// Sprite sheets: SVG files with shapes that get copied into the page's <defs>, to be used with <use>.
import { defs } from "./svg.js";

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
