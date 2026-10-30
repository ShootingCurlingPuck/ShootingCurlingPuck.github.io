// Shared helpers for seasonal themes: seeded randomness, colours, and the sprite sheet loader.
import { defs } from "../core/svg.js";
import { seeded } from "../core/anim.js";
// so theme parts find everything here
export { detail, scaled } from "../core/perf.js";
export { everyFrame, seeded, mix } from "../core/anim.js";

export const INK = "#000000"; // outline base colour (same as the brand ink)

// Weighted choice from [[item, weight], ...]
export function pick(rnd, list) {
  let total = 0;
  list.forEach((e) => (total += e[1]));
  let r = rnd() * total;
  for (let i = 0; i < list.length; i++)
    if ((r -= list[i][1]) < 0) return list[i][0];
  return list[list.length - 1][0];
}

// Nudge every number in a path a little, so copies of a shape are never perfectly identical
export function roughen(d, rnd, amt) {
  return d.replace(/-?\d+(\.\d+)?/g, (n) =>
    (+n + (rnd() - 0.5) * 2 * amt).toFixed(1),
  );
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
        if (prefixes.some((p) => n.getAttribute("id").indexOf(p) === 0))
          defs.appendChild(document.importNode(n, true));
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

// Random whole number from min to max (inclusive)
export const randInt = (rnd, min, max) =>
  min + Math.floor(rnd() * (max - min + 1));

// Add CSS for a theme (e.g. animations the browser runs smoothly by itself)
export function addStyle(css) {
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);
}
