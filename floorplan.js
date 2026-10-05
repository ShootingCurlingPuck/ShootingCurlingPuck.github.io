// Written to run on old TV browsers (Samsung 2018, Chromium ~56): no trailing commas in calls,
// no async/await, and fallbacks for APIs that engine lacks. Keep it that way when editing.
// Test URLs: ?mode=live | ?mode=standby | ?debug=1 (shows errors on screen) | ?icons=text|emoji

// ----- SETTINGS -----
const DATA_URL =
  "https://defaulte0e5bdf3aed144d3a1d20677842249.ac.environment.api.powerplatform.com/powerautomate/automations/direct/cu/30/workflows/9b00daac866f48c3901fd5518909b9b4/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ZzGG55w4he-5jts1YHl-aPl_cRBANaPgxD4noVRohps";
const TZ = "Europe/Brussels";
const SOON_MIN = 15; // "free, but busy soon" threshold
const OPEN_H = 7,
  CLOSE_H = 19; // standby outside these hours, and at weekends
const FORCE = new URLSearchParams(location.search).get("mode"); // "standby" or "live" for testing
const REFRESH_MS = 60 * 1000;
const STALE_MS = 5 * 60 * 1000; // keep showing last good data this long after failures
const FETCH_TIMEOUT_MS = 20 * 1000;
const QS = new URLSearchParams(location.search);
let clockOffset = 0; // server time minus device time
const nowMs = () => Date.now() + clockOffset;

// On-screen error log for TVs without devtools. Only active with ?debug=1
let debugLog = () => {};
if (QS.get("debug")) {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;left:0;top:0;right:0;z-index:9;padding:8px;background:#fff;color:#c00;font:20px monospace;white-space:pre-wrap";
  document.body.appendChild(box);
  debugLog = (m) => {
    box.textContent += m + "\n";
  };
  window.onerror = (m, src, line) => debugLog(m + " (line " + line + ")");
}

// ---- FONT SIZES ----
const NAME_F = 26; // one size for every room name
const CLOCK_F = 70; // max clock size, shrinks automatically if too wide
const CHAR_W = 0.68; // average glyph width in em, used to fit text into tiles
const FONT_STACK = "Obviously, NeueHaas, Arial, sans-serif";

const CHIP = 32; // size of the state square in the list
const NAME_DX = CHIP + 14; // gap between chip and name

// ---- Brand palette ----
const P = {
  t1: "#C69C6D", // Tint I: background
  t2: "#A25C0F", // Tint II
  t3: "#FAFDE5", // Tint III: floor
  t4: "#E0CDA9",
  red: "#C8102E", // Accent I: busy, clock
  green: "#54987C", // Accent II: free
  yellow: "#E1FF6F", // Marking: busy soon, highlight
  ink: "#000000",
};
Object.keys(P).forEach((k) =>
  document.documentElement.style.setProperty("--" + k, P[k])
);

// ---- ASSETS (change paths here if you move files; missing files just don't show) ----
const ORMIT_LOGO = {
  file: "assets/logo-black.svg",
  x: 695,
  y: 980,
  w: 300,
  h: 60,
};
const VOLVE_LOGO = {
  file: "assets/volve.svg",
  x: 1365,
  y: 1165,
  w: 96,
  h: 48,
};
const PSG_LOGO = {
  file: "assets/pauwels-consulting-logo.svg",
  x: 1650,
  y: 1349,
  w: 192,
  h: 96,
};
// Feedback QR: size = the code itself, pad = light border around it (the QR "quiet zone")
const QR = { file: "assets/feedback-qr.svg", size: 130, pad: 10 };
// Pixel clusters: file + corner. sx/sy mirror the cluster so it hugs its corner.
const PIXEL_CELL = 54;
const PIXEL_GRID = { x: 286.3, y: 439.46, w: 932.9 }; // where the 3 x 2 squares sit inside the 1500 canvas
// --------------------

