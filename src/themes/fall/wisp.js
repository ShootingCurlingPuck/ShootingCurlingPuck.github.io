// The will-o'-the-wisp: a rare pale flame floating low over the leaf litter on dark, calm nights.
// It dances on the spot, drifts off, darts about. In the stories it goes out when someone comes
// near and shows up again further off, always out of reach: here something startles it now and
// then (a gust, or nothing at all): it's snuffed out, then back a little further on, a bit smaller,
// as if it moved away. One of its old names is jack-o'-lantern, so it comes out more on Halloween.
// Test switch: ?wisp=often (one every 20 seconds or so, when it's dark: add ?time=23:00)
import { el, defs } from "../../core/svg.js";
import { QS } from "../../core/params.js";
import { TZ } from "../../config.js";
import { sceneNow } from "../../core/time.js";
import { everyFrame } from "../toolkit.js";
import { WISP } from "./settings.js";

const rand = (r) => r[0] + Math.random() * (r[1] - r[0]);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// The flame: a teardrop, its base at 0,0, its tip 28 units up
const FLAME = "M0,-28C5,-19 9,-11 9,-4C9,3 5,7 0,7C-5,7 -9,3 -9,-4C-9,-11 -5,-19 0,-28Z";

// How it moves in each kind of move: how hard it's pulled to where it's going, how much the air
// holds it back, and how far off it picks its next spot (x and height)
const MOVES = {
  hover: { pull: 7, drag: 3.5, reach: [12, 10], every: 0.7 },
  drift: { pull: 1.2, drag: 1.6, reach: [260, 60], every: 99 },
  dart: { pull: 30, drag: 9, reach: [160, 50], every: 99 },
};

