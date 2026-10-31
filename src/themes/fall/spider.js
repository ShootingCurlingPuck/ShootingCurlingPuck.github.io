// A small spider that visits every few minutes. Live: it lowers itself from the underside of a
// tile (a different one each time), hangs and sways, then climbs back. Standby (the tiles are
// faint then): from the underside of the clock's frame, down past the date, or from the underside
// of one of the tree's branches (below the clouds), and it stays longer.
// Weather: in rain it only peeks (a short way down, a moment, straight back up); in strong wind it
// stays in; out already, it swings with the wind and climbs back up in a strong gust or when the rain
// starts. A few more visits at night.
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
  const fx = scene.fx || {};
  const rain = () => (fx.precip ? fx.precip.amount() : 0);
  const windy = () => (fx.wind ? fx.wind.strength() : 0);
  const night = () => (fx.daylight ? fx.daylight.darkness() > 0.5 : false);
  const nextWait = () =>
    test
      ? 15 + Math.random() * 10
      : (between(SPIDER.every) * 60) / (night() ? SPIDER.nightMore : 1);

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
  let ax, ay, drop, hang, y, inStandby, lastTile, lastX, fromEdge, peek, fromFrame;
  let sway = 0; // degrees, eased: it swings with the wind
  // a strong gust while it hangs there: back up
  if (fx.wind)
    fx.wind.onGust((amp) => {
      if (phase === "hang" && amp >= SPIDER.gustUp) phase = "up";
    });

  // Pick where to come down; false if no good spot right now. Live: from the underside of a tile.
  // Standby: from the clock's frame or a branch of the tree (never from the top of the screen: it
  // would come out of the clouds).
  function choose() {
    inStandby = scene.isStandby();
    fromFrame = false;
    if (!inStandby) return fromTile();
    if (tree && (fromTree || Math.random() < 0.5) && fromBranch()) return true;
    if (fromTree) return false;
    return fromClock();
  }

  // From the underside of the clock's frame, hanging below the date
  function fromClock() {
    const C = scene.geo.STANDBY_CLOCK;
    if (!C) return false;
    for (let i = 0; i < 10; i++) {
      const x = C.under.x1 + 30 + Math.random() * (C.under.x2 - C.under.x1 - 60);
      if (lastX !== undefined && Math.abs(x - lastX) < 80) continue;
      const room = VB - 200 - C.under.y;
      const d = Math.min(room, Math.max(C.dateBottom - C.under.y + 60, between(SPIDER.standby.drop)));
      if (d < 60 || hits(x, C.under.y + d, 30)) continue;
      ax = x;
      ay = C.under.y;
      drop = d;
      hang = between(SPIDER.standby.hang);
      lastX = x;
      fromEdge = true; // comes out from behind the frame
      fromFrame = true;
      return true;
    }
    return false;
  }
  const mid = VIEW.x + VIEW.w / 2;
  const nearClock = (x) => inStandby && Math.abs(x - mid) < SPIDER.clockClear;
  const below = (fx.cloudsBottom || VIEW.y) + 10; // branches below the clouds only

  // From the underside of one of the tree's branches (thick enough), wherever they reach
  function fromBranch() {
    for (let i = 0; i < 40; i++) {
      const x = VIEW.x + 80 + Math.random() * (VIEW.w - 160);
      if (nearClock(x) || (lastX !== undefined && Math.abs(x - lastX) < 300)) continue;
      const ys = tree.branchesAt(x, SPIDER.branchMinW).filter((b) => b > below);
      if (!ys.length) continue;
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
      hang = between(SPIDER.standby.hang);
      lastX = x;
      fromEdge = true; // comes out from behind the branch
      return true;
    }
    return false;
  }

  // Under a tile, with open space below it for the whole drop
  function fromTile() {
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
      hang = between(inStandby ? SPIDER.standby.hang : SPIDER.live.hang);
      lastTile = e.tile;
      lastX = x;
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
      if (windy() > SPIDER.windy) {
        wait = 60; // too windy: stays in, tries again in a minute
        return;
      }
      if (!choose()) {
        wait = 30; // try again a bit later
        return;
      }
      // raining: only a peek at the weather, then back in
      peek = rain() > SPIDER.wet;
      if (peek) {
        // under the clock it only just shows itself, above the date
        drop = fromFrame ? between(SPIDER.peek.frame) : Math.min(drop, between(SPIDER.peek.drop));
        hang = between(SPIDER.peek.hang);
      }
      phase = "down";
      t = 0;
      y = ay;
      g.style.display = "";
      g.setAttribute("opacity", fromEdge ? 0 : 1);
    }
    // Mode changed while visiting, or the rain started: head back up
    if (scene.isStandby() !== inStandby && phase !== "up") phase = "up";
    if (!peek && rain() > SPIDER.wet && phase !== "up") phase = "up";
    t += dt;
    // swinging: a gentle sway while it hangs, more in the wind, pushed the way the wind blows
    const w = windy(),
      gust = fx.wind ? fx.wind.gust() : 0;
    const dir = fx.wind ? fx.wind.dir() : 1;
    const swing =
      (phase === "hang" ? 4 * Math.min(1, t / 2) : 0) * Math.sin(t * 1.3) +
      SPIDER.windSway * (w * 0.6 + gust * 0.4) * (0.6 * dir + 0.4 * Math.sin(t * 1.7));
    sway += (swing - sway) * Math.min(1, dt * 3);
    if (phase === "down") {
      y += SPIDER.speed.down * dt;
      if (fromEdge)
        g.setAttribute("opacity", Math.min(1, t / 0.4).toFixed(2)); // out from behind the edge
      if (y >= ay + drop) {
        y = ay + drop;
        phase = "hang";
        t = 0;
      }
      draw(sway);
    } else if (phase === "hang") {
      draw(sway);
      if (t >= hang) phase = "up";
    } else if (phase === "up") {
      const hurry = scene.isStandby() !== inStandby || peek || rain() > SPIDER.wet ? 2 : 1;
      y -= SPIDER.speed.up * dt * hurry;
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
      draw(sway);
    }
  });

  // For whoever wants to watch it (the owl)
  return {
    out: () => phase !== "wait",
    pos: () => ({ x: ax, y: y }),
  };
}