// Coordinates come straight from Floorplan.xml. booth = big single letter, no time line.
const ROOMS = [
  {
    email: "bootha@ormittalent.be",
    name: "A",
    x: 650,
    y: 533,
    w: 53,
    h: 80,
    booth: true,
  },
  {
    email: "boothb@ormittalent.be",
    name: "B",
    x: 880,
    y: 1278,
    w: 53,
    h: 62,
    booth: true,
  },
  {
    email: "boothc@ormittalent.be",
    name: "C",
    x: 880,
    y: 1340,
    w: 53,
    h: 62,
    booth: true,
  },
  {
    email: "boothd@ormittalent.be",
    name: "D",
    x: 1717,
    y: 965,
    w: 53,
    h: 62,
    booth: true,
  },
  {
    email: "theboard@ormittalent.be",
    name: "Board",
    x: 1500,
    y: 740,
    w: 160,
    h: 240,
  },
  {
    email: "developmentlab@ormittalent.be",
    name: "Development Lab",
    x: 1091,
    y: 566,
    w: 369,
    h: 174,
  },
  {
    email: "thegrowthhub@ormittalent.be",
    name: "Growth Hub",
    x: 650,
    y: 339,
    w: 361,
    h: 161,
  },
  {
    email: "thehive@ormittalent.be",
    name: "Hive",
    x: 933,
    y: 1278,
    w: 113,
    h: 102,
  },
  {
    email: "thejungle@ormittalent.be",
    name: "Jungle",
    x: 1500,
    y: 980,
    w: 123,
    h: 120,
  },
  {
    email: "thenest@ormittalent.be",
    name: "Nest",
    x: 1443,
    y: 1340,
    w: 123,
    h: 160,
  },
  {
    email: "theoasis@ormittalent.be",
    name: "Oasis",
    x: 1320,
    y: 1340,
    w: 123,
    h: 160,
  },
  {
    email: "theoval@ormittalent.be",
    name: "Oval",
    x: 650,
    y: 740,
    w: 170,
    h: 120,
  },
  {
    email: "thepause@ormittalent.be",
    name: "Pause",
    x: 650,
    y: 613,
    w: 100,
    h: 127,
  },
  {
    email: "theretreat@ormittalent.be",
    name: "Retreat",
    x: 1770,
    y: 900,
    w: 120,
    h: 127,
  },
  {
    email: "thestudio@ormittalent.be",
    name: "Studio",
    x: 1770,
    y: 740,
    w: 120,
    h: 160,
  },
];

// Non-bookable spaces: muted visual anchors. No label = unlabelled.
const ANCHORS = [
  { x: 750, y: 566, w: 70, h: 174, dashed: true }, // storage
  { x: 880, y: 566, w: 211, h: 174, label: "🚻", f: 48, dashed: true }, // toilets
  { x: 1460, y: 566, w: 113, h: 174, label: "⬆️⬇️", f: 32, dashed: true }, // elevators
  { x: 650, y: 1302, w: 155, h: 198, label: "🔇", f: 48, dashed: true }, // focus room
  { x: 1167, y: 1100, w: 493, h: 178, dashed: true }, // Volve
  { x: 1721, y: 1027, w: 169, h: 120, dashed: true }, // Pauwels room
  { x: 880, y: 1180, w: 133, h: 102, label: "🚻", f: 48, dashed: true }, // toilets
];

// Text measuring canvas. If the browser has no canvas, fall back to a crude estimate instead of crashing.
const mctx = document.createElement("canvas").getContext("2d") || {
  font: "",
  measureText: (t) => ({ width: t.length * 20 }),
};

// Old TV browsers often have no emoji font. Detect that (a missing glyph measures the same as
// any other missing glyph) and fall back to short text labels. Force with ?icons=text or ?icons=emoji
const ICONS = QS.get("icons");
const EMOJI_OK = ICONS
  ? ICONS === "emoji"
  : (function () {
      mctx.font = `700 40px ${FONT_STACK}`;
      return mctx.measureText("🚻").width !== mctx.measureText("\uFFFF").width;
    })();
const ICON_TEXT = { "🚻": "WC", "⬆️⬇️": "Lift", "🔇": "Quiet" };

const SVGNS = "http://www.w3.org/2000/svg";
const XLINK = "http://www.w3.org/1999/xlink";
const svg = document.getElementById("plan");

