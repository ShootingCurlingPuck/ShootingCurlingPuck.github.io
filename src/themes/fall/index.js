// Autumn: a tree on the right, a forest floor along the bottom edge, fungi on the tiles (some
// glowing at night), a visiting spider, now and then a will-o'-the-wisp, and falling leaves
// carried by the wind (the weather itself is in sky/)
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
import { startAcorns } from "./acorns.js";
import { startFoxfire } from "./foxfire.js";
import { startWisp } from "./wisp.js";
import { season } from "./season.js";

export default function startFall(scene) {
  // The season decides the colours (from green and yellow to brown), how deep the litter is, and
  // how many acorns and mushrooms there are (see season.js)
  const now = season();
  const pals = now.palettes(FALL_PALS[QS.get("fallpal")] || FALL_PALS.a);
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
      const tree = part("tree", () => drawTree(scene.layer, scene, pals.tree));
      const ground = el("g", { class: "ground" }, scene.layer);
      const glows = []; // where fungi glow at night (foxfire)
      const surface = part("floor", () =>
        drawForestFloor(ground, scene, pals.litter, now, glows),
      );
      part("fungi", () => drawLedgeFungi(scene.layer, scene, now.fungi));
      // Everything that moves goes in a layer of its own, which the TV can redraw on its own; the
      // tree, floor and fungi stay in the plan's layer, drawn once. The owl (in the trunk, under
      // the night veil) goes in the moving layer (scene.front); the falling leaves and the spider
      // are above the night veil, in front of the stars and behind the clouds (scene.near), so they
      // shade themselves at night: the leaves by their colours, the spider (a small drawing) with a
      // filter.
      const fx = scene.fx || {};
      const moving = scene.front || scene.layer;
      const near = scene.near || moving;
      // foxfire first: everything else in the near layer passes in front of it
      part("foxfire", () => startFoxfire(near, scene, glows));
      const spiderLayer = el(
        "g",
        fx.daylight && scene.near ? { filter: fx.daylight.shadeFilter } : {},
        near,
      );
      const spider = part("spider", () => startSpider(spiderLayer, scene, tree));
      // the will-o'-the-wisp drifts over the litter; the owl watches it like it watches the spider
      const wisp = part(
        "wisp",
        () => surface && startWisp(near, scene, surface, fx.wind || null, fx.precip || null),
      );
      const watched =
        spider || wisp
          ? {
              out: () => !!((wisp && wisp.out()) || (spider && spider.out())),
              pos: () => (wisp && wisp.out() ? wisp.pos() : spider.pos()),
            }
          : null;
      // the owl sits in the trunk; when it goes hunting it flies off up close in front of the
      // veil, shading itself, and shows far off in the night sky (owl-flight.js)
      part("owl", () => tree && startOwl(moving, scene, tree, watched, near));
      // The weather (scene.fx, see sky/index.js) is general; autumn reacts to it and tells it
      // where its ground is: rain lands on the leaf cover, up to 25 units into it
      if (fx.precip && surface) fx.precip.setGround(surface, 25);
      // snow settles on the tree's thicker branches too (by the air's temperature)
      if (fx.snow && tree) fx.snow.addAirLedges(tree.ledges(6));
      // and keeps the night sky behind the tree and the leaf litter
      if (fx.night) {
        if (tree) fx.night.addForeground(tree.group);
        fx.night.addForeground(ground);
      }
      part("falling", () =>
        startFalling(
          near,
          scene,
          pals.tree, // they come from the tree
          surface || (() => scene.geo.VB - 20),
          tree || null,
          fx.wind || null,
          () => (fx.precip ? fx.precip.amount() : 0),
        ),
      );
      part(
        "acorns",
        () =>
          tree &&
          surface &&
          startAcorns(near, scene, tree, surface, fx.wind || null, now.acornsPerMinute),
      );
    })
    .catch((e) => debugLog("Autumn shapes: " + e));
}
