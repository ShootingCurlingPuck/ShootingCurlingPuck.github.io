// The tree on the right: a trunk leaning in from off-screen, branches reaching over the empty
// top-right corner of the plan, and a canopy that thins as autumn goes on.
// The tree's shape never changes (fixed seed). Each canopy leaf has its own "drop day", so the
// crown empties gradually from 1 October to 30 November and never grows back mid-season.
// Test switch: ?treeday=0..60 (days since 1 October)
import { TZ } from "../../config.js";
import { QS } from "../../core/params.js";
import { nowMs } from "../../core/time.js";
import { el, use } from "../../core/svg.js";
import { seeded, pick, mix, INK } from "../toolkit.js";
import { TREE } from "./settings.js";
import { LEAF_FORM_WEIGHTS, LEAF_VARIANTS, leafShape } from "./shapes.js";

// Days since 1 October (Brussels date), 0..60
function seasonDay() {
  const forced = QS.get("treeday");
  if (forced !== null) return Math.max(0, Math.min(60, +forced));
  const p = new Date(nowMs())
    .toLocaleDateString("en-GB", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
    })
    .split("/");
  const day = +p[0],
    month = +p[1];
  if (month === 10) return day - 1;
  if (month === 11) return 30 + day;
  return month < 10 ? 0 : 60;
}

