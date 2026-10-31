// Snow: the snowy kind of precipitation (see weather/precip.js). Each flake is a little falling body
// (core/physics.js): light and a bit flat, so it floats down slowly, wobbles, and goes wherever the
// wind takes it. Flakes come in from above under the clouds and rest a moment where they land.
// Like the rain streaks, all flakes of one size are one path (dots), redrawn every frame: cheap
// on the TV however many there are.
import { el } from "../core/svg.js";
import { SNOW } from "../config.js";
import { body, fall, airSpeed } from "../core/physics.js";

const rand = (r) => r[0] + Math.random() * (r[1] - r[0]);

export function startSnow(layer, api) {
  const { VIEW, VR, VB } = api.geo;
  const S = SNOW;
  const g = el("g", { class: "snow" }, layer);
  const dots = (w, colour, op) =>
    el(
      "path",
      { fill: "none", stroke: colour, "stroke-width": w, "stroke-linecap": "round", "stroke-opacity": op },
      g,
    );
  // each size: a thin darker rim under the white dot
  const paths = S.sizes.map((w) => ({ rim: dots(w + 2, S.edge, 0.55), dot: dots(w, S.colour, 1) }));

  const flakes = [],
    resting = [];
  let air = airSpeed(api.wind);

  // A new flake. Where it would land is picked first; then it starts where its way there comes
  // into the picture: at the top, or, in a wind (snow flying sideways), at the upwind edge. inside: already snowing, so anywhere in the picture.
  function newFlake(inside) {
    const k = Math.random(); // light and small .. heavy and big
    const f = body(
      {
        x: 0,
        y: 0,
        mass: S.mass[0] + k * (S.mass[1] - S.mass[0]),
        area: Math.pow(S.size[0] + k * (S.size[1] - S.size[0]), 2),
        flat: rand(S.flat),
      },
      air,
    );
    if (inside) {
      f.x = VIEW.x + Math.random() * VIEW.w;
      f.y = VIEW.y + Math.random() * VIEW.h;
    } else {
      const slope = air / f.vy; // sideways per downward
      const top = VIEW.y - 10 - Math.random() * 60;
      // where it would land: anywhere across, and further on downwind (those blow out of the picture
      // before they land), so the whole picture gets flakes, in any wind
      const ext = slope * (VB - top);
      const land = VIEW.x + Math.min(0, ext) + Math.random() * (VIEW.w + Math.abs(ext));
      f.x = land - slope * (VB - top);
      f.y = top;
      if (f.x < VIEW.x - 30 || f.x > VR + 30) {
        // comes in from the side
        f.x = slope < 0 ? VR + 30 : VIEW.x - 30;
        f.y = VB - (land - f.x) / slope;
      }
      if (!api.underCloud(f.x)) return; // never from a clear sky
    }
    f.cls = Math.min(S.sizes.length - 1, Math.floor(k * S.sizes.length));
    f.depth = Math.random() * api.depth();
    flakes.push(f);
  }
  const wanted = () => {
    const max = api.isStandby() ? S.max.standby : S.max.live;
    return Math.round(max * api.amount() * api.detail());
  };
  // already snowing at the start: flakes all over the height
  for (let i = 0; i < wanted() * 2 && flakes.length < wanted(); i++) newFlake(true);

  let t = 0;
  return {
    frame(dt) {
      t += dt;
      air = airSpeed(api.wind);
      const want = wanted();
      if (want - flakes.length > Math.max(10, want * 0.25))
        for (let i = 0; i < want * 2 && flakes.length < want; i++) newFlake(true);
      for (let n = 0; n < 10 && flakes.length < want; n++) newFlake(false);

      const d = S.sizes.map(() => "");
      for (let i = flakes.length - 1; i >= 0; i--) {
        const f = flakes[i];
        fall(f, dt, air);
        // blown out of the picture: gone (a new one comes in)
        if (f.x < VIEW.x - 60 || f.x > VR + 60) {
          flakes.splice(i, 1);
          continue;
        }
        const ground = api.groundAt(f.x) + f.depth;
        if (f.y >= ground) {
          resting.push({ x: f.x, y: ground, cls: f.cls, until: t + rand(S.linger) });
          flakes.splice(i, 1);
          continue;
        }
        d[f.cls] += `M${f.x.toFixed(1)} ${f.y.toFixed(1)}h0`;
      }
      for (let i = resting.length - 1; i >= 0; i--) {
        const r = resting[i];
        if (t > r.until) {
          resting.splice(i, 1);
          continue;
        }
        d[r.cls] += `M${r.x.toFixed(1)} ${r.y.toFixed(1)}h0`;
      }
      paths.forEach((p, k) => {
        p.rim.setAttribute("d", d[k] || "M0 0");
        p.dot.setAttribute("d", d[k] || "M0 0");
      });
    },
    remove() {
      layer.removeChild(g);
    },
  };
}
