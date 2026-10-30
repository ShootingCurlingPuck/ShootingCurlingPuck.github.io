// The one shared animation loop, plus small helpers used by the weather and the themes.
import { measure } from "./perf.js";
import { crumb } from "./debug.js";

// One shared animation loop for everything that moves (weather, themes), at about 30 fps (plenty, and kind to the TV).
// fn(now, dt): now in ms (performance clock), dt in seconds since the last frame, capped at 0.1 so
// nothing jumps after the TV slept. Frame times feed the shared detail level (core/perf.js).
const frameFns = [];
let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (now - last < 30) return;
  if (last) measure(now - last);
  else crumb("first animation frame");
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
  last = now;
  frameFns.forEach((fn) => fn(now, dt));
}
export function everyFrame(fn) {
  if (!frameFns.length) requestAnimationFrame(frame);
  frameFns.push(fn);
}

// Same numbers all day, new ones tomorrow: a scene doesn't jump on a reload
export function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++)
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return function () {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mix a colour towards another (solid result, no transparency): t = 0 keeps a, 1 gives b
export function mix(a, b, t) {
  const ca = parseInt(a.slice(1), 16),
    cb = parseInt(b.slice(1), 16);
  const ch = (sh) => {
    const x = (ca >> sh) & 255,
      y = (cb >> sh) & 255;
    return Math.round(x + (y - x) * t);
  };
  return (
    "#" +
    ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)
  );
}
