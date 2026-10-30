// Autumn: a tree on the right, a forest floor along the bottom edge, fungi on the tiles,
// a visiting spider, and falling leaves carried by the wind
import { el } from "../../core/svg.js";
import { QS } from "../../core/params.js";
import { debugLog, crumb } from "../../core/debug.js";
import { FALL_PALS } from "./settings.js";
import { loadShapes } from "./shapes.js";
import { drawForestFloor } from "./floor.js";
import { startFalling } from "./falling.js";
import { drawLedgeFungi } from "./ledges.js";
import { startSpider } from "./spider.js";
import { drawTree } from "./tree.js";
import { startOwl } from "./owl.js";
import { startWind } from "../wind.js";

export default function startFall(scene) {
  const pal = FALL_PALS[QS.get("fallpal")] || FALL_PALS.a;
  // Each part runs on its own, so a bug in one doesn't take the others down.
  // ?skip=tree,owl,... leaves parts out (to find what a TV can't handle); each start is logged.
  const skip = (QS.get("skip") || "").split(",");
  const part = (name, fn) => {
    if (skip.indexOf(name) >= 0) return crumb("autumn " + name + ": skipped");
    crumb("autumn " + name + ": start");
    try {
      const r = fn();
      crumb("autumn " + name + ": done");
      return r;
    } catch (e) {
      debugLog("Autumn " + name + ": " + e);
    }
  };
  crumb("autumn: loading shapes");
  loadShapes()
    .then(() => {
      // Tree first: the floor's leaves cover the foot of its trunk
      const tree = part("tree", () => drawTree(scene.layer, scene, pal));
      const surface = part("floor", () =>
        drawForestFloor(el("g", { class: "ground" }, scene.layer), scene, pal),
      );
      part("fungi", () => drawLedgeFungi(scene.layer, scene));
      const spider = part("spider", () => startSpider(scene.layer, scene));
      part("owl", () => tree && startOwl(scene.layer, scene, tree, spider));
      const wind = part("wind", () => startWind(scene));
      part("falling", () =>
        startFalling(
          scene.front || scene.layer, // in front of the clock too
          scene,
          pal,
          surface || (() => scene.geo.VB - 20),
          tree || null,
          wind || null,
        ),
      );
    })
    .catch((e) => debugLog("Autumn shapes: " + e));
}
