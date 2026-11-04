// Falling things, the way they fall in real life: a body has a mass, an area facing the air, a size
// and a flatness, and the rest follows. Gravity pulls it down; the air holds it back (drag grows
// with the square of its speed through the air), so each body settles at its own top speed: an
// acorn drops, a leaf drifts down, a snowflake floats. The wind is air moving sideways, so it
// carries light, broad things along and hardly moves heavy ones.
// The air is never quite still: slow little eddies (PHYSICS.eddies) push light things about, so a
// snowflake meanders down while an acorn doesn't notice.
// Flat things (leaves) swing like a pendulum on their way down: smooth arcs from side to side,
// rising a little at each end where they tip up, then swinging back, tilted along the arc like a
// swing seat. The real physics of a falling sheet is chaotic and needs tiny time steps, so the
// swing is laid over the body's own fall: how wide it swings comes from its size and flatness
// (PHYSICS.swing), how slowly from its size (bigger: slower, like a longer pendulum), and it
// changes a little from one swing to the next. The wind and the eddies carry the whole swing along.
// Positions are in screen units, everything else in metres, seconds and kilograms; PHYSICS.scale
// converts (see config.js).
import { PHYSICS, WIND } from "../config.js";

const G = 9.81,
  AIR = 1.2; // kg per m3

// Top speed of a body falling through still air, m/s
export function topSpeed(mass, area, cd) {
  return Math.sqrt((2 * mass * G) / (AIR * (cd || 1) * area));
}

// A new body. p: { x, y (screen units), mass (kg), area (m2), size (m, its length), flat (0 round ..
// 1 a flat sheet), cd (drag coefficient, default 1), vx, vy (m/s, default: already at top speed,
// moving with the wind `air`) }
export function body(p, air) {
  const b = {
    x: p.x,
    y: p.y,
    mass: p.mass,
    size: p.size || Math.sqrt(p.area),
    flat: p.flat || 0,
    kd: (0.5 * AIR * (p.cd || 1) * p.area) / p.mass, // drag per speed squared, per kg
    tilt: 0, // radians, 0 = lying flat (+: its right side down)
    phase: Math.random() * 6.3, // where it is in its swing
    age: Math.random() * 100, // its own clock, for the eddies around it
    e1: Math.random() * 6.3,
    e2: Math.random() * 6.3,
  };
  b.vx = p.vx !== undefined ? p.vx : air || 0;
  b.vy = p.vy !== undefined ? p.vy : Math.sqrt(G / b.kd);
  // the swing: its centre is where the body is falling; x, y is where it is now, on its arc
  b.cx = b.x;
  b.cy = b.y;
  b.sx = b.sy = 0;
  return b;
}

// Move a body on by dt seconds; air: the wind's speed in m/s (+ to the right); up (optional): air
// rising under it, m/s (a gust swirling up off the ground). Small steps when the frame is long, so
// slow frames on the TV don't change how things fall.
export function fall(b, dt, air, up) {
  const P = PHYSICS,
    n = Math.max(1, Math.ceil(dt / 0.02)),
    h = dt / n;
  // moved from outside (a new start, a landing): the swing's centre follows
  if (b.cx === undefined || Math.abs(b.x - b.cx - b.sx) > 0.01 || Math.abs(b.y - b.cy - b.sy) > 0.01) {
    b.cx = b.x - (b.sx || 0);
    b.cy = b.y - (b.sy || 0);
  }
  for (let i = 0; i < n; i++) {
    // the eddies around it: two slow swirls, a few seconds each, mostly sideways
    b.age += h;
    const E = P.eddies,
      ex = E * (0.65 * Math.sin(b.age * 0.9 + b.e1) + 0.35 * Math.sin(b.age * 2.1 + b.e2)),
      ey = 0.35 * E * Math.sin(b.age * 1.3 + b.e2) - (up || 0);
    const ax0 = (air || 0) + ex;
    const ux = b.vx - ax0,
      uy = b.vy - ey;
    const u = Math.sqrt(ux * ux + uy * uy) + 1e-6;
    // drag, worked out so it can't overshoot even on a long step: the speed through the air
    // shrinks by 1 / (1 + k u h)
    const d = 1 + b.kd * u * h;
    b.vx = ax0 + ux / d;
    b.vy = ey + (uy + G * h) / d;
    b.cx += b.vx * h * P.scale;
    b.cy += b.vy * h * P.scale;
    if (b.flat) {
      // the swing: a bit faster or slower, wider or narrower, from one swing to the next
      const rate = Math.sqrt(G / (P.swingLength * b.size)) * (1 + 0.1 * Math.sin(b.age * 0.31 + b.e2));
      b.phase += rate * h;
    }
  }
  if (b.flat) {
    const width = b.flat * P.swing * b.size * P.scale * (0.8 + 0.2 * Math.sin(b.age * 0.37 + b.e1));
    const s = Math.sin(b.phase);
    b.sx = width * s; // across
    b.sy = -width * P.swingRise * s * s; // up at both ends
    b.tilt = -b.flat * P.swingReach * s; // tipped up at the ends, like a swing seat
  }
  b.x = b.cx + b.sx;
  b.y = b.cy + b.sy;
}

// The wind for falling things, in m/s (+ to the right), from the wind service (sky's fx.wind):
// its strength turned back into km/h along WIND.levels, gusts on top, times PHYSICS.wind
export function airSpeed(wind) {
  if (!wind) return 0;
  const s = Math.min(1, wind.strength() + 0.5 * wind.gust());
  const L = WIND.levels;
  let kmh = L[L.length - 1][0];
  for (let i = 1; i < L.length; i++)
    if (s <= L[i][1]) {
      const a = L[i - 1],
        b = L[i];
      kmh = a[0] + ((s - a[1]) / (b[1] - a[1] || 1)) * (b[0] - a[0]);
      break;
    }
  return wind.dir() * (kmh / 3.6) * PHYSICS.wind;
}
