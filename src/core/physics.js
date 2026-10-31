// Falling things, the way they fall in real life: a body has a mass, an area facing the air, a size
// and a flatness, and the rest follows. Gravity pulls it down; the air holds it back (drag grows
// with the square of its speed through the air), so each body settles at its own top speed: an
// acorn drops, a leaf drifts down, a snowflake floats. The wind is air moving sideways, so it
// carries light, broad things along and hardly moves heavy ones.
// The air is never quite still: slow little eddies (PHYSICS.eddies) push light things about, so a
// snowflake meanders down while an acorn doesn't notice.
// Flat things (leaves) swing: a tilted flat body glides the way it's tilted, and the air
// turns it back, over and over. The real physics of that (a falling sheet of paper) is chaotic and
// needs tiny time steps, so this is a simpler version that keeps its look: the tilt swings back and
// forth at a rate set by the body's speed and size, as far as its flatness allows, and the tilt
// makes it glide sideways and fall faster when it's edge-on.
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
    tilt: (Math.random() - 0.5) * (p.flat || 0), // radians, 0 = lying flat
    turn: (Math.random() - 0.5) * 2, // radians per second
    age: Math.random() * 100, // its own clock, for the eddies around it
    e1: Math.random() * 6.3,
    e2: Math.random() * 6.3,
  };
  b.vx = p.vx !== undefined ? p.vx : air || 0;
  b.vy = p.vy !== undefined ? p.vy : Math.sqrt(G / b.kd);
  return b;
}

// Move a body on by dt seconds; air: the wind's speed in m/s (+ to the right). Small steps when the
// frame is long, so slow frames on the TV don't change how things fall.
export function fall(b, dt, air) {
  const P = PHYSICS,
    n = Math.max(1, Math.ceil(dt / 0.02)),
    h = dt / n;
  for (let i = 0; i < n; i++) {
    // the eddies around it: two slow swirls, a few seconds each, mostly sideways
    b.age += h;
    const E = P.eddies,
      ex = E * (0.65 * Math.sin(b.age * 0.9 + b.e1) + 0.35 * Math.sin(b.age * 2.1 + b.e2)),
      ey = 0.35 * E * Math.sin(b.age * 1.3 + b.e2);
    const ax0 = (air || 0) + ex;
    const ux = b.vx - ax0,
      uy = b.vy - ey;
    const u = Math.sqrt(ux * ux + uy * uy) + 1e-6;
    let ax = 0,
      k = b.kd;
    if (b.flat) {
      const s = Math.sin(b.tilt);
      k *= 1 - 0.7 * b.flat * s * s; // edge-on: less drag
      ax = P.glide * b.flat * b.kd * u * u * Math.sin(2 * b.tilt); // gliding the way it tilts
      // the swing: back and forth (a self-sustaining swing that settles at the flatness' reach)
      const rate = Math.min(P.swingRate, Math.sqrt((3.4 * u) / b.size));
      const reach = b.flat * P.swingReach;
      b.turn +=
        (-rate * rate * b.tilt + 0.4 * rate * (1 - (b.tilt * b.tilt) / (reach * reach)) * b.turn) * h;
      b.tilt += b.turn * h;
    }
    // drag, worked out so it can't overshoot even on a long step: the speed through the air
    // shrinks by 1 / (1 + k u h)
    const d = 1 + k * u * h;
    b.vx = ax0 + (ux + ax * h) / d;
    b.vy = ey + (uy + G * h) / d;
    b.x += b.vx * h * P.scale;
    b.y += b.vy * h * P.scale;
  }
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
