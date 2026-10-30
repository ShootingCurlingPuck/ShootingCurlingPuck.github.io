// Rain streaks: the default kind of precipitation (see sky/precip.js). Thin slanted streaks in front
// of everything (still under the QR code), slanting with the wind, ending on the ground with a tiny
// splash. Drops are only added at the top and only removed when they land, so rain builds up and
// dies down naturally. All drops are one path and all splashes another, redrawn every frame: much
// cheaper on the TV than an element per drop.
import { el } from "../core/svg.js";
import { RAIN } from "../config.js";

export function startStreaks(layer, api) {
  const { VIEW } = api.geo;
  const g = el("g", { class: "rain" }, layer);
  const line = (w) =>
    el(
      "path",
      {
        fill: "none",
        stroke: RAIN.colour,
        "stroke-opacity": RAIN.opacity,
        "stroke-width": w,
        "stroke-linecap": "round",
      },
      g,
    );
  const streaks = line(RAIN.width),
    splashes = line(RAIN.width * 0.8);

  const drops = [],
    splash = [];
  function newDrop(y) {
    const x = api.startX();
    if (x === null) return; // no cloud to come from
    drops.push({
      x: x,
      y: y,
      v: RAIN.speed[0] + Math.random() * (RAIN.speed[1] - RAIN.speed[0]),
      len:
        (RAIN.length[0] + Math.random() * (RAIN.length[1] - RAIN.length[0])) *
        (0.45 + 0.55 * api.amount()), // drizzle: shorter streaks
      end: api.landAt(x),
    });
  }
  const wanted = () => {
    const max = api.isStandby() ? RAIN.max.standby : RAIN.max.live;
    return Math.round(max * api.amount() * api.detail());
  };
  // already raining at the start: spread drops over the height
  for (let i = 0; i < wanted() * 2 && drops.length < wanted(); i++)
    newDrop(VIEW.y + Math.random() * VIEW.h);

  return {
    frame(dt) {
      const want = wanted();
      // A big jump (the first weather after loading, which isn't faded in): it's already raining,
      // so the missing drops go all over the height. Otherwise they'd all start at the top at once
      // and come down as one sheet, which then keeps going round as bands.
      if (want - drops.length > Math.max(10, want * 0.25))
        for (let i = 0; i < want * 2 && drops.length < want; i++)
          newDrop(VIEW.y + Math.random() * VIEW.h);
      // new drops come in from above the top edge, at staggered heights so they don't arrive as a
      // sheet; at most a few dozen per frame (heavy rain needs over a hundred per second)
      for (let n = 0; n < 30 && drops.length < want; n++)
        newDrop(VIEW.y - 60 - Math.random() * 300);

      const sl = api.slope();
      let d = "";
      for (let i = drops.length - 1; i >= 0; i--) {
        const p = drops[i];
        p.y += p.v * dt;
        p.x += p.v * sl * dt;
        if (p.y >= p.end) {
          if (api.amount() > RAIN.splashFrom && splash.length < 40)
            splash.push({ x: p.x, y: p.end, t: 0 });
          // a drop that lands is replaced at the top, unless there should be fewer now
          drops.splice(i, 1);
          continue;
        }
        // the streak trails behind the drop, along its path
        const len = Math.min(p.len, p.y - (VIEW.y - 60));
        if (len <= 0) continue;
        d += `M${p.x.toFixed(1)} ${p.y.toFixed(1)}l${(-sl * len).toFixed(1)} ${(-len).toFixed(1)}`;
      }
      streaks.setAttribute("d", d || "M0 0");

      // splashes: two tiny ticks flying apart, for a moment
      let s = "";
      for (let i = splash.length - 1; i >= 0; i--) {
        const p = splash[i];
        p.t += dt;
        if (p.t > 0.16) {
          splash.splice(i, 1);
          continue;
        }
        const k = 3 + p.t * 40;
        s += `M${(p.x - k).toFixed(1)} ${(p.y - 2).toFixed(1)}l-3 -4M${(p.x + k).toFixed(1)} ${(p.y - 2).toFixed(1)}l3 -4`;
      }
      splashes.setAttribute("d", s || "M0 0");
    },
    remove() {
      layer.removeChild(g);
    },
  };
}
