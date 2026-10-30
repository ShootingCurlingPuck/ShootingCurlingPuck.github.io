// Feedback QR in the free strip right of the floor. Drawn last so nothing (veil, theme) covers it.
import { QR } from "../config.js";
import { svg, el, label, img } from "../core/svg.js";
import { QR_X, QR_Y, QR_TILE } from "../layout.js";

export function drawQR() {
  el(
    "rect",
    {
      x: QR_X,
      y: QR_Y,
      width: QR_TILE,
      height: QR_TILE,
      rx: 8,
      class: "floor",
    },
    svg,
  );
  img(QR.file, QR_X + QR.pad, QR_Y + QR.pad, QR.size, QR.size);
  label(
    "Feedback",
    { x: QR_X + QR_TILE / 2, y: QR_Y - 30, class: "h", "font-size": 26 },
    svg,
  );
}
