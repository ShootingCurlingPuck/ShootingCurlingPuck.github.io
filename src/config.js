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

// ----- Weather (Open-Meteo, free for non-commercial use, data under CC BY 4.0) -----
// Where the office is: weather for this spot. Brussels centre by default; set to the office.
export const WEATHER_AT = { lat: 50.85, lon: 4.35 };
export const WEATHER_EVERY_MS = 15 * 60 * 1000; // Open-Meteo's current data changes every 15 min
export const WEATHER_STALE_MS = 90 * 60 * 1000; // older than this: treat as "no weather"
// Credit shown under the QR code (required by the data licence), one entry per line
export const WEATHER_CREDIT = ["Weather by", "Open-Meteo.com"];
export const CREDIT_F = 15; // its font size
// Wind (see themes/wind.js). levels: [km/h, strength] points: still under 10 km/h, a breeze to 25,
// windy to 45, stormy beyond. noData: strength when there's no weather (a light breeze).
// ease: seconds to follow a weather change. Gusts: every gustEvery seconds in still air (much more
// often when windy), rising in gustRise and fading over gustFade seconds.
export const WIND = {
  levels: [
    [0, 0],
    [10, 0.15],
    [25, 0.45],
    [45, 0.8],
    [65, 1],
  ],
  noData: 0.1,
  ease: 40,
  gustEvery: [60, 150],
  gustRise: 0.6,
  gustFade: 2.5,
  standbyBoost: 1.3,
};
// Clouds (see themes/clouds.js): `count` clouds spread over a field `period` screen widths long
// that repeats as it drifts; each `width` units wide, made of puffs every `puffEvery` units with
// radii `puff` (bigger in the middle) and a soft `halo`. They hang down at most `depth` of the way
// from the top edge to the first text (0.95: to just above it, never over it). `opacity` of a cloud; from `bankFrom` cover on, the clouds
// merge into one continuous bank. ease: seconds to follow a weather change. speed: drift in units
// per second, still air .. full wind. Colours: body and outline, dry and when it rains.
export const CLOUDS = {
  count: 9,
  period: 1.5,
  width: [320, 560],
  puffEvery: 70,
  puff: [55, 105],
  halo: 10,
  depth: 0.95,
  opacity: 0.9,
  bankFrom: 0.75,
  ease: 60,
  speed: [4, 60],
  body: "#FFFFFF",
  line: "#AFC0DA",
  rainBody: "#D3D9E3",
  rainLine: "#8D9BB3",
};

// Rain (see themes/rain.js). levels: amount (0..1) per kind of rain, from its lightest to its
// heaviest mm/h. max: drops on screen at amount 1. slant: sideways per downward at full wind.
// speed in units per second, length of a streak in units (shorter in light rain).
// ease: seconds to follow a weather change. splashFrom: amount above which drops splash.
export const RAIN = {
  levels: {
    drizzle: { mm: [0.1, 0.5], amount: [0.15, 0.25] },
    rain: { mm: [0.5, 4], amount: [0.35, 0.7] },
    heavy: { mm: [4, 12], amount: [0.8, 1] },
    thunder: { mm: [2, 12], amount: [0.8, 1] }, // no lightning: just heavy rain
  },
  max: { live: 160, standby: 240 },
  slant: 0.45,
  speed: [950, 1250],
  length: [60, 110],
  width: 3,
  colour: "#4F6A8F",
  opacity: 0.5,
  ease: 60,
  splashFrom: 0.3,
};

// ----- Animation performance (see core/perf.js) -----
// Below `low` fps the detail level drops by `down` per second, above `high` it climbs back by `up`
// per second (slower, so it doesn't seesaw), never below `min`. `target`: the fps assumed at start.
// Tuned on the TV (Oct 2026): it tops out around 25 fps with almost nothing moving and runs at about
// 23 at full detail without visible stutter, so only a real slowdown (under 20) cuts detail.
export const PERF = {
  target: 25,
  low: 20,
  high: 23,
  down: 0.25,
  up: 0.05,
  min: 0.2,
};

// ----- Auto-refresh -----
export const WAKE_GAP_MS = 30 * 1000; // a 1 s tick arriving this late means the TV slept
export const MIN_LIFE_MS = 30 * 1000; // ignore wake signals this soon after load (prevents reload loops)
export const UPDATE_MS = 5 * 60 * 1000; // how often to check for new code
export const SYNC_MS = 10 * 60 * 1000; // how often to sync the clock
// Files whose change triggers a reload on the TV
export const WATCH = [
  "dist/app.js",
  "floorplan.css",
  "assets/themes/fall/sprites.svg",
];

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
export const ORMIT_LOGO = {
  file: "assets/logo-black.svg",
  x: 695,
  y: 1000,
  w: 300,
  h: 60,
};
export const VOLVE_LOGO = {
  file: "assets/volve.svg",
  x: 1365,
  y: 1165,
  w: 96,
  h: 48,
};
export const PSG_LOGO = {
  file: "assets/pauwels-consulting-logo.svg",
  x: 1650,
  y: 1349,
  w: 192,
  h: 96,
};
// Feedback QR: size = the code itself, pad = light border around it (the QR "quiet zone")
// lift = space below the tile, for the weather credit and clear of the forest floor
export const QR = {
  file: "assets/feedback-qr.svg",
  size: 130,
  pad: 10,
  lift: 100,
};
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
