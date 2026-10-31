// Meteor showers: how many shooting stars there really are right now, and where they come from.
// Data: the International Meteor Organization's working list (2026 calendar), the showers that
// matter at night from Belgium. Each shower peaks when the sun reaches the same point on its yearly
// path (solar longitude), so the peaks land on the right night every year by themselves.
// The rate is the shower's strength (ZHR: meteors per hour for one observer under a perfect sky with
// the radiant overhead) times how high its radiant is, plus the random "sporadic" meteors of any
// night. The night sky then scales it to the part of the sky the window shows.

const rad = Math.PI / 180;

// [name, peak solar longitude, radiant RA, radiant Dec (degrees), speed (km/s), ZHR, falloff]
// falloff: how fast the activity drops away from the peak, per degree of solar longitude (about a
// day): rough, sharp showers fall fast, broad ones slowly.
export const SHOWERS = [
  ["Quadrantids", 283.15, 230, 49, 41, 80, 0.8],
  ["Lyrids", 32.32, 271, 34, 49, 18, 0.35],
  ["eta Aquariids", 45.5, 338, -1, 66, 50, 0.08],
  ["Southern delta Aquariids", 128, 340, -16, 41, 25, 0.06],
  ["alpha Capricornids", 128, 307, -10, 23, 5, 0.05],
  ["Perseids", 140.0, 48, 58, 59, 100, 0.2],
  ["Aurigids", 158.6, 91, 39, 66, 6, 0.4],
  ["September epsilon Perseids", 166.7, 48, 40, 64, 8, 0.3],
  ["Draconids", 195.4, 262, 54, 20, 5, 0.6],
  ["Orionids", 208, 95, 16, 66, 20, 0.12],
  ["Southern Taurids", 223, 52, 15, 27, 7, 0.04],
  ["Northern Taurids", 230, 58, 22, 29, 5, 0.04],
  ["Leonids", 235.27, 152, 22, 71, 15, 0.25],
  ["sigma Hydrids", 257, 125, 2, 58, 7, 0.15],
  ["Geminids", 262.2, 112, 33, 35, 150, 0.3],
  ["Ursids", 270.7, 217, 76, 33, 10, 0.6],
];
export const SPORADIC = 8; // random meteors per hour on any dark night, for one observer

// The sun's position along its yearly path (degrees), at time ms
export function solarLongitude(ms) {
  const d = ms / 86400000 + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * rad;
  const L = 280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g);
  return ((L % 360) + 360) % 360;
}

// What's coming down now: a list of { name, perHour, ra, dec, speed } (ra null for the sporadic
// ones, which come from anywhere). altitude(ra, dec): how high that point is now, in degrees.
export function meteorsNow(ms, altitude) {
  const lambda = solarLongitude(ms);
  const out = [{ name: "sporadic", perHour: SPORADIC, ra: null, dec: null, speed: 40 }];
  SHOWERS.forEach((s) => {
    let off = Math.abs(lambda - s[1]) % 360;
    if (off > 180) off = 360 - off;
    const zhr = s[5] * Math.pow(10, -s[6] * off);
    if (zhr < 0.3) return;
    const alt = altitude(s[2], s[3]);
    if (alt <= 0) return; // its radiant is below the horizon: (almost) none
    out.push({
      name: s[0],
      perHour: zhr * Math.sin(alt * rad),
      ra: s[2],
      dec: s[3],
      speed: s[4],
    });
  });
  return out;
}
