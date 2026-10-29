// The permanent forest floor along the bottom edge of the screen (which counts as the ground):
// a leaf cover with a pile under the Booths list, and props: a tree stump, mushrooms, acorns, twigs...
// The layout is seeded by date: stable all day, different tomorrow.
import { TZ } from "../../config.js";
import { QS } from "../../core/params.js";
import { nowMs } from "../../core/time.js";
import { use } from "../../core/svg.js";
import { seeded, pick, mix, INK, randInt } from "../toolkit.js";
import { HAZE, FLOOR_PROPS } from "./settings.js";
import { LEAF_FORM_WEIGHTS, LEAF_VARIANTS, leafShape, propShape } from "./shapes.js";

export function drawForestFloor(g, scene, pal) {
  const { VIEW, VR, VB, ROOMS, LIST, CHIP, NAME_F, BOOTH_CHIP_Y } = scene.geo;
  const P = scene.palette;
  const haze = QS.get("haze") === "0" ? 0 : HAZE;
  // ?seed=anything previews another "day"
  const rnd = seeded("fall-floor " + (QS.get("seed") || new Date(nowMs()).toLocaleDateString("en-GB", { timeZone: TZ })));

  const oasis = ROOMS.filter((r) => r.name === "Oasis")[0];
  const groundTop = (oasis.y + oasis.h / 2 + NAME_F / 2 + oasis.y + oasis.h) / 2;
  const pileTop = BOOTH_CHIP_Y + CHIP + 44; // a little way under the booth chips
  const listR = LIST.x + LIST.w;
  const carpet = VB - 30; // the always-covered strip along the bottom edge

  // Surface of the leaf cover: a mound under the list that tails off to the right, and an uneven
  // floor elsewhere with some thin spots. Never above the halfway line on the floor.
  const peakX = LIST.x + LIST.w * (0.3 + rnd() * 0.3);
  const p1 = rnd() * 6,
    p2 = rnd() * 6,
    p3 = rnd() * 6;
  const mound = (x) => {
    const w = x < peakX ? peakX - VIEW.x + 60 : (listR - peakX) * 1.25;
    const d = (x - peakX) / w;
    return Math.abs(d) >= 1 ? 0 : (groundTop - pileTop) * Math.pow(Math.cos((Math.PI / 2) * d), 1.6);
  };
  const floorH = (x) => {
    // 0..1 share of the floor band that is covered: dips to bare carpet in a few spots
    const n = 0.55 + 0.3 * Math.sin(x / 53 + p1) + 0.25 * Math.sin(x / 131 + p2) + 0.15 * Math.sin(x / 23 + p3);
    return Math.max(0, Math.min(1, n));
  };
  const surface = (x) => {
    const floor = carpet - (carpet - groundTop) * floorH(x);
    return Math.max(pileTop, Math.min(floor, groundTop - mound(x)));
  };
  const inPile = (x) => mound(x) > 12;

  const keepOut = scene.keepOut; // QR code, logos
  const hits = (x, y, r) =>
    keepOut.some((k) => x + r > k.x && x - r < k.x + k.w && y + r > k.y && y - r < k.y + k.h);

  const leaves = [],
    props = [];
  function leaf(x, y, sMax, opt) {
    opt = opt || {};
    const s = 0.5 + ((sMax || 1.25) - 0.5) * Math.pow(rnd(), 1.4); // many small, a few big
    const r = 40 * s;
    if (y > VB - (opt.edge ? 2 : 6) || hits(x, y, r * 0.8)) return; // centre off screen: not worth drawing
    leaves.push({
      x: x,
      y: y,
      r: r,
      s: s,
      key: opt.key !== undefined ? opt.key : y,
      back: opt.key === undefined && rnd() < 0.3, // back layer: drawn first, hazed
      squash: rnd() < 0.25 ? 0.45 + rnd() * 0.3 : 0.85 + rnd() * 0.15, // some seen at an angle
      form: pick(rnd, LEAF_FORM_WEIGHTS),
      v: Math.floor(rnd() * LEAF_VARIANTS),
      col: pal[Math.floor(rnd() * pal.length)],
      deg: Math.round(rnd() * 360),
      skew: Math.round((rnd() - 0.5) * 16),
      flip: rnd() < 0.5 ? -1 : 1
    });
  }

  // Fill each column from the bottom up to the surface: solid in the pile, closed along the bottom,
  // thinning out higher up on the floor. Leaves sit with their centre below the surface, so every
  // top leaf has others underneath it.
  for (let x = VIEW.x - 30; x < VR + 30; x += 13) {
    const top = surface(x),
      pile = inPile(x);
    for (let y = VB - 10; y > top + 10; y -= 17 + rnd() * 8) {
      const up = (VB - y) / (VB - groundTop); // 0 at the bottom edge, 1 at the halfway line
      const thin = floorH(x); // 0 in the floor's thin spots
      const p = pile ? 0.85 : y > carpet ? 0.6 + 0.35 * thin : (0.6 - 0.3 * up) * thin;
      if (rnd() < p) leaf(x + (rnd() - 0.5) * 12, y + (rnd() - 0.5) * 8, pile ? 1.25 : 0.7 + 0.55 * thin);
    }
  }

  // Props. The bottom edge of the screen is the ground: everything either stands on it or rests on
  // something that does. Leaves in front of a prop may only hide the part below its bury line.
  // Standing props: extent left/right of the base, bury line and scale (sprite units)
  const STANDING = {
    stump: { l: -54, r: 56, bury: 30, s: 1 },
    mushroom: { l: -22, r: 22, bury: 16, s: 1.2 },
    mushrooms: { l: -30, r: 36, bury: 16, s: 1.2 },
    chanterelles: { l: -24, r: 24, bury: 10, s: 1.4 },
    mycena: { l: -22, r: 22, bury: 12, s: 1.3 },
    puffball: { l: -16, r: 16, bury: 8, s: 1.3 },
  };
  // Lying props: half width and half height as they lie, and the offset from sprite origin to middle
  const LYING = {
    acorn: { w: 24, h: 14, dy: 20 },
    conker: { w: 14, h: 13, dy: 0 },
    husk: { w: 28, h: 14, dy: 0 },
    twig: { w: 44, h: 7, dy: 0 },
    "branch-leaf": { w: 54, h: 9, dy: 0 },
  };
  const taken = []; // [x, half width] of every placed prop
  const free = (x, w) => taken.every((t) => Math.abs(t[0] - x) > t[1] + w);

  // Standing: base just below the screen edge, a few small leaves in front of the foot
  function standing(name, x) {
    const b = STANDING[name],
      s = b.s,
      yb = VB + 3;
    if (hits(x, yb - 40 * s, (b.r - b.l) * s * 0.5)) return false;
    const P = { name: name, key: yb, l: x + b.l * s, r: x + b.r * s, line: yb - b.bury * s };
    P.tf = `translate(${Math.round(x)} ${yb}) scale(${s})`;
    props.push(P);
    taken.push([x, ((b.r - b.l) * s) / 2]);
    for (let i = 0; i < 3; i++)
      leaf(x + b.l * s + rnd() * (b.r - b.l) * s, VB - 3 - rnd() * 6, 0.7, { key: P.key + 1, edge: true });
    return true;
  }
  // Lying: on the ground among the bottom leaves, or nestled into the pile, with leaves right behind
  // and under it to hold it up
  function lying(kind, x) {
    const b = LYING[kind];
    let name = kind,
      s = 1.1 + rnd() * 0.25,
      deg;
    if (kind === "acorn") name = pick(rnd, [["acorn", 6], ["nut", 2], ["cap", 1]]);
    if (kind === "twig") name = rnd() < 0.5 ? "twig" : "twig-fork";
    if (name === "cap") deg = (rnd() < 0.5 ? 0 : 180) + (rnd() - 0.5) * 24; // bowl-up or dome-up
    else if (kind === "acorn") deg = (rnd() < 0.5 ? -1 : 1) * (65 + rnd() * 50) + (rnd() < 0.2 ? 180 : 0); // on its side
    else if (kind === "conker") deg = rnd() * 360; // round: any way up
    else if (kind === "husk") deg = (rnd() - 0.5) * 30; // open side up
    else {
      deg = (rnd() < 0.5 ? 0 : 180) + (rnd() - 0.5) * 24; // twigs lie roughly flat, either way round
      s = 0.9 + rnd() * 0.3;
    }
    const half = (name === "cap" ? 8 : b.h) * s,
      hw = b.w * s;
    const cy = inPile(x) ? Math.min(VB - half - 2, surface(x) + 40 + rnd() * 30) : VB - half - rnd() * 4;
    if (hits(x, cy, Math.max(hw, 26 * s))) return false;
    const P = { name: name, key: cy + 1, l: x - hw, r: x + hw, line: cy + half * 0.3, cx: x, cy: cy, rad: half };
    P.tf = `translate(${Math.round(x)} ${Math.round(cy)}) rotate(${Math.round(deg)}) scale(${s.toFixed(2)}) translate(0 ${name === "cap" ? 14 : b.dy})`;
    props.push(P);
    taken.push([x, hw]);
    const n = hw > 30 ? 3 : 2; // long twigs get more support
    for (let i = 0; i < n; i++) leaf(x - hw * 0.6 + rnd() * hw * 1.2, cy + 14 + rnd() * 4, 0.8, { key: cy - 1, edge: true });
    return true;
  }

  // Today's selection: a random count of each kind (see FLOOR_PROPS), placed in random order
  const stumpX = Math.max(VIEW.x + 80, Math.min(listR - 70, peakX + (rnd() < 0.5 ? -1 : 1) * (110 + rnd() * 60)));
  if (randInt(rnd, FLOOR_PROPS.stump[0], FLOOR_PROPS.stump[1])) standing("stump", stumpX);
  const todo = [];
  Object.keys(FLOOR_PROPS).forEach((k) => {
    if (k === "stump") return;
    for (let n = randInt(rnd, FLOOR_PROPS[k][0], FLOOR_PROPS[k][1]); n > 0; n--) todo.push(k);
  });
  for (let i = todo.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1)),
      t = todo[i];
    todo[i] = todo[j];
    todo[j] = t;
  }
  todo.forEach((kind) => {
    const w = STANDING[kind] ? ((STANDING[kind].r - STANDING[kind].l) * STANDING[kind].s) / 2 : LYING[kind].w * 1.2;
    for (let tries = 0; tries < 30; tries++) {
      const x = VIEW.x + 40 + rnd() * (VR - VIEW.x - 80);
      if (!free(x, w + 20)) continue;
      if (STANDING[kind] ? standing(kind, x) : lying(kind, x)) break;
    }
  });

  // A leaf in front of a prop may not reach above that prop's bury line
  const unburied = leaves.filter((L) =>
    props.every((P) => !(L.key > P.key && L.x + L.r * 0.7 > P.l && L.x - L.r * 0.7 < P.r && L.y - L.r * 0.7 < P.line))
  );

  // Gravity: working up from the bottom, keep only what touches the ground (the screen edge) or rests
  // on something already kept. Rooted props stand on the ground; lying acorns need support too.
  const loose = unburied
    .map((L) => ({ x: L.x, y: L.y, r: L.r * 0.55, leaf: L }))
    .concat(props.filter((P) => P.rad).map((P) => ({ x: P.cx, y: P.cy, r: P.rad, prop: P })));
  loose.sort((a, b) => b.y - a.y);
  const held = [];
  loose.forEach((it) => {
    const bottom = it.y + it.r;
    const ok =
      bottom >= VB - 4 ||
      held.some((h) => h.y > it.y && h.y - h.r <= bottom && Math.abs(h.x - it.x) < h.r * 1.2 + it.r * 0.3);
    if (ok) held.push(it);
    else if (it.prop) props.splice(props.indexOf(it.prop), 1);
  });
  const kept = held.filter((h) => h.leaf).map((h) => h.leaf);

  const draw = (L) => {
    const fill = L.back ? mix(L.col, P.t1, haze * (0.6 + 0.4 * rnd())) : L.col;
    use(
      g,
      leafShape(L.form, L.v),
      `translate(${Math.round(L.x)} ${Math.round(L.y)}) rotate(${L.deg}) skewX(${L.skew}) scale(${(L.flip * L.s).toFixed(2)} ${(L.s * L.squash).toFixed(2)})`,
      { fill: fill, stroke: mix(fill, INK, 0.45) }
    );
  };
  const byKey = (a, b) => a.key - b.key;
  // Back layer first, then the front layer with the props slotted in by depth
  kept.filter((L) => L.back).sort(byKey).forEach(draw);
  kept
    .filter((L) => !L.back)
    .concat(props.map((p) => ({ key: p.key, prop: p })))
    .sort(byKey)
    .forEach((it) => (it.prop ? use(g, propShape(it.prop.name), it.prop.tf) : draw(it)));
  return surface; // falling leaves land on this
}
