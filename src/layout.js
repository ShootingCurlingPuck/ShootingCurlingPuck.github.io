// Geometry derived from config.js and floorplan.json. Pure numbers: nothing is drawn here.
import {
  FLOOR,
  CORE,
  MAP_SHIFT,
  STANDBY_SCALE,
  CHIP,
  QR,
  PIXEL_CELL,
  PIXEL_GRID,
  CLOCK_FRAME_FILE,
} from "./config.js";
import plan from "./floorplan.json";

export const ROOMS = plan.rooms;
export const ANCHORS = plan.anchors;

const VIEW_H = FLOOR.h + 80;
const VIEW_W = Math.round((VIEW_H * 16) / 9);
export const VIEW = {
  x: Math.round(FLOOR.x + FLOOR.w / 2 - VIEW_W / 2 - MAP_SHIFT),
  y: FLOOR.y - 40,
  w: VIEW_W,
  h: VIEW_H,
};
export const VR = VIEW.x + VIEW.w,
  VB = VIEW.y + VIEW.h; // right / bottom edges

// Core-anchored: clock frame, date, error line
export const CX = CORE.x + CORE.w / 2;
export const CLOCK_FRAME = {
  file: CLOCK_FRAME_FILE,
  x: CORE.x,
  y: CORE.y + 75,
  w: CORE.w,
  h: 185,
};
export const FRAME_C = { x: CX + 5.5, y: CLOCK_FRAME.y + 87.5 };
export const DATE_Y = CORE.y + 256,
  ERR_Y = CORE.y + 344;
const GROUP_MID_Y = (CLOCK_FRAME.y + DATE_Y + 13) / 2; // vertical middle of frame + date
export const STANDBY_SHIFT = `translate(${VIEW.x + VIEW.w / 2}px, ${VIEW.y + VIEW.h / 2}px) scale(${STANDBY_SCALE}) translate(${-CX}px, ${-GROUP_MID_Y}px)`;
// Where a point of the clock group ends up in standby (the same move as STANDBY_SHIFT)
const inStandby = (x, y) => ({
  x: VIEW.x + VIEW.w / 2 + STANDBY_SCALE * (x - CX),
  y: VIEW.y + VIEW.h / 2 + STANDBY_SCALE * (y - GROUP_MID_Y),
});
// The underside of the clock frame's drawing (its blue shadow: x 40.7 to 216.6, y 99 in the frame
// file's 257.37 x 122.92 units, fitted into CLOCK_FRAME like the image), and the bottom of the date
// below it, both as they are in standby: for things that hang from the frame (the autumn spider)
const fk = Math.min(CLOCK_FRAME.w / 257.37, CLOCK_FRAME.h / 122.92),
  fx = CLOCK_FRAME.x + (CLOCK_FRAME.w - 257.37 * fk) / 2,
  fy = CLOCK_FRAME.y + (CLOCK_FRAME.h - 122.92 * fk) / 2;
const under1 = inStandby(fx + 40.7 * fk, fy + 99 * fk),
  under2 = inStandby(fx + 216.6 * fk, fy + 99 * fk);
export const STANDBY_CLOCK = {
  under: { x1: under1.x, x2: under2.x, y: under1.y },
  dateBottom: inStandby(CX, DATE_Y + 8).y,
};
// A point of the clock group on screen, in live mode or standby
export const clockPoint = (x, y, standby) => (standby ? inStandby(x, y) : { x: x, y: y });
// The tops of the clock frame's drawing (its white shape, in the frame file's units), in the clock
// group's own units: where snow can settle on it (see clockPoint for where they are on screen)
export const CLOCK_TOPS = [
  [27.6, 37.9, 8], // the little square top left
  [40.75, 213.8, 24], // the top
  [32.8, 40.75, 40], // the step on the left
  [216.6, 229.8, 40], // the step on the right
  [224.6, 237.8, 90.9], // the little square bottom right
].map((e) => ({ x1: fx + e[0] * fk, x2: fx + e[1] * fk, y: fy + e[2] * fk }));
export const LIVE_POS = "translate(0px, 0px) scale(1) translate(0px, 0px)";

// Live indicator under the date. Fixed left edge, text grows right.
export const LIVE = { size: 22, x: CORE.x + CORE.w / 2 - 48, y: DATE_Y + 24 };

// Screen-anchored: pixel clusters hug the viewBox corners
export const PIXEL_SCALE = PIXEL_CELL / (PIXEL_GRID.w / 3); // canvas units -> screen units
export const PIXEL_CORNERS = [
  { file: "assets/pxl-3.svg", x: VIEW.x + 400, y: VIEW.y + 101, sx: 1, sy: -1 },
  { file: "assets/pxl-2.svg", x: VIEW.x - 26, y: VB, sx: 1, sy: -1 },
  { file: "assets/pxl-1.svg", x: VR - 108, y: VB - 82, sx: 1, sy: 1 },
  {
    file: "assets/pxl-3.svg",
    x: VR - 108,
    y: VIEW.y + 501,
    sx: 1,
    sy: 1,
    rotate: -90,
  },
];

// Left panel: from screen edge to floor, with padding
export const LIST = {
  x: VIEW.x + 60,
  w: FLOOR.x - 75 - (VIEW.x + 60),
  head: FLOOR.y + 90,
  top: FLOOR.y + 170,
  rowH: 70,
  rows: ROOMS.filter((r) => !r.booth).length,
  nameF: 42,
  timeF: 28,
};
export const BOOTH_Y = LIST.top + LIST.rows * LIST.rowH + 24; // "Booths" heading
export const BOOTH_CHIP_Y = BOOTH_Y + 60;

// Feedback QR tile, in the free strip right of the floor
export const QR_TILE = QR.size + QR.pad * 2;
export const QR_X = Math.round((FLOOR.x + FLOOR.w + VR) / 2 - QR_TILE / 2);
export const QR_Y = FLOOR.y + FLOOR.h - QR_TILE - QR.lift;

export { FLOOR, CORE, CHIP };
