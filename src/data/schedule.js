// Room bookings from the Power Automate flow, and what they mean right now
import { DATA_URL, FETCH_TIMEOUT_MS, SOON_MIN } from "../config.js";
import { state } from "../core/state.js";
import { parseUtc } from "../core/time.js";
import { debugLog } from "../core/debug.js";

// fetch + JSON with a hard timeout. AbortController is optional (missing on old engines).
export function fetchJson(url, ms) {
  return new Promise((resolve, reject) => {
    const ctl = typeof AbortController === "function" ? new AbortController() : null;
    const timer = setTimeout(() => {
      if (ctl) ctl.abort();
      reject(new Error("Timeout"));
    }, ms);
    fetch(url, { cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(
        (d) => {
          clearTimeout(timer);
          resolve(d);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        }
      );
  });
}

// Fetch the schedules; calls done() afterwards, success or not
export function load(done) {
  if (state.standby) return;
  // "&_=" defeats HTTP caching on engines that ignore cache: "no-store"
  fetchJson(DATA_URL + "&_=" + Date.now(), FETCH_TIMEOUT_MS)
    .then((data) => {
      if (data.generatedAt) {
        const off = parseUtc(data.generatedAt).getTime() - Date.now();
        state.clockOffset = Math.abs(off) > 5000 ? off : 0; // ignore normal jitter
      }
      const list = data.value || (data.schedule && data.schedule.value);
      if (!Array.isArray(list)) throw new Error("Unexpected response");
      if (state.standby) return;
      state.lastData = new Map(list.map((s) => [String(s.scheduleId).toLowerCase(), s]));
      state.lastOk = Date.now();
      state.errMsg = "";
    })
    .catch((e) => {
      state.errMsg = "Room data unavailable";
      console.error(e);
      debugLog(String(e));
    })
    .then(done);
}

// { state: "free" | "soon" | "busy" | "nodata", until?: Date }
export function roomState(sched, now) {
  if (!sched || sched.error) return { state: "nodata" };
  const iv = (sched.scheduleItems || [])
    .filter((i) => i.status !== "free")
    .map((i) => [parseUtc(i.start.dateTime).getTime(), parseUtc(i.end.dateTime).getTime()])
    .sort((a, b) => a[0] - b[0]);
  const merged = []; // merge touching/overlapping bookings
  for (const [s, e] of iv) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  const t = now.getTime();
  const cur = merged.find(([s, e]) => t >= s && t < e);
  if (cur) return { state: "busy", until: new Date(cur[1]) };
  const next = merged.find(([s]) => s > t);
  if (!next) return { state: "free" };
  return { state: (next[0] - t) / 60000 <= SOON_MIN ? "soon" : "free", until: new Date(next[0]) };
}
