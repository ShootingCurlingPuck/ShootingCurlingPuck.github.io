// Leaves falling from the tree and the top. Each is a real little body (see core/physics.js): light
// and flat, so it drifts down slowly, swings and glides from side to side, and goes where the wind
// and the air's eddies take it; nothing here says how it should sway. In the rain they're wet:
// heavier, so they fall faster and swing less. On the ground they rest a while, then fade. Gusts
// swirl up off the ground there and carry leaves up with them.
import { el, use } from "../../core/svg.js";
import { pick, mix, INK, everyFrame, detail, scaled } from "../toolkit.js";
import { FALLING } from "./settings.js";
import { PHYSICS } from "../../config.js";
import { body, fall, airSpeed } from "../../core/physics.js";
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
  // At night they're in front of the night veil (and the stars), so they darken themselves
  const daylight = scene.fx && scene.fx.daylight;
  const shade = (c) => (daylight ? daylight.shade(c) : c);
  function colour(L) {
    L.u.setAttribute("fill", shade(L.col));
    L.u.setAttribute("stroke", shade(L.line));
  }
  if (daylight) daylight.onChange(() => flying.concat(landed).forEach(colour));

  // A new leaf at x, y. vx: units per second sideways to start with; fadeIn: let go of the crown
  // (fade in, start at its spot in the crown). Wet leaves (rain) carry water: heavier, a bit less flat.
  function makeLeaf(x0, y, vx, s, fadeIn) {
    const form = pick(Math.random, LEAF_FORM_WEIGHTS);
    const col = pal[Math.floor(Math.random() * pal.length)];
    const F = FALLING.body,
      k = Math.random(),
      r = wet ? wet() : 0;
    const L = body({
      x: x0,
      y: y,
      mass: (F.mass[0] + k * (F.mass[1] - F.mass[0])) * (1 + F.wet * r),
      area: F.area[0] + Math.random() * (F.area[1] - F.area[0]),
      flat: (F.flat[0] + Math.random() * (F.flat[1] - F.flat[0])) * (1 - 0.3 * r),
      vx: vx / PHYSICS.scale,
      vy: fadeIn ? 0 : undefined, // let go of the crown: from standstill; else already falling
    });
    if (fadeIn) L.tilt = L.turn = 0; // starts exactly as it hung in the crown
    L.vyTop = Math.sqrt(9.81 / L.kd); // its top speed in still air, m/s
    Object.assign(L, {
      fadeIn: fadeIn ? 0.5 : 0, // seconds
      tumble: 0.6 + Math.random() * 1.2,
      tb: 0, // tumble phase
      deg0: Math.random() * 360,
      s: s,
      t: 0,
      u: use(
        g,
        leafShape(form, Math.floor(Math.random() * LEAF_VARIANTS)),
        "",
        {},
      ),
      col: col,
      line: mix(col, INK, 0.45),
    });
    colour(L);
    flying.push(L);
    return L;
  }

  // y: where to start; above the screen = a new leaf, which may come from the tree instead
  function spawn(y) {
    // From the top: mostly over the side away from the tree, and further upwind the windier it
    // is (they get carried downwind)
    const side = tree ? 0.7 : 1;
    const shift = 0.3 * strength();
    // 0..1 across the screen; wind to the left: start further right, and the other way round
    const u =
      (wind && wind.dir() > 0 ? 0 : shift) + Math.random() * side * (1 - shift);
    let x0 = VIEW.x + VIEW.w * u,
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

  // A gust swirling up off the ground where the leaf lies: rising air (strong enough to carry it
  // about `height` up), turning round as it rises and dying down over a second or so; the leaf just
  // goes with the air, and falls again once it's gone
  function hop(L, height, deg) {
    const dur = FALLING.swirl.lasts;
    const climb = height / PHYSICS.scale / dur; // m/s on average
    L.hop = {
      t: 0,
      dur: dur,
      up: 2 * (climb + L.vyTop), // rising air at the start, fading to nothing
      R: (8 + Math.random() * (10 + height * 0.15)) / PHYSICS.scale, // swirl radius, m
      om: (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 3), // swirl speed, rad/s
      th: Math.random() * 6.3,
      spin: (Math.random() - 0.5) * 500, // degrees per second
    };
    L.deg0 = deg;
    L.vx = L.vy = 0;
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
    const air = airSpeed(wind);
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
      L.tb += L.tumble * (1 + k) * dt;
      let flipX = Math.cos(L.tb); // 3D-ish tumble: the leaf turns edge-on and back
      if (Math.abs(flipX) < 0.15) flipX = flipX < 0 ? -0.15 : 0.15;

      if (L.hop) {
        // in the swirl: the air rises (less and less) and turns round
        const h = L.hop;
        h.t += dt;
        h.th += h.om * dt;
        const left = Math.max(0, 1 - h.t / h.dur);
        fall(L, dt, air + h.R * h.om * Math.cos(h.th) * left, h.up * left + h.R * h.om * Math.sin(h.th) * left);
        L.deg0 += h.spin * left * dt;
        if (h.t >= h.dur) L.hop = null;
      } else fall(L, dt, air);
      const x = L.x;
      // how it hangs: its tilt as it swings (the physics' tilt), on top of its own angle
      const deg = L.deg0 + (L.tilt * 180) / Math.PI;
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
