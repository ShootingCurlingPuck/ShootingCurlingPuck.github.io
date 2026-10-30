import { QS } from "./params.js";

// On-screen error log for TVs without devtools. Only active with ?debug=1
export let debugLog = () => {};
if (QS.get("debug")) {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;left:0;top:0;right:0;z-index:9;padding:8px;background:#fff;color:#c00;font:20px monospace;white-space:pre-wrap";
  document.body.appendChild(box);
  debugLog = (m) => {
    box.textContent += m + "\n";
  };
  window.onerror = (m, src, line) => debugLog(m + " (line " + line + ")");
}

// Crash trail: milestones saved in the browser's storage as the page runs (always, also without
// ?debug=1). A crashed page can't show anything, but the next load can: with ?debug=1 it shows how
// far the previous run got, and when.
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
  if (trail.length > 60) trail.splice(1, 1); // keep the first line (when it started)
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

// Heartbeat: every 15 s for the first 2 minutes, then every minute
let beats = 0;
function beat() {
  beats++;
  const mem =
    performance.memory && performance.memory.usedJSHeapSize
      ? ", JS " + Math.round(performance.memory.usedJSHeapSize / 1e6) + " MB"
      : "";
  crumb("alive" + mem);
  setTimeout(beat, beats < 8 ? 15000 : 60000);
}
setTimeout(beat, 15000);
