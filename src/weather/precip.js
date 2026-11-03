// Precipitation, from the live weather, for everything (whatever the season). This part decides how
// much is coming down and where, and whether it's rain or snow (one at a time: when the weather
// turns, the one dies down before the other starts). How each looks and moves is a "kind":
// rain streaks (weather/streaks.js) and snowflakes (weather/snow.js) by default; a theme may bring
// its own with setKind. A kind is a function (layer, api) => { frame(dt), remove() }, with api:
//   amount()   how hard it's coming down now, 0..1 (eases towards the weather in about a minute)
//   slope()    sideways per downward movement, from the wind (sign = wind direction)
//   startX()   an x to start a particle from, under a visible cloud; null if there's no cloud
//              (then nothing comes down: never from a clear sky)
//   landAt(x)  the y where a particle that falls at x lands on the ground
//   groundAt(x), depth()  the ground's surface at x, and how far below it things may land
//   underCloud(x)  whether something may start at x now (under a visible cloud)
//   wind       the wind service (or null)
//   settle     snow settling (or null): catchFlake(x, y0, y1, size), landFlake(x, size), groundAt(x)
//   detail()   the shared animation detail level (core/perf.js), 0..1
//   geo, isStandby()
// Test switches: ?rain=0..1, ?snow=0..1 (pretend amount; ?weather=drizzle|rain|heavy|snow works too)
import { el } from "../core/svg.js";
import { QS } from "../core/params.js";
import { RAIN, SNOW } from "../config.js";
import { everyFrame } from "../core/anim.js";
import { detail } from "../core/perf.js";
import { startStreaks } from "./streaks.js";
import { startSnow } from "./snow.js";

// clouds (optional): it only comes down from under them (see clouds.js coverAt)
export function startPrecip(layer, scene, wind, clouds) {
  const { VIEW, VR, VB } = scene.geo;
  const forced = parseFloat(QS.get("rain")),
    forcedSnow = parseFloat(QS.get("snow"));
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  // Rain or snow, by the weather
  const wantType = () => {
    if (!isNaN(forcedSnow)) return "snow";
    if (!isNaN(forced)) return "rain";
    const w = scene.weather();
    return w && w.precip === "snow" ? "snow" : "rain";
  };
  // 0..1 from the weather. Rain: drizzle a little, rain more, heavy (and thunder) the most; within
  // each kind, more millimetres per hour = more. Snow: by centimetres per hour (SNOW.levels).
  // While the weather turns from one to the other, the one that's falling dies down first.
  function target() {
    if (wantType() !== type) return 0;
    if (!isNaN(forcedSnow)) return clamp01(forcedSnow);
    if (!isNaN(forced)) return clamp01(forced);
    const w = scene.weather();
    if (!w) return 0;
    if (type === "snow") {
      const L = SNOW.levels,
        cm = w.snowCm || 0;
      for (let i = 1; i < L.length; i++)
        if (cm <= L[i][0]) return L[i - 1][1] + ((cm - L[i - 1][0]) / (L[i][0] - L[i - 1][0])) * (L[i][1] - L[i - 1][1]);
      return L[L.length - 1][1];
    }
    const r = RAIN.levels[w.precip];
    if (!r) return 0; // none
    const mm = Math.max(r.mm[0], Math.min(r.mm[1], w.mmPerHour || r.mm[0]));
    return (
      r.amount[0] +
      ((mm - r.mm[0]) / (r.mm[1] - r.mm[0] || 1)) * (r.amount[1] - r.amount[0])
    );
  }
  let t = 0,
    type = "rain";
  const kinds = { rain: startStreaks, snow: startSnow };
  let amount = 0;

  // The ground: a flat line near the bottom unless a theme says where its ground is
  let ground = () => VB - 20,
    depth = 0; // how far below the ground's surface things may land (e.g. into a leaf pile)

  const slope = () => {
    const k = wind ? wind.strength() + 0.5 * wind.gust() : 0;
    return (wind ? wind.dir() : -1) * RAIN.slant * Math.min(1.2, k);
  };
  const api = {
    geo: scene.geo,
    isStandby: scene.isStandby,
    amount: () => amount,
    slope: slope,
    detail: detail,
    startX() {
      // start further upwind the more it slants, so the whole width gets some; only from under
      // a visible cloud (a few tries to find one), unless the clouds are switched off
      const sl = slope();
      const spread = VIEW.w + Math.abs(sl) * VIEW.h;
      const from = sl < 0 ? VIEW.x : VIEW.x - Math.abs(sl) * VIEW.h;
      for (let i = 0; i < 12; i++) {
        const x = from + Math.random() * spread;
        if (!clouds || Math.random() < clouds.coverAt(x)) return x;
      }
      return null;
    },
    landAt: (x) =>
      ground(Math.max(VIEW.x, Math.min(VR, x))) + Math.random() * depth,
    groundAt: (x) => ground(Math.max(VIEW.x, Math.min(VR, x))),
    // whether something may come down at x now: only from under a visible cloud (by how much cloud
    // there is), unless the clouds are switched off
    underCloud: (x) => !clouds || Math.random() < clouds.coverAt(x),
    depth: () => depth,
    wind: wind || null,
    settle: null, // snow settling, if any (see weather/settle.js and setSettle)
  };

  const g = el("g", { class: "precip" }, layer);
  let kind = null;
  function use(newType) {
    if (kind) kind.remove();
    type = newType;
    kind = kinds[type](g, api);
  }
  use(wantType());
  amount = target();
  scene.on("weather", () => {
    // the first weather after loading: no fade (and straight to rain or snow)
    if (t >= 15) return;
    if (wantType() !== type) use(wantType());
    amount = target();
  });

  everyFrame((now, dt) => {
    t += dt;
    // the weather turned (rain to snow or back): once the old one has died down, the new one starts
    if (wantType() !== type && amount < 0.02) use(wantType());
    amount += (target() - amount) * Math.min(1, dt / RAIN.ease);
    kind.frame(dt);
  });

  return {
    amount: () => amount,
    // where the ground is: ground(x) gives its surface's y at x; things land up to `below` deeper
    setGround(fn, below) {
      ground = fn;
      depth = below || 0;
    },
    // swap how rain or snow looks and moves (see the top of this file); which: "rain" (default) or
    // "snow"; start null goes back to the general one
    setKind(start, which) {
      const w = which === "snow" ? "snow" : "rain";
      kinds[w] = start || (w === "snow" ? startSnow : startStreaks);
      if (w === type) use(type);
    },
    kind: () => type, // "rain" or "snow"
    ground: () => ground, // the ground's surface: a function of x (see setGround)
    // snow settling (weather/settle.js): falling snow lies down on what it meets there
    setSettle(s) {
      api.settle = s;
    },
  };
}
