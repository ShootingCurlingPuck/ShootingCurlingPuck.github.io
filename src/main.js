// Room status screen: builds the page in drawing order, then keeps it up to date.
// Written as ES modules; esbuild bundles them into dist/app.js for the TV (old Chromium 56),
// so modern syntax is fine here. Drawing order = z-order, so the order below matters.
import { crumb } from "./core/debug.js"; // first, so it catches errors from everything else
import {
  REFRESH_MS,
  STALE_MS,
  P,
  ORMIT_LOGO,
  VOLVE_LOGO,
  PSG_LOGO,
  NAME_F,
  KITCHEN_LABEL,
  WEATHER_CREDIT,
  CREDIT_F,
} from "./config.js";
import { svg, el, overlay } from "./core/svg.js";
import { state } from "./core/state.js";
import { nowMs } from "./core/time.js";
import { on, emit } from "./core/events.js";
import * as L from "./layout.js";
import { drawStatic } from "./plan/static.js";
import { layoutRoom } from "./plan/rooms.js";
import {
  clockG,
  errEl,
  drawClock,
  drawLive,
  placeClock,
  tick,
  renderLive,
} from "./plan/clock.js";
import { listG, drawList, drawListRows, renderList } from "./plan/list.js";
import { drawQR } from "./plan/qr.js";
import { load, roomState } from "./data/schedule.js";
import { applyMode } from "./system/mode.js";
import { startAutoRefresh, safeReload } from "./system/autorefresh.js";
import { startTheme, themeChanged } from "./themes/index.js";
import { startWeather, getWeather } from "./weather/weather.js";

// ---- Drawing ----
drawStatic(); // background, brand pixels, floor, anchors, rooms, core, logos, "You"
drawClock(); // clock group + error line
drawList(); // "Rooms" heading
drawLive(); // live indicator inside the clock group
drawListRows(); // list rows and booths
crumb("plan drawn");

// Standby veil: dims everything except the clock group, which sits above it
const veil = el(
  "rect",
  { x: L.VIEW.x, y: L.VIEW.y, width: L.VIEW.w, height: L.VIEW.h, class: "dim" },
  svg,
);
// Final z-order: ...map, logos, list, [theme], veil, clock, error line; then two layers on top:
// [theme front] (everything that moves), then the QR code
svg.insertBefore(listG, clockG);
svg.insertBefore(veil, clockG);
// Front layer for themes, in its own drawing on top: everything that moves goes here, so the TV
// doesn't have to redraw the whole plan for every moving leaf (see overlay() in core/svg.js)
const frontG = el("g", { class: "theme-front" }, overlay("moving"));
drawQR(overlay("top")); // last, so nothing covers it

// Seasonal theme. Live: above the plan and list, under the veil. Standby: above the veil.
const themeG = el("g", { class: "theme" }, svg);
svg.insertBefore(themeG, veil);
startTheme({
  layer: themeG,
  geo: {
    VIEW: L.VIEW,
    VR: L.VR,
    VB: L.VB,
    FLOOR: L.FLOOR,
    CORE: L.CORE,
    ROOMS: L.ROOMS,
    LIST: L.LIST,
    CHIP: L.CHIP,
    NAME_F: NAME_F,
    BOOTH_CHIP_Y: L.BOOTH_CHIP_Y,
  },
  // spots a theme must never cover: the QR code (with its label and the weather credit), the logos,
  // the Kitchen label,
  keepOut: [
    {
      x: L.QR_X - 8,
      y: L.QR_Y - 60,
      w: L.QR_TILE + 16,
      h: L.QR_TILE + 60 + CREDIT_F * (1.2 + 1.15 * WEATHER_CREDIT.length),
    },
  ]
    .concat(
      [PSG_LOGO, ORMIT_LOGO, VOLVE_LOGO].map((l) => ({
        x: l.x,
        y: l.y,
        w: l.w,
        h: l.h,
      })),
    )
    .concat([
      { x: KITCHEN_LABEL.x - 60, y: KITCHEN_LABEL.y - 18, w: 120, h: 36 },
    ])
    // and the labels/icons of the non-bookable spaces (toilets, lifts, Focus)
    .concat(
      L.ANCHORS.filter((a) => a.label).map((a) => {
        const w = Math.min(a.w - 10, 90),
          h = (a.f || NAME_F) * 1.4;
        return {
          x: a.x + a.w / 2 - w / 2,
          y: a.y + a.h / 2 - h / 2,
          w: w,
          h: h,
        };
      }),
    ),
  front: frontG, // above everything except the QR code, in live and standby: for things that move
  palette: P,
  isStandby: () => !!state.standby,
  on: on, // subscribe to events: "mode" (standby), "room" (a room changed state), "weather"
  weather: getWeather, // the latest weather, or null (see weather/weather.js)
});

// ---- Updating ----
const lastState = {}; // per room, to notice changes (sent as a "room" event, e.g. for themes)
function render() {
  const now = new Date(nowMs());
  const fresh = state.lastData && Date.now() - state.lastOk < STALE_MS;
  const avail = [];
  L.ROOMS.forEach((r) => {
    const res = fresh
      ? roomState(state.lastData.get(r.email), now)
      : { state: "nodata" };
    r.g.setAttribute("class", "room " + res.state);
    const before = lastState[r.email];
    if (
      before &&
      before !== "nodata" &&
      res.state !== "nodata" &&
      before !== res.state
    )
      emit("room", {
        name: r.name,
        x: r.x + r.w / 2,
        y: r.y + r.h / 2,
        from: before,
        to: res.state,
      });
    lastState[r.email] = res.state;
    layoutRoom(r);
    avail.push({ r: r, res: res });
  });
  renderList(avail, !!fresh);
  renderLive(fresh);
  errEl.textContent = fresh || state.standby ? "" : state.errMsg;
}

on("mode", (standby) => {
  svg.insertBefore(themeG, standby ? clockG : veil);
  if (!standby && themeChanged()) safeReload(); // season changed overnight
  clockG.style.transform = standby ? L.STANDBY_SHIFT : L.LIVE_POS;
  if (standby) {
    state.lastData = null; // nothing stale survives standby
    state.errMsg = "";
  } else load(render);
  render();
});

placeClock();
tick();
applyMode();
// Re-measure once the brand fonts have really loaded
(document.fonts
  ? Promise.all([
      document.fonts.load("700 20px Obviously"),
      document.fonts.load("700 20px NeueHaas"),
    ])
  : Promise.resolve()
)
  .catch(() => {})
  .then(() => {
    placeClock();
    render();
  });
setInterval(tick, 1000);
setInterval(applyMode, 10 * 1000);
setInterval(render, 10 * 1000); // re-evaluate states between fetches
setInterval(() => load(render), REFRESH_MS);

startWeather(); // live weather; themes can use it (nothing visible depends on it yet)

startAutoRefresh(() => {
  tick();
  applyMode();
});
