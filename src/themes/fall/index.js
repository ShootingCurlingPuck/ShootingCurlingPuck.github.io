// Autumn: a forest floor along the bottom edge, and leaves falling, landing and catching on ledges
import { el } from "../../core/svg.js";
import { QS } from "../../core/params.js";
import { debugLog } from "../../core/debug.js";
import { FALL_PALS } from "./settings.js";
import { loadShapes } from "./shapes.js";
import { drawForestFloor } from "./floor.js";
import { startFalling } from "./falling.js";

export default function startFall(scene) {
  const pal = FALL_PALS[QS.get("fallpal")] || FALL_PALS.a;
  loadShapes()
    .then(() => {
      const surface = drawForestFloor(el("g", { class: "ground" }, scene.layer), scene, pal);
      startFalling(scene.layer, scene, pal, surface);
    })
    .catch((e) => debugLog("Autumn theme: " + e));
}
