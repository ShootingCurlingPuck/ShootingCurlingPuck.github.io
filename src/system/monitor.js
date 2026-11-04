// Watches the screen's health on the TV and sends a notification (ntfy) when something breaks:
//   - after a crash, a freeze or a power cut: on the next start, when and how the previous run
//     ended, with the last lines of its trail (core/debug.js);
//   - a script error;
//   - the frame rate stuck very low for several minutes;
//   - the drawing or the memory growing far beyond where it settled after the start;
//   - the page reloading over and over.
// Only the TV reports (its browser says Tizen); a laptop or phone looking at the site doesn't.
// ?device=tv or ?device=other overrides that, e.g. to try the reports from a laptop. ?monitor=test
// sends a test notification at start.
// The messages only ever hold the screen's health (frame rate, memory, errors, what it was doing),
// never room bookings: the topic is in this public code, so anyone could read them.
// Each kind of report goes out at most once per MONITOR.quiet, and at most MONITOR.perDay a day
// (the test excepted).
import { MONITOR } from "../config.js";
import { QS } from "../core/params.js";
import { crumb, previousTrail, currentTrail, setStats } from "../core/debug.js";
import { fpsNow, detail } from "../core/perf.js";

const device = QS.get("device");
const isTV =
  device === "tv" ||
  (device !== "other" && /Tizen|SMART-TV|SmartTV|Web0S|webOS/i.test(navigator.userAgent));

const STORE = "room-status-monitor";
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "{}");
  } catch (e) {
    return {};
  }
}
function save(m) {
  try {
    localStorage.setItem(STORE, JSON.stringify(m));
  } catch (e) {
    // storage full or blocked: then it may send a little more often, nothing worse
  }
}

// Send one notification. kind: which check (for the rate limits); title, text; urgent: high priority
function send(kind, title, text, urgent) {
  if (!isTV || !MONITOR.ntfy) return;
  // the test (?monitor=test) always goes out, and doesn't count towards the limits
  if (kind !== "test") {
    const m = load();
    const now = Date.now();
    m.sent = (m.sent || []).filter((t) => now - t < 86400000);
    m.last = m.last || {};
    if (m.last[kind] && now - m.last[kind] < MONITOR.quiet) return;
    if (m.sent.length >= MONITOR.perDay) return;
    m.last[kind] = now;
    m.sent.push(now);
    save(m);
  }
  crumb("monitor: sent " + kind);
  // a plain-text POST with the title and priority in the address: a "simple" request, which any
  // browser may send anywhere (no-cors: we don't need to read the answer)
  const url =
    MONITOR.ntfy +
    "?title=" + encodeURIComponent("Room screen: " + title) +
    "&priority=" + (urgent ? "high" : "default") +
    "&tags=" + (urgent ? "rotating_light" : "warning");
  try {
    fetch(url, { method: "POST", mode: "no-cors", body: text }).catch(() => {});
  } catch (e) {
    // no fetch: nothing to do
  }
}

const tail = (lines, n) => lines.slice(Math.max(0, lines.length - n)).join("\n");
// "+123.4s ..." lines after a "start <ISO time>" first line: the time of the last line
function lastTime(lines) {
  const start = /start (\S+)/.exec(lines[0] || "");
  const last = /^\+([\d.]+)s/.exec(lines[lines.length - 1] || "");
  if (!start || !last) return null;
  return new Date(new Date(start[1]).getTime() + parseFloat(last[1]) * 1000);
}
const clock = (d) =>
  d.toLocaleString("en-GB", { timeZone: "Europe/Brussels", weekday: "short", hour: "2-digit", minute: "2-digit" });

export function startMonitor() {
  // the heartbeat lines in the trail carry the frame rate and detail level
  setStats(() => "fps " + fpsNow().toFixed(1) + ", detail " + detail().toFixed(2));
  crumb("monitor: " + (isTV ? "this is the TV, reporting" : "not the TV, not reporting"));

  // ---- How the previous run ended ----
  // (a trail from before the monitor existed has no end lines at all: says nothing)
  const prev = previousTrail();
  const ended = prev.length && /end: /.test(prev[prev.length - 1]);
  const knows = prev.some((l) => /monitor: /.test(l));
  if (prev.length > 1 && knows && !ended) {
    const when = lastTime(prev);
    send(
      "stopped",
      "stopped unexpectedly",
      "The previous run stopped without a planned reload (a crash, a freeze, or the TV was switched off)." +
        (when ? "\nLast sign of life: " + clock(when) + "." : "") +
        "\nRestarted: " + clock(new Date()) + ".\n\nIts last lines:\n" + tail(prev, MONITOR.lines),
      true,
    );
  }

  // ---- Reloading over and over ----
  const m = load();
  const now = Date.now();
  m.loads = (m.loads || []).filter((t) => now - t < MONITOR.loopWindow).concat([now]);
  save(m);
  if (m.loads.length > MONITOR.loopLoads)
    send("reloads", "keeps reloading", m.loads.length + " starts in the last " + Math.round(MONITOR.loopWindow / 60000) + " minutes.\n\n" + tail(currentTrail(), 10), true);

  // ---- Script errors ----
  window.addEventListener("error", (e) =>
    send("error", "script error", (e.message || "error") + (e.filename ? "\n" + e.filename + ":" + e.lineno : "") + "\n\n" + tail(currentTrail(), 10)),
  );
  window.addEventListener("unhandledrejection", (e) =>
    send("error", "script error", "Unhandled: " + (e.reason && (e.reason.message || e.reason)) + "\n\n" + tail(currentTrail(), 10)),
  );

  // ---- Frame rate, drawing, memory: checked every minute ----
  const nodes = () => document.getElementsByTagName("*").length;
  const heap = () => (performance.memory ? performance.memory.usedJSHeapSize / 1e6 : 0);
  let slow = 0,
    base = null;
  setTimeout(() => (base = { nodes: nodes(), heap: heap() }), MONITOR.settle);
  setInterval(() => {
    // stuck very low: a few minutes in a row (a short dip is normal)
    slow = fpsNow() < MONITOR.lowFps ? slow + 1 : 0;
    if (slow >= MONITOR.lowMinutes)
      send("slow", "very slow", "Under " + MONITOR.lowFps + " fps for " + slow + " minutes (now " + fpsNow().toFixed(1) + ").\n\n" + tail(currentTrail(), 12));
    if (!base) return;
    const n = nodes(),
      h = heap();
    if (n > base.nodes + MONITOR.nodesGrowth)
      send("growing", "drawing keeps growing", "Drawn elements: " + n + " (" + base.nodes + " after the start).\n\n" + tail(currentTrail(), 12));
    if (base.heap && h > base.heap * MONITOR.heapGrowth)
      send("memory", "memory keeps growing", "Memory: " + Math.round(h) + " MB (" + Math.round(base.heap) + " MB after the start).\n\n" + tail(currentTrail(), 12));
  }, 60000);

  if (QS.get("monitor") === "test")
    send("test", "test", "A test from " + (isTV ? "the TV" : "a device that isn't the TV (?device=tv)") + ", " + clock(new Date()) + ".\n\n" + tail(currentTrail(), 5));
}

// For the parts of the screen that catch their own errors (a theme part that fails): report it too
export function trouble(msg) {
  send("error", "part failed", msg + "\n\n" + tail(currentTrail(), 10));
}
