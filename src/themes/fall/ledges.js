// Fungi growing on the tiles: little toadstool clusters on top edges, bracket fungi out of side
// edges. Chosen per day (seeded), never on booths. They sit in an "on-plan" group, which
// floorplan.css fades together with the plan in standby.
import { TZ } from "../../config.js";
import { QS } from "../../core/params.js";
import { nowMs } from "../../core/time.js";
import { el, use } from "../../core/svg.js";
import { seeded, randInt } from "../toolkit.js";
import { exposedEdges } from "../edges.js";
import { LEDGE_FUNGI } from "./settings.js";
import { propShape } from "./shapes.js";

export function drawLedgeFungi(layer, scene) {
  const g = el("g", { class: "on-plan" }, layer);
  const rnd = seeded(
    "fall-ledges " +
      (QS.get("seed") ||
        new Date(nowMs()).toLocaleDateString("en-GB", { timeZone: TZ })),
  );
  const all = exposedEdges(scene.geo);
  const edges = all.filter((e) => !(e.tile.room && e.tile.room.booth));
  const hits = (x, y, r) =>
    scene.keepOut.some(
      (k) =>
        x + r > k.x && x - r < k.x + k.w && y + r > k.y && y - r < k.y + k.h,
    );
  const shuffled = (list) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1)),
        t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  };
  const usedTiles = [];

  // Toadstools standing on a top edge, slightly sunk into the outline
  let n = randInt(rnd, LEDGE_FUNGI.toadstools[0], LEDGE_FUNGI.toadstools[1]);
  shuffled(edges.filter((e) => e.side === "top")).forEach((e) => {
    if (n <= 0 || usedTiles.indexOf(e.tile) >= 0 || e.x2 - e.x1 < 50) return;
    const x = e.x1 + 22 + rnd() * (e.x2 - e.x1 - 44),
      s = 0.65 + rnd() * 0.15;
    if (hits(x, e.at - 15, 25)) return;
    use(
      g,
      propShape("mushrooms"),
      `translate(${Math.round(x)} ${e.at + 3}) scale(${rnd() < 0.5 ? -s : s} ${s})`,
    );
    usedTiles.push(e.tile);
    n--;
  });

  // Chanterelles standing on a top edge, slightly sunk into the outline
  n = randInt(rnd, LEDGE_FUNGI.chanterelles[0], LEDGE_FUNGI.chanterelles[1]);
  shuffled(edges.filter((e) => e.side === "top")).forEach((e) => {
    if (n <= 0 || usedTiles.indexOf(e.tile) >= 0 || e.x2 - e.x1 < 50) return;
    const x = e.x1 + 22 + rnd() * (e.x2 - e.x1 - 44),
      s = 0.65 + rnd() * 0.75;
    if (hits(x, e.at - 15, 25)) return;
    use(
      g,
      "prop-chanterelles",
      `translate(${Math.round(x)} ${e.at + 3}) scale(${rnd() < 0.5 ? -s : s} ${s})`,
    );
    usedTiles.push(e.tile);
    n--;
  });

  // Bracket fungi growing out of a side edge, pointing away from the tile
  n = randInt(rnd, LEDGE_FUNGI.brackets[0], LEDGE_FUNGI.brackets[1]);
  shuffled(
    edges.filter((e) => e.side === "left" || e.side === "right"),
  ).forEach((e) => {
    if (n <= 0 || usedTiles.indexOf(e.tile) >= 0 || e.y2 - e.y1 < 40) return;
    const y = e.y1 + 15 + rnd() * (e.y2 - e.y1 - 30),
      s = 1 + rnd() * 0.25,
      dir = e.side === "right" ? 1 : -1;
    if (all.covered(e.at + dir * 22, y) || hits(e.at + dir * 12, y, 15)) return; // room to stick out
    use(
      g,
      "ledge-bracket",
      `translate(${e.at} ${Math.round(y)}) scale(${dir * s} ${s})`,
    );
    usedTiles.push(e.tile);
    n--;
  });
}
