// Foxfire: some fungi really do glow faintly green in the dark: the bonnets (Mycena) and the honey
// fungus threads in rotting wood (the stump). On the floor only: on the tiles it looks odd. Each spot is a
// soft gradient, in front of the night veil, so it shows as the screen gets dark; fainter in live
// mode, where the veil stays lighter. Steady: real foxfire doesn't flicker. Static drawing, only
// its opacity changes, and only when the veil visibly changes.
import { el, defs } from "../../core/svg.js";
import { DAYLIGHT } from "../../config.js";
import { FOXFIRE } from "./settings.js";

// glows: [{ x, y, rx, ry, o }] from the floor
export function startFoxfire(layer, scene, glows) {
  const daylight = scene.fx && scene.fx.daylight;
  if (!daylight || !glows.length) return;
  const F = FOXFIRE;
  const grad = el("radialGradient", { id: "foxfire-glow" }, defs);
  F.falloff.forEach((st) =>
    el("stop", { offset: st[0], "stop-color": F.colour, "stop-opacity": st[1] }, grad),
  );
  const g = el("g", { class: "foxfire", opacity: 0 }, layer);
  glows.forEach((p) =>
    el(
      "ellipse",
      {
        cx: p.x.toFixed(1),
        cy: p.y.toFixed(1),
        rx: p.rx.toFixed(1),
        ry: p.ry.toFixed(1),
        fill: "url(#foxfire-glow)",
        opacity: p.o,
      },
      g,
    ),
  );
  let last = -1;
  function update() {
    const dark = daylight.veil().opacity / DAYLIGHT.max.standby; // how dark the screen looks, 0..1
    const o = Math.max(0, Math.min(1, (dark - F.from) / (F.full - F.from))) * F.strength;
    const k = Math.round(o * 40);
    if (k === last) return;
    last = k;
    g.setAttribute("opacity", (k / 40).toFixed(3));
  }
  update();
  daylight.onChange(update);
}
