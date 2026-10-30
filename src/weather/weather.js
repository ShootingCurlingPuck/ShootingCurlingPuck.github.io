// Live weather for the office, from Open-Meteo (no key needed). Fetched every 15 minutes, in live
// and standby alike, and turned into one simple description that themes can use:
//
//   { tempC, sky: "clear" | "partly" | "cloudy" | "overcast", cloud: 0-100,
//     precip: "none" | "drizzle" | "rain" | "heavy" | "snow" | "thunder", mmPerHour,
//     wind: km/h, gusts: km/h, windFrom: degrees (0 = from the north), fog: boolean,
//     isDay: boolean, code: WMO weather code, at: Date (when it was measured) }
//
// getWeather() returns the latest one, or null when there's none (yet) or it's too old.
// A "weather" event fires on every successful update.
// Test switch: ?weather=clear|partly|cloudy|overcast|drizzle|rain|heavy|snow|thunder|fog|windy
// (or a change, e.g. ?weather=heavy>clear: switches every 30 seconds)
import {
  WEATHER_AT,
  WEATHER_EVERY_MS,
  WEATHER_STALE_MS,
  FETCH_TIMEOUT_MS,
} from "../config.js";
import { QS } from "../core/params.js";
import { emit } from "../core/events.js";
import { debugLog } from "../core/debug.js";
import { fetchJson } from "../data/schedule.js";
import { parseUtc } from "../core/time.js";

const FIELDS = [
  "temperature_2m",
  "is_day",
  "precipitation",
  "rain",
  "showers",
  "snowfall",
  "weather_code",
  "cloud_cover",
  "visibility",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
];
const URL =
  "https://api.open-meteo.com/v1/forecast?latitude=" +
  WEATHER_AT.lat +
  "&longitude=" +
  WEATHER_AT.lon +
  "&current=" +
  FIELDS.join(","); // times come back in GMT, without a zone; parseUtc reads them as such

let latest = null;

export function getWeather() {
  if (!latest) return null;
  if (!latest.forced && Date.now() - latest.fetched > WEATHER_STALE_MS)
    return null;
  return latest;
}

// WMO weather codes: https://open-meteo.com/en/docs (section "WMO Weather interpretation codes")
function describe(c) {
  const num = (v) => (typeof v === "number" ? v : 0);
  const code = num(c.weather_code);
  const cloud = num(c.cloud_cover);
  const mm = num(c.rain) + num(c.showers);
  const snowCm = num(c.snowfall);
  let precip = "none";
  if (code >= 95) precip = "thunder";
  else if (
    (code >= 71 && code <= 77) ||
    code === 85 ||
    code === 86 ||
    snowCm > 0
  )
    precip = "snow";
  else if (code === 65 || code === 67 || code === 82 || mm >= 4)
    precip = "heavy";
  else if (
    (code >= 61 && code <= 66) ||
    code === 80 ||
    code === 81 ||
    mm >= 0.5
  )
    precip = "rain";
  else if ((code >= 51 && code <= 57) || mm > 0) precip = "drizzle";
  const sky =
    cloud < 20
      ? "clear"
      : cloud < 50
        ? "partly"
        : cloud < 85
          ? "cloudy"
          : "overcast";
  return {
    tempC: typeof c.temperature_2m === "number" ? c.temperature_2m : null,
    sky: sky,
    cloud: cloud,
    precip: precip,
    mmPerHour: num(c.precipitation) || mm,
    wind: num(c.wind_speed_10m),
    gusts: num(c.wind_gusts_10m),
    windFrom: num(c.wind_direction_10m),
    fog:
      code === 45 ||
      code === 48 ||
      (typeof c.visibility === "number" && c.visibility < 1000),
    isDay: c.is_day !== 0,
    code: code,
    at: c.time ? parseUtc(c.time) : new Date(),
  };
}

// Pretend weather for testing (?weather=...)
const FORCED = {
  clear: { cloud: 5 },
  partly: { cloud: 35 },
  cloudy: { cloud: 70 },
  overcast: { cloud: 95 },
  drizzle: { cloud: 90, weather_code: 51, rain: 0.2 },
  rain: { cloud: 95, weather_code: 63, rain: 2 },
  heavy: { cloud: 100, weather_code: 65, rain: 8 },
  snow: { cloud: 100, weather_code: 73, snowfall: 0.5 },
  thunder: { cloud: 100, weather_code: 95, rain: 6 },
  fog: { cloud: 100, weather_code: 45, visibility: 300 },
  windy: { cloud: 60, wind: 45, gusts: 75 },
};

function summary(w) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return (
    w.sky +
    (w.precip !== "none" ? ", " + w.precip + " " + w.mmPerHour + " mm/h" : "") +
    (w.fog ? ", fog" : "") +
    ", wind " +
    Math.round(w.wind) +
    " km/h (gusts " +
    Math.round(w.gusts) +
    ") from " +
    dirs[Math.round(w.windFrom / 45) % 8] +
    (w.tempC !== null ? ", " + w.tempC + " C" : "")
  );
}

function update() {
  fetchJson(URL, FETCH_TIMEOUT_MS)
    .then((data) => {
      if (!data || !data.current)
        throw new Error("Unexpected weather response");
      latest = describe(data.current);
      latest.fetched = Date.now();
      debugLog("Weather: " + summary(latest));
      emit("weather", latest);
    })
    .catch((e) => debugLog("Weather unavailable: " + e));
}

// Pretend weather: ?weather=rain, or a change to test fades: ?weather=heavy>clear switches after
// 30 seconds (as many steps as you like: ?weather=clear>rain>clear)
function forceWeather(name) {
  const c = FORCED[name];
  latest = describe({
    cloud_cover: c.cloud,
    weather_code:
      c.weather_code ||
      (c.cloud > 85 ? 3 : c.cloud > 50 ? 2 : c.cloud > 20 ? 1 : 0),
    rain: c.rain,
    snowfall: c.snowfall,
    visibility: c.visibility,
    wind_speed_10m: c.wind || 12,
    wind_gusts_10m: c.gusts || 25,
    wind_direction_10m: 225,
    temperature_2m: 10,
    is_day: 1,
  });
  latest.forced = true;
  latest.fetched = Date.now();
  debugLog("Weather (forced): " + summary(latest));
  emit("weather", latest);
}

export function startWeather() {
  const steps = (QS.get("weather") || "").split(">").filter((n) => FORCED[n]);
  if (steps.length) {
    steps.forEach((name, i) => setTimeout(() => forceWeather(name), i * 30000));
    return;
  }
  update();
  setInterval(update, WEATHER_EVERY_MS);
}
