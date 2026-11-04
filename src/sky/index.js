// The sky and the weather, for everything, whatever the season: starts and connects the weather
// effects (../weather/: wind, clouds, rain) and the day/night cycle (here: daylight, the night sky).
// Started by main.js before the theme, so it also runs with ?theme=none. Themes get the result as
// scene.fx: they can react to it (leaves in the wind, ...) and change how it looks, never what the
// weather is:
//   fx.wind               strength(), gust(), onGust(fn), dir(), setDirection(-1 | 1)
//   fx.clouds             cover(), coverAt(x), setStyle({ body, line, rainBody, rainLine })
//   fx.precip             amount(), kind() ("rain" | "snow"), setGround(fn, below),
//                         setKind(start, "rain" | "snow") (see weather/precip.js)
//   fx.snow               depth(), addAirLedges(list): snow settling (see weather/settle.js)
//   fx.daylight           darkness() (0 day .. 1 night), sunAltitude(), veil() (see daylight.js)
//   fx.night              addForeground(node): keep the stars and moon behind this drawing (in live
//                         mode and standby)
// Any part can be missing (?skip=wind,clouds,precip,settle,daylight,night, or if it failed): check
// before using it.
import { QS } from "../core/params.js";
import { trouble } from "../system/monitor.js";
import { debugLog, crumb } from "../core/debug.js";
import { HEAD_F, CLOUDS } from "../config.js";
import { startWind } from "../weather/wind.js";
import { startClouds } from "../weather/clouds.js";
import { startPrecip } from "../weather/precip.js";
import { startSettle } from "../weather/settle.js";
import { startDaylight } from "./daylight.js";
import { startNightSky } from "./night-sky.js";

// scene: as given to themes; it needs scene.front (moving layer), scene.night (the night veil's
// layer, above the moving one), scene.stars (above the veil) and scene.sky (the clouds' layer, on top)
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
      trouble("sky " + name + ": " + e);
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

  const daylight = scene.night
    ? part("daylight", () => startDaylight(scene.night, scene))
    : null;
  const night =
    daylight && scene.stars
      ? part("night", () =>
          startNightSky(scene.stars, scene, daylight, textTop, () => clouds),
        )
      : null;
  const wind = part("wind", () => startWind(scene));
  const clouds = scene.sky
    ? part("clouds", () =>
        startClouds(
          scene.sky,
          scene,
          wind || null,
          textTop,
          () => (precip ? precip.amount() : 0),
          daylight || null,
        ),
      )
    : null;
  // in front of what themes put in the moving layer, coming from under the clouds
  const precip = part("precip", () =>
    startPrecip(scene.front, scene, wind || null, clouds || null),
  );
  // snow settling on things, where it's cold enough
  const snow = precip ? part("settle", () => startSettle(scene.front, scene, precip)) : null;
  if (snow) precip.setSettle(snow);

  return {
    wind: wind || null,
    clouds: clouds || null,
    precip: precip || null,
    snow: snow || null,
    daylight: daylight || null,
    night: night || null,
    // the lowest a cloud can hang: things that come down from above start below this
    cloudsBottom: g.VIEW.y + (textTop - g.VIEW.y) * CLOUDS.depth,
  };
}
