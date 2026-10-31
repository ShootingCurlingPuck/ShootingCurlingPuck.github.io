// The night sky, for everything (whatever the season): the real stars, planets and moon, and
// shooting stars at the real rate (more during the meteor showers), as seen
// from the office through the screen as a window facing NIGHT.facing (south-east), so the sky turns
// from left to right through the night. They come out with the darkness (the moon and the brightest
// stars first, the faint ones only at full night), and hide behind the clouds.
//
// They sit above the night veil (so they shine) but look as if they're behind everything: the
// foreground is cut out of their layer. In live mode that's the plan (except the central block
// with the clock, a window onto the sky), the list's text, the clock, the keep-clear spots, and
// whatever the theme adds (addForeground, e.g. the autumn tree and leaf litter). In standby nobody
// needs the room data, so the stars may cover it: only the clock and the theme's drawings stay in
// front. The moon stays in the top strip, like the clouds; in daylight it's a pale day moon, and
// behind a cloud its glow still shows through.
// Cheap: the positions are worked out again every NIGHT.every seconds only (the sky turns slowly).
import { el, use, defs, XLINK } from "../core/svg.js";
import { loadSprites } from "../core/sprites.js";
import { WEATHER_AT, NIGHT } from "../config.js";
import { everyFrame } from "../core/anim.js";
import { debugLog } from "../core/debug.js";
import { sunAltitude } from "./daylight.js";
import { STARS } from "./stars-data.js";
import { planetAt, PLANET_NAMES } from "./planets.js";
import { meteorsNow } from "./meteors.js";
import { QS } from "../core/params.js";

const rad = Math.PI / 180;

