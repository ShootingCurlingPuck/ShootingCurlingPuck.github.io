// How far into autumn we are, for everything in the theme that follows the season: the canopy
// thins, the leaf colours go from green and yellow through orange and red to brown, the litter
// deepens, acorns fall and then get eaten, and the mushrooms come up and go again.
// To see another point in the season: ?date=2026-11-25 (see core/time.js)
import { TZ } from "../../config.js";
import { sceneNow } from "../../core/time.js";
import { FALL_SEASON } from "./settings.js";

// Days since 1 October (Brussels date), 0..60
export function seasonDay() {
  const p = new Date(sceneNow())
    .toLocaleDateString("en-GB", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
    })
    .split("/");
  const day = +p[0],
    month = +p[1];
  if (month === 10) return day - 1;
  if (month === 11) return 30 + day;
  return month < 10 ? 0 : 60;
}

// A value along [day, value] points, in between linearly
export function along(points, day) {
  if (day <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++)
    if (day <= points[i][0]) {
      const a = points[i - 1],
        b = points[i];
      return a[1] + ((day - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
    }
  return points[points.length - 1][1];
}

// The palette for a day: each colour (same order as FALL_PALS) is common around its peak day and
// rare far from it. Returned as a list with each colour repeated by how common it is, so code
// that picks a random entry gets the season's mix.
export function seasonPalette(pal, day) {
  const S = FALL_SEASON;
  const w = pal.map((c, i) => {
    const d = (day - S.colourPeaks[i]) / S.colourSpread;
    return Math.max(S.colourRare, Math.exp(-d * d));
  });
  const sum = w.reduce((a, b) => a + b, 0);
  const out = [];
  pal.forEach((c, i) => {
    for (let n = Math.round((w[i] / sum) * 24); n > 0; n--) out.push(c);
  });
  return out.length ? out : pal;
}

// Everything for today in one go
export function season() {
  const day = seasonDay();
  const S = FALL_SEASON;
  return {
    day: day,
    litter: along(S.litter, day), // depth of the leaf cover, share of the full pile
    acornsOnGround: along(S.acornsOnGround, day), // times the usual number
    acornsPerMinute: along(S.acornsFalling, day),
    fungi: along(S.fungi, day), // times the usual number of mushrooms
    palettes: (pal) => ({
      tree: seasonPalette(pal, day),
      litter: seasonPalette(pal, Math.max(0, day - S.litterLag)),
    }),
  };
}
