// Room name inside each tile
import { NAME_F } from "../config.js";
import { fit, inkMid } from "../core/text.js";

export function layoutRoom(r) {
  const cx = r.x + r.w / 2,
    cy = r.y + r.h / 2,
    maxW = r.w * 0.8;
  if (r.booth) {
    const fs = Math.min(r.w, r.h) * 0.8;
    r.nameEl.textContent = r.name;
    r.nameEl.style.dominantBaseline = "alphabetic";
    r.nameEl.setAttribute("x", cx);
    r.nameEl.setAttribute("y", cy + inkMid(r.name, fs));
    r.nameEl.setAttribute("font-size", fs);
    return;
  }
  r.nameEl.textContent = r.name;
  r.nameEl.setAttribute("x", cx);
  r.nameEl.setAttribute("y", cy);
  r.nameEl.setAttribute("font-size", fit(r.name, maxW, NAME_F));
}