// ---- LAYOUT: change these few numbers, everything else follows ----
const FLOOR = { x: 651, y: 339, w: 1238, h: 1161 };
const CORE = { x: 1039, y: 740, w: 461, h: 360 }; // the solid block with the clock
const MAP_SHIFT = 280; // how far the map is pushed right (more list space)
const VIEW_H = FLOOR.h + 80;
const VIEW_W = Math.round((VIEW_H * 16) / 9);
const VIEW = {
  x: Math.round(FLOOR.x + FLOOR.w / 2 - VIEW_W / 2 - MAP_SHIFT),
  y: FLOOR.y - 40,
  w: VIEW_W,
  h: VIEW_H,
};
svg.setAttribute("viewBox", [VIEW.x, VIEW.y, VIEW.w, VIEW.h].join(" "));
const VR = VIEW.x + VIEW.w,
  VB = VIEW.y + VIEW.h; // right / bottom edges

// Core-anchored: clock frame, date, error line
const CX = CORE.x + CORE.w / 2;
const CLOCK_FRAME = {
  file: "assets/frame.svg",
  x: CORE.x,
  y: CORE.y + 75,
  w: CORE.w,
  h: 185,
};
const FRAME_C = { x: CX + 5.5, y: CLOCK_FRAME.y + 87.5 };
const DATE_Y = CORE.y + 292,
  ERR_Y = CORE.y + 344;
const GROUP_MID_Y = (CLOCK_FRAME.y + DATE_Y + 13) / 2; // vertical middle of frame + date
const STANDBY_SCALE = 2;
const STANDBY_SHIFT = `translate(${VIEW.x + VIEW.w / 2}px, ${VIEW.y + VIEW.h / 2}px) scale(${STANDBY_SCALE}) translate(${-CX}px, ${-GROUP_MID_Y}px)`;
const LIVE_POS = "translate(0px, 0px) scale(1) translate(0px, 0px)";

// Screen-anchored: pixel clusters hug the viewBox corners
const PIXEL_CORNERS = [
  { file: "assets/pxl-3.svg", x: VIEW.x + 154, y: VIEW.y + 101, sx: 1, sy: -1 },
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
const LIST = {
  x: VIEW.x + 60,
  w: FLOOR.x - 75 - (VIEW.x + 60),
  head: FLOOR.y + 90,
  top: FLOOR.y + 170,
  rowH: 70,
  rows: ROOMS.filter((r) => !r.booth).length,
  nameF: 42,
  timeF: 28,
};

function el(tag, attrs, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
function label(text, attrs, parent) {
  const t = el("text", attrs, parent);
  t.textContent = text;
  return t;
}
function roomShape(parent, x, y, w, h, state) {
  const g = el("g", { class: "room " + state }, parent);
  el("rect", { x, y, width: w, height: h, rx: 8, class: "base" }, g);
  el(
    "rect",
    { x: x + 2, y: y + 2, width: w - 4, height: h - 4, rx: 6, class: "base" },
    g
  );
  return g;
}
function img(file, x, y, w, h, parent, extra) {
  const n = el(
    "image",
    Object.assign({ x, y, width: w, height: h }, extra || {}),
    parent || svg
  );
  n.setAttributeNS(XLINK, "xlink:href", file);
  return n;
}

// ---- Static drawing ----
el(
  "rect",
  { x: VIEW.x, y: VIEW.y, width: VIEW.w, height: VIEW.h, fill: P.t1 },
  svg
);

// Pixel clusters in the corners
const k = PIXEL_CELL / (PIXEL_GRID.w / 3); // canvas units -> screen units
PIXEL_CORNERS.forEach((c) => {
  const g = el(
    "g",
    {
      transform: `translate(${c.x} ${c.y}) scale(${c.sx} ${c.sy}) rotate(${c.rotate || 0})`,
    },
    svg
  );
  const f = el("g", { filter: "url(#white30)" }, g);
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
  svg
);

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
    svg
  );
  if (a.label) {
    const txt = !EMOJI_OK && ICON_TEXT[a.label];
    label(
      txt || a.label,
      {
        x: a.x + a.w / 2,
        y: a.y + a.h / 2,
        "font-size": txt ? Math.min(a.f, fit(txt, a.w * 0.8, a.f)) : a.f,
      },
      svg
    );
  }
});

