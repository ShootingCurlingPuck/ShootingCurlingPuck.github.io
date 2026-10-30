// Leaves falling from the tree and the top, swaying and tumbling, carried right to left by the wind.
// In the rain they're wet: they fall faster and sway less.
// On the ground they rest a while, then fade. Gusts make leaves on the ground hop up and swirl.
import { el, use } from "../../core/svg.js";
import { pick, mix, INK, everyFrame, detail, scaled } from "../toolkit.js";
import { FALLING } from "./settings.js";
import { LEAF_FORM_WEIGHTS, LEAF_VARIANTS, leafShape } from "./shapes.js";

// wet(): how hard it's raining, 0..1
export function startFalling(layer, scene, pal, floorSurface, tree, wind, wet) {
  const { VIEW, VR } = scene.geo;
  const g = el("g", { class: "falling" }, layer);
  const flying = [],
    landed = [];
  let nextSpawn = 0;
  const between = (r) => r[0] + Math.random() * (r[1] - r[0]);
  const strength = () => (wind ? wind.strength() : 0);

  // A new leaf at x, y. fromTree: let go of the crown (fade in, start at its spot in the crown)
  function makeLeaf(x0, y, vx, s, fadeIn) {
    const form = pick(Math.random, LEAF_FORM_WEIGHTS);
    const col = pal[Math.floor(Math.random() * pal.length)];
    const ph = fadeIn ? 0 : Math.random() * 6.3; // tree leaves start exactly at their spot in the crown
    const L = {
      x0: x0,
      x: x0,
      vx: vx,
      fadeIn: fadeIn ? 0.5 : 0, // seconds
      y: y,
      vy: 64 + Math.random() * 18, // units per second
      amp: 25 + Math.random() * 45, // sway width
      w: 0.7 + Math.random() * 0.7, // sway speed
      a: ph, // sway phase, advances faster in wind
      tumble: 0.6 + Math.random() * 1.2,
      tb: 0, // tumble phase
      catch: 0.7 + Math.random() * 0.6, // how much this leaf catches the wind
      deg0: Math.random() * 360,
      s: s,
      t: 0,
      u: use(
        g,
        leafShape(form, Math.floor(Math.random() * LEAF_VARIANTS)),
        "",
        { fill: col, stroke: mix(col, INK, 0.45) },
      ),
    };
    flying.push(L);
    return L;
  }

  // y: where to start; above the screen = a new leaf, which may come from the tree instead
  function spawn(y) {
    // From the top: mostly over the side away from the tree, further right the windier it is
    // (they get carried left)
    const side = tree ? 0.7 : 1;
    const shift = 0.3 * strength();
    let x0 = VIEW.x + VIEW.w * (shift + Math.random() * side * (1 - shift)),
      vx = (Math.random() - 0.5) * 10,
      s = 0.6 + Math.random() * 0.5,
      fromTree = false;
    if (
      y < VIEW.y &&
      tree &&
      Math.random() < FALLING.fromTree * tree.fullness
    ) {
      const p = tree.spawnPoint();
      if (p) {
        x0 = p.x;
        y = p.y;
        vx = -between(FALLING.breeze);
        s = 0.5 + Math.random() * 0.3; // about the size of the crown's leaves
        fromTree = true;
      }
    }
    makeLeaf(x0, y, vx, s, fromTree);
  }

  function place(L, x, deg, sx, sy) {
    L.u.setAttribute(
      "transform",
      `translate(${x.toFixed(1)} ${L.y.toFixed(1)}) rotate(${deg.toFixed(1)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`,
    );
  }
  function remove(list, i) {
    g.removeChild(list[i].u);
    list.splice(i, 1);
  }

  // A hop: the leaf is thrown up from where it is, circles a little while it rises, and drops back
  // into its normal fall when it's as fast as a falling leaf again
  function hop(L, height, deg) {
    const grav = 320;
    L.hop = {
      vy: -Math.sqrt(2 * grav * height),
      grav: grav,
      x: L.x,
      R: 8 + Math.random() * (10 + height * 0.15), // swirl radius
      om: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3), // swirl speed, rad/s
      th: Math.random() * 6.3,
      deg: deg,
      spin: (Math.random() - 0.5) * 500, // degrees per second
    };
    L.target = undefined;
  }

  // Gusts stir the ground around a random spot
  if (wind)
    wind.onGust((amp) => {
      // the crown lets go of a few extra leaves
      if (tree) {
        const n = Math.round(
          FALLING.wind.shed[0] +
            (FALLING.wind.shed[1] - FALLING.wind.shed[0]) * strength(),
        );
        for (let i = 0; i < scaled(n, 0); i++) spawn(VIEW.y - 60);
      }
      const k = strength();
      const H = FALLING.swirl.calm.map(
        (c, i) => c + (FALLING.swirl.stormy[i] - c) * k,
      );
      const gx = VIEW.x + 150 + Math.random() * (VIEW.w - 400);
      const reach = FALLING.swirl.reach * (0.7 + amp * 0.6);
      // leaves that landed there take off again
      for (let i = landed.length - 1; i >= 0; i--) {
        const L = landed[i];
        if (L.fadeFrom !== undefined || Math.abs(L.x - gx) > reach) continue;
        landed.splice(i, 1);
        flying.push(L);
        hop(L, between(H) * amp * 1.5, L.deg);
      }
      // and a few come up out of the pile
      const kick = scaled(
        Math.round(
          FALLING.swirl.kick[0] +
            (FALLING.swirl.kick[1] - FALLING.swirl.kick[0]) * k,
        ),
      );
      for (let i = 0; i < kick; i++) {
        const x = gx + (Math.random() - 0.5) * reach * 1.4;
        const L = makeLeaf(
          x,
          floorSurface(x) + 6 + Math.random() * 16,
          0,
          0.5 + Math.random() * 0.4,
          false,
        );
        L.fadeIn = 0.25; // rises out of the pile instead of popping up
        L.u.setAttribute("opacity", 0);
        hop(L, between(H) * (0.7 + amp * 0.6), Math.random() * 360);
      }
    });

  // A few already on their way, so the screen isn't empty after a reload
  for (let i = 0; i < 3; i++) spawn(VIEW.y + Math.random() * VIEW.h * 0.6);

  everyFrame((now, dt) => {
    const sec = now / 1000;
    const mode = scene.isStandby() ? FALLING.standby : FALLING.live;
    const k = strength();
    const r = wet ? wet() : 0;
    const sway = 1 - FALLING.wet.sway * r;
    const gust = wind ? wind.gust() : 0;
    const drift = -(FALLING.wind.drift * k + FALLING.wind.gustDrift * gust); // leftward
    nextSpawn -= dt;
    if (nextSpawn <= 0 && flying.length < scaled(mode.max)) {
      spawn(VIEW.y - 60);
      // fewer as the crown empties, and when the TV is struggling
      const rate = (tree ? 0.35 + 0.65 * tree.fullness : 1) * detail();
      nextSpawn = (mode.every * (0.6 + Math.random() * 0.8)) / rate;
    }

    for (let i = flying.length - 1; i >= 0; i--) {
      const L = flying[i];
      L.t += dt;
      if (L.fadeIn) {
        L.u.setAttribute("opacity", Math.min(1, L.t / L.fadeIn).toFixed(2));
        if (L.t >= L.fadeIn) {
          L.fadeIn = 0;
          L.u.removeAttribute("opacity");
        }
      }
      L.a += L.w * (1 + FALLING.wind.sway * k) * dt;
      L.tb += L.tumble * (1 + k) * dt;
      let flipX = Math.cos(L.tb); // 3D-ish tumble: the leaf turns edge-on and back
      if (Math.abs(flipX) < 0.15) flipX = flipX < 0 ? -0.15 : 0.15;
      let x, deg;

      if (L.hop) {
        const h = L.hop;
        h.vy += h.grav * dt;
        L.y += h.vy * dt;
        h.x += drift * L.catch * dt;
        h.th += h.om * dt;
        h.deg += h.spin * dt;
        x = h.x + h.R * Math.sin(h.th);
        deg = h.deg;
        if (h.vy >= L.vy) {
          // back to a normal fall, carrying on from exactly here
          L.hop = null;
          L.x0 = x - L.amp * sway * Math.sin(L.a);
          L.deg0 = deg - 35 * Math.sin(L.a + 1.57);
        }
      } else {
        L.y += L.vy * (1 + FALLING.wind.fall * k + FALLING.wet.fall * r) * dt;
        L.x0 += (L.vx + drift * L.catch) * dt;
        x = L.x0 + L.amp * sway * Math.sin(L.a);
        deg = L.deg0 + 35 * Math.sin(L.a + 1.57);
      }
      L.x = x;
      L.deg = deg;

      // blown off the side of the screen
      if (x < VIEW.x - 100 || x > VR + 100) {
        remove(flying, i);
        continue;
      }
      if (!L.hop && L.target === undefined && L.y > VIEW.y + VIEW.h * 0.6)
        L.target = floorSurface(x) + 8 + Math.random() * 22;
      if (!L.hop && L.target !== undefined && L.y >= L.target) {
        // land exactly as it was in that moment: no snapping to another orientation
        place(L, x, deg, L.s * flipX, L.s);
        L.until = sec + between(FALLING.rest);
        L.fadeFrom = undefined;
        flying.splice(i, 1);
        landed.push(L);
        continue;
      }
      place(L, x, deg, L.s * flipX, L.s);
    }

    // Resting leaves: fade when their time is up, or when too many have piled up
    for (let i = landed.length - 1; i >= 0; i--) {
      const L = landed[i];
      if (
        L.fadeFrom === undefined &&
        (sec > L.until || landed.length - i > scaled(FALLING.landedMax, 3))
      )
        L.fadeFrom = sec;
      if (L.fadeFrom !== undefined) {
        const o = 1 - (sec - L.fadeFrom) / FALLING.fade;
        if (o <= 0) remove(landed, i);
        else L.u.setAttribute("opacity", o.toFixed(2));
      }
    }
  });
}
