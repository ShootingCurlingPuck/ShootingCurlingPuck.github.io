// Feedback QR in the free strip right of the floor, with the weather credit under it.
// Drawn last so nothing (veil, theme) covers it.
import { QR, WEATHER_CREDIT, CREDIT_F } from "../config.js";
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
  // Weather data credit, small, just under the tile
  WEATHER_CREDIT.forEach((line, i) =>
    label(
      line,
      {
        x: QR_X + QR_TILE / 2,
        y: QR_Y + QR_TILE + CREDIT_F * (1.1 + 1.15 * i),
        "font-size": CREDIT_F,
        fill: "#000",
        "fill-opacity": 0.75,
      },
      svg,
    ),
  );
}
