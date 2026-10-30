// All tunable settings in one place. Layout geometry derived from these lives in layout.js,
// room and anchor coordinates in floorplan.json.

// ----- Data -----
export const DATA_URL =
  "https://defaulte0e5bdf3aed144d3a1d20677842249.ac.environment.api.powerplatform.com/powerautomate/automations/direct/cu/30/workflows/9b00daac866f48c3901fd5518909b9b4/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ZzGG55w4he-5jts1YHl-aPl_cRBANaPgxD4noVRohps";
export const TZ = "Europe/Brussels";
export const SOON_MIN = 15; // "free, but busy soon" threshold
export const OPEN_H = 7,
  CLOSE_H = 19; // standby outside these hours, and at weekends
export const REFRESH_MS = 60 * 1000;
export const STALE_MS = 5 * 60 * 1000; // keep showing last good data this long after failures
export const FETCH_TIMEOUT_MS = 20 * 1000;

// ----- Auto-refresh -----
export const WAKE_GAP_MS = 30 * 1000; // a 1 s tick arriving this late means the TV slept
export const MIN_LIFE_MS = 30 * 1000; // ignore wake signals this soon after load (prevents reload loops)
export const UPDATE_MS = 5 * 60 * 1000; // how often to check for new code
export const SYNC_MS = 10 * 60 * 1000; // how often to sync the clock
// Files whose change triggers a reload on the TV
export const WATCH = ["dist/app.js", "floorplan.css", "assets/themes/fall/sprites.svg"];

// ----- Font sizes -----
export const NAME_F = 26; // one size for every room name
export const CLOCK_F = 70; // max clock size, shrinks automatically if too wide
export const CHAR_W = 0.68; // average glyph width in em, used to fit text into tiles
export const FONT_STACK = "Obviously, NeueHaas, Arial, sans-serif";

export const CHIP = 32; // size of the state square in the list
export const NAME_DX = CHIP + 14; // gap between chip and name

// ----- Brand palette -----
export const P = {
  t1: "#CEDEFF", // Tint I: background
  t2: "#256EFF", // Tint II
  t3: "#FFFFFF", // Tint III: floor
  t4: "#FFFFFF",
  red: "#C8102E", // Accent I: busy, clock
  green: "#FFEAFC", // Accent II: free
  yellow: "#FFEAFC", // Marking: busy soon, highlight
  ink: "#000000",
};

// ----- Assets (change paths here if you move files; missing files just don't show) -----
export const ORMIT_LOGO = { file: "assets/logo-black.svg", x: 695, y: 1000, w: 300, h: 60 };
export const VOLVE_LOGO = { file: "assets/volve.svg", x: 1365, y: 1165, w: 96, h: 48 };
export const PSG_LOGO = { file: "assets/pauwels-consulting-logo.svg", x: 1650, y: 1349, w: 192, h: 96 };
// Feedback QR: size = the code itself, pad = light border around it (the QR "quiet zone")
export const QR = { file: "assets/feedback-qr.svg", size: 130, pad: 10 };
// "Kitchen" label: anywhere in the kitchen (between the top-right corners of the elevator
// zone and of the floor plan). Themes keep it clear.
export const KITCHEN_LABEL = { x: 1650, y: 540 };
// "You" marker: the TV hangs on the Oval's south wall, facing the open area
export const YOU = { x: 764, y: 920, dot: 8, ring: 17 };
// Pixel clusters: file + corner. sx/sy mirror the cluster so it hugs its corner.
export const PIXEL_CELL = 54;
export const PIXEL_GRID = { x: 286.3, y: 439.46, w: 932.9 }; // where the 3 x 2 squares sit inside the 1500 canvas
export const CLOCK_FRAME_FILE = "assets/frame.svg";

// ----- Layout: change these few numbers, everything else follows -----
export const FLOOR = { x: 651, y: 339, w: 1238, h: 1161 };
export const CORE = { x: 1039, y: 740, w: 461, h: 360 }; // the solid block with the clock
export const MAP_SHIFT = 280; // how far the map is pushed right (more list space)
export const STANDBY_SCALE = 2;
