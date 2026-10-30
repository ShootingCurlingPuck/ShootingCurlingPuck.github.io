// Rain for themes, from the live weather: thin slanted streaks in front of everything (still under the
// QR code), slanting with the wind, ending on the ground with a tiny splash.
// The amount eases towards the weather over about a minute; drops are only added at the top and only
// removed when they reach the ground, so rain builds up and dies down naturally.
// All drops are one path and all splashes another, redrawn every frame: much cheaper on the TV than
// an element per drop.
// Test switch: ?rain=0..1 (pretend rain amount; ?weather=drizzle|rain|heavy works too)
import { el } from "../core/svg.js";
import { QS } from "../core/params.js";
import { RAIN } from "../config.js";
import { everyFrame, detail } from "./toolkit.js";

// ground(x): y where a drop falling at x hits the ground
// clouds (optional): rain only falls from under them (see clouds.js coverAt)
export function startRain(layer, scene, wind, ground, clouds) {
  const { VIEW, VR, VB } = scene.geo;
  const forced = parseFloat(QS.get("rain"));
  const g = el("g", { class: "rain" }, layer);
  const streaks = el(
    "path",
    {
      fill: "none",
      stroke: RAIN.colour,
      "stroke-opacity": RAIN.opacity,
      "stroke-width": RAIN.width,
      "stroke-linecap": "round",
    },
    g,
  );
  const splashes = el(
    "path",
    {
      fill: "none",
      stroke: RAIN.colour,
      "stroke-opacity": RAIN.opacity,
      "stroke-width": RAIN.width * 0.8,
      "stroke-linecap": "round",
    },
    g,
  );
  const groundAt = ground || (() => VB - 20);

  // 0..1 from the weather: drizzle a little, rain more, heavy (and thunder) the most;
  // within each kind, more millimetres per hour = more rain
  function target() {
    if (!isNaN(forced)) return Math.max(0, Math.min(1, forced));
    const w = scene.weather();
    if (!w) return 0;
    const r = RAIN.levels[w.precip];
    if (!r) return 0; // none, or snow (not drawn yet)
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

  const drops = [],
    splash = [];
  const slope = () => {
    // horizontal per vertical: leftward, more with wind and gusts
    const k = wind ? wind.strength() + 0.5 * wind.gust() : 0;
    return -RAIN.slant * Math.min(1.2, k);
  };
  function newDrop(y) {
    const sl = slope();
    // start further right the more it slants, so the whole width gets rain; with clouds, mostly
    // from under them (a few tries for a spot under a cloud; anywhere if there are none)
    let x = VIEW.x + Math.random() * (VIEW.w - sl * VIEW.h);
    if (clouds && clouds.cover() > 0.05)
      for (let i = 0; i < 8 && Math.random() > clouds.coverAt(x); i++)
        x = VIEW.x + Math.random() * (VIEW.w - sl * VIEW.h);
    const d = {
      x: x,
      y: y,
      v: RAIN.speed[0] + Math.random() * (RAIN.speed[1] - RAIN.speed[0]),
    };
    d.len =
      (RAIN.length[0] + Math.random() * (RAIN.length[1] - RAIN.length[0])) *
      (0.45 + 0.55 * amount); // drizzle: shorter streaks
    d.end = groundAt(Math.max(VIEW.x, Math.min(VR, x))) + Math.random() * 25;
    drops.push(d);
  }
  const wanted = () => {
    const max = scene.isStandby() ? RAIN.max.standby : RAIN.max.live;
    return Math.round(max * amount * detail());
  };
  // already raining at load: spread drops over the height
  for (let i = 0; i < wanted(); i++) newDrop(VIEW.y + Math.random() * VIEW.h);

  everyFrame((now, dt) => {
    t += dt;
    amount += (target() - amount) * Math.min(1, dt / RAIN.ease);
    const want = wanted();
    // new drops come in from above the top edge, at staggered heights so they don't arrive as a
    // sheet; at most a few dozen per frame (heavy rain needs over a hundred per second)
    for (let n = 0; n < 30 && drops.length < want; n++)
      newDrop(VIEW.y - 60 - Math.random() * 300);

    const sl = slope();
    let d = "";
    for (let i = drops.length - 1; i >= 0; i--) {
      const p = drops[i];
      p.y += p.v * dt;
      p.x += p.v * sl * dt;
      if (p.y >= p.end) {
        if (amount > RAIN.splashFrom && splash.length < 40)
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
  });

  // 0..1, for other parts that react to rain (e.g. wet leaves fall straighter)
  return { amount: () => amount };
}