label("Kitchen", { x: 1750, y: 450, "font-size": 26 }, svg);

ROOMS.forEach((r) => {
  r.g = roomShape(svg, r.x, r.y, r.w, r.h, "nodata");
  r.nameEl = el("text", { class: "h" }, r.g);
});

// Inner walls (solid block in the middle) and outer wall
el(
  "rect",
  { x: CORE.x, y: CORE.y, width: CORE.w, height: CORE.h, rx: 8, class: "core" },
  svg
);

img(ORMIT_LOGO.file, ORMIT_LOGO.x, ORMIT_LOGO.y, ORMIT_LOGO.w, ORMIT_LOGO.h);
img(VOLVE_LOGO.file, VOLVE_LOGO.x, VOLVE_LOGO.y, VOLVE_LOGO.w, VOLVE_LOGO.h);
img(PSG_LOGO.file, PSG_LOGO.x, PSG_LOGO.y, PSG_LOGO.w, PSG_LOGO.h);

// Centre of the ring: clock frame, clock, date, error line
const clockG = el("g", { class: "clockg" }, svg);
img(
  CLOCK_FRAME.file,
  CLOCK_FRAME.x,
  CLOCK_FRAME.y,
  CLOCK_FRAME.w,
  CLOCK_FRAME.h,
  clockG,
  { preserveAspectRatio: "xMidYMid meet" }
);
const clockEl = el(
  "text",
  { x: FRAME_C.x, y: FRAME_C.y, class: "clock h", "font-size": CLOCK_F },
  clockG
);
clockEl.style.dominantBaseline = "alphabetic";
const dateEl = el(
  "text",
  { x: CX, y: DATE_Y, class: "date", "font-size": 26 },
  clockG
);

const errEl = el(
  "text",
  { x: CX, y: ERR_Y, class: "err", "font-size": 20 },
  svg
);

// ---- "Rooms" panel (left margin) ----
const listG = el("g", {}, svg); // "live" class hides it in standby
label(
  "Rooms",
  { x: LIST.x, y: LIST.head, class: "h lhead", "font-size": 52 },
  listG
);
const listRows = [];
for (let i = 0; i < LIST.rows; i++) {
  const y = LIST.top + i * LIST.rowH;
  const g = el("g", {}, listG);
  listRows.push({
    g: g,
    chip: roomShape(g, LIST.x, y - CHIP / 2, CHIP, CHIP, "free"),
    name: el("text", { x: LIST.x + NAME_DX, y: y, class: "lname" }, g),
    time: el(
      "text",
      { x: LIST.x + LIST.w, y: y, class: "ltime", "font-size": LIST.timeF },
      g
    ),
  });
}

const BOOTH_Y = LIST.top + LIST.rows * LIST.rowH + 24;
label(
  "Booths",
  { x: LIST.x, y: BOOTH_Y, class: "h lhead", "font-size": 52 },
  listG
);
const boothCells = ROOMS.filter((r) => r.booth).map((r, i, all) => {
  const x = LIST.x + (i * LIST.w) / all.length;
  const g = el("g", {}, listG);
  return {
    r: r,
    chip: roomShape(g, x, BOOTH_Y + 60, CHIP, CHIP, "nodata"),
    name: label(
      r.name,
      {
        x: x + CHIP + 10,
        y: BOOTH_Y + 60 + CHIP / 2 - 3,
        class: "lname h",
        "font-size": 34,
      },
      g
    ),
  };
});

// Standby veil: covers everything except the clock group, which is drawn above it
const veil = el(
  "rect",
  { x: VIEW.x, y: VIEW.y, width: VIEW.w, height: VIEW.h, class: "dim" },
  svg
);
// Final z-order: ...map, logos, list, veil, clock
svg.insertBefore(listG, clockG);
svg.insertBefore(veil, clockG);

