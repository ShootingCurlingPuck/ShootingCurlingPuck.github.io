// The owl's night hunt. It stares out for a moment, then leaves the hollow to the right, past the
// screen's edge (the trunk is close to it), so it never crosses the plan up close. While it's away
// the hollow is empty, and now and then it shows far off: a small dark shape out in the sky,
// behind everything in front (cut out like the stars), gliding across with a few wingbeats, or
// dropping down behind the leaves onto something and rising again a little later. When the hunt
// is over it flies back in from the right and settles in the hollow. Up close it's a simple shape
// (round head turned to us, broad rounded wings, short tail) that shades itself at night.
import { el } from "../../core/svg.js";
import { everyFrame } from "../toolkit.js";
import { OWL } from "./settings.js";

const rand = (r) => r[0] + Math.random() * (r[1] - r[0]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// A point along a cubic curve through p0..p3 (each [x, y]), at k 0..1
function bez(p, k) {
  const u = 1 - k;
  return [0, 1].map(
    (i) =>
      u * u * u * p[0][i] + 3 * u * u * k * p[1][i] + 3 * u * k * k * p[2][i] + k * k * k * p[3][i],
  );
}
// The curve as a list of points spaced about evenly along it, so the owl flies at a steady speed
function evenly(p, step) {
  const raw = [];
  for (let i = 0; i <= 200; i++) raw.push(bez(p, i / 200));
  const out = [raw[0]];
  let left = step;
  for (let i = 1; i < raw.length; i++) {
    let a = raw[i - 1];
    const b = raw[i];
    let d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (d >= left) {
      const k = left / d;
      a = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      out.push(a);
      d -= left;
      left = step;
    }
    left -= d;
  }
  out.push(raw[raw.length - 1]);
  return out;
}

// layer: in front of the night veil (it shades itself), for the owl up close; home: { x, y } where
// it sits in the hollow; owl: { hide(), show(), look(point, seconds) } (the sitting owl).
// Returns { go(), out() }.
export function startOwlFlight(layer, scene, home, owl) {
  const F = OWL.hunt;
  const { VIEW, VR, VB } = scene.geo;
  const fx = scene.fx || {};
  const daylight = fx.daylight;
  const C = { body: "#8A5A3B", dark: "#6E4630", light: "#C49A6C", ink: "#3B2A1E" };

  // ---- Drawing: flying to the right (flipped when it flies left), its round face turned to us ----
  const wrap = el("g", daylight ? { filter: daylight.shadeFilter } : {}, layer);
  const g = el("g", { class: "owl-flight", display: "none" }, wrap);
  const line = { stroke: C.ink, "stroke-width": 1.5, "stroke-linejoin": "round" };
  // A wing pointing up from its shoulder: long and broad, a rounded tip, the flight feathers
  // fingered along the back edge. It turns around the shoulder as it beats.
  const WING =
    "M5,0C7,-14 5,-30 -1,-41C-4,-46 -12,-44 -13,-37L-15,-30L-12,-27L-16,-20L-13,-16L-16,-9L-12,-6Q-9,2 5,0Z";
  const farWing = el("path", Object.assign({ d: WING, fill: C.dark }, line), g);
  el("path", Object.assign({ d: "M-10,-2L-24,-5Q-26,1 -24,6L-10,4Z", fill: C.dark }, line), g); // tail
  el("ellipse", Object.assign({ cx: 0, cy: 0, rx: 14, ry: 10, fill: C.body }, line), g); // body
  el("path", { d: "M-6,5Q3,11 11,4", fill: "none", stroke: C.light, "stroke-width": 3, "stroke-linecap": "round" }, g); // pale belly
  const nearWing = el("path", Object.assign({ d: WING, fill: C.body }, line), g);
  el(
    "path",
    { d: "M-4,-8L-9,-30M0,-6L-3,-28", fill: "none", stroke: C.light, "stroke-width": 1.2, "stroke-linecap": "round", opacity: 0.7 },
    nearWing.parentNode,
  );
  const feathers = g.lastChild; // feather lines on the near wing (turned with it)
  // the head: big and round, no neck, looking at us
  const head = el("g", { transform: "translate(14 -8)" }, g);
  el("circle", Object.assign({ r: 11.5, fill: C.body }, line), head);
  el("ellipse", { cx: 0, cy: 1, rx: 8.5, ry: 8, fill: C.light }, head); // the face
  el("circle", { cx: -3.3, cy: 0, r: 2.3, fill: C.ink }, head);
  el("circle", { cx: 3.3, cy: 0, r: 2.3, fill: C.ink }, head);
  el("path", { d: "M-1.3,3L0,6L1.3,3Z", fill: C.ink }, head); // beak

  // a: how high the wings are, -1 down .. 1 up (0.6: held up and back, gliding)
  function pose(a) {
    const r = -20 - (1 - a) * 88;
    nearWing.setAttribute("transform", `translate(3 -5) rotate(${r.toFixed(1)})`);
    feathers.setAttribute("transform", `translate(3 -5) rotate(${r.toFixed(1)})`);
    farWing.setAttribute("transform", `translate(6 -7) rotate(${(r + 14).toFixed(1)}) scale(0.85)`);
  }

  // ---- Far away: a small dark shape out in the sky ----
  const farG = fx.night && fx.night.far ? el("g", { class: "owl-far", display: "none" }, fx.night.far) : null;
  const farShape = farG ? el("path", { fill: F.far.colour, opacity: F.far.opacity }, farG) : null;
  // a: how high the wings are, -1 down .. 1 up. Wings out to both sides, a round head on top.
  function farPose(a) {
    const y = (-7 * a).toFixed(1),
      top = (-3 * a - 3.5).toFixed(1),
      bottom = (-3 * a).toFixed(1);
    farShape.setAttribute(
      "d",
      `M-13,${y}Q-7,${top} -2,-2.5A2.6,2.6 0 0 1 2,-2.5Q7,${top} 13,${y}Q7,${bottom} 2.5,2Q0,4.5 -2.5,2Q-7,${bottom} -13,${y}Z`,
    );
  }

  // ---- The hunt: a list of steps, played one after the other ----
  // a step: { near: path } (up close), { far: path } (far off), or { pause: seconds }. A path is a
  // list of points about one frame apart; flap: [from, to] (share of the path with wingbeats, else
  // glides with now and then a few beats); flare: from where it brakes, wings up (landing)
  let steps = null,
    s = 0,
    i = 0,
    wait = 0,
    flapT = 0,
    t = 0;
  const along = (p, speed) => evenly(p, speed / 60);
  const skyY = () => VIEW.y + 80 + Math.random() * VIEW.h * 0.45;

  // one sighting far off: across the sky, or down behind the leaves and up again later
  function sighting() {
    const S = F.far,
      fromLeft = Math.random() < 0.5;
    const x0 = fromLeft ? VIEW.x - 40 : VR + 40,
      x1 = fromLeft ? VR + 40 : VIEW.x - 40;
    const y0 = skyY();
    if (Math.random() >= S.dive) {
      const y1 = skyY();
      return [
        {
          far: along([[x0, y0], [x0 + (x1 - x0) * 0.33, y0 - 60], [x0 + (x1 - x0) * 0.66, y1 + 60], [x1, y1]], S.speed),
        },
      ];
    }
    // down onto something, out of sight behind the leaves, then up and away
    const xd = VIEW.x + VIEW.w * (0.15 + Math.random() * 0.7);
    const below = VB + 30;
    const x2 = Math.random() < 0.5 ? VIEW.x - 40 : VR + 40;
    return [
      { far: along([[x0, y0], [(x0 + xd) / 2, y0 + 40], [xd, y0 + 80], [xd + (xd < x0 ? -20 : 20), below]], S.speed) },
      { pause: rand(S.hidden) },
      { far: along([[xd, below], [xd, below - 200], [(xd + x2) / 2, skyY()], [x2, skyY()]], S.speed) },
    ];
  }

  function go() {
    if (steps) return false;
    const hx = home.x,
      hy = home.y;
    const off = [VR + 120, hy - 190];
    const plan = [
      { pause: F.spot }, // staring out first (owl.look, below)
      { leave: true },
      { near: along([[hx + 5, hy - 30], [hx + 90, hy - 95], [VR - 40, hy - 150], off], F.speed), flap: [0, 1] },
    ];
    // away: a few sightings far off, spread over the time it's gone
    const n = Math.max(1, Math.round(rand(F.far.sightings)));
    const gone = rand(F.away) * 60;
    for (let k = 0; k < n; k++) {
      plan.push({ pause: (gone / (n + 1)) * (0.6 + 0.8 * Math.random()) });
      sighting().forEach((st) => plan.push(st));
    }
    plan.push({ pause: gone / (n + 1) });
    plan.push({
      near: along([off, [VR - 30, hy - 150], [hx + 110, hy - 75], [hx + 18, hy - 28]], F.speed),
      flap: [0, 0.35],
      flare: 0.82,
    });
    plan.push({ land: true });
    owl.look([VR, hy - 160], F.spot);
    steps = plan;
    s = 0;
    i = 0;
    wait = 0;
    return true;
  }

  function show(which) {
    g.setAttribute("display", which === "near" ? "" : "none");
    if (farG) farG.setAttribute("display", which === "far" ? "" : "none");
  }
  function next() {
    s++;
    i = 0;
    wait = 0;
    show(null);
    if (s >= steps.length) steps = null;
  }

  everyFrame((now, dt) => {
    t += dt;
    if (!steps) return;
    const st = steps[s];
    if (st.pause !== undefined) {
      wait += dt;
      if (wait >= st.pause) next();
      return;
    }
    if (st.leave) {
      owl.hide();
      return next();
    }
    if (st.land) {
      owl.show(); // back in the hollow
      return next();
    }
    const far = !!st.far;
    if (far && !farG) return next(); // no night sky: it hunts unseen
    const P = st.far || st.near;
    i = Math.min(P.length - 1, i + dt * 60);
    const k0 = Math.floor(i),
      p = P[k0],
      q = P[Math.min(P.length - 1, k0 + 1)],
      k = i - k0;
    const x = p[0] + (q[0] - p[0]) * k,
      y = p[1] + (q[1] - p[1]) * k;
    const b = P[Math.max(0, k0 - 3)],
      f = P[Math.min(P.length - 1, k0 + 3)];
    const dir = f[0] - b[0] < 0 ? -1 : 1;
    const pitch = clamp((Math.atan2(f[1] - b[1], Math.abs(f[0] - b[0]) || 1) * 180) / Math.PI, -30, 30) * 0.6;
    const share = i / (P.length - 1);
    let a;
    if (st.flare && share > st.flare) a = 1; // braking: wings up
    else if (st.flap && share >= st.flap[0] && share <= st.flap[1]) {
      flapT += dt;
      a = 0.45 + 0.6 * Math.sin(flapT * Math.PI * 2 * F.beats); // wingbeats
    } else {
      // gliding, with now and then a few lazy beats
      const beats = Math.sin(t * 0.8) > 0.85;
      if (beats) flapT += dt;
      a = (far ? 0.25 : 0.6) + (beats ? 0.5 * Math.sin(flapT * Math.PI * 2 * F.beats) : 0);
    }
    if (far) {
      show("far");
      farPose(far ? clamp(a * 1.4 - 0.4, -1, 1) : a);
      farG.setAttribute(
        "transform",
        `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(pitch * dir * 0.5).toFixed(1)}) scale(${F.far.size})`,
      );
    } else {
      show("near");
      pose(a);
      g.setAttribute(
        "transform",
        `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${(dir * F.size).toFixed(2)} ${F.size}) rotate(${(pitch * dir).toFixed(1)})`,
      );
    }
    if (i >= P.length - 1) next();
  });

  return {
    go: go,
    out: () => !!steps, // away from the hollow (or about to leave)
  };
}
