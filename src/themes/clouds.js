// Clouds for themes, from the live weather. They sit mostly above the top edge: we only see their
// lower halves hanging into the strip above the plan, down to halfway to the first line of text.
// The more cloud cover, the more clouds; when it's overcast they merge into one continuous bank.
// When it rains they turn greyer (and rain falls from under them: see coverAt, used by rain.js).
// They drift right to left with the wind.
//
// Cheap on the TV: the clouds are drawn once, in their own layer (scene.sky, a separate drawing),
// and drifting moves that whole layer, which the browser does without redrawing anything. The
// cloud field repeats every CLOUDS.period screen widths, so it can drift forever.
// Test switch: ?clouds=0..1 (pretend cloud cover; ?weather=partly|cloudy|overcast works too)
import { el } from "../core/svg.js";
import { QS } from "../core/params.js";
import { CLOUDS } from "../config.js";
import { everyFrame, seeded, mix } from "./toolkit.js";

// sky: an overlay <svg> of its own; textTop: y of the first text below the strip (clouds stay
// above halfway to it); wet(): how hard it's raining, 0..1
export function startClouds(sky, scene, wind, textTop, wet) {
  const { VIEW } = scene.geo;
  const C = CLOUDS;
  const forced = parseFloat(QS.get("clouds"));
  const lowest = VIEW.y + (textTop - VIEW.y) * C.depth; // the lowest a cloud may hang
  const P = Math.round(VIEW.w * C.period); // the field repeats every P units
  const rnd = seeded("clouds"); // the same cloud shapes every load
  const between = (a, b) => a + rnd() * (b - a);

  // ---- The cloud field: N clouds spread over one period, each a row of puffs ----
  // Each cloud gets a rank: with little cover only the lowest ranks show.
  const clouds = [];
  const n = C.count;
  const order = [];
  for (let i = 0; i < n; i++) order.push(i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  for (let i = 0; i < n; i++) {
    const w = between(C.width[0], C.width[1]);
    const cx = VIEW.x + ((i + 0.5) / n) * P + (rnd() - 0.5) * (P / n) * 0.5;
    // most hang down close to the limit, a few stay higher
    const base = lowest - Math.pow(rnd(), 2) * (lowest - VIEW.y) * 0.55;
    clouds.push({ cx: cx, w: w, rank: order[i] / n, base: base });
  }
  // The bank: one long low cloud over the whole period, for overcast days
  const bank = {
    cx: VIEW.x + P / 2,
    w: P,
    rank: -1,
    base: VIEW.y + (lowest - VIEW.y) * 0.6,
    bank: true,
  };

  // Puffs for a cloud: a lumpy belly, bigger in the middle; their tops are well above the edge
  function puffs(c) {
    const out = [];
    const k = Math.max(3, Math.round(c.w / C.puffEvery));
    for (let i = 0; i < k; i++) {
      const u = (i + 0.5) / k; // 0..1 along the cloud
      const mid = 1 - Math.abs(u - 0.5) * 1.4; // bigger towards the middle
      const r = (C.puff[0] + (C.puff[1] - C.puff[0]) * mid) * between(0.85, 1.15);
      // a belly: deepest in the middle, the ends rise towards the top edge
      const rise = c.bank
        ? between(0, 0.35)
        : Math.pow(1 - mid, 1.3) * 0.85 + between(0, 0.1);
      const bottom = c.base - rise * (c.base - VIEW.y);
      out.push({ x: c.cx - c.w / 2 + u * c.w + (rnd() - 0.5) * 20, y: bottom - r, r: r });
    }
    return out;
  }

  // ---- Drawing: three copies of the field side by side (one period apart), so it can drift ----
  const fieldG = el("g", { class: "clouds" }, sky);
  function drawCloud(c) {
    const ps = puffs(c);
    const g = el("g", { opacity: 0 }, fieldG);
    [-P, 0, P].forEach((dx) => {
      const copy = el("g", { transform: `translate(${dx} 0)` }, g);
      // a faint, slightly bigger halo first (softens the edge), then the outline, then the body
      ps.forEach((p) =>
        el("circle", { cx: p.x, cy: p.y, r: p.r + C.halo, class: "cloud-halo" }, copy),
      );
      ps.forEach((p) =>
        el("circle", { cx: p.x, cy: p.y, r: p.r, class: "cloud-line" }, copy),
      );
      ps.forEach((p) =>
        el("circle", { cx: p.x, cy: p.y, r: p.r, class: "cloud-body" }, copy),
      );
    });
    c.g = g;
    c.shown = 0;
  }
  drawCloud(bank);
  clouds.forEach(drawCloud);

  // ---- Cover from the weather, easing like the rain ----
  function target() {
    if (!isNaN(forced)) return Math.max(0, Math.min(1, forced));
    const w = scene.weather();
    return w ? w.cloud / 100 : 0;
  }
  let t = 0;
  let cover = target();
  scene.on("weather", () => {
    if (t < 15) cover = target(); // the first weather after loading: no fade
  });
  // How much each cloud shows at this cover: ranks below the cover show, one fades at the border
  const showFor = (c) =>
    c.bank
      ? Math.max(0, Math.min(1, (cover - C.bankFrom) / (1 - C.bankFrom)))
      : Math.max(0, Math.min(1, (cover * 1.1 - c.rank) * n));

  let offset = 0, // how far the field has drifted, in plan units (0..P)
    scale = 1,
    lastGrey = -1;
  function measure() {
    // plan units to screen pixels, as the plan is fitted into the window
    const r = document.getElementById("plan").getBoundingClientRect();
    scale = Math.min(r.width / VIEW.w, r.height / VIEW.h);
  }
  measure();
  window.addEventListener("resize", measure);

  everyFrame((now, dt) => {
    t += dt;
    cover += (target() - cover) * Math.min(1, dt / C.ease);
    // Only touch the drawing when something visibly changed (each change redraws this layer)
    [bank].concat(clouds).forEach((c) => {
      const s = showFor(c);
      if (Math.abs(s - c.shown) > 0.03 || (s === 0) !== (c.shown === 0)) {
        c.shown = s;
        c.g.setAttribute("opacity", (s * C.opacity).toFixed(2));
      }
    });
    const grey = Math.round((wet ? wet() : 0) * 20) / 20;
    if (grey !== lastGrey) {
      lastGrey = grey;
      sky.style.setProperty("--cloud-body", mix(C.body, C.rainBody, grey));
      sky.style.setProperty("--cloud-line", mix(C.line, C.rainLine, grey));
    }
    // Drift: moving the whole layer, no redrawing
    const k = wind ? wind.strength() + 0.3 * wind.gust() : 0.1;
    offset = (offset + (C.speed[0] + (C.speed[1] - C.speed[0]) * k) * dt) % P;
    sky.style.transform = `translate3d(${(-offset * scale).toFixed(1)}px,0,0)`;
  });

  return {
    // 0..1: how much cloud is above screen x right now (rain falls from under the clouds)
    coverAt(x) {
      let f = (x + offset - VIEW.x) % P;
      if (f < 0) f += P;
      f += VIEW.x;
      if (bank.shown > 0.5) return 1;
      let best = 0;
      clouds.forEach((c) => {
        if (c.shown <= 0) return;
        for (let d = -P; d <= P; d += P)
          if (Math.abs(f - (c.cx + d)) < c.w / 2) best = Math.max(best, c.shown);
      });
      return best;
    },
    cover: () => cover,
  };
}
