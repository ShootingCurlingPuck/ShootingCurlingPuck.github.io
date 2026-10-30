// Autumn: a tree on the right, a forest floor along the bottom edge, fungi on the tiles,
// a visiting spider, falling leaves carried by the wind, and rain
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
import { startRain } from "../rain.js";
import { startClouds } from "../clouds.js";

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
      // Everything that moves goes in the front layer (scene.front), which the TV can redraw on
      // its own; the tree, floor and fungi stay in the plan's layer, drawn once
      const moving = scene.front || scene.layer;
      const spider = part("spider", () => startSpider(moving, scene, tree));
      part("owl", () => tree && startOwl(moving, scene, tree, spider));
      const wind = part("wind", () => startWind(scene));
      part("falling", () =>
        startFalling(
          moving,
          scene,
          pal,
          surface || (() => scene.geo.VB - 20),
          tree || null,
          wind || null,
          () => (rain ? rain.amount() : 0),
        ),
      );
      // Clouds in their own layer (scene.sky); they hang down at most halfway to the first text:
      // the room names at the top of the plan and the "Rooms" heading (font size 52)
      const g = scene.geo;
      const textTop = Math.min(
        g.LIST.head - 52 * 0.6,
        ...g.ROOMS.filter((r) => !r.booth).map((r) => r.y + r.h / 2 - g.NAME_F * 0.6),
      );
      const clouds = scene.sky
        ? part("clouds", () =>
            startClouds(scene.sky, scene, wind || null, textTop, () =>
              rain ? rain.amount() : 0,
            ),
          )
        : null;
      // Rain last: in front of the falling leaves, from under the clouds
      const rain = part("rain", () =>
        startRain(moving, scene, wind || null, surface, clouds || null),
      );
    })
    .catch((e) => debugLog("Autumn shapes: " + e));
}
