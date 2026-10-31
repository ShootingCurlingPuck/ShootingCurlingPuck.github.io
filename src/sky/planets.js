// Where the bright planets are in the sky: Venus, Mars, Jupiter and Saturn (Mercury is rarely seen
// from Belgium). From NASA/JPL's "Approximate Positions of the Planets" (E.M. Standish, table 1,
// valid 1800-2050): accurate to well under a degree, far more than the screen can show.

const rad = Math.PI / 180;

// Orbital elements at 2000 and their change per century: semi-major axis (AU), eccentricity,
// inclination, mean longitude, longitude of perihelion, longitude of the ascending node (degrees)
const ELEMENTS = {
  earth: [1.00000261, 0.00000562, 0.01671123, -0.00004392, -0.00001531, -0.01294668,
    100.46457166, 35999.37244981, 102.93768193, 0.32327364, 0, 0],
  venus: [0.72333566, 0.0000039, 0.00677672, -0.00004107, 3.39467605, -0.0007889,
    181.9790995, 58517.81538729, 131.60246718, 0.00268329, 76.67984255, -0.27769418],
  mars: [1.52371034, 0.00001847, 0.0933941, 0.00007882, 1.84969142, -0.00813131,
    -4.55343205, 19140.30268499, -23.94362959, 0.44441088, 49.55953891, -0.29257343],
  jupiter: [5.202887, -0.00011607, 0.04838624, -0.00013253, 1.30439695, -0.00183714,
    34.39644051, 3034.74612775, 14.72847983, 0.21252668, 100.47390909, 0.20469106],
  saturn: [9.53667594, -0.0012506, 0.05386179, -0.00050991, 2.48599187, 0.00193609,
    49.95424423, 1222.49362201, 92.59887831, -0.41897216, 113.66242448, -0.28867794],
};

// Position around the sun (AU, ecliptic of 2000) T centuries after 2000
function heliocentric(name, T) {
  const E = ELEMENTS[name];
  const a = E[0] + E[1] * T,
    e = E[2] + E[3] * T,
    I = (E[4] + E[5] * T) * rad,
    L = E[6] + E[7] * T,
    peri = E[8] + E[9] * T,
    node = (E[10] + E[11] * T) * rad;
  const M = ((((L - peri) % 360) + 540) % 360 - 180) * rad; // mean anomaly, -180..180
  let ecc = M + e * Math.sin(M); // Kepler's equation, a few rounds of Newton's method
  for (let i = 0; i < 6; i++)
    ecc -= (ecc - e * Math.sin(ecc) - M) / (1 - e * Math.cos(ecc));
  const xp = a * (Math.cos(ecc) - e),
    yp = a * Math.sqrt(1 - e * e) * Math.sin(ecc);
  const w = peri * rad - node; // argument of perihelion
  const cw = Math.cos(w), sw = Math.sin(w), cn = Math.cos(node), sn = Math.sin(node);
  const ci = Math.cos(I), si = Math.sin(I);
  return [
    (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp,
    (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp,
    sw * si * xp + cw * si * yp,
  ];
}

// Right ascension and declination (degrees) of a planet as seen from the earth, at time ms
export function planetAt(name, ms) {
  const T = (ms / 86400000 + 2440587.5 - 2451545.0) / 36525;
  const p = heliocentric(name, T),
    e = heliocentric("earth", T);
  const x = p[0] - e[0],
    y = p[1] - e[1],
    z = p[2] - e[2];
  const ob = 23.43928 * rad; // from the ecliptic to the equator
  const ye = y * Math.cos(ob) - z * Math.sin(ob),
    ze = y * Math.sin(ob) + z * Math.cos(ob);
  return {
    ra: ((Math.atan2(ye, x) / rad) % 360 + 360) % 360,
    dec: Math.atan2(ze, Math.sqrt(x * x + ye * ye)) / rad,
  };
}

export const PLANET_NAMES = ["venus", "mars", "jupiter", "saturn"];
