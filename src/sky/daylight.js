// Day and night, for everything (whatever the season): the real height of the sun at the office,
// worked out from the date and time (no internet needed), turned into one "darkness" value from
// 0 (day) to 1 (full night), through sunset and the three twilights. The whole screen follows it
// under a night veil, darker in standby than in live mode (where people still need to read the
// rooms). The QR code only gets a share of it (DAYLIGHT.qr), so it keeps scanning.
// Test switches: ?time=17:40 (pretend it's that time today), ?date=2026-11-05 (pretend it's that
// day, e.g. for another moon phase), ?darkness=0..1 (fixed darkness)
import { el } from "../core/svg.js";
import { QS } from "../core/params.js";
import { nowMs, fmt } from "../core/time.js";
import { debugLog } from "../core/debug.js";
import { WEATHER_AT, DAYLIGHT } from "../config.js";
import { everyFrame, mix } from "../core/anim.js";

const rad = Math.PI / 180;

// Height of the sun above the horizon in degrees (negative below it), at time ms, for lat/lon.
// A standard low-precision formula, good to about a minute for sunrise and sunset.
export function sunAltitude(ms, lat, lon) {
  const d = ms / 86400000 + 2440587.5 - 2451545.0; // days since 2000-01-01 12:00 UTC
  const g = (357.529 + 0.98560028 * d) * rad; // the sun's mean anomaly
  const q = 280.459 + 0.98564736 * d; // its mean longitude
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad; // ecliptic longitude
  const e = (23.439 - 0.00000036 * d) * rad; // tilt of the earth's axis
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
  const dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24; // sidereal time, hours
  const h = (gmst * 15 + lon) * rad - ra; // hour angle
  return (
    Math.asin(
      Math.sin(lat * rad) * Math.sin(dec) +
        Math.cos(lat * rad) * Math.cos(dec) * Math.cos(h),
    ) / rad
  );
}

// Darkness 0..1 for a sun height, along the points in DAYLIGHT.curve
function darknessFor(alt) {
  const pts = DAYLIGHT.curve;
  if (alt >= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++)
    if (alt >= pts[i][0]) {
      const a = pts[i - 1],
        b = pts[i];
      return a[1] + ((alt - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
    }
  return pts[pts.length - 1][1];
}

// layer: an overlay of its own, above everything that should go dark
export function startDaylight(layer, scene) {
  const { VIEW } = scene.geo;
  const forced = parseFloat(QS.get("darkness"));
  // ?time=HH:MM: shift the clock so it's that time now (today), then let it run on
  let shift = 0;
  const asked = /^(\d\d?):(\d\d)$/.exec(QS.get("time") || "");
  if (asked) {
    const now = fmt(new Date(nowMs())).split(":");
    shift = ((+asked[1] - +now[0]) * 60 + (+asked[2] - +now[1])) * 60000;
  }
  // ?date=YYYY-MM-DD: the same, whole days
  const day = /^(\d{4})-(\d\d)-(\d\d)$/.exec(QS.get("date") || "");
  if (day) {
    const today = new Date(nowMs());
    const then = Date.UTC(+day[1], +day[2] - 1, +day[3]);
    const now0 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    shift += Math.round((then - now0) / 86400000) * 86400000;
  }
  const time = () => nowMs() + shift;
  const alt = () => sunAltitude(time(), WEATHER_AT.lat, WEATHER_AT.lon);
  const darkness = () => (isNaN(forced) ? darknessFor(alt()) : forced);

  // The veil: one rect well beyond the plan (the window may show more than the plan)
  const veil = el(
    "rect",
    {
      x: VIEW.x - VIEW.w,
      y: VIEW.y - VIEW.h,
      width: VIEW.w * 3,
      height: VIEW.h * 3,
      fill: DAYLIGHT.dusk,
      opacity: 0,
    },
    layer,
  );
  // How dark the veil should be: darkness, up to the live or standby maximum
  const target = () =>
    darkness() * (scene.isStandby() ? DAYLIGHT.max.standby : DAYLIGHT.max.live);
  // The QR code's tile, on its own layer above everything: a lighter veil, just over the tile (its
  // surroundings are already under the main veil)
  const qr = scene.top && scene.qr;
  const qrVeil = qr
    ? el(
        "rect",
        {
          x: qr.x,
          y: qr.y,
          width: qr.size,
          height: qr.size,
          rx: 8,
          fill: DAYLIGHT.dusk,
          opacity: 0,
        },
        scene.top,
      )
    : null;
  let d = darkness(),
    shown = target(), // the veil's opacity now (eases on mode changes)
    colour = mix(DAYLIGHT.dusk, DAYLIGHT.night, d),
    last = -1,
    nextLog = 0;
  function paint() {
    veil.setAttribute("fill", colour);
    veil.setAttribute("opacity", shown.toFixed(3));
    if (qrVeil) {
      qrVeil.setAttribute("fill", colour);
      qrVeil.setAttribute("opacity", (shown * DAYLIGHT.qr).toFixed(3));
    }
  }
  paint();

  everyFrame((now, dt) => {
    d = darkness();
    const goal = target();
    // the sun moves slowly; the jump between live and standby is eased over a few seconds
    shown += (goal - shown) * Math.min(1, dt / DAYLIGHT.ease);
    colour = mix(DAYLIGHT.dusk, DAYLIGHT.night, Math.min(1, d));
    // only repaint (which redraws this layer) on a visible change
    const key = Math.round(shown * 200);
    if (key !== last) {
      last = key;
      paint();
    }
    if (now > nextLog) {
      nextLog = now + 60000;
      debugLog(
        "Daylight: sun " + alt().toFixed(1) + "°, darkness " + d.toFixed(2) + ", veil " + shown.toFixed(2),
      );
    }
  });

  return {
    darkness: () => d, // 0 day .. 1 full night
    time: time, // the clock the sky runs on (ms; shifted by ?time and ?date)
    sunAltitude: alt,
    // what the veil does, for layers above it that darken themselves (clouds): its colour and
    // opacity right now
    veil: () => ({ colour: colour, opacity: shown }),
  };
}
