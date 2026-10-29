// Leaves falling from the top, swaying and tumbling. On the ground they rest a while, then fade.
import { el, use } from "../../core/svg.js";
import { pick, mix, INK, everyFrame } from "../toolkit.js";
import { FALLING } from "./settings.js";
import { LEAF_FORM_WEIGHTS, LEAF_VARIANTS, leafShape } from "./shapes.js";

export function startFalling(layer, scene, pal, floorSurface) {
  const { VIEW } = scene.geo;
  const g = el("g", { class: "falling" }, layer);
  const flying = [],
    landed = [];
  let nextSpawn = 0;

  function spawn(y) {
    const s = 0.6 + Math.random() * 0.5,
      form = pick(Math.random, LEAF_FORM_WEIGHTS);
    const col = pal[Math.floor(Math.random() * pal.length)];
    flying.push({
      x0: VIEW.x + Math.random() * VIEW.w,
      y: y,
      vy: 64 + Math.random() * 18, // units per second
      amp: 25 + Math.random() * 45, // sway width
      w: 0.7 + Math.random() * 0.7, // sway speed
      ph: Math.random() * 6.3,
      tumble: 0.6 + Math.random() * 1.2,
      deg0: Math.random() * 360,
      s: s,
      t: 0,
      u: use(g, leafShape(form, Math.floor(Math.random() * LEAF_VARIANTS)), "", { fill: col, stroke: mix(col, INK, 0.45) }),
    });
  }
  function place(L, x, deg, sx, sy) {
    L.u.setAttribute(
      "transform",
      `translate(${x.toFixed(1)} ${L.y.toFixed(1)}) rotate(${deg.toFixed(1)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`
    );
  }

  // A few already on their way, so the screen isn't empty after a reload
  for (let i = 0; i < 3; i++) spawn(VIEW.y + Math.random() * VIEW.h * 0.6);

  everyFrame((now, dt) => {
    const sec = now / 1000;
    const mode = scene.isStandby() ? FALLING.standby : FALLING.live;
    nextSpawn -= dt;
    if (nextSpawn <= 0 && flying.length < mode.max) {
      spawn(VIEW.y - 60);
      nextSpawn = mode.every * (0.6 + Math.random() * 0.8);
    }

    for (let i = flying.length - 1; i >= 0; i--) {
      const L = flying[i];
      L.t += dt;
      L.y += L.vy * dt;
      const a = L.w * L.t + L.ph;
      const x = L.x0 + L.amp * Math.sin(a);
      const deg = L.deg0 + 35 * Math.sin(a + 1.57);
      let flipX = Math.cos(L.t * L.tumble); // 3D-ish tumble: the leaf turns edge-on and back
      if (Math.abs(flipX) < 0.15) flipX = flipX < 0 ? -0.15 : 0.15;
      if (L.target === undefined && L.y > VIEW.y + VIEW.h * 0.6) L.target = floorSurface(x) + 8 + Math.random() * 22;
      if (L.target !== undefined && L.y >= L.target) {
        // land flat, at whatever angle it had
        place(L, x, deg, flipX < 0 ? -L.s : L.s, L.s * (0.7 + Math.random() * 0.3));
        L.until = sec + FALLING.rest[0] + Math.random() * (FALLING.rest[1] - FALLING.rest[0]);
        flying.splice(i, 1);
        landed.push(L);
        continue;
      }
      place(L, x, deg, L.s * flipX, L.s);
    }

    // Resting leaves: fade when their time is up, or when too many have piled up
    for (let i = landed.length - 1; i >= 0; i--) {
      const L = landed[i];
      if (L.fadeFrom === undefined && (sec > L.until || landed.length - i > FALLING.landedMax)) L.fadeFrom = sec;
      if (L.fadeFrom !== undefined) {
        const o = 1 - (sec - L.fadeFrom) / FALLING.fade;
        if (o <= 0) {
          g.removeChild(L.u);
          landed.splice(i, 1);
        } else L.u.setAttribute("opacity", o.toFixed(2));
      }
    }
  });
}