// Feedback QR in the free strip right of the floor. Appended last so the standby veil doesn't dim it.
const QR_TILE = QR.size + QR.pad * 2;
const QR_X = Math.round((FLOOR.x + FLOOR.w + VR) / 2 - QR_TILE / 2);
const QR_Y = FLOOR.y + FLOOR.h - QR_TILE - 40;
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
  svg
);
img(QR.file, QR_X + QR.pad, QR_Y + QR.pad, QR.size, QR.size);
label(
  "Feedback",
  {
    x: QR_X + QR_TILE / 2,
    y: QR_Y - 30,
    class: "h",
    "font-size": 26,
  },
  svg
);

const listName = (a) => (a.r.booth ? "Booth " : "") + a.r.name;

function renderList(rows, fresh) {
  listG.setAttribute("opacity", fresh || standby ? 1 : 0.3); // feed dead: whole panel fades
  boothCells.forEach((c) => {
    const a = rows.find((x) => x.r === c.r);
    c.chip.setAttribute("class", "room " + a.res.state);
    c.name.setAttribute("opacity", a.res.state === "busy" ? 0.6 : 1);
  });
  rows = rows.filter((a) => !a.r.booth);
  rows.sort((a, b) =>
    a.r.name.toLowerCase() < b.r.name.toLowerCase() ? -1 : 1
  );
  listRows.forEach((row, i) => {
    const a = rows[i];
    row.g.style.display = a ? "" : "none";
    if (!a) return;
    const nm = listName(a);
    const dim = a.res.state === "busy" ? 0.6 : 1;
    row.chip.setAttribute("class", "room " + a.res.state);
    row.name.textContent = nm;
    row.name.setAttribute(
      "font-size",
      fit(nm, LIST.w - NAME_DX - 110, LIST.nameF)
    );
    row.name.setAttribute("opacity", dim);
    row.time.textContent = a.res.until
      ? `${a.res.state === "busy" ? "busy" : "free"} until ${fmt(a.res.until)}`
      : "";
    row.time.setAttribute(
      "opacity",
      row.time.textContent.includes("busy") ? 0.6 : 1
    );
  });
}

