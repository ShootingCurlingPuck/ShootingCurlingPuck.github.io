// Acorns dropping from the oak now and then (more in a gust), mostly early in the season: they fall
// straight (heavy, unlike leaves), make one small hop on the leaf cover, tip over onto their side, rest a while and fade.
// Each one shades itself at night like the night veil (it's above it), with a small
// filter of its own.
// Test switch: ?acorns=often (one every few seconds)
import { el, use } from "../../core/svg.js";
import { QS } from "../../core/params.js";
import { everyFrame } from "../toolkit.js";
import { ACORNS } from "./settings.js";
import { body, fall, airSpeed } from "../../core/physics.js";
import { PHYSICS } from "../../config.js";

// The acorn's outline, roughly an egg: an ellipse of half length L and half width W around the
// sprite's middle (sprite units: cap 28 wide, cap and nut 36 long)
const L = 19 * ACORNS.size,
  W = 13 * ACORNS.size;
const rad = Math.PI / 180;
// Its lowest point at angle deg: where it touches the ground. x, y: from its middle, on screen
// (y = how far below the middle); bx, by: the same point on the acorn itself, to measure rolling
function lowest(deg) {
  const s = Math.sin(deg * rad),
    c = Math.cos(deg * rad);
  const h = Math.sqrt(W * W * s * s + L * L * c * c);
  const bx = (W * W * s) / h,
    by = (L * L * c) / h;
  return { x: bx * c - by * s, y: h, bx: bx, by: by };
}

// perMinute: how many fall per minute at this point of the season (see season.js)
export function startAcorns(layer, scene, tree, surface, wind, perMinute) {
  const often = QS.get("acorns") === "often";
  const rate = often ? 15 : perMinute;
  const daylight = scene.fx && scene.fx.daylight;
  const g = el("g", { class: "acorns" }, layer);
  const acorns = [];

  // a falling acorn is a real little body (see core/physics.js): heavy and compact, so it drops
  // fast and the wind barely moves it
  function drop(at) {
    const a = body({
      x: at.x,
      y: at.y,
      mass: ACORNS.mass,
      area: ACORNS.area,
      cd: ACORNS.cd,
      vx: (Math.random() - 0.5) * 0.3, // m/s: let go of with a little nudge
      vy: 0,
    });
    Object.assign(a, {
      spin: (Math.random() - 0.5) * 400, // degrees per second
      deg: Math.random() * 360,
      bounces: 0,
      until: 0,
      fadeFrom: 0,
      // each in a little wrapper that shades it at night (a small area: cheap)
      w: el("g", daylight ? { filter: daylight.shadeFilter } : {}, g),
    });
    a.u = use(a.w, "prop-acorn", "");
    acorns.push(a);
  }

  let t = 0;
  everyFrame((now, dt) => {
    t += dt;
    const gust = wind ? wind.gust() : 0;
    if (
      rate > 0 &&
      acorns.length < ACORNS.max &&
      Math.random() < (rate / 60) * (1 + 3 * gust) * dt
    ) {
      const at = tree.spawnPoint();
      if (at) drop(at);
    }
    for (let i = acorns.length - 1; i >= 0; i--) {
      const a = acorns[i];
      if (!a.until) {
        // falling (and hopping): gravity, the air, the wind; spinning
        fall(a, dt, airSpeed(wind));
        a.deg += a.spin * dt;
        // the ground line: lying flat, its middle sits 6 below the leaf surface, as before
        const ground = surface(a.x) + 6 + W;
        const lo = lowest(a.deg);
        if (a.y + lo.y >= ground) {
          a.y = ground - lo.y; // touching with its lowest point
          if (a.bounces < 1 && a.vy * PHYSICS.scale > 120) {
            a.bounces++;
            a.vy = -a.vy * ACORNS.bounce; // one small hop: leaves are soft
            a.vx *= 0.6; // (m/s)
            a.spin *= 0.5;
          } else {
            a.until = t + ACORNS.rest[0] + Math.random() * (ACORNS.rest[1] - ACORNS.rest[0]);
            // then it topples onto its side (90 degrees either way), the way it leans now, rolling
            // over the point it stands on: that point stays on the ground, the middle comes down
            const from = ((a.deg % 360) + 540) % 360 - 180; // -180..180
            const to = (from >= 0 ? 90 : -90) + (Math.random() - 0.5) * 12;
            a.deg = from;
            a.tip = {
              from: from,
              to: to,
              t0: t,
              dur: Math.max(0.12, (Math.abs(to - from) / 90) * ACORNS.tip),
              ground: ground,
              at: a.x + lo.x, // where it touches the ground
              lo: lo,
            };
          }
        }
      } else if (a.tip) {
        // toppling: slow at first, then faster. It rolls without slipping: the touching point
        // moves along the ground as far as it moves around the acorn's outline
        const tp = a.tip;
        const p = Math.min(1, (t - tp.t0) / tp.dur);
        const deg = tp.from + (tp.to - tp.from) * p * p;
        const lo = lowest(deg);
        const roll = Math.sqrt((lo.bx - tp.lo.bx) * (lo.bx - tp.lo.bx) + (lo.by - tp.lo.by) * (lo.by - tp.lo.by));
        tp.at += deg >= a.deg ? roll : -roll; // turning clockwise rolls it to the right
        tp.lo = lo;
        a.deg = deg;
        a.x = tp.at - lo.x;
        a.y = tp.ground - lo.y;
        if (p >= 1) a.tip = null;
      } else if (t > a.until) {
        // resting time over: fade away (into the leaves)
        if (!a.fadeFrom) a.fadeFrom = t;
        const o = 1 - (t - a.fadeFrom) / 3;
        if (o <= 0) {
          g.removeChild(a.w);
          acorns.splice(i, 1);
          continue;
        }
        a.w.setAttribute("opacity", o.toFixed(2));
      } else continue; // resting: nothing to redraw
      // the sprite's middle is about 20 units above its origin
      a.u.setAttribute(
        "transform",
        `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)}) rotate(${a.deg.toFixed(0)}) scale(${ACORNS.size}) translate(0 20)`,
      );
    }
  });
}
