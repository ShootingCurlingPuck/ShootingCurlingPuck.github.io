// A small spider that visits every few minutes. Live: it lowers itself from the underside of a
// tile (a different one each time), hangs and sways, then climbs back. Standby: it comes down
// from the top of the screen, at a different spot each time, and stays longer; where the tree's
// branches are above that spot, it comes down from the underside of one of them instead.
// Test switches: ?spider=now (first visit after 2 s, then every 15-25 s), ?spider=tree (the same,
// and in standby always from a branch)
import { QS } from "../../core/params.js";
import { el, use } from "../../core/svg.js";
import { everyFrame } from "../toolkit.js";
import { exposedEdges } from "../edges.js";
import { SPIDER } from "./settings.js";

export function startSpider(layer, scene, tree) {
  const { VIEW, VR, VB } = scene.geo;
  const test = QS.get("spider") === "now" || QS.get("spider") === "tree";
  const fromTree = QS.get("spider") === "tree";
  const allEdges = exposedEdges(scene.geo);
  const undersides = allEdges.filter((e) => e.side === "bottom" && e.tile.room);
  const hits = (x, y, r) =>
    scene.keepOut.some(
      (k) =>
        x + r > k.x && x - r < k.x + k.w && y + r > k.y && y - r < k.y + k.h,
    );
  const between = (r) => r[0] + Math.random() * (r[1] - r[0]);
  const nextWait = () =>
    test ? 15 + Math.random() * 10 : between(SPIDER.every) * 60;

  const sc = SPIDER.scale;
  const g = el("g", { class: "spider" }, layer);
  const thread = el(
    "line",
    { stroke: "#3B2F2A", "stroke-opacity": 0.5, "stroke-width": 1.3 },
    g,
  );
  const body = use(g, "critter-spider", "");
  g.style.display = "none";

  let phase = "wait",
    wait = test ? 2 : nextWait(),
    t = 0;
  let ax, ay, drop, hang, y, inStandby, lastTile, lastX, fromEdge;

  // Pick where to come down; false if no good spot right now
  function choose() {
    inStandby = scene.isStandby();
    if (inStandby) {
      // From above the top edge, away from the big standby clock in the middle; or, where the
      // tree is above that spot, from the underside of one of its branches there (any of them)
      const mid = VIEW.x + VIEW.w / 2;
      for (let i = 0; i < 40; i++) {
        const x = VIEW.x + 80 + Math.random() * (VIEW.w - 160);
        if (
          Math.abs(x - mid) < 520 ||
          (lastX !== undefined && Math.abs(x - lastX) < 300)
        )
          continue;
        const ys = tree ? tree.branchesAt(x, SPIDER.branchMinW) : [];
        if (fromTree && !ys.length) continue;
        if (ys.length) {
          const branch = ys[Math.floor(Math.random() * ys.length)];
          // from the branch, but never down into the leaves on the ground
          const room = VB - 200 - branch;
          if (room < 60) continue;
          const d = Math.min(between(SPIDER.standby.drop), room);
          // and not where the thread would run down in front of the trunk
          let onTrunk = false;
          for (let k = 0; k <= 4; k++) {
            const tr = tree.trunkAt(branch + (d * k) / 4);
            if (Math.abs(x - tr.x) < tr.w / 2 + 25) onTrunk = true;
          }
          // nor hanging over something that must stay clear (labels, QR code)
          if (onTrunk || hits(x, branch + d, 30)) continue;
          ax = x;
          ay = branch;
          drop = d;
          fromEdge = true; // comes out from behind the branch
        } else {
          ax = x;
          ay = VIEW.y - 30;
          drop = between(SPIDER.standby.drop) + 30;
          if (hits(x, ay + drop, 30)) continue;
          fromEdge = false;
        }
        hang = between(SPIDER.standby.hang);
        lastX = x;
        return true;
      }
      return false;
    }
    // Under a tile, with open space below it for the whole drop
    for (let i = 0; i < 20; i++) {
      const e = undersides[Math.floor(Math.random() * undersides.length)];
      if (!e || e.tile === lastTile) continue;
      const x = e.x1 + 15 + Math.random() * (e.x2 - e.x1 - 30);
      let clear = 0;
      while (
        clear < 400 &&
        !allEdges.covered(x, e.at + 6 + clear) &&
        e.at + clear < VB - 160
      )
        clear += 6;
      const d = Math.min(between(SPIDER.live.drop), clear - 30);
      if (d < 50 || hits(x, e.at + d, 30)) continue;
      ax = x;
      ay = e.at;
      drop = d;
      hang = between(SPIDER.live.hang);
      lastTile = e.tile;
      fromEdge = true;
      return true;
    }
    return false;
  }

  function draw(sway) {
    g.setAttribute(
      "transform",
      `rotate(${sway.toFixed(2)} ${ax.toFixed(1)} ${ay})`,
    );
    thread.setAttribute("x1", ax);
    thread.setAttribute("y1", ay);
    thread.setAttribute("x2", ax);
    thread.setAttribute("y2", (y - 16 * sc).toFixed(1));
    body.setAttribute(
      "transform",
      `translate(${ax.toFixed(1)} ${y.toFixed(1)}) scale(${sc})`,
    );
  }

  everyFrame((now, dt) => {
    if (phase === "wait") {
      wait -= dt;
      if (wait > 0) return;
      if (!choose()) {
        wait = 30; // try again a bit later
        return;
      }
      phase = "down";
      t = 0;
      y = ay;
      g.style.display = "";
      g.setAttribute("opacity", fromEdge ? 0 : 1);
    }
    // Mode changed while visiting: head back up
    if (scene.isStandby() !== inStandby && phase !== "up") phase = "up";
    t += dt;
    if (phase === "down") {
      y += SPIDER.speed.down * dt;
      if (fromEdge)
        g.setAttribute("opacity", Math.min(1, t / 0.4).toFixed(2)); // out from behind the edge
      if (y >= ay + drop) {
        y = ay + drop;
        phase = "hang";
        t = 0;
      }
      draw(0);
    } else if (phase === "hang") {
      draw(4 * Math.sin(t * 1.3) * Math.min(1, t / 2)); // a gentle sway, easing in
      if (t >= hang) phase = "up";
    } else if (phase === "up") {
      y -= SPIDER.speed.up * dt * (scene.isStandby() !== inStandby ? 2 : 1);
      const left = y - ay;
      if (fromEdge)
        g.setAttribute(
          "opacity",
          Math.max(0, Math.min(1, left / 20)).toFixed(2),
        );
      if (left <= 0) {
        g.style.display = "none";
        phase = "wait";
        wait = nextWait();
        return;
      }
      draw(0);
    }
  });

  // For whoever wants to watch it (the owl)
  return {
    out: () => phase !== "wait",
    pos: () => ({ x: ax, y: y }),
  };
}