// surface(x): the top of the leaf litter; wind, precip: from the sky (may be null)
export function startWisp(layer, scene, surface, wind, precip) {
  const daylight = scene.fx && scene.fx.daylight;
  if (!daylight) return null;
  const W = WISP;
  const { VIEW } = scene.geo;
  const left = VIEW.x + 70,
    right = VIEW.x + VIEW.w - 70;
  const often = QS.get("wisp") === "often";
  const halloween =
    new Date(sceneNow()).toLocaleDateString("en-GB", { timeZone: TZ }).indexOf("31/10") === 0;

  const gradient = (id, colour, stops, attrs) => {
    const grad = el("radialGradient", Object.assign({ id: id }, attrs || {}), defs);
    stops.forEach((st) =>
      el("stop", { offset: st[0], "stop-color": colour, "stop-opacity": st[1] }, grad),
    );
    return "url(#" + id + ")";
  };
  // its light on the leaves below (drawn first: the flame floats in front of it)
  const pool = el(
    "ellipse",
    {
      rx: W.pool.rx,
      ry: W.pool.ry,
      fill: gradient("wisp-pool", W.light.colour, [[0, 0.4], [0.5, 0.15], [1, 0]]),
      opacity: 0,
      display: "none",
    },
    layer,
  );
  const g = el("g", { class: "wisp", opacity: 0, display: "none" }, layer);
  el(
    "circle",
    {
      cy: -8,
      r: W.light.r,
      fill: gradient("wisp-light", W.light.colour, [[0, 0.3], [0.35, 0.14], [1, 0]]),
    },
    g,
  );
  const flame = el("g", {}, g);
  // soft edges: each part fades out towards its outline, brightest low in the flame
  const soft = { cx: 0.5, cy: 0.68, r: 0.6, fx: 0.5, fy: 0.75 };
  el("path", { d: FLAME, fill: gradient("wisp-flame", W.colour, [[0, 0.95], [0.55, 0.6], [1, 0]], soft) }, flame);
  el(
    "path",
    {
      d: FLAME,
      fill: gradient("wisp-heart", W.heart, [[0, 1], [0.5, 0.7], [1, 0]], soft),
      transform: "translate(0 2) scale(0.55)",
    },
    flame,
  );

  let V = null; // the visit now, if any

  function pickMove() {
    const r = Math.random(),
      M = W.moves;
    V.move = r < M.hover[0] ? "hover" : r < M.hover[0] + M.drift[0] ? "drift" : "dart";
    V.moveUntil = V.age + rand(M[V.move][1]);
    V.nextSpot = 0;
  }
  function pickSpot() {
    const m = MOVES[V.move];
    const way = Math.random() < 0.5 ? -1 : 1;
    V.tx = Math.max(left, Math.min(right, V.x + way * m.reach[0] * (0.4 + 0.6 * Math.random())));
    V.th = Math.max(W.height[0], Math.min(W.height[1], V.h + (Math.random() - 0.5) * 2 * m.reach[1]));
    V.nextSpot = V.age + m.every;
  }

  function start() {
    const life = rand(W.life);
    const n = Math.round(rand(W.startled));
    const at = [];
    for (let i = 1; i <= n; i++) at.push((life * i) / (n + 1) + (Math.random() - 0.5) * 4);
    V = {
      x: left + Math.random() * (right - left),
      h: rand(W.height),
      vx: 0,
      vh: 0,
      age: 0,
      life: life,
      startles: at, // when something startles it
      out: -1, // when it was snuffed out (or -1)
      back: -1, // when it lit up again
      size: 1,
      seed: Math.random() * 100,
    };
    V.tx = V.x;
    V.th = V.h;
    pickMove();
    g.setAttribute("display", "");
    pool.setAttribute("display", "");
  }
  function end() {
    V = null;
    g.setAttribute("display", "none");
    pool.setAttribute("display", "none");
  }
  // startled: snuffed out at once; it comes back on its own (see below)
  function startle() {
    if (!V || V.out >= 0 || V.age < 2) return;
    V.out = V.age;
    V.dark = rand(W.gone);
  }
  if (wind) wind.onGust(() => Math.random() < W.startleGust && startle());

  let t = 0;
  everyFrame((now, dt) => {
    t += dt;
    if (!V) {
      const calm =
        (!wind || wind.strength() <= W.maxWind) && (!precip || precip.amount() <= W.maxRain);
      const perHour = often ? 180 : W.perDarkHour * (halloween ? W.halloween : 1);
      if (daylight.darkness() >= W.darkness && calm && Math.random() < (perHour / 3600) * dt)
        start();
      return;
    }
    V.age += dt;
    if (V.startles.length && V.age > V.startles[0]) {
      V.startles.shift();
      startle();
    }
    if (V.age > V.life && V.out < 0) startle(); // it ends the same way: gone in a blink
    let light = 1;
    if (V.out >= 0) {
      const since = V.age - V.out;
      light = clamp01(1 - since / 0.15); // snuffed out in a blink
      if (since > V.dark) {
        if (V.age > V.life) return end();
        // back, somewhere further on
        let way = Math.random() < 0.5 ? -1 : 1;
        if (V.x + way * 120 < left || V.x + way * 120 > right) way = -way; // not off the edge
        V.x = Math.max(left, Math.min(right, V.x + way * (90 + Math.random() * 180)));
        V.h = rand(W.height);
        V.vx = V.vh = 0;
        V.size *= 0.88;
        V.out = -1;
        V.back = V.age;
        V.tx = V.x;
        V.th = V.h;
        pickMove();
        light = 0;
      }
    }
    if (V.back >= 0) light = Math.min(light, clamp01((V.age - V.back) / 0.6));
    light *= clamp01(V.age / 1.5); // lighting up the first time

    // moving: pulled towards its next spot, held back by the air (a spring with damping)
    if (V.out < 0) {
      if (V.age > V.moveUntil) pickMove();
      if (V.age > V.nextSpot) pickSpot();
      const m = MOVES[V.move];
      const step = Math.min(dt, 0.05); // stays steady on a slow frame
      V.vx += (m.pull * (V.tx - V.x) - m.drag * V.vx) * step;
      V.vh += (m.pull * (V.th - V.h) - m.drag * V.vh) * step;
      V.x = Math.max(left, Math.min(right, V.x + V.vx * dt));
      V.h = Math.max(W.height[0] * 0.7, V.h + V.vh * dt);
    }
    // a restless wobble on top, never quite still
    const a = V.age + V.seed;
    const x = V.x + 4 * Math.sin(a * 1.9) + 2.5 * Math.sin(a * 3.7);
    const ground = surface(x);
    const y = ground - V.h - 3 * Math.sin(a * 2.3) - 2 * Math.sin(a * 4.1);
    V.px = x;
    V.py = y;

    // the flame flickers: it stretches and shrinks, and its tip trails behind when it moves
    const flick = Math.sin(a * 9.1) * Math.sin(a * 5.3) + 0.5 * Math.sin(a * 17.3);
    const lean = Math.max(-30, Math.min(30, -V.vx * 0.35 + 6 * Math.sin(a * 2.9)));
    const s = W.size * V.size;
    flame.setAttribute(
      "transform",
      `skewX(${lean.toFixed(1)}) scale(${(1 - 0.06 * flick).toFixed(3)} ${(1 + 0.14 * flick).toFixed(3)})`,
    );
    g.setAttribute("opacity", Math.min(1, light * (0.85 + 0.15 * flick)).toFixed(2));
    g.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})`);
    // its light on the leaves: stronger the lower it floats
    const near = clamp01(1 - V.h / W.pool.near);
    pool.setAttribute("opacity", (light * near * (0.9 + 0.1 * flick)).toFixed(2));
    pool.setAttribute(
      "transform",
      `translate(${x.toFixed(1)} ${(ground - 4).toFixed(1)}) scale(${(V.size * (0.7 + 0.3 * near)).toFixed(3)})`,
    );
  });

  // for the owl, which watches it
  return {
    out: () => !!V && V.age > 1 && V.out < 0,
    pos: () => (V ? { x: V.px, y: V.py } : { x: 0, y: 0 }),
  };
}
