// Wind, from the live weather, for everything (whatever the season): a smooth strength (0 = still
// air, 1 = stormy) and gusts. The strength eases towards the weather over about a minute, so updates
// never jump. Gusts happen in calm weather too, just rarely and gently; the windier, the more often
// and stronger. What reacts to it (leaves, snow, ...) is up to the theme.
// Direction on screen: WIND.direction by default (-1: right to left), a theme may change it.
// Test switches: ?wind=<km/h> (pretend wind speed), ?gusts=often (a gust every few seconds)
import { QS } from "../core/params.js";
import { WIND } from "../config.js";
import { everyFrame } from "../core/anim.js";

export function startWind(scene) {
  const forcedKmh = parseFloat(QS.get("wind"));
  const often = QS.get("gusts") === "often";
  const listeners = [];
  let dir = WIND.direction;

  // km/h to strength, along the points in WIND.levels
  function strengthFor(kmh) {
    const pts = WIND.levels;
    if (kmh <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++)
      if (kmh <= pts[i][0]) {
        const a = pts[i - 1],
          b = pts[i];
        return a[1] + ((kmh - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
      }
    return pts[pts.length - 1][1];
  }
  function target() {
    if (!isNaN(forcedKmh)) return strengthFor(forcedKmh);
    const w = scene.weather();
    return w ? strengthFor(w.wind) : WIND.noData;
  }

  let s = target(); // start where the weather is, no fade at load
  let t = 0,
    nextGust = 0,
    gustAt = -100,
    gustAmp = 0;
  const between = (a, b) => a + Math.random() * (b - a);
  const gap = () =>
    often ? between(5, 9) : between(WIND.gustEvery[0], WIND.gustEvery[1]) *
      (1 - 0.85 * s); // calm: every couple of minutes; stormy: every 10-20 s
  nextGust = gap() * Math.random(); // the first one somewhere in the first interval
  // The first weather usually arrives a moment after loading: take it as is, no fade
  scene.on("weather", () => {
    if (t < 15) s = target();
  });

  everyFrame((now, dt) => {
    t += dt;
    s += (target() - s) * Math.min(1, dt / WIND.ease);
    if (t > nextGust) {
      gustAt = t;
      gustAmp = Math.min(1, between(0.25, 0.4) + 0.6 * s); // 0..1
      nextGust = t + gap();
      listeners.forEach((fn) => fn(gustAmp));
    }
  });

  const boost = () => (scene.isStandby() ? WIND.standbyBoost : 1);
  return {
    // 0..1, a bit more in standby
    strength: () => Math.min(1, s * boost()),
    // the current gust, 0..1: quick rise, slow fade
    gust() {
      const k = t - gustAt;
      if (k < 0 || k > WIND.gustRise + WIND.gustFade) return 0;
      return (
        gustAmp *
        (k < WIND.gustRise ? k / WIND.gustRise : 1 - (k - WIND.gustRise) / WIND.gustFade)
      );
    },
    // fn(amp) at the start of every gust
    onGust: (fn) => listeners.push(fn),
    // which way it blows on screen: -1 right to left, 1 left to right
    dir: () => dir,
    setDirection: (d) => (dir = d < 0 ? -1 : 1),
  };
}
