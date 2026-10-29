// Seasonal themes: picks one by date and starts it with a "scene" (its layer, the geometry it may
// use, spots it must keep clear, and whether we're in standby). Themes never touch the plan itself.
// Date ranges are DD-MM and may wrap the new year. Force one with ?theme=fall|winter|none
import { TZ } from "../config.js";
import { QS } from "../core/params.js";
import { nowMs } from "../core/time.js";
import { svg } from "../core/svg.js";
import startFall from "./fall/index.js";
import startWinter from "./winter/index.js";

const THEMES = {
  fall: { from: "01-10", to: "30-11", start: startFall },
  winter: { from: "01-12", to: "29-02", start: startWinter },
};

let THEME = null;
const sortKey = (ddmm) => ddmm.slice(3) + ddmm.slice(0, 2); // "29-10" -> "1029"

function themeFor(d) {
  const f = QS.get("theme");
  if (f) return THEMES[f] ? f : null;
  const p = d.toLocaleDateString("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit" }).split("/");
  const today = p[1] + p[0];
  return (
    Object.keys(THEMES).filter(function (k) {
      const a = sortKey(THEMES[k].from),
        b = sortKey(THEMES[k].to);
      return a <= b ? today >= a && today <= b : today >= a || today <= b;
    })[0] || null
  );
}

export function startTheme(scene) {
  THEME = themeFor(new Date(nowMs()));
  if (!THEME) return;
  svg.classList.add("theme-" + THEME);
  THEMES[THEME].start(scene);
}

// True when the date has moved into another theme since load (checked when standby ends)
export function themeChanged() {
  return !QS.get("theme") && themeFor(new Date(nowMs())) !== THEME;
}
