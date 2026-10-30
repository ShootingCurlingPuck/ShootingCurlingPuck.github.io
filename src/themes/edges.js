// Exposed edges of the tiles (rooms, booths, the clock block): stretches where nothing sits right
// against them. Themes use these to put things on, under or beside tiles.
// Each edge: { side: "top" | "bottom" | "left" | "right", x1, x2 (horizontal) or y1, y2 (vertical),
// at: the edge's y (top/bottom) or x (left/right), tile }
export function exposedEdges(geo, opts) {
  const minLen = (opts && opts.minLen) || 40;
  const tiles = geo.ROOMS.map((r) => ({
    x: r.x,
    y: r.y,
    w: r.w,
    h: r.h,
    room: r,
  })).concat([
    { x: geo.CORE.x, y: geo.CORE.y, w: geo.CORE.w, h: geo.CORE.h, core: true },
  ]);
  const covered = (x, y) =>
    tiles.some((t) => x > t.x && x < t.x + t.w && y > t.y && y < t.y + t.h);
  const edges = [];
  // Walk along one side in 8-unit steps, collecting open stretches
  function walk(tile, side, from, to, probe) {
    let start = null;
    for (let p = from + 8; p <= to - 8; p += 8) {
      const open = !covered.apply(null, probe(p));
      const lastStep = p + 8 > to - 8;
      if (open && start === null) start = p;
      if ((!open || lastStep) && start !== null) {
        const end = open ? p : p - 8;
        if (end - start >= minLen) {
          const e = { side: side, tile: tile };
          if (side === "top" || side === "bottom") {
            e.x1 = start;
            e.x2 = end;
            e.at = side === "top" ? tile.y : tile.y + tile.h;
          } else {
            e.y1 = start;
            e.y2 = end;
            e.at = side === "left" ? tile.x : tile.x + tile.w;
          }
          edges.push(e);
        }
        start = null;
      }
    }
  }
  tiles.forEach((t) => {
    walk(t, "top", t.x, t.x + t.w, (x) => [x, t.y - 4]);
    walk(t, "bottom", t.x, t.x + t.w, (x) => [x, t.y + t.h + 4]);
    walk(t, "left", t.y, t.y + t.h, (y) => [t.x - 4, y]);
    walk(t, "right", t.y, t.y + t.h, (y) => [t.x + t.w + 4, y]);
  });
  edges.covered = covered;
  return edges;
}
