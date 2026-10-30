import { FONT_STACK, CHAR_W } from "../config.js";
import { QS } from "./params.js";

// Text measuring canvas. If the browser has no canvas, fall back to a crude estimate instead of crashing.
export const mctx = document.createElement("canvas").getContext("2d") || {
  font: "",
  measureText: (t) => ({ width: t.length * 20 }),
};

// Font size that makes text fit maxW, capped at maxF
export function fit(text, maxW, maxF) {
  return Math.min(maxF, maxW / (text.length * CHAR_W));
}

// Distance from baseline up to the middle of the glyph ink
export function inkMid(text, size) {
  mctx.font = `700 ${size}px ${FONT_STACK}`;
  const m = mctx.measureText(text);
  if (typeof m.actualBoundingBoxAscent !== "number") return size * 0.36; // old engines: about half the cap height
  return (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
}

// Old TV browsers often have no emoji font. Detect that (a missing glyph measures the same as
// any other missing glyph) and fall back to short text labels. Force with ?icons=text or ?icons=emoji
const ICONS = QS.get("icons");
export const EMOJI_OK = ICONS
  ? ICONS === "emoji"
  : (function () {
      mctx.font = `700 40px ${FONT_STACK}`;
      return mctx.measureText("🚻").width !== mctx.measureText("\uFFFF").width;
    })();
export const ICON_TEXT = { "🚻": "WC", "⬆️⬇️": "Lift", "🔇": "Quiet" };