// Local sidereal time in degrees (how far the sky has turned), at time ms and longitude lon
function siderealDeg(ms, lon) {
  const d = ms / 86400000 + 2440587.5 - 2451545.0;
  return ((((280.46061837 + 360.98564736629 * d + lon) % 360) + 360) % 360);
}
// Height and compass direction (degrees, 0 = north, 90 = east) of right ascension/declination
function horizon(raDeg, decDeg, lstDeg, lat) {
  const h = (lstDeg - raDeg) * rad,
    dec = decDeg * rad,
    phi = lat * rad;
  const alt = Math.asin(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(h),
  );
  const az = Math.atan2(
    -Math.cos(dec) * Math.sin(h),
    Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.sin(phi) * Math.cos(h),
  );
  return { alt: alt / rad, az: ((az / rad) % 360 + 360) % 360 };
}
// The moon (a standard low-precision formula, good to about a degree): where it is, and how
// much of it is lit (0 new .. 1 full) and whether it's waxing
function moonAt(ms) {
  const d = ms / 86400000 + 2440587.5 - 2451545.0;
  const L = 218.316 + 13.176396 * d,
    M = (134.963 + 13.064993 * d) * rad,
    F = (93.272 + 13.22935 * d) * rad;
  const lon = (L + 6.289 * Math.sin(M)) * rad,
    lat = 5.128 * Math.sin(F) * rad,
    e = 23.439 * rad;
  const ra = Math.atan2(
    Math.sin(lon) * Math.cos(e) - Math.tan(lat) * Math.sin(e),
    Math.cos(lon),
  );
  const dec = Math.asin(
    Math.sin(lat) * Math.cos(e) + Math.cos(lat) * Math.sin(e) * Math.sin(lon),
  );
  // the sun's longitude, for the phase
  const g = (357.529 + 0.98560028 * d) * rad;
  const sunLon = (280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad;
  const elong = Math.acos(Math.cos(lat) * Math.cos(lon - sunLon));
  return {
    ra: ((ra / rad) % 360 + 360) % 360,
    dec: dec / rad,
    lit: (1 - Math.cos(elong)) / 2,
    waxing: Math.sin(lon - sunLon) > 0,
  };
}

// layer: an overlay of its own, above the night veil and below the clouds; daylight: the clock and
// darkness (sky/daylight.js); textTop: the top of the first text under the top strip; clouds(): the
// clouds (sky/clouds.js), if any, for the moon's glow through them
export function startNightSky(layer, scene, daylight, textTop, clouds) {
  const { VIEW, VB, FLOOR, CORE } = scene.geo;
  const N = NIGHT;

  // ---- The window onto the sky: a stereographic view centred on the facing direction ----
  const az0 = N.facing * rad,
    alt0 = N.centre * rad;
  function project(alt, az) {
    const a = alt * rad,
      dz = az * rad - az0;
    const cosc =
      Math.sin(alt0) * Math.sin(a) + Math.cos(alt0) * Math.cos(a) * Math.cos(dz);
    const k = 2 / (1 + cosc);
    return {
      x: k * Math.cos(a) * Math.sin(dz),
      y: k * (Math.cos(alt0) * Math.sin(a) - Math.sin(alt0) * Math.cos(a) * Math.cos(dz)),
    };
  }
  // scale: the horizon straight ahead at the bottom edge, NIGHT.top degrees up at the top edge
  const p0 = project(0, N.facing),
    pTop = project(N.top, N.facing);
  const S = (VB - VIEW.y) / (pTop.y - p0.y);
  const cx = VIEW.x + VIEW.w / 2;
  const toScreen = (p) => ({ x: cx + p.x * S, y: VB - (p.y - p0.y) * S });

  // ---- The foreground, cut out of this layer: one cut-out for live mode, one for standby ----
  const black = el("filter", { id: "night-sky-black" }, defs); // drawings as black silhouettes
  el(
    "feColorMatrix",
    { type: "matrix", values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" },
    black,
  );
  function makeMask(id) {
    const m = el(
      "mask",
      {
        id: id,
        maskUnits: "userSpaceOnUse",
        x: VIEW.x - VIEW.w,
        y: VIEW.y - VIEW.h,
        width: VIEW.w * 3,
        height: VIEW.h * 3,
      },
      defs,
    );
    rect(m, VIEW.x - VIEW.w, VIEW.y - VIEW.h, VIEW.w * 3, VIEW.h * 3, "#fff");
    return m;
  }
  const rect = (m, x, y, w, h, fill) =>
    el("rect", { x: x, y: y, width: w, height: h, fill: fill }, m);
  const live = makeMask("night-sky-live"),
    standby = makeMask("night-sky-standby");
  // the plan, below the top strip (like the clouds, the strip down to the first text is sky)...
  const planTop = Math.max(FLOOR.y, textTop - 4);
  rect(live, FLOOR.x, planTop, FLOOR.w, FLOOR.y + FLOOR.h - planTop, "#000");
  rect(live, CORE.x, CORE.y, CORE.w, CORE.h, "#fff"); // ...with a window in the middle
  scene.keepOut.forEach((k) => rect(live, k.x, k.y, k.w, k.h, "#000")); // logos, labels, QR code
  let ids = 0;
  function silhouette(m, node) {
    if (!node.id) node.id = "night-sky-fg-" + ids++;
    const u = el("use", { filter: "url(#night-sky-black)" }, m);
    u.setAttributeNS(XLINK, "xlink:href", "#" + node.id);
  }
  // the plan's own foreground on the background (the list's text, the clock): only the clock stays
  // in front in standby (it's the last item of scene.foreground)
  const plan = scene.foreground || [];
  plan.forEach((node) => silhouette(live, node));
  if (plan.length) silhouette(standby, plan[plan.length - 1]);
  // theme drawings stay in front in both
  function addForeground(node) {
    silhouette(live, node);
    silhouette(standby, node);
  }

  const g = el("g", { class: "night-sky" }, layer);
  const cutFor = () =>
    g.setAttribute("mask", scene.isStandby() ? "url(#night-sky-standby)" : "url(#night-sky-live)");
  cutFor();
  scene.on("mode", cutFor);

  // ---- Stars: brightness groups, each one path of round dots (the brightest with a soft glow) ----
  const dots = (w, op) =>
    el(
      "path",
      { fill: "none", stroke: "#FFFFFF", "stroke-width": w, "stroke-linecap": "round", opacity: op },
      g,
    );
  const groups = N.stars.map((s) => {
    const sg = el("g", { opacity: 0 }, g);
    const glow = s.glow ? dots(s.glow, 0.18) : null;
    if (glow) sg.appendChild(glow);
    const core = dots(s.size, 1);
    sg.appendChild(core);
    return { g: sg, paths: glow ? [glow, core] : [core] };
  });
  function drawStars(ms) {
    const lst = siderealDeg(ms, WEATHER_AT.lon);
    const d = N.stars.map(() => "");
    for (let i = 0; i < STARS.length; i += 3) {
      const mag = STARS[i + 2] / 10;
      const b = N.stars.findIndex((s) => mag <= s.mag);
      if (b < 0) continue;
      const h = horizon(STARS[i] / 10, STARS[i + 1] / 10, lst, WEATHER_AT.lat);
      if (h.alt < 1) continue;
      const p = toScreen(project(h.alt, h.az));
      if (p.y > VB || p.y < VIEW.y - 50) continue;
      d[b] += `M${p.x.toFixed(1)} ${p.y.toFixed(1)}h0`;
    }
    groups.forEach((grp, b) => grp.paths.forEach((p) => p.setAttribute("d", d[b] || "M0 0")));
  }

  // ---- Planets: brighter dots in their real colours; Saturn with a hint of its rings ----
  const planets = PLANET_NAMES.map((name) => {
    const P = N.planets[name];
    const pg = el("g", { opacity: 0 }, g);
    el("circle", { r: P.size * 1.6, fill: P.colour, opacity: 0.22 }, pg); // glow
    if (name === "saturn")
      el(
        "ellipse",
        {
          rx: P.size * 1.9,
          ry: P.size * 0.55,
          fill: "none",
          stroke: P.colour,
          "stroke-width": P.size * 0.35,
          transform: "rotate(-18)",
        },
        pg,
      );
    el("circle", { r: P.size * 0.6, fill: P.colour }, pg);
    return { name: name, g: pg, up: false };
  });
  function drawPlanets(ms) {
    const lst = siderealDeg(ms, WEATHER_AT.lon);
    planets.forEach((pl) => {
      const at = planetAt(pl.name, ms);
      const h = horizon(at.ra, at.dec, lst, WEATHER_AT.lat);
      const p = toScreen(project(h.alt, h.az));
      pl.up = h.alt > 1 && p.y < VB && p.y > VIEW.y - 30;
      pl.g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    });
  }

  // ---- Shooting stars: at the real rate for the part of the sky the window shows ----
  // ?meteors=often: many more, to see them
  const often = QS.get("meteors") === "often" ? 40 : 1;
  const flying = [];
  const trail = (w, op) =>
    el(
      "path",
      { fill: "none", stroke: "#FFFFFF", "stroke-width": w, "stroke-linecap": "round", opacity: op },
      g,
    );
  function launch(src, lst) {
    // somewhere in the sky part of the window, flying away from its shower's radiant
    const x = VIEW.x + Math.random() * VIEW.w,
      y = VIEW.y + Math.random() * (VB - VIEW.y) * 0.7;
    let dx, dy;
    if (src.ra !== null) {
      const h = horizon(src.ra, src.dec, lst, WEATHER_AT.lat);
      const r = toScreen(project(h.alt, h.az));
      dx = x - r.x;
      dy = y - r.y;
    } else {
      const a = Math.random() * Math.PI * 2;
      dx = Math.cos(a);
      dy = Math.abs(Math.sin(a)) + 0.2; // random ones mostly head down
    }
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const speed = N.meteors.speed * (0.6 + src.speed / 70); // faster showers streak faster
    flying.push({
      x: x,
      y: y,
      ux: dx / len,
      uy: dy / len,
      v: speed,
      life: (N.meteors.length[0] + Math.random() * (N.meteors.length[1] - N.meteors.length[0])) / speed,
      t: 0,
      bright: 0.6 + Math.random() * 0.4,
      glow: trail(N.meteors.width * 3, 0),
      core: trail(N.meteors.width, 0),
    });
  }
  let rates = [],
    perSecond = 0;
  function updateRates(ms) {
    const lst = siderealDeg(ms, WEATHER_AT.lon);
    rates = meteorsNow(ms, (ra, dec) => horizon(ra, dec, lst, WEATHER_AT.lat).alt);
    const total = rates.reduce((sum, r) => sum + r.perHour, 0);
    perSecond = (total * N.meteors.share * N.meteors.times * often) / 3600;
  }
  function meteorFrame(dt, dark) {
    // only in the dark: fewer as the sky brightens
    const k = Math.max(0, Math.min(1, (dark - N.meteors.from) / (1 - N.meteors.from)));
    if (k > 0 && Math.random() < perSecond * k * dt) {
      // which source: in proportion to their rates
      let pickAt = Math.random() * rates.reduce((sum, r) => sum + r.perHour, 0);
      const src = rates.find((r) => (pickAt -= r.perHour) <= 0) || rates[0];
      if (src) launch(src, siderealDeg(daylight.time(), WEATHER_AT.lon));
    }
    for (let i = flying.length - 1; i >= 0; i--) {
      const m = flying[i];
      m.t += dt;
      const f = m.t / m.life; // 0..1 through its short life
      if (f >= 1) {
        g.removeChild(m.glow);
        g.removeChild(m.core);
        flying.splice(i, 1);
        continue;
      }
      // the head moves on; the tail grows, then the whole streak fades
      const hx = m.x + m.ux * m.v * m.t,
        hy = m.y + m.uy * m.v * m.t;
      const tail = Math.min(m.v * m.t, N.meteors.tail);
      const d = `M${hx.toFixed(1)} ${hy.toFixed(1)}L${(hx - m.ux * tail).toFixed(1)} ${(hy - m.uy * tail).toFixed(1)}`;
      const op = (f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85) * m.bright;
      m.core.setAttribute("d", d);
      m.glow.setAttribute("d", d);
      m.core.setAttribute("opacity", op.toFixed(2));
      m.glow.setAttribute("opacity", (op * 0.3).toFixed(2));
    }
  }

  // ---- The moon, in the top strip: the sprite (assets/sky/sprites.svg), cut to its lit part ----
  const R = N.moon.size;
  const moonG = el("g", { opacity: 0 }, g);
  const halo = el("circle", { r: R * 2.4, fill: "url(#moon-glow)", opacity: 0 }, moonG);
  el("circle", { r: R, fill: "#FFFFFF", opacity: 0.12 }, moonG); // the dark part, faintly
  const clip = el("clipPath", { id: "moon-lit" }, defs);
  const lit = el("path", {}, clip);
  const face = use(moonG, "sky-moon", `scale(${R / 50})`, { "clip-path": "url(#moon-lit)" });
  face.style.display = "none"; // until the sprite has loaded
  loadSprites("assets/sky/sprites.svg", ["sky-"])
    .then(() => (face.style.display = ""))
    .catch(() => {
      // no sprite: a plain disc instead
      face.parentNode.removeChild(face);
      el("circle", { r: R, fill: N.moon.colour, "clip-path": "url(#moon-lit)" }, moonG);
    });
  // its glow through the clouds: above them (in the top layer), shown while a cloud covers it
  const grad = el("radialGradient", { id: "moon-glow" }, defs);
  [
    [0, 0.55],
    [0.35, 0.28],
    [1, 0],
  ].forEach((st) =>
    el("stop", { offset: st[0], "stop-color": "#FFFFFF", "stop-opacity": st[1] }, grad),
  );
  const glow = scene.top
    ? el("circle", { r: R * 3, fill: "url(#moon-glow)", opacity: 0 }, scene.top)
    : null;
  const stripY = VIEW.y + (textTop - VIEW.y) * N.moon.height; // its height in the strip (centre)
  let moonUp = false,
    moonLit = 0,
    moonX = 0;
  function drawMoon(ms) {
    const m = moonAt(ms);
    const h = horizon(m.ra, m.dec, siderealDeg(ms, WEATHER_AT.lon), WEATHER_AT.lat);
    // across the strip by its direction (the strip is only just tall enough for it)
    const x = toScreen(project(N.centre, h.az)).x;
    const y = stripY;
    moonUp = h.alt > 0 && x > VIEW.x - 2 * R && x < VIEW.x + VIEW.w + 2 * R;
    moonLit = m.lit;
    moonX = x;
    // the lit part: the outer edge is a half circle, the inner edge (the terminator) a half ellipse
    const k = m.lit,
      rx = (R * Math.abs(1 - 2 * k)).toFixed(2);
    const inner = k > 0.5 ? 1 : 0; // crescent: the terminator curves the same way as the edge
    lit.setAttribute(
      "d",
      `M0 ${-R}A${R} ${R} 0 0 1 0 ${R}A${rx} ${R} 0 0 ${inner} 0 ${-R}Z`,
    );
    // waxing: lit on the right (as seen from the northern hemisphere); waning: on the left
    lit.setAttribute("transform", m.waxing ? "" : "scale(-1 1)");
    const at = `translate(${x.toFixed(1)} ${y.toFixed(1)})`;
    moonG.setAttribute("transform", at);
    if (glow) glow.setAttribute("transform", at);
  }

  // ---- Keeping up: positions every few seconds, brightness when the darkness changes ----
  let nextMove = 0,
    nextLog = 0,
    lastKey = "";
  everyFrame((now, dt) => {
    const ms = daylight.time();
    if (now > nextMove) {
      nextMove = now + N.every * 1000;
      drawStars(ms);
      drawPlanets(ms);
      drawMoon(ms);
      updateRates(ms);
      if (now > nextLog) {
        nextLog = now + 60000;
        const list = rates
          .filter((r) => r.perHour * N.meteors.share > 0.05)
          .map((r) => r.name + " " + (r.perHour * N.meteors.share * N.meteors.times).toFixed(1));
        debugLog(
          "Meteors through the window: " + (perSecond * 3600).toFixed(1) + " per hour in the dark (" + list.join(", ") + ")",
        );
      }
    }
    // stars come out by brightness; the moon is bright enough from early twilight on, and in
    // daylight it's a pale day moon (if enough of it is lit to be seen by day)
    const dark = daylight.darkness();
    const ops = N.stars.map((s) => Math.max(0, Math.min(1, (dark - s.from) / 0.15)));
    const planetOps = planets.map((pl) =>
      pl.up ? Math.max(0, Math.min(1, (dark - N.planets[pl.name].from) / 0.15)) : 0,
    );
    meteorFrame(dt, dark);
    const night = Math.max(0, Math.min(1, (dark - N.moon.from) / 0.25));
    const day = moonLit > N.moon.dayLit ? N.moon.day : 0;
    const moonOp = moonUp ? Math.max(night, day) : 0;
    // behind a cloud: its glow shows through (less through a thick overcast bank)
    const c = clouds && clouds();
    const covered = c && moonUp ? c.coverAt(moonX) : 0;
    const glowOp = covered * night * N.moon.glow * (1 - 0.6 * Math.max(0, c ? c.cover() - 0.75 : 0) / 0.25);
    const key = ops
      .concat(planetOps, moonOp, night, glowOp)
      .map((o) => Math.round(o * 40))
      .join();
    if (key !== lastKey) {
      lastKey = key; // only repaint (which redraws this layer) on a visible change
      groups.forEach((grp, b) => grp.g.setAttribute("opacity", (ops[b] * N.stars[b].opacity).toFixed(2)));
      planets.forEach((pl, i) => pl.g.setAttribute("opacity", planetOps[i].toFixed(2)));
      moonG.setAttribute("opacity", moonOp.toFixed(2));
      halo.setAttribute("opacity", (0.35 * night).toFixed(3)); // no halo by day
      if (glow) glow.setAttribute("opacity", glowOp.toFixed(2));
    }
  });

  // for checking against the real sky: where something is now
  return {
    addForeground: addForeground,
    moon: () => {
      const ms = daylight.time();
      const m = moonAt(ms);
      const h = horizon(m.ra, m.dec, siderealDeg(ms, WEATHER_AT.lon), WEATHER_AT.lat);
      return { alt: h.alt, az: h.az, lit: m.lit, waxing: m.waxing };
    },
    sunAltitude: () => sunAltitude(daylight.time(), WEATHER_AT.lat, WEATHER_AT.lon),
    // shooting stars per hour through the window right now, by source
    meteors: () =>
      rates.map((r) => ({
        name: r.name,
        perHour: +(r.perHour * N.meteors.share * N.meteors.times).toFixed(2),
      })),
  };
}