// Returns { fullness: 0..1, spawnPoint(): {x, y} | null } for the falling leaves
export function drawTree(layer, scene, pal) {
  const { VR, VB } = scene.geo;
  const rnd = seeded("fall-tree"); // same tree every day
  const day = seasonDay();
  const g = el("g", { class: "tree" }, layer);
  const back = el("g", {}, g); // leaves behind the wood
  const wood = el("g", {}, g);
  const front = el("g", {}, g);
  const deg2rad = Math.PI / 180;

  // Areas the tree must leave clear (Kitchen label, QR code, logos), with a margin
  const clear = scene.keepOut.map((k) => ({
    x: k.x - 12,
    y: k.y - 12,
    w: k.w + 24,
    h: k.h + 24,
  }));
  const blocked = (x, y, r) =>
    clear.some(
      (k) =>
        x + (r || 0) > k.x &&
        x - (r || 0) < k.x + k.w &&
        y + (r || 0) > k.y &&
        y - (r || 0) < k.y + k.h
    );
  // The crown's outline: an ellipse around the top-right (branches get shorter towards its edge)
  const C = TREE.crown;
  const cx = VR + C.cx,
    cy = scene.geo.VIEW.y + C.cy;
  const inCrown = (x, y) => ((x - cx) / C.rx) ** 2 + ((y - cy) / C.ry) ** 2 < 1;
  const fits = (x, y) =>
    inCrown(x, y) && y > scene.geo.VIEW.y - 60 && !blocked(x, y);
  // Leaves may stick out of the crown's outline only a little
  const inCrownLoose = (x, y) =>
    ((x - cx) / (C.rx * 1.06)) ** 2 + ((y - cy) / (C.ry * 1.06)) ** 2 < 1;

  // Wood is drawn as short stroke pieces so it can taper: all outlines first, then all fills
  const segs = [];
  function limb(x, y, x2, y2, w1, w2, bend) {
    const mx = (x + x2) / 2 + bend * (y2 - y) * 0.15,
      my = (y + y2) / 2 - bend * (x2 - x) * 0.15;
    const pt = (t) => {
      const a = (1 - t) * (1 - t),
        b = 2 * (1 - t) * t,
        c = t * t;
      return [a * x + b * mx + c * x2, a * y + b * my + c * y2];
    };
    const n = w1 > 6 ? 6 : 2;
    for (let i = 0; i < n; i++) {
      const p1 = pt(i / n),
        p2 = pt((i + 1) / n);
      segs.push({
        d: `M${p1[0].toFixed(1)},${p1[1].toFixed(1)}L${p2[0].toFixed(1)},${p2[1].toFixed(1)}`,
        w: w1 + (w2 - w1) * ((i + 0.5) / n),
      });
    }
    return pt; // to find points along the limb
  }

  // Trunk: from below the bottom-right corner, leaning in as it rises (centre line points)
  const trunk = TREE.trunk.map((p) => [
    VR + p[0],
    p[1] === "bottom" ? VB + 40 : p[1],
  ]);
  const tw = (i) =>
    TREE.trunkWidth[0] +
    (TREE.trunkWidth[1] - TREE.trunkWidth[0]) * (i / (trunk.length - 1));
  for (let i = 0; i < trunk.length - 1; i++)
    limb(
      trunk[i][0],
      trunk[i][1],
      trunk[i + 1][0],
      trunk[i + 1][1],
      tw(i),
      tw(i + 1),
      0
    );

  // Branches: main limbs from the trunk, splitting until they're thin or reach the crown's edge
  const fine = []; // thin outer branches: where twigs and leaves grow
  // base: the main limb's direction; branches never turn more than 70 degrees away from it,
  // so nothing grows back towards the trunk
  function branch(x, y, deg, len, w, depth, base) {
    // How much of the branch fits along direction d (0..1), checked in small steps
    const fitFor = (d) => {
      const r = d * deg2rad;
      let k = 0;
      for (let t = 0.1; t <= 1.001; t += 0.1) {
        if (!fits(x + Math.cos(r) * len * t, y + Math.sin(r) * len * t)) break;
        k = t;
      }
      return k;
    };
    // Try the planned direction and small turns; keep whichever fits furthest
    let best = { deg: deg, k: fitFor(deg) };
    [-TREE.maxTurn, -TREE.maxTurn / 2, TREE.maxTurn / 2, TREE.maxTurn].forEach(
      (turn) => {
        const k = fitFor(deg + turn);
        if (k > best.k + 0.15) best = { deg: deg + turn, k: k };
      }
    );
    if (best.k < 0.3) return; // too close to the edge: this branch simply doesn't grow
    deg = best.deg;
    const r = deg * deg2rad,
      L = len * best.k;
    const x2 = x + Math.cos(r) * L,
      y2 = y + Math.sin(r) * L;
    const pt = limb(x, y, x2, y2, w, w * 0.7, (rnd() - 0.5) * 1.4);
    const tip = depth <= 0 || best.k < 0.7; // cut short by the edge: no further splitting
    if (w <= TREE.twigFrom)
      fine.push({ pt: pt, deg: deg, len: L, w: w, tip: tip });
    // Thick limbs grow side branches along their length, so the inside of the crown fills too
    if (w > TREE.twigFrom * 1.3) {
      let side = rnd() < 0.5 ? 1 : -1;
      for (
        let d = TREE.sideEvery * (0.6 + rnd() * 0.5);
        d < L * 0.9;
        d += TREE.sideEvery * (0.8 + rnd() * 0.5)
      ) {
        const p = pt(d / L);
        const sd = Math.max(
          base - 75,
          Math.min(base + 75, deg + side * (35 + rnd() * 25))
        );
        branch(
          p[0],
          p[1],
          sd,
          TREE.sideLen[0] + rnd() * (TREE.sideLen[1] - TREE.sideLen[0]),
          Math.max(4, w * 0.4),
          1,
          base
        );
        side = -side;
      }
    }
    if (tip) return;
    const kids = rnd() < 0.4 ? 3 : 2;
    for (let i = 0; i < kids; i++) {
      const spread = (i - (kids - 1) / 2) * (26 + rnd() * 16);
      let d = deg + spread + (rnd() - 0.5) * 14;
      d = Math.max(base - 70, Math.min(base + 70, d));
      branch(x2, y2, d, len * (0.62 + rnd() * 0.14), w * 0.64, depth - 1, base);
    }
  }
  TREE.limbs.forEach((L) => {
    let at = trunk[0]; // the trunk point at this height
    for (let i = 0; i < trunk.length - 1; i++) {
      if (trunk[i][1] >= L.y && trunk[i + 1][1] <= L.y) {
        const t = (trunk[i][1] - L.y) / (trunk[i][1] - trunk[i + 1][1]);
        at = [trunk[i][0] + (trunk[i + 1][0] - trunk[i][0]) * t, L.y];
      }
    }
    branch(at[0], at[1], L.deg, L.len, L.w, L.depth, L.deg);
  });

  // Twigs: short thin sticks off the fine branches, alternating sides. Leaves hang from these.
  const twigs = [];
  fine.forEach((b) => {
    let side = rnd() < 0.5 ? 1 : -1;
    for (
      let d = TREE.twigEvery * (0.5 + rnd());
      d < b.len;
      d += TREE.twigEvery * (0.7 + rnd() * 0.6)
    ) {
      const p = b.pt(d / b.len);
      const deg = b.deg + side * (40 + rnd() * 30),
        len = 16 + rnd() * 20;
      side = -side;
      const x2 = p[0] + Math.cos(deg * deg2rad) * len,
        y2 = p[1] + Math.sin(deg * deg2rad) * len;
      if (!fits(x2, y2)) continue;
      twigs.push({ x: p[0], y: p[1], x2: x2, y2: y2, deg: deg });
      limb(p[0], p[1], x2, y2, 3, 1.6, 0);
    }
    if (b.tip) {
      const p = b.pt(1);
      twigs.push({
        x: p[0],
        y: p[1],
        x2: p[0],
        y2: p[1],
        deg: b.deg,
        end: true,
      });
    }
  });

  // Pieces of (about) the same width share one path: a few dozen elements instead of thousands
  const byWidth = {};
  segs.forEach((s) => {
    const w = Math.max(1.5, Math.round(s.w * 2) / 2);
    byWidth[w] = (byWidth[w] || "") + s.d;
  });
  const widths = Object.keys(byWidth).map(Number);
  const pass = (stroke, extra) =>
    widths.forEach((w) =>
      el(
        "path",
        {
          d: byWidth[w],
          fill: "none",
          stroke: stroke,
          "stroke-width": w + extra(w),
          "stroke-linecap": "round",
        },
        wood
      )
    );
  pass(TREE.barkLine, (w) => (w > 4 ? 4 : 2)); // outlines first, then fills, so joints look seamless
  pass(TREE.bark, () => 0);

  // Leaves hang from the twigs by their stem: a few along each twig and at its end,
  // pointing outwards and drooping a little
  const canopy = [];
  let total = 0;
  twigs.forEach((t) => {
    const n = t.end
      ? TREE.tipLeaves
      : TREE.twigLeaves[0] +
        (rnd() < 0.5 ? 1 : 0) * (TREE.twigLeaves[1] - TREE.twigLeaves[0]);
    for (let i = 0; i < n; i++) {
      const along = t.end ? 1 : i === n - 1 ? 1 : 0.4 + rnd() * 0.4;
      const ax = t.x + (t.x2 - t.x) * along,
        ay = t.y + (t.y2 - t.y) * along;
      const s = 0.42 + rnd() * 0.22;
      let dir = t.deg + (rnd() < 0.5 ? -1 : 1) * (15 + rnd() * 45);
      dir += (90 - (((dir % 360) + 360) % 360)) * 0.15; // droop: pull a little towards straight down
      const cx = ax + Math.cos(dir * deg2rad) * 40 * s,
        cy = ay + Math.sin(dir * deg2rad) * 40 * s;
      total++;
      const dropDay = TREE.dropFrom + rnd() * (TREE.dropTo - TREE.dropFrom);
      const leaf = {
        x: cx,
        y: cy,
        s: s,
        deg: Math.round(dir + 90), // the sprite's tip points up; turn it to point along dir
        form: pick(rnd, LEAF_FORM_WEIGHTS),
        v: Math.floor(rnd() * LEAF_VARIANTS),
        col: pal[Math.floor(rnd() * pal.length)],
        behind: rnd() < 0.3,
      };
      if (
        dropDay > day &&
        cy < TREE.leavesAbove &&
        inCrownLoose(cx, cy) &&
        !blocked(cx, cy, 34 * s)
      )
        canopy.push(leaf);
    }
  });
  canopy.forEach((L) => {
    const fill = L.behind ? mix(L.col, scene.palette.t1, 0.3) : L.col;
    use(
      L.behind ? back : front,
      leafShape(L.form, L.v),
      `translate(${L.x.toFixed(1)} ${L.y.toFixed(1)}) rotate(${L.deg}) scale(${L.s.toFixed(2)})`,
      { fill: fill, stroke: mix(fill, INK, 0.5) }
    );
  });

  return {
    fullness: total ? canopy.length / total : 0,
    // A random leaf in the crown: where a falling leaf starts
    spawnPoint() {
      if (!canopy.length) return null;
      const L = canopy[Math.floor(Math.random() * canopy.length)];
      return { x: L.x, y: L.y };
    },
  };
}
