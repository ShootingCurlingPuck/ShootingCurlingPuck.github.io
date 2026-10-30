// Self-adjusting detail level for animations, so the old TV never stutters.
// The animation loop reports every frame; when the frame rate drops below PERF.low, the shared
// detail level (0..1) goes down, and when there's headroom again it slowly comes back up.
// Animations scale how much they draw with detail(): fewer leaves, fewer raindrops, ...
// Test switches: ?detail=0.3 (fixed level), ?debug=1 (fps and detail readout, bottom left)
import { QS } from "./params.js";
import { PERF } from "../config.js";

const asked = parseFloat(QS.get("detail"));
const fixed = isNaN(asked) ? null : Math.max(0, Math.min(1, asked));
let level = fixed !== null ? fixed : 1;
let fps = PERF.target;

// Called by the animation loop with the real time between two drawn frames, in ms
export function measure(gapMs) {
  if (gapMs > 500) return; // the TV slept or the tab was hidden: says nothing about load
  fps += (1000 / gapMs - fps) * 0.05; // smoothed over the last couple of seconds
  if (fixed !== null) return;
  const dt = gapMs / 1000;
  if (fps < PERF.low) level -= PERF.down * dt;
  else if (fps > PERF.high) level += PERF.up * dt;
  level = Math.max(PERF.min, Math.min(1, level));
}

export const detail = () => level;

// "n things at full detail" scaled to the current level, never below `least`
export const scaled = (n, least) =>
  Math.max(least === undefined ? 1 : least, Math.round(n * level));

if (QS.get("debug")) {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;left:0;bottom:0;z-index:9;padding:4px 8px;background:#fff;color:#000;font:20px monospace";
  document.body.appendChild(box);
  setInterval(() => {
    box.textContent = `fps ${fps.toFixed(1)}  detail ${level.toFixed(2)}`;
  }, 500);
}
