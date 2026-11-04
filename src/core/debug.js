import { QS } from "./params.js";

// On-screen error log for TVs without devtools. Only active with ?debug=1
export let debugLog = () => {};
if (QS.get("debug")) {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;left:0;top:0;max-width:60vw;max-height:40vh;overflow:hidden;z-index:9;padding:6px;background:rgba(255,255,255,0.85);color:#c00;font:14px monospace;white-space:pre-wrap";
  document.body.appendChild(box);
  // Only the latest lines, so the box never covers more than a corner of the screen
  debugLog = (m) => {
    const lines = (box.textContent + m + "\n").split("\n");
    box.textContent = lines.slice(Math.max(0, lines.length - 25)).join("\n");
  };
  window.onerror = (m, src, line) => debugLog(m + " (line " + line + ")");
}

// Crash trail: milestones saved in the browser's storage as the page runs (always, also without
// ?debug=1). A crashed or frozen page can't show anything, but the next load can: with ?debug=1 it
// shows how far the previous run got, and when, and system/monitor.js reports it (on the TV).
// Every minute a heartbeat line: frame rate, detail level, drawn elements, memory, and how many of
// each counted event happened since the last one (meteors, ...). A planned reload ends the trail
// with an "end:" line, so the next load can tell a planned end from a crash or a freeze.
const KEY = "room-status-trail";
const t0 = Date.now();
let trail = [];
let previous = [];
try {
  previous = JSON.parse(localStorage.getItem(KEY) || "[]");
} catch (e) {
  previous = [];
}
const nodes = () => document.getElementsByTagName("*").length;
export function crumb(msg) {
  const line =
    "+" + ((Date.now() - t0) / 1000).toFixed(1) + "s " + msg + " (" + nodes() + " nodes)";
  trail.push(line);
  if (trail.length > 90) trail.splice(1, 1); // keep the first line (when it started)
  try {
    localStorage.setItem(KEY, JSON.stringify(trail));
  } catch (e) {
    // storage full or blocked: nothing to do
  }
  if (QS.get("debug")) debugLog(line);
}
if (QS.get("debug"))
  debugLog(
    previous.length
      ? "Previous run got to:\n  " + previous.join("\n  ") + "\nThis run:"
      : "No previous run saved. This run:",
  );
crumb("start " + new Date(t0).toISOString() + " " + location.search);

// The previous run's trail, as it was at load
export const previousTrail = () => previous;
// This run's trail so far
export const currentTrail = () => trail;
// A planned end (a reload): the last line of the trail
export function endRun(why) {
  crumb("end: " + why);
}

// Events counted per heartbeat (frequent ones, which would flood the trail one line each)
const counts = {};
export function count(name) {
  counts[name] = (counts[name] || 0) + 1;
}

// Heartbeat: every 15 s for the first 2 minutes, then every minute. stats(): the frame rate and
// detail level (from core/perf.js, set by setStats to avoid a loop between the two modules)
let stats = () => "";
export const setStats = (fn) => (stats = fn);
let beats = 0;
function beat() {
  beats++;
  const mem =
    performance.memory && performance.memory.usedJSHeapSize
      ? ", JS " + Math.round(performance.memory.usedJSHeapSize / 1e6) + " MB"
      : "";
  const events = Object.keys(counts)
    .map((k) => k + " " + counts[k])
    .join(", ");
  Object.keys(counts).forEach((k) => delete counts[k]);
  crumb("alive " + stats() + mem + (events ? ", " + events : ""));
  setTimeout(beat, beats < 8 ? 15000 : 60000);
}
setTimeout(beat, 15000);
