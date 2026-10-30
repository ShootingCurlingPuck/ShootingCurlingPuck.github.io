// Precipitation, from the live weather, for everything (whatever the season). This part decides how
// much is coming down and where; how it looks and moves is a "kind" that can be swapped:
// rain streaks by default (sky/streaks.js), a theme may bring its own (snowflakes, ...) with
// setKind. A kind is a function (layer, api) => { frame(dt), remove() }, with api:
//   amount()   how hard it's coming down now, 0..1 (eases towards the weather in about a minute)
//   slope()    sideways per downward movement, from the wind (sign = wind direction)
//   startX()   an x to start a particle from, under a visible cloud; null if there's no cloud
//              (then nothing comes down: never from a clear sky)
//   landAt(x)  the y where a particle that falls at x lands on the ground
//   detail()   the shared animation detail level (core/perf.js), 0..1
//   geo, isStandby()
// Test switch: ?rain=0..1 (pretend amount; ?weather=drizzle|rain|heavy works too)
import { el } from "../core/svg.js";
import { QS } from "../core/params.js";
import { RAIN } from "../config.js";
import { everyFrame } from "../core/anim.js";
import { detail } from "../core/perf.js";
import { startStreaks } from "./streaks.js";

// clouds (optional): it only comes down from under them (see clouds.js coverAt)
export function startPrecip(layer, scene, wind, clouds) {
  const { VIEW, VR, VB } = scene.geo;
  const forced = parseFloat(QS.get("rain"));

  // 0..1 from the weather: drizzle a little, rain more, heavy (and thunder) the most;
  // within each kind, more millimetres per hour = more
  function target() {
    if (!isNaN(forced)) return Math.max(0, Math.min(1, forced));
    const w = scene.weather();
    if (!w) return 0;
    const r = RAIN.levels[w.precip];
    if (!r) return 0; // none, or snow (no snow kind yet)
    const mm = Math.max(r.mm[0], Math.min(r.mm[1], w.mmPerHour || r.mm[0]));
    return (
      r.amount[0] +
      ((mm - r.mm[0]) / (r.mm[1] - r.mm[0] || 1)) * (r.amount[1] - r.amount[0])
    );
  }
  let t = 0;
  let amount = target();
  scene.on("weather", () => {
    if (t < 15) amount = target(); // the first weather after loading: no fade
  });

  // The ground: a flat line near the bottom unless a theme says where its ground is
  let ground = () => VB - 20,
    depth = 0; // how far below the ground's surface things may land (e.g. into a leaf pile)

  const slope = () => {
    const k = wind ? wind.strength() + 0.5 * wind.gust() : 0;
    return (wind ? wind.dir() : -1) * RAIN.slant * Math.min(1.2, k);
  };
  const api = {
    geo: scene.geo,
    isStandby: scene.isStandby,
    amount: () => amount,
    slope: slope,
    detail: detail,
    startX() {
      // start further upwind the more it slants, so the whole width gets some; only from under
      // a visible cloud (a few tries to find one), unless the clouds are switched off
      const sl = slope();
      const spread = VIEW.w + Math.abs(sl) * VIEW.h;
      const from = sl < 0 ? VIEW.x : VIEW.x - Math.abs(sl) * VIEW.h;
      for (let i = 0; i < 12; i++) {
        const x = from + Math.random() * spread;
        if (!clouds || Math.random() < clouds.coverAt(x)) return x;
      }
      return null;
    },
    landAt: (x) =>
      ground(Math.max(VIEW.x, Math.min(VR, x))) + Math.random() * depth,
  };

  const g = el("g", { class: "precip" }, layer);
  let kind = startStreaks(g, api);

  everyFrame((now, dt) => {
    t += dt;
    amount += (target() - amount) * Math.min(1, dt / RAIN.ease);
    kind.frame(dt);
  });

  return {
    amount: () => amount,
    // where the ground is: ground(x) gives its surface's y at x; things land up to `below` deeper
    setGround(fn, below) {
      ground = fn;
      depth = below || 0;
    },
    // swap how it looks and moves (see the top of this file); null goes back to rain streaks
    setKind(start) {
      kind.remove();
      kind = (start || startStreaks)(g, api);
    },
  };
}
