// Shared helpers for seasonal themes: seeded randomness, colours, and the sprite sheet loader.
import { defs } from "../core/svg.js";

export const INK = "#000000"; // outline base colour (same as the brand ink)

// Same numbers all day, new ones tomorrow: a scene doesn't jump on a reload
export function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return function () {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Weighted choice from [[item, weight], ...]
export function pick(rnd, list) {
  let total = 0;
  list.forEach((e) => (total += e[1]));
  let r = rnd() * total;
  for (let i = 0; i < list.length; i++) if ((r -= list[i][1]) < 0) return list[i][0];
  return list[list.length - 1][0];
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
  return "#" + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
}

// Nudge every number in a path a little, so copies of a shape are never perfectly identical
export function roughen(d, rnd, amt) {
  return d.replace(/-?\d+(\.\d+)?/g, (n) => (+n + (rnd() - 0.5) * 2 * amt).toFixed(1));
}

// Load a sprite sheet and copy every element whose id has one of the prefixes into <defs>.
// Resolves when done; rejects if the file can't be loaded.
export function loadSprites(url, prefixes) {
  return fetch(url + "?v=" + Date.now(), { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status + " for " + url);
      return res.text();
    })
    .then((text) => {
      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      const found = doc.querySelectorAll("[id]");
      for (let i = 0; i < found.length; i++) {
        const n = found[i];
        if (prefixes.some((p) => n.getAttribute("id").indexOf(p) === 0)) defs.appendChild(document.importNode(n, true));
      }
    });
}

// Make n roughened copies of a shape already in <defs> (id-0, id-1, ...). Paths are roughened in the
// order of `amounts` ({ className: amount }), each copy with its own fixed seed.
export function roughCopies(id, n, amounts) {
  const base = document.getElementById(id);
  for (let v = 0; v < n; v++) {
    const copy = base.cloneNode(true);
    copy.setAttribute("id", id + "-" + v);
    const r = seeded(id.replace(/^[a-z]+-/, "") + v);
    Object.keys(amounts).forEach((cls) => {
      const p = copy.querySelector("." + cls);
      if (p) p.setAttribute("d", roughen(p.getAttribute("d"), r, amounts[cls]));
    });
    defs.appendChild(copy);
  }
}

// One shared animation loop for all moving theme parts, at about 30 fps (plenty, and kind to the TV).
// fn(now, dt): now in ms (performance clock), dt in seconds since the last frame, capped at 0.1 so
// nothing jumps after the TV slept.
const frameFns = [];
let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (now - last < 30) return;
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
  last = now;
  frameFns.forEach((fn) => fn(now, dt));
}
export function everyFrame(fn) {
  if (!frameFns.length) requestAnimationFrame(frame);
  frameFns.push(fn);
}

// Random whole number from min to max (inclusive)
export const randInt = (rnd, min, max) => min + Math.floor(rnd() * (max - min + 1));
