// The parts of the screen that never change: background, brand pixels, floor, anchors, rooms, logos.
import {
  P,
  NAME_F,
  ORMIT_LOGO,
  VOLVE_LOGO,
  PSG_LOGO,
  YOU,
  PIXEL_GRID,
  KITCHEN_LABEL,
} from "../config.js";
import { svg, el, label, img, roomShape } from "../core/svg.js";
import { fit, EMOJI_OK, ICON_TEXT } from "../core/text.js";
import {
  VIEW,
  FLOOR,
  CORE,
  ROOMS,
  ANCHORS,
  PIXEL_CORNERS,
  PIXEL_SCALE,
} from "../layout.js";

export function drawStatic() {
  // Brand colours as CSS variables (floorplan.css uses them)
  Object.keys(P).forEach((k) =>
    document.documentElement.style.setProperty("--" + k, P[k]),
  );
  svg.setAttribute("viewBox", [VIEW.x, VIEW.y, VIEW.w, VIEW.h].join(" "));

  el(
    "rect",
    { x: VIEW.x, y: VIEW.y, width: VIEW.w, height: VIEW.h, fill: P.t1 },
    svg,
  );

  // Pixel clusters in the corners
  const k = PIXEL_SCALE;
  PIXEL_CORNERS.forEach((c) => {
    const g = el(
      "g",
      {
        transform: `translate(${c.x} ${c.y}) scale(${c.sx} ${c.sy}) rotate(${c.rotate || 0})`,
      },
      svg,
    );
    const f = el("g", {}, g);
    img(c.file, -PIXEL_GRID.x * k, -PIXEL_GRID.y * k, 1500 * k, 1500 * k, f);
  });

  el(
    "rect",
    {
      x: FLOOR.x,
      y: FLOOR.y,
      width: FLOOR.w,
      height: FLOOR.h,
      rx: 8,
      class: "floor",
    },
    svg,
  );

  // Non-bookable spaces: muted visual anchors. No label = unlabelled.
  ANCHORS.forEach((a) => {
    el(
      "rect",
      {
        x: a.x,
        y: a.y,
        width: a.w,
        height: a.h,
        rx: 8,
        class: "anchor" + (a.dashed ? " dashed" : ""),
      },
      svg,
    );
    if (a.label) {
      const f = a.f || NAME_F;
      const txt = !EMOJI_OK && ICON_TEXT[a.label];
      label(
        txt || a.label,
        {
          x: a.x + a.w / 2,
          y: a.y + a.h / 2,
          "font-size": txt ? Math.min(f, fit(txt, a.w * 0.8, f)) : f,
        },
        svg,
      );
    }
  });

  label(
    "Kitchen",
    { x: KITCHEN_LABEL.x, y: KITCHEN_LABEL.y, "font-size": 26 },
    svg,
  );

  // Room tiles; their colour and name are set on every render
  ROOMS.forEach((r) => {
    r.g = roomShape(svg, r.x, r.y, r.w, r.h, "nodata");
    r.nameEl = el("text", { class: "h" }, r.g);
  });

  // Inner walls (solid block in the middle)
  el(
    "rect",
    {
      x: CORE.x,
      y: CORE.y,
      width: CORE.w,
      height: CORE.h,
      rx: 8,
      class: "core",
    },
    svg,
  );

  [ORMIT_LOGO, VOLVE_LOGO, PSG_LOGO].forEach((l) =>
    img(l.file, l.x, l.y, l.w, l.h),
  );

  // "You" marker, between the Oval and the Ormit logo
  const youG = el("g", {}, svg);
  el(
    "circle",
    {
      cx: YOU.x,
      cy: YOU.y,
      r: YOU.ring,
      fill: "none",
      stroke: P.t2,
      "stroke-width": 4,
    },
    youG,
  );
  el("circle", { cx: YOU.x, cy: YOU.y, r: YOU.dot, fill: P.ink }, youG);
  label(
    "You",
    {
      x: YOU.x - YOU.ring - 3,
      y: YOU.y + YOU.ring + 12,
      class: "h lname",
      "font-size": 20,
      opacity: 0.6,
    },
    youG,
  );
}
