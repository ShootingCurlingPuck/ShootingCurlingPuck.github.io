// Snow settling, made of the flakes themselves. A falling flake stops at the first thing it meets:
// the top of a tile, the clock frame, a tree's branch, or the ground (in autumn: the very top of the
// leaves, the stump, a mushroom cap). Where that thing is cold enough, the flake stays: first a
// sprinkling of single flakes, then they crowd together into lumps and a layer, up to a limit.
// Where it's too warm, flakes just melt away (the snow kind shows them a moment), and lying snow
// melts unevenly, the thinnest spots first.
// Each surface goes by its own temperature: the ground, the tiles and the clock frame by the
// ground's surface temperature; things up in the air (branches) by the air's.
// There are far fewer flakes on screen than in a real snowfall, so each lying flake counts for
// more: the depth still grows at the weather's real rate (cm per hour, SETTLE.unitsPerCm), while
// the first sprinkling shows within minutes. Snow already lying when the screen starts (the
// weather's snow depth) is there from the start.
// On the ground (in autumn: a leaf pile) it's first a sprinkling of flakes on the leaf tops; then it
// fills in between the leaves and rises as a blanket: white from its surface down to the bottom
// edge, with only the leaves that stick up above it showing (a flake or two on top). On ledges
// (tiles, the clock frame, branches) it's a thin layer of piled lumps.
// Drawn as round dots (one path per size, outlines under fillings so touching dots merge into one
// shape) and the blanket's area, in the moving layer with the flakes: the plan's own drawing never
// has to be redrawn.
// Test switches: ?temp=-3 (pretend air and ground temperature), ?settle=fast (60 times faster)
import { el } from "../core/svg.js";
import { QS } from "../core/params.js";
import { SETTLE } from "../config.js";
import { everyFrame } from "../core/anim.js";
import { exposedEdges } from "../themes/edges.js";

const STEP = 6; // units between spots along a surface
// a fixed little offset per spot, so the dots don't line up
const jitter = (i, k) => Math.sin(i * 12.9898 + k * 78.233) * 0.5;

