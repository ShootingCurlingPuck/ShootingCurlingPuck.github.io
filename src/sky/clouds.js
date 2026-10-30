// Clouds, from the live weather, for everything (whatever the season). They sit mostly above the top
// edge: we only see their lower halves hanging into the strip above the plan, down to just above the
// first line of text. The more cloud cover, the more clouds; when it's overcast they merge into one
// continuous bank. Clouds never just pop up or vanish: a new one slides in from upwind or grows
// next to a visible one (about half and half), and one goes by drifting off downwind or by merging
// into a neighbour that stays. A lone cloud only leaves by drifting off. When it rains they turn greyer (and it falls from under them: see coverAt, used
// by precip.js). They drift with the wind. A theme may change their colours (setStyle).
//
// Cheap on the TV: the clouds are drawn once, in their own layer (scene.sky, a separate drawing),
// and drifting moves that whole layer, which the browser does without redrawing anything. The
// cloud field repeats every CLOUDS.period screen widths, so it can drift forever.
// Test switch: ?clouds=0..1 (pretend cloud cover; ?weather=partly|cloudy|overcast works too)
import { el } from "../core/svg.js";
import { QS } from "../core/params.js";
import { CLOUDS } from "../config.js";
import { everyFrame, seeded, mix } from "../core/anim.js";

// sky: an overlay <svg> of its own; textTop: y of the first text below the strip (clouds stay
// above it, see CLOUDS.depth); wet(): how hard it's raining, 0..1
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
    // its extent left and right of its centre, puffs included
    c.l = Math.min.apply(null, ps.map((p) => p.x - p.r - C.halo)) - c.cx;
    c.r = Math.max.apply(null, ps.map((p) => p.x + p.r + C.halo)) - c.cx;
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

  let offset = 0, // how far the field has drifted, in plan units (0..P)
    scale = 1,
    winL = VIEW.x, // the part of the field the window shows, in plan units
    winR = VIEW.x + VIEW.w,
    lastGrey = -1,
    style = { body: C.body, line: C.line, rainBody: C.rainBody, rainLine: C.rainLine };
  function measure() {
    // plan units to screen pixels, as the plan is fitted into the window (the window may be
    // wider than the plan: then it shows a bit more sky left and right)
    const r = document.getElementById("plan").getBoundingClientRect();
    scale = Math.min(r.width / VIEW.w, r.height / VIEW.h);
    const half = document.documentElement.clientWidth / scale / 2;
    winL = VIEW.x + VIEW.w / 2 - half;
    winR = VIEW.x + VIEW.w / 2 + half;
  }
  measure();
  window.addEventListener("resize", measure);

  // ---- Which clouds are out ----
  const copies = [-P, 0, P];
  const show = (c, s) => {
    if (Math.abs(s - c.shown) < 0.03 && s !== 0 && s !== 1) return; // only visible changes
    c.shown = s;
    c.g.setAttribute("opacity", (s * C.opacity).toFixed(2));
  };
  const onScreen = (c) =>
    c.bank ||
    copies.some((d) => {
      const x = c.cx + d - offset;
      return x + c.r > winL && x + c.l < winR;
    });
  const touching = (a, b) =>
    copies.some((d) => a.cx + a.l < b.cx + d + b.r && a.cx + a.r > b.cx + d + b.l);
  // how far an off-screen cloud still has to drift to come in (upwind of the window)
  function toEnter(c, dir) {
    let best = Infinity;
    copies.forEach((d) => {
      const x = c.cx + d - offset;
      const gap = dir < 0 ? x + c.l - winR : winL - (x + c.r);
      if (gap >= 0 && gap < best) best = gap;
    });
    return best;
  }
  const wanted = () => Math.round(Math.min(1, cover * 1.1) * n);
  const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

  // At load (and with the first weather): the sky is already as it is, no arriving
  function settle() {
    const want = wanted();
    clouds
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .forEach((c, i) => {
        c.on = i < want;
        c.fade = 0;
        show(c, c.on ? 1 : 0);
      });
    bank.on = cover >= C.bankFrom;
    bank.fade = 0;
    show(bank, bank.on ? 1 : 0);
  }
  settle();
  scene.on("weather", () => {
    if (t < 15) {
      cover = target(); // the first weather after loading: no fade
      settle();
    }
  });

  // One change at a time, every few seconds: one cloud more or one fewer
  function change(dir) {
    const out = clouds.filter((c) => c.on);
    const visible = out.filter(onScreen);
    const want = wanted();
    if (out.length < want) {
      const grow = clouds.filter(
        (c) => !c.on && onScreen(c) && visible.some((v) => touching(c, v)),
      );
      const edge = clouds
        .filter((c) => !c.on && !onScreen(c))
        .sort((a, b) => toEnter(a, dir) - toEnter(b, dir))[0];
      if (grow.length && (!edge || Math.random() < 0.5)) {
        const c = pickOne(grow);
        c.on = true;
        c.fade = 1; // grows in, next to a visible one
      } else if (edge) {
        edge.on = true; // just upwind, out of sight: it slides in
        show(edge, 1);
      }
    } else if (out.length > want) {
      const gone = out.filter((c) => !onScreen(c));
      const merge = visible.filter(
        (c) => c.fade >= 0 && visible.some((o) => o !== c && touching(c, o)),
      );
      if (gone.length) {
        const c = pickOne(gone); // out of sight: just don't bring it back
        c.on = false;
        show(c, 0);
      } else if (merge.length) {
        const c = pickOne(merge);
        c.on = false;
        c.fade = -1; // merges into its neighbour
      } // else: only lone clouds left; they leave by drifting off
    }
    // The bank (overcast) grows in from enough visible clouds, and merges back into them
    if (cover >= C.bankFrom && !bank.on && visible.length >= 3) {
      bank.on = true;
      bank.fade = 1;
    } else if (cover < C.bankFrom && bank.on && visible.length) {
      bank.on = false;
      bank.fade = -1;
    }
  }
  let nextChange = 0;

  everyFrame((now, dt) => {
    t += dt;
    cover += (target() - cover) * Math.min(1, dt / C.ease);
    const dir = wind ? wind.dir() : -1;
    nextChange -= dt;
    if (nextChange <= 0) {
      change(dir);
      nextChange = C.changeEvery[0] + Math.random() * (C.changeEvery[1] - C.changeEvery[0]);
    }
    // growing in and merging away (each change redraws this layer, so only visible steps)
    [bank].concat(clouds).forEach((c) => {
      if (!c.fade) return;
      const s = Math.max(0, Math.min(1, c.shown + (c.fade * dt) / (c.bank ? C.growFor * 2 : C.growFor)));
      if (s === 0 || s === 1) c.fade = 0;
      show(c, s);
    });
    const grey = Math.round((wet ? wet() : 0) * 20) / 20;
    if (grey !== lastGrey) {
      lastGrey = grey;
      sky.style.setProperty("--cloud-body", mix(style.body, style.rainBody, grey));
      sky.style.setProperty("--cloud-line", mix(style.line, style.rainLine, grey));
    }
    // Drift: moving the whole layer, no redrawing (offset grows as the field moves left)
    const k = wind ? wind.strength() + 0.3 * wind.gust() : 0.1;
    offset -= dir * (C.speed[0] + (C.speed[1] - C.speed[0]) * k) * dt;
    offset = ((offset % P) + P) % P;
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
    // colours: { body, line, rainBody, rainLine } (any of them), e.g. from a theme
    setStyle(s) {
      Object.keys(s).forEach((k) => (style[k] = s[k]));
      lastGrey = -1; // repaint with them
    },
  };
}
