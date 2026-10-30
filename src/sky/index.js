// The sky: weather effects (and later the day/night cycle) for everything, whatever the season.
// Started by main.js before the theme, so it also runs with ?theme=none. Themes get the result as
// scene.fx: they can react to it (leaves in the wind, ...) and change how it looks, never what the
// weather is:
//   fx.wind               strength(), gust(), onGust(fn), dir(), setDirection(-1 | 1)
//   fx.clouds             cover(), coverAt(x), setStyle({ body, line, rainBody, rainLine })
//   fx.precip             amount(), setGround(fn, below), setKind(start) (see precip.js)
// Any part can be missing (?skip=wind,clouds,precip, or if it failed): check before using it.
import { QS } from "../core/params.js";
import { debugLog, crumb } from "../core/debug.js";
import { HEAD_F } from "../config.js";
import { startWind } from "./wind.js";
import { startClouds } from "./clouds.js";
import { startPrecip } from "./precip.js";

// scene: as given to themes; it needs scene.front (moving layer) and scene.sky (clouds' layer)
export function startSky(scene) {
  const skip = (QS.get("skip") || "").split(",");
  // Each part runs on its own, so a bug in one doesn't take the others down
  const part = (name, fn) => {
    if (skip.indexOf(name) >= 0) return crumb("sky " + name + ": skipped");
    crumb("sky " + name + ": start");
    try {
      const r = fn();
      crumb("sky " + name + ": done");
      return r;
    } catch (e) {
      debugLog("Sky " + name + ": " + e);
    }
  };

  // Clouds hang down to just above the first text under the top strip: the room names at the
  // top of the plan and the "Rooms" heading
  const g = scene.geo;
  const textTop = Math.min.apply(
    null,
    [g.LIST.head - HEAD_F * 0.6].concat(
      g.ROOMS.filter((r) => !r.booth).map(
        (r) => r.y + r.h / 2 - g.NAME_F * 0.6,
      ),
    ),
  );

  const wind = part("wind", () => startWind(scene));
  const clouds = scene.sky
    ? part("clouds", () =>
        startClouds(scene.sky, scene, wind || null, textTop, () =>
          precip ? precip.amount() : 0,
        ),
      )
    : null;
  // in front of what themes put in the moving layer, coming from under the clouds
  const precip = part("precip", () =>
    startPrecip(scene.front, scene, wind || null, clouds || null),
  );

  return { wind: wind || null, clouds: clouds || null, precip: precip || null };
}
