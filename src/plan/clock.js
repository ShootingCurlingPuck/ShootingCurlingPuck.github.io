// The clock group in the middle of the core: frame, time, date and the "Live" indicator.
// In standby the whole group moves to the centre of the screen and doubles in size.
import { CLOCK_F, FONT_STACK, TZ, REFRESH_MS } from "../config.js";
import { svg, el, label, img, roomShape } from "../core/svg.js";
import { mctx, inkMid } from "../core/text.js";
import { nowMs, fmt } from "../core/time.js";
import { state } from "../core/state.js";
import { CX, CLOCK_FRAME, FRAME_C, DATE_Y, ERR_Y, LIVE } from "../layout.js";

export const clockG = el("g", { class: "clockg" });
let clockEl, dateEl, liveG, liveChip, liveTxt;
export let errEl;

export function drawClock() {
  svg.appendChild(clockG);
  img(CLOCK_FRAME.file, CLOCK_FRAME.x, CLOCK_FRAME.y, CLOCK_FRAME.w, CLOCK_FRAME.h, clockG, {
    preserveAspectRatio: "xMidYMid meet",
  });
  clockEl = el("text", { x: FRAME_C.x, y: FRAME_C.y, class: "clock h", "font-size": CLOCK_F }, clockG);
  clockEl.style.dominantBaseline = "alphabetic";
  dateEl = el("text", { x: CX, y: DATE_Y, class: "date", "font-size": 26 }, clockG);
  errEl = el("text", { x: CX, y: ERR_Y, class: "err", "font-size": 20 }, svg);
}

export function drawLive() {
  liveG = el("g", {}, clockG);
  liveChip = roomShape(liveG, LIVE.x, LIVE.y + LIVE.size / 2, LIVE.size, LIVE.size, "nodata");
  liveTxt = label("", { x: LIVE.x + LIVE.size + 12, y: LIVE.y + LIVE.size, class: "lname", "font-size": 24 }, liveG);
}

// Fit the clock inside the frame's text area (re-run once the brand fonts have loaded)
export function placeClock() {
  let f = CLOCK_F;
  mctx.font = `700 ${f}px ${FONT_STACK}`;
  const w = mctx.measureText("00:00").width;
  if (w > 305) f = (f * 305) / w;
  clockEl.setAttribute("font-size", f);
  clockEl.setAttribute("y", FRAME_C.y + inkMid("0", f));
}

let lastClock = "",
  lastDate = "";
export function tick() {
  const now = new Date(nowMs());
  const c = fmt(now);
  if (c !== lastClock) {
    lastClock = c;
    clockEl.textContent = c;
  }
  const d = now.toLocaleDateString("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
  if (d !== lastDate) {
    lastDate = d;
    dateEl.textContent = d;
  }
}

export function renderLive(fresh) {
  liveG.style.display = state.standby ? "none" : "";
  if (state.standby) return;
  const late = fresh && Date.now() - state.lastOk > 2 * REFRESH_MS; // missed refreshes, not yet stale
  const st = !fresh ? "nodata" : late ? "soon" : "free";
  liveChip.setAttribute("class", "room " + st + (st === "free" ? " pulse" : ""));
  liveTxt.textContent = !fresh ? "Offline" : late ? "Delayed" : "Live";
}
