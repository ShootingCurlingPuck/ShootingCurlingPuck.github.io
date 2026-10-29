// Leaves falling from the top, swaying and tumbling. In live mode some catch on a ledge (the
// exposed top edge of a tile), rest, wobble loose and drop. On the ground they rest a while, then fade.
// One small animation loop moves them all.
import { el, use } from "../../core/svg.js";
import { pick, mix, INK } from "../toolkit.js";
import { FALLING, PERCH } from "./settings.js";
import { LEAF_FORM_WEIGHTS, LEAF_VARIANTS, leafShape } from "./shapes.js";

export function startFalling(layer, scene, pal, floorSurface) {
  const { VIEW, FLOOR, CORE, ROOMS } = scene.geo;
  const g = el("g", { class: "falling" }, layer);
  const flying = [],
    landed = [],
    perched = [];
  let last = performance.now(),
    nextSpawn = 0;

  // Ledges: exposed stretches of the top edge of every tile, the clock block and the floor plan.
  // A stretch is exposed when nothing sits right on top of it.
  const solids = ROOMS.map((r) => ({ x: r.x, y: r.y, w: r.w, h: r.h })).concat([CORE]);
  const covered = (x, y) => solids.some((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h);
  const ledges = [];
  solids.concat([FLOOR]).forEach((r) => {
    let start = null;
    for (let x = r.x + 8; x <= r.x + r.w - 8; x += 8) {
      const open = !covered(x, r.y - 4);
      if (open && start === null) start = x;
      if ((!open || x + 8 > r.x + r.w - 8) && start !== null) {
        const end = open ? x : x - 8;
        if (end - start >= 40) ledges.push({ x1: start, x2: end, y: r.y, n: 0 });
        start = null;
      }
    }
  });

  function newLeaf() {
    const s = 0.6 + Math.random() * 0.5,
      form = pick(Math.random, LEAF_FORM_WEIGHTS);
    const col = pal[Math.floor(Math.random() * pal.length)];
    return {
      s: s,
      sign: Math.random() < 0.5 ? -1 : 1,
      u: use(g, leafShape(form, Math.floor(Math.random() * LEAF_VARIANTS)), "", { fill: col, stroke: mix(col, INK, 0.45) })
    };
  }
  // (Re)start a leaf's fall from x, y; deg is where its rotation starts
  function fly(L, x, y, deg) {
    L.vy = 64 + Math.random() * 18; // units per second
    L.amp = 25 + Math.random() * 45; // sway width
    L.w = 0.7 + Math.random() * 0.7; // sway speed
    L.ph = 0;
    L.tumble = 0.6 + Math.random() * 1.2;
    L.x0 = x;
    L.y = y;
    L.deg0 = deg - 35;
    L.t = 0;
    L.target = undefined;
    flying.push(L);
  }
  function spawn(y) {
    fly(newLeaf(), VIEW.x + Math.random() * VIEW.w, y, Math.random() * 360);
  }
  function place(L, x, deg, sx, sy) {
    L.u.setAttribute("transform", `translate(${x.toFixed(1)} ${L.y.toFixed(1)}) rotate(${deg.toFixed(1)}) scale(${sx.toFixed(3)} ${sy.toFixed(3)})`);
  }
  // Lying on a ledge: roughly on its side, bottom resting on the edge
  function perch(L, ledge, x, now) {
    ledge.n++;
    L.ledge = ledge;
    L.px = Math.max(ledge.x1, Math.min(ledge.x2, x));
    L.pdeg = (Math.random() < 0.5 ? 90 : 270) + (Math.random() - 0.5) * 30;
    L.psy = L.s * (0.6 + Math.random() * 0.3);
    L.y = ledge.y - 40 * L.s * 0.3;
    L.loose = now / 1000 + PERCH.rest[0] + Math.random() * (PERCH.rest[1] - PERCH.rest[0]);
    place(L, L.px, L.pdeg, L.sign * L.s, L.psy);
    perched.push(L);
  }
  const freeLedges = () => ledges.filter((l) => l.n < PERCH.perLedge);

  // A few already on their way, and a few already resting on ledges, so a reload doesn't start empty
  // (ledges on the first frame, once the screen knows whether it's in standby)
  for (let i = 0; i < 3; i++) spawn(VIEW.y + Math.random() * VIEW.h * 0.6);
  let started = false;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!started) {
      started = true;
      for (let i = 0; i < (scene.isStandby() ? 0 : PERCH.atStart); i++) {
        const free = freeLedges();
        if (!free.length) break;
        const l = free[Math.floor(Math.random() * free.length)];
        perch(newLeaf(), l, l.x1 + Math.random() * (l.x2 - l.x1), now);
      }
    }
    const dt = Math.min(0.1, (now - last) / 1000); // after a TV sleep, don't jump
    if (now - last < 30) return; // ~30 fps is plenty and kind to the TV
    last = now;
    const sec = now / 1000;
    const mode = scene.isStandby() ? FALLING.standby : FALLING.live;
    nextSpawn -= dt;
    if (nextSpawn <= 0 && flying.length < mode.max) {
      spawn(VIEW.y - 60);
      nextSpawn = mode.every * (0.6 + Math.random() * 0.8);
    }

    for (let i = flying.length - 1; i >= 0; i--) {
      const L = flying[i];
      const prevY = L.y;
      L.t += dt;
      L.y += L.vy * dt;
      const a = L.w * L.t + L.ph;
      const x = L.x0 + L.amp * Math.sin(a);
      const deg = L.deg0 + 35 * Math.sin(a + 1.57);
      let flipX = Math.cos(L.t * L.tumble); // 3D-ish tumble: the leaf turns edge-on and back
      if (Math.abs(flipX) < 0.15) flipX = flipX < 0 ? -0.15 : 0.15;

      // Catch on a ledge? (live only, and not the ledge it just fell off)
      if (!scene.isStandby() && perched.length < PERCH.max) {
        const lift = 40 * L.s * 0.3;
        const hit = freeLedges().filter(
          (l) => l !== L.from && x > l.x1 && x < l.x2 && prevY < l.y - lift && L.y >= l.y - lift
        )[0];
        if (hit && Math.random() < PERCH.chance) {
          flying.splice(i, 1);
          perch(L, hit, x, now);
          continue;
        }
      }

      if (L.target === undefined && L.y > VIEW.y + VIEW.h * 0.6) L.target = floorSurface(x) + 8 + Math.random() * 22;
      if (L.target !== undefined && L.y >= L.target) {
        // land flat, at whatever angle it had
        place(L, x, deg, flipX < 0 ? -L.s : L.s, L.s * (0.7 + Math.random() * 0.3));
        L.until = sec + FALLING.rest[0] + Math.random() * (FALLING.rest[1] - FALLING.rest[0]);
        flying.splice(i, 1);
        landed.push(L);
        continue;
      }
      place(L, x, deg, L.sign * L.s * flipX, L.s);
    }

    // Perched leaves: wobble loose when their time is up (or at once when standby starts), then drop
    for (let i = perched.length - 1; i >= 0; i--) {
      const L = perched[i];
      if (scene.isStandby() && L.loose > sec + PERCH.wobble) L.loose = sec + Math.random() * 6; // staggered
      if (sec < L.loose) continue;
      const w = sec - L.loose;
      if (w < PERCH.wobble) {
        const amp = 6 + 10 * (w / PERCH.wobble); // growing wobble
        place(L, L.px, L.pdeg + amp * Math.sin(w * 11), L.sign * L.s, L.psy);
        continue;
      }
      perched.splice(i, 1);
      L.ledge.n--;
      L.from = L.ledge;
      fly(L, L.px, L.y, L.pdeg);
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
  }
  requestAnimationFrame(frame);
}