// ---- Logic ----
function inkMid(text, size) {
  // distance from baseline up to the middle of the glyph ink
  mctx.font = `700 ${size}px ${FONT_STACK}`;
  const m = mctx.measureText(text);
  if (typeof m.actualBoundingBoxAscent !== "number") return size * 0.36; // old engines: about half the cap height
  return (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
}
function placeClock() {
  let f = CLOCK_F;
  mctx.font = `700 ${f}px ${FONT_STACK}`;
  const w = mctx.measureText("00:00").width;
  if (w > 305) f = (f * 305) / w; // keep inside the frame's text area
  clockEl.setAttribute("font-size", f);
  clockEl.setAttribute("y", FRAME_C.y + inkMid("0", f));
}

function parseUtc(s) {
  if (!/[zZ]$|[+-]\d\d:\d\d$/.test(s)) s += "Z";
  return new Date(s.replace(/(\.\d{3})\d+/, "$1")); // Graph sends 7 fractional digits
}
function fmt(d) {
  return d.toLocaleTimeString("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

function roomState(sched, now) {
  if (!sched || sched.error) return { state: "nodata" };
  const iv = (sched.scheduleItems || [])
    .filter((i) => i.status !== "free")
    .map((i) => [
      parseUtc(i.start.dateTime).getTime(),
      parseUtc(i.end.dateTime).getTime(),
    ])
    .sort((a, b) => a[0] - b[0]);
  const merged = []; // merge touching/overlapping bookings
  for (const [s, e] of iv) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  const t = now.getTime();
  const cur = merged.find(([s, e]) => t >= s && t < e);
  if (cur) return { state: "busy", until: new Date(cur[1]) };
  const next = merged.find(([s]) => s > t);
  if (!next) return { state: "free" };
  return {
    state: (next[0] - t) / 60000 <= SOON_MIN ? "soon" : "free",
    until: new Date(next[0]),
  };
}

function fit(text, maxW, maxF) {
  return Math.min(maxF, maxW / (text.length * CHAR_W));
}

function layout(r, res) {
  const cx = r.x + r.w / 2,
    cy = r.y + r.h / 2,
    maxW = r.w * 0.8;
  if (r.booth) {
    const fs = Math.min(r.w, r.h) * 0.8;
    r.nameEl.textContent = r.name;
    r.nameEl.style.dominantBaseline = "alphabetic";
    r.nameEl.setAttribute("x", cx);
    r.nameEl.setAttribute("y", cy + inkMid(r.name, fs));
    r.nameEl.setAttribute("font-size", fs);
    return;
  }
  const nf = fit(r.name, maxW, NAME_F);
  r.nameEl.textContent = r.name;
  r.nameEl.setAttribute("x", cx);
  r.nameEl.setAttribute("y", cy);
  r.nameEl.setAttribute("font-size", nf);
}

let standby = null;

function isStandby(now) {
  if (FORCE === "standby") return true;
  if (FORCE === "live") return false;
  // Two plain calls instead of formatToParts (missing on old engines)
  const weekday = now.toLocaleDateString("en-GB", {
    timeZone: TZ,
    weekday: "short",
  });
  const h =
    parseInt(
      now.toLocaleTimeString("en-GB", {
        timeZone: TZ,
        hour: "2-digit",
        minute: "2-digit",
      }),
      10
    ) % 24;
  return weekday === "Sat" || weekday === "Sun" || h < OPEN_H || h >= CLOSE_H;
}

function applyMode() {
  const s = isStandby(new Date(nowMs()));
  if (s === standby) return;
  standby = s;
  svg.classList.toggle("standby", s);
  clockG.style.transform = s ? STANDBY_SHIFT : LIVE_POS;
  if (s) {
    lastData = null;
    errMsg = "";
  } // nothing stale survives standby
  else load();
  render();
}

let lastData = null,
  lastOk = 0,
  errMsg = "";

function render() {
  const now = new Date(nowMs());
  const fresh = lastData && Date.now() - lastOk < STALE_MS;
  const avail = [];
  ROOMS.forEach((r) => {
    const res = fresh
      ? roomState(lastData.get(r.email), now)
      : { state: "nodata" };
    r.g.setAttribute("class", "room " + res.state);
    layout(r, res);
    avail.push({ r: r, res: res });
  });
  renderList(avail, !!fresh);
  errEl.textContent = fresh || standby ? "" : errMsg;
}

let lastClock = "",
  lastDate = "";
function tick() {
  const now = new Date(nowMs());
  const c = fmt(now);
  if (c !== lastClock) {
    lastClock = c;
    clockEl.textContent = c;
  }
  const d = now.toLocaleDateString("en-GB", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  if (d !== lastDate) {
    lastDate = d;
    dateEl.textContent = d;
  }
}

// fetch + JSON with a hard timeout. AbortController is optional (missing on old engines).
function fetchJson(url, ms) {
  return new Promise((resolve, reject) => {
    const ctl =
      typeof AbortController === "function" ? new AbortController() : null;
    const timer = setTimeout(() => {
      if (ctl) ctl.abort();
      reject(new Error("Timeout"));
    }, ms);
    fetch(url, { cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then((res) => {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(
        (d) => {
          clearTimeout(timer);
          resolve(d);
        },
        (e) => {
          clearTimeout(timer);
          reject(e);
        }
      );
  });
}

function load() {
  if (standby) return;
  // "&_=" defeats HTTP caching on engines that ignore cache: "no-store"
  fetchJson(DATA_URL + "&_=" + Date.now(), FETCH_TIMEOUT_MS)
    .then((data) => {
      if (data.generatedAt) {
        const off = parseUtc(data.generatedAt).getTime() - Date.now();
        clockOffset = Math.abs(off) > 5000 ? off : 0; // ignore normal jitter
      }
      const list = data.value || (data.schedule && data.schedule.value);
      if (!Array.isArray(list)) throw new Error("Unexpected response");
      if (standby) return;
      lastData = new Map(
        list.map((s) => [String(s.scheduleId).toLowerCase(), s])
      );
      lastOk = Date.now();
      errMsg = "";
    })
    .catch((e) => {
      errMsg = "Room data unavailable";
      console.error(e);
      debugLog(String(e));
    })
    .then(render);
}

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
setInterval(load, REFRESH_MS);
setInterval(
  function () {
    if (standby && new Date().getHours() === 23) location.reload();
  },
  30 * 60 * 1000
);
