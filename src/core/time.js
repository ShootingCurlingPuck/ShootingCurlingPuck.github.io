import { TZ, OPEN_H, CLOSE_H } from "../config.js";
import { FORCE } from "./params.js";
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
