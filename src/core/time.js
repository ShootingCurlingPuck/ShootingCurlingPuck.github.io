import { TZ, OPEN_H, CLOSE_H } from "../config.js";
import { FORCE, QS } from "./params.js";
import { state } from "./state.js";

// Device time corrected by the server's clock
export const nowMs = () => Date.now() + state.clockOffset;

export function parseUtc(s) {
  if (!/[zZ]$|[+-]\d\d:\d\d$/.test(s)) s += "Z";
  return new Date(s.replace(/(\.\d{3})\d+/, "$1")); // Graph sends 7 fractional digits
}

// "14:05" in Brussels time
export function fmt(d) {
  return d.toLocaleTimeString("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

export const dayKey = (d) => d.toLocaleDateString("en-GB", { timeZone: TZ });

export function isStandby(now) {
  if (FORCE === "standby") return true;
  if (FORCE === "live") return false;
  // Two plain calls instead of formatToParts (missing on old engines)
  const weekday = now.toLocaleDateString("en-GB", {
    timeZone: TZ,
    weekday: "short",
  });
  const h =
    parseInt(
      now.toLocaleTimeString("en-GB", {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
      }),
      10,
    ) % 24;
  return weekday === "Sat" || weekday === "Sun" || h < OPEN_H || h >= CLOSE_H;
}

// The scene's clock: the real time, unless a test switch pretends another day or time of day:
// ?date=2026-11-25 (that day, Brussels date) and/or ?time=17:40 (that time of day), then it runs on.
// Everything on screen follows it: the clock and date, live/standby, the sky, the season, the theme,
// the daily layouts and the weather (forecast or history for that hour, see weather/weather.js).
// The room data can't: the feed only has today's bookings, so the rooms show today's bookings as
// they'd be at the pretend time of day (roomNow).
const minutesOf = (ms) => {
  const hm = fmt(new Date(ms)).split(":");
  return +hm[0] * 60 + +hm[1];
};
let shifts = null;
function shiftsFor() {
  const now = nowMs();
  const today = dayKey(new Date(now)); // dd/mm/yyyy, Brussels
  let target = today,
    days = 0;
  const day = /^(\d{4})-(\d\d)-(\d\d)$/.exec(QS.get("date") || "");
  if (day) {
    target = day[3] + "/" + day[2] + "/" + day[1];
    const t = today.split("/");
    days =
      Math.round(
        (Date.UTC(+day[1], +day[2] - 1, +day[3]) - Date.UTC(+t[2], +t[1] - 1, +t[0])) / 86400000,
      ) * 86400000;
  }
  const asked = /^(\d\d?):(\d\d)$/.exec(QS.get("time") || "");
  const wanted = asked ? +asked[1] * 60 + +asked[2] : minutesOf(now);
  // the wanted clock time on the wanted day (whole days alone can land an hour off, even on the
  // day next to it, across a summer-time change)
  const guess = days + (wanted - minutesOf(now + days)) * 60000;
  let scene = guess;
  [0, -86400000, 86400000].some((k) => {
    if (dayKey(new Date(now + guess + k)) !== target) return false;
    scene = guess + k;
    return true;
  });
  return { scene: scene, rooms: asked ? (wanted - minutesOf(now)) * 60000 : 0 };
}
function shifts_() {
  if (!shifts) shifts = shiftsFor();
  return shifts;
}
export const sceneNow = () => nowMs() + shifts_().scene;
export const roomNow = () => nowMs() + shifts_().rooms;
export const scenePretend = () => shifts_().scene !== 0; // a test switch moved the clock