// layer: where to draw (the moving layer, with the flakes); precip: the precipitation service
export function startSettle(layer, scene, precip) {
  const { VIEW, VR, VB } = scene.geo;
  const S = SETTLE;
  const forcedT = parseFloat(QS.get("temp"));
  const fast = QS.get("settle") === "fast" ? 60 : 1;

  // ---- The surfaces: each a row of spots, each spot with its snow depth ----
  // { kind: "ground" | "ledge" | "air", x1, y1, x2, y2 (a straight top; the ground: y(x)), group,
  //   h: depths, dust: the size of the first flake that lay there (0: bare) }
  const surfaces = [];
  function surface(kind, x1, y1, x2, y2, group) {
    const n = Math.max(1, Math.round(Math.abs(x2 - x1) / STEP));
    const s = { kind: kind, x1: x1, y1: y1, x2: x2, y2: y2, n: n, h: new Float32Array(n + 1), dust: new Float32Array(n + 1), group: group, dirty: true };
    surfaces.push(s);
    return s;
  }
  const max = (s) => S.max[s.kind];
  // the ground: its general line (where the blanket's surface starts) and, to the leaf, the very
  // top of what's there (where single flakes lie)
  const clampX = (x) => Math.max(VIEW.x, Math.min(VR, x));
  const baseY = (x) => precip.ground()(clampX(x));
  const groundY = (x) => {
    const g = precip.ground();
    return g.exact ? g.exact(clampX(x)) : g(clampX(x));
  };
  const yAt = (s, i) => (s.kind === "ground" ? groundY(s.x1 + i * STEP) : s.y1 + ((s.y2 - s.y1) * i) / s.n);
  const xAt = (s, i) => s.x1 + ((s.x2 - s.x1) * i) / s.n;

  // drawing groups: the tiles' snow fades with the plan in standby; the clock's is redrawn where the
  // clock goes
  const g = el("g", { class: "settled" }, layer);
  layer.insertBefore(g, layer.firstChild); // under the falling flakes
  const groups = { ground: el("g", {}, g), plain: el("g", {}, g), tiles: el("g", {}, g), clock: el("g", {}, g) };
  function paths(parent) {
    const rims = el("g", {}, parent),
      fills = el("g", {}, parent);
    return S.dots.map((d) => ({
      d: d,
      rim: el("path", { fill: "none", stroke: S.edge, "stroke-width": d + 2, "stroke-linecap": "round" }, rims),
      fill: el("path", { fill: "none", stroke: S.colour, "stroke-width": d, "stroke-linecap": "round" }, fills),
    }));
  }
  // the ground: the sprinkling (flakes on the leaf tops), and the blanket (outlines of its bumpy top,
  // its area, then the dots' fillings), which fades in as the snow deepens
  const dusting = el("g", {}, groups.ground);
  dusting.paths = paths(dusting);
  const blanketG = el("g", {}, groups.ground);
  blanketG.style.display = "none";
  const gRims = el("g", {}, blanketG);
  const blanket = el("path", { fill: S.colour }, blanketG);
  const gFills = el("g", {}, blanketG);
  blanketG.paths = S.dots.map((d) => ({
    rim: el("path", { fill: "none", stroke: S.edge, "stroke-width": d + 2, "stroke-linecap": "round" }, gRims),
    fill: el("path", { fill: "none", stroke: S.colour, "stroke-width": d, "stroke-linecap": "round" }, gFills),
  }));
  ["plain", "tiles", "clock"].forEach((k) => (groups[k].paths = paths(groups[k])));

  const ground = surface("ground", VIEW.x, 0, VR, 0, groups.ground);
  const clear = (x1, x2, y) =>
    !scene.keepOut.some((k) => x2 > k.x && x1 < k.x + k.w && y > k.y - 20 && y < k.y + k.h);
  exposedEdges(scene.geo)
    .filter((e) => e.side === "top" && clear(e.x1, e.x2, e.at))
    .forEach((e) => surface("ledge", e.x1, e.at, e.x2, e.at, groups.tiles));
  // the clock frame's tops: placed where the clock is in this mode (and again when it moves)
  const clockTops = (scene.clockTops || []).map(() => surface("ledge", 0, 0, 0, 0, groups.clock));
  function placeClock() {
    const standby = scene.isStandby();
    (scene.clockTops || []).forEach((e, i) => {
      const a = scene.clockPoint(e.x1, e.y, standby),
        b = scene.clockPoint(e.x2, e.y, standby);
      const s = clockTops[i];
      Object.assign(s, { x1: a.x, y1: a.y, x2: b.x, y2: b.y, dirty: true });
    });
    index();
  }

  // ---- Where a falling flake meets a ledge: per column, the ledges crossing it ----
  const COL = 10;
  let columns = {};
  function index() {
    columns = {};
    surfaces.forEach((s) => {
      if (s.kind === "ground") return;
      const a = Math.min(s.x1, s.x2),
        b = Math.max(s.x1, s.x2);
      for (let c = Math.floor(a / COL); c <= Math.floor(b / COL); c++) (columns[c] = columns[c] || []).push(s);
    });
  }
  placeClock();
  scene.on("mode", () => {
    groups.clock.style.display = "none"; // while the clock moves
    groups.tiles.setAttribute("opacity", scene.isStandby() ? 0.15 : 1);
    setTimeout(() => {
      placeClock();
      groups.clock.style.display = "";
    }, 1300);
  });
  groups.tiles.setAttribute("opacity", scene.isStandby() ? 0.15 : 1);

  // ---- Temperatures ----
  function temps() {
    if (!isNaN(forcedT)) return { air: forcedT, ground: forcedT };
    const w = scene.weather();
    if (!w) return null;
    return {
      air: w.tempC !== null ? w.tempC : 5,
      ground: w.groundC !== null ? w.groundC : w.tempC !== null ? w.tempC : 5,
    };
  }
  const tempOf = (s, T) => (s.kind === "air" ? T.air : T.ground);
  let T = temps();

  // ---- Snow already lying when it starts ----
  let started = false;
  scene.on("weather", (w) => {
    T = temps();
    if (started || !w || !T) return;
    started = true;
    const lying = (w.snowDepthCm || 0) * S.unitsPerCm;
    if (lying < 0.5) return;
    surfaces.forEach((s) => {
      if (tempOf(s, T) > S.freeze) return;
      for (let i = 0; i <= s.n; i++) {
        s.h[i] = Math.min(max(s), lying * (0.7 + 0.3 * (jitter(i, 3) + 0.5)));
        s.dust[i] = S.dots[1];
      }
      s.dirty = true;
    });
  });

  // ---- A flake lying down ----
  // How much depth one flake adds: the weather's rate spread over the flakes landing (counted as
  // they land), so the depth follows the real cm per hour however many flakes there are
  let landings = 10, // per second, a running count
    landedNow = 0;
  function rate() {
    const w = scene.weather();
    const cm = w && w.precip === "snow" && w.snowCm ? w.snowCm : S.pretendRate * precip.amount();
    return (cm * S.unitsPerCm * fast) / 3600; // units of depth per second
  }
  function lay(s, x, size) {
    if (!T || tempOf(s, T) > S.freeze) return false; // too warm: it melts
    let i = Math.round(((x - s.x1) / (s.x2 - s.x1 || 1)) * s.n);
    i = Math.max(0, Math.min(s.n, i));
    landedNow++;
    const width = VIEW.w; // depth per flake, as if it fell over the whole width
    const dh = Math.min(2, (rate() * width) / STEP / Math.max(1, landings));
    if (!s.dust[i]) s.dust[i] = size; // the first flake here: it shows as itself
    // the snow heaps up a little where it lands and spreads to its neighbours; full spots pass it on
    const add = (j, v, hops) => {
      if (j < 0 || j > s.n || hops > 6) return;
      const room = max(s) - s.h[j];
      if (room <= 0) return add(j + (Math.random() < 0.5 ? -1 : 1), v, (hops || 0) + 1);
      s.h[j] += Math.min(room, v);
      if (!s.dust[j] && s.h[j] > S.dots[0] * 0.4) s.dust[j] = S.dots[0];
    };
    add(i, dh * 0.5);
    add(i - 1, dh * 0.25);
    add(i + 1, dh * 0.25);
    s.dirty = true;
    return true;
  }

  // ---- Drawing ----
  // A spot with a little snow: one dot, from a single flake up to a small lump. Deeper: small lumps
  // piled up to the snow's top, so it's a layer with a bumpy top, not a ball.
  const DOTS = S.dots,
    LUMP = DOTS[DOTS.length - 1];
  const classOf = (size) => {
    let k = 0;
    while (k < DOTS.length - 1 && DOTS[k] < size) k++;
    return k;
  };
  // The blanket on the ground: one continuous layer once there's more than a sprinkling. It rises
  // from the bottom of the pile as the snow deepens: first only the gaps low down fill in, then up
  // to a little below the pile's general line (SETTLE.sink), then above it; whatever's taller than
  // its surface sticks out. The depth that counts is half the ground's average, half the local one
  // (levelled over a wide stretch: snow settles fairly flat), so it rises evenly.
  let mean = 0;
  const level = (i) => {
    let sum = 0,
      n = 0;
    for (let k = Math.max(0, i - 8); k <= Math.min(ground.n, i + 8); k++) {
      sum += ground.h[k];
      n++;
    }
    const e = 0.5 * mean + 0.5 * (sum / n),
      thr = S.blanket;
    const base = baseY(xAt(ground, i)) + S.sink;
    if (e <= thr / 2) return VB + 6;
    if (e < thr) return VB + 6 - ((e - thr / 2) / (thr / 2)) * (VB + 6 - base);
    return base - (e - thr);
  };
  let cover = 0; // 1: there's a blanket
  function drawGround() {
    mean = 0;
    for (let i = 0; i <= ground.n; i++) mean += ground.h[i];
    mean /= ground.n + 1;
    cover = mean > S.blanket / 2 ? 1 : 0;
    const dust = dusting.paths.map(() => ""),
      top = blanketG.paths.map(() => "");
    const dot = (d, k, x, y) => (d[k] += "M" + x.toFixed(1) + " " + y.toFixed(1) + "h0");
    const B = DOTS[DOTS.length - 2];
    let area = "";
    for (let i = 0; i <= ground.n; i++) {
      const x = xAt(ground, i),
        leaf = groundY(x),
        lv = level(i);
      if (cover) {
        // the blanket's surface here, with a soft bump along it
        const y = lv + jitter(i, 2) * 2;
        area += (area ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
        dot(top, classOf(B * (0.8 + 0.4 * (jitter(i, 5) + 0.5))), x + jitter(i, 1) * 2, y);
      }
      // flakes lying on a leaf top: on every leaf sticking out of the snow
      if (ground.dust[i] && leaf < lv - 3) {
        const k = Math.min(2, classOf(Math.max(ground.dust[i], cover ? 0 : ground.h[i] * 1.6)));
        dot(dust, k, x + jitter(i, 1) * 3, leaf - DOTS[k] * 0.35);
      }
    }
    // the blanket: its surface (carried on past both edges of the picture), then down to below the
    // bottom edge
    if (area) {
      const first = level(0),
        last = level(ground.n);
      area =
        "M" + (VIEW.x - 400) + " " + first.toFixed(1) + area.replace(/^M/, "L") +
        "L" + (VR + 400) + " " + last.toFixed(1) + "L" + (VR + 400) + " " + (VB + 10) + "L" + (VIEW.x - 400) + " " + (VB + 10) + "Z";
    }
    blanket.setAttribute("d", area || "M0 0");
    blanketG.style.display = cover ? "" : "none";
    dusting.paths.forEach((p, k) => {
      p.rim.setAttribute("d", dust[k] || "M0 0");
      p.fill.setAttribute("d", dust[k] || "M0 0");
    });
    blanketG.paths.forEach((p, k) => {
      p.rim.setAttribute("d", top[k] || "M0 0");
      p.fill.setAttribute("d", top[k] || "M0 0");
    });
  }

  function draw(group) {
    if (group === groups.ground) return drawGround();
    const d = group.paths.map(() => "");
    const dot = (k, x, y) => (d[k] += "M" + x.toFixed(1) + " " + y.toFixed(1) + "h0");
    surfaces.forEach((s) => {
      if (s.group !== group) return;
      for (let i = 0; i <= s.n; i++) {
        const h = s.h[i];
        if (!s.dust[i] && h < 0.3) continue;
        const x = xAt(s, i) + jitter(i, 1) * 3,
          y = yAt(s, i);
        if (h < LUMP * 0.6) {
          const k = classOf(Math.max(s.dust[i], h * 1.6));
          dot(k, x, y - DOTS[k] * 0.35 + jitter(i, 2) * 1.5);
          continue;
        }
        // a layer: lumps from its top down to the surface
        const k = classOf(LUMP * (0.85 + 0.3 * (jitter(i, 5) + 0.5)));
        const D = DOTS[k];
        for (let yy = y - h + D / 2 + jitter(i, 2) * 2; yy < y - D * 0.3; yy += D * 0.6) dot(k, x, yy);
        dot(k, x, y - D * 0.3);
      }
    });
    group.paths.forEach((p, k) => {
      p.rim.setAttribute("d", d[k] || "M0 0");
      p.fill.setAttribute("d", d[k] || "M0 0");
    });
  }

  // ---- Melting, and redrawing what changed, a few times a second ----
  let since = 0;
  everyFrame((now, dt) => {
    since += dt;
    if (since < 0.25) return;
    landings += (landedNow / since - landings) * Math.min(1, since / 10);
    landedNow = 0;
    const step = since * fast;
    since = 0;
    T = temps();
    if (T)
      surfaces.forEach((s) => {
        const t = tempOf(s, T);
        if (t <= S.freeze) return;
        const melt = (S.melt * (1 + (t - S.freeze)) * step) / 60;
        for (let i = 0; i <= s.n; i++) {
          if (!s.dust[i] && !s.h[i]) continue;
          s.h[i] = Math.max(0, s.h[i] - melt * (0.6 + 0.8 * (jitter(i, 4) + 0.5)));
          // a lone flake or the last bit of a patch melts away at a random moment
          if (s.h[i] <= 0 && s.dust[i] && Math.random() < step * 0.3) s.dust[i] = 0;
          s.dirty = true;
        }
      });
    Object.keys(groups).forEach((k) => {
      const grp = groups[k];
      if (surfaces.some((s) => s.group === grp && s.dirty)) draw(grp);
    });
    surfaces.forEach((s) => (s.dirty = false));
  });

  return {
    // a flake moving from y0 to y1 at x: does it stop on a ledge on the way? (true: it lies there now)
    catchFlake(x, y0, y1, size) {
      const list = columns[Math.floor(x / COL)];
      if (!list) return false;
      for (let k = 0; k < list.length; k++) {
        const s = list[k];
        const a = Math.min(s.x1, s.x2),
          b = Math.max(s.x1, s.x2);
        if (x < a || x > b) continue;
        const y = s.y1 + ((s.y2 - s.y1) * (x - s.x1)) / (s.x2 - s.x1 || 1);
        if (y0 < y && y1 >= y) return lay(s, x, size);
      }
      return false;
    },
    // a flake that reached the ground at x: does it stay? (false: it melts)
    landFlake: (x, size) => lay(surfaces[0], x, size),
    // where the ground's snow is at x (the top of the snow): flakes land on it
    groundAt(x) {
      const i = Math.max(0, Math.min(ground.n, Math.round((x - ground.x1) / STEP)));
      const leaf = groundY(x);
      return cover ? Math.min(leaf, level(i)) : leaf;
    },
    depth: () => {
      const avg = (k) => {
        const list = surfaces.filter((s) => s.kind === k);
        let sum = 0,
          n = 0;
        list.forEach((s) => s.h.forEach((v) => ((sum += v), n++)));
        return n ? sum / n : 0;
      };
      return { ground: avg("ground"), ledge: avg("ledge"), air: avg("air") };
    },
    // ledges up in the air that hold snow by the air's temperature: [{ x1, y1, x2, y2 }] (their top
    // surface; e.g. a tree's branches)
    addAirLedges(list) {
      list.forEach((e) => surface("air", e.x1, e.y1, e.x2, e.y2, groups.plain));
      index();
    },
  };
}
