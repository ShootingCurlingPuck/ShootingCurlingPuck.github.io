// Written to run on old TV browsers (Samsung 2018, Chromium ~56): no trailing commas in calls,
// no async/await, and fallbacks for APIs that engine lacks. Keep it that way when editing.
// Test URLs: ?mode=live | ?mode=standby | ?debug=1 (shows errors on screen) | ?icons=text|emoji

// ----- SETTINGS -----
const DATA_URL =
  "https://defaulte0e5bdf3aed144d3a1d20677842249.ac.environment.api.powerplatform.com/powerautomate/automations/direct/cu/30/workflows/9b00daac866f48c3901fd5518909b9b4/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=ZzGG55w4he-5jts1YHl-aPl_cRBANaPgxD4noVRohps";
const TZ = "Europe/Brussels";
const SOON_MIN = 10; // "free, but booked soon" threshold
const OPEN_H = 7,
  CLOSE_H = 19; // standby outside these hours, and at weekends
const FORCE = new URLSearchParams(location.search).get("mode"); // "standby" or "live" for testing
const REFRESH_MS = 60 * 1000;
const STALE_MS = 6 * 60 * 1000; // keep showing last good data this long after failures
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
const NAME_F = 28; // one size for every room name
const TIME_F = 22; // one size for every time line
const UNTIL_F = 18; // the small "until" label above the time
const CLOCK_F = 70; // max clock size, shrinks automatically if too wide
const CHAR_W = 0.68; // average glyph width in em, used to fit text into tiles
const FONT_STACK = "Obviously, NeueHaas, Arial, sans-serif";
const FRAME_C = { x: 1275, y: 862.5 }; // centre of the clock frame's text area

// ---- BRAND: Pink palette (+ black and white) ----
const P = {
  t1: "#C69C6D", // Tint I: background
  t2: "#A25C0F", // Tint II
  t3: "#FAFDE5", // Tint III: floor
  t4: "#E0CDA9",
  red: "#C8102E", // Accent I: busy, clock
  green: "#54987C", // Accent II: free
  yellow: "#E1FF6F", // Marking: booked soon, highlight
  ink: "#000000",
};
Object.keys(P).forEach((k) =>
  document.documentElement.style.setProperty("--" + k, P[k])
);

// ---- ASSETS (change paths here if you move files; missing files just don't show) ----
const CLOCK_FRAME = {
  file: "assets/frame.svg",
  x: 1039,
  y: 775,
  w: 461,
  h: 185,
};
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
// Pixel clusters: file + corner. sx/sy mirror the cluster so it hugs its corner.
const PIXEL_CELL = 54;
const PIXEL_CORNERS = [
  { file: "assets/pxl-3.svg", x: 320, y: 400, sx: 1, sy: -1 },
  { file: "assets/pxl-2.svg", x: 139, y: 1540, sx: 1, sy: -1 },
  { file: "assets/pxl-1.svg", x: 2264, y: 1458, sx: 1, sy: 1 },
  { file: "assets/pxl-3.svg", x: 2264, y: 800, sx: 1, sy: 1, rotate: -90 },
];
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
el("rect", { x: 166, y: 299, width: 2206, height: 1241, fill: P.t1 }, svg); // background

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
  const f = el(
    "g",
    { "clip-path": "url(#pxclip)", filter: "url(#white30)" },
    g
  );
  img(c.file, -PIXEL_GRID.x * k, -PIXEL_GRID.y * k, 1500 * k, 1500 * k, f);
});

el(
  "rect",
  { x: 651, y: 339, width: 1238, height: 1161, rx: 8, class: "floor" },
  svg
); // floor

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
        class: "alabel",
        "font-size": txt ? Math.min(a.f, fit(txt, a.w * 0.8, a.f)) : a.f,
      },
      svg
    );
  }
});

label("Kitchen", { x: 1750, y: 450, class: "alabel", "font-size": 26 }, svg);

ROOMS.forEach((r) => {
  r.g = roomShape(svg, r.x, r.y, r.w, r.h, "nodata");
  r.nameEl = el("text", { class: "h" }, r.g);
  r.untilEl = el("text", { class: "u" }, r.g);
  r.timeEl = el("text", {}, r.g);
});

// Inner walls (solid block in the middle) and outer wall
el(
  "rect",
  { x: 1039, y: 740, width: 461, height: 360, rx: 8, class: "core" },
  svg
);

// Standby veil: covers the plan, everything drawn after it stays crisp
el("rect", { x: 166, y: 299, width: 2206, height: 1241, class: "dim" }, svg);

img(ORMIT_LOGO.file, ORMIT_LOGO.x, ORMIT_LOGO.y, ORMIT_LOGO.w, ORMIT_LOGO.h);
img(VOLVE_LOGO.file, VOLVE_LOGO.x, VOLVE_LOGO.y, VOLVE_LOGO.w, VOLVE_LOGO.h);
img(PSG_LOGO.file, PSG_LOGO.x, PSG_LOGO.y, PSG_LOGO.w, PSG_LOGO.h);

// Centre of the ring: clock frame, clock, date, legend, error line
const CX = 1269.5;
const clockG = el("g", {}, svg);
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
  { x: CX, y: 972, class: "date", "font-size": 26 },
  clockG
);
const legendG = el("g", { class: "live" }, svg);
const LEG_F = 18,
  LEG_GAP = 24;
function buildLegend() {
  while (legendG.firstChild) legendG.removeChild(legendG.firstChild);
  mctx.font = `700 ${LEG_F}px NeueHaas, Arial, sans-serif`; // the legend's real font
  const items = [
    ["free", "Free"],
    ["soon", "Booked soon"],
    ["busy", "Busy"],
  ].map(([s, t]) => ({ s, t, w: 36 + mctx.measureText(t).width }));
  let lx =
    CX -
    (items.reduce((a, i) => a + i.w, 0) + LEG_GAP * (items.length - 1)) / 2;
  items.forEach((i) => {
    roomShape(legendG, lx, 1002, 26, 20, i.s);
    label(
      i.t,
      { x: lx + 36, y: 1012, class: "legend", "font-size": LEG_F },
      legendG
    );
    lx += i.w + LEG_GAP;
  });
}
buildLegend();
const errEl = el(
  "text",
  { x: CX, y: 1084, class: "err", "font-size": 20 },
  svg
);

// ---- "Free now" panel (left margin) ----
const LIST = {
  x: 196,
  w: 430,
  top: 550,
  rowH: 90,
  rows: 10,
  nameF: 40,
  timeF: 24,
};
const listG = el("g", { class: "live" }, svg); // "live" class hides it in standby
const listHead = label(
  "Free now",
  { x: LIST.x, y: LIST.top - LIST.rowH, class: "h lhead", "font-size": 52 },
  listG
);
label(
  "until",
  {
    x: LIST.x + LIST.w,
    y: 478,
    class: "ltime",
    "font-size": 20,
    "fill-opacity": 0.6,
  },
  listG
);
const listRows = [];
for (let i = 0; i < LIST.rows; i++) {
  const y = LIST.top + i * LIST.rowH;
  const g = el("g", {}, listG);
  listRows.push({
    g: g,
    chip: roomShape(g, LIST.x, y - 11, 22, 22, "free"),
    name: el("text", { x: LIST.x + 36, y: y, class: "lname" }, g),
    time: el(
      "text",
      { x: LIST.x + LIST.w, y: y, class: "ltime", "font-size": LIST.timeF },
      g
    ),
  });
}

function renderList(avail, fresh) {
  const key = (a) => (a.res.until ? a.res.until.getTime() : 1e15);
  avail.sort((a, b) => key(b) - key(a)); // longest-free first
  const msg = !fresh ? "No data" : avail.length ? "" : "All busy";
  const more = avail.length > LIST.rows ? avail.length - (LIST.rows - 1) : 0;
  listRows.forEach((row, i) => {
    const a = avail[i];
    const isMsg = i === 0 && msg;
    const isMore = more && i === LIST.rows - 1;
    row.g.style.display = a || isMsg ? "" : "none";
    row.chip.style.display = isMsg || isMore ? "none" : "";
    if (isMsg || isMore) {
      row.name.textContent = isMsg ? msg : "+" + more + " more";
      row.name.setAttribute("font-size", LIST.nameF);
      row.time.textContent = "";
      row.name.setAttribute("x", LIST.x);
      return;
    }
    row.name.setAttribute("x", LIST.x + 36);
    const nm = (a.r.booth ? "Booth " : "The ") + a.r.name;
    const tm = a.res.until ? fmt(a.res.until) : "all day";
    row.chip.setAttribute("class", "room " + a.res.state);
    row.name.textContent = nm;
    row.name.setAttribute("font-size", fit(nm, LIST.w - 36 - 110, LIST.nameF));
    row.time.textContent = tm;
  });
  listHead.textContent = "Free now";
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
    maxW = r.w * 0.92;
  if (r.booth) {
    const fs = Math.min(r.w, r.h) * 0.8;
    r.nameEl.textContent = r.name;
    r.nameEl.style.dominantBaseline = "alphabetic";
    r.nameEl.setAttribute("x", cx);
    r.nameEl.setAttribute("y", cy + inkMid(r.name, fs));
    r.nameEl.setAttribute("font-size", fs);
    r.timeEl.textContent = "";
    r.untilEl.textContent = "";
    return;
  }
  const nf = fit(r.name, maxW, NAME_F);
  const has = !!res.until;
  const tf = has ? TIME_F : 0,
    uf = has ? UNTIL_F : 0;
  const g1 = has ? 4 : 0,
    g2 = has ? 2 : 0;
  const top = cy - (nf + g1 + uf + g2 + tf) / 2;
  r.nameEl.textContent = r.name;
  r.nameEl.setAttribute("x", cx);
  r.nameEl.setAttribute("y", top + nf / 2);
  r.nameEl.setAttribute("font-size", nf);
  r.untilEl.textContent = has
    ? res.state === "busy"
      ? "busy until"
      : "free until"
    : "";
  r.untilEl.setAttribute("x", cx);
  r.untilEl.setAttribute("y", top + nf + g1 + uf / 2);
  r.untilEl.setAttribute("font-size", uf || 10);
  r.timeEl.textContent = has ? fmt(res.until) : "";
  r.timeEl.setAttribute("x", cx);
  r.timeEl.setAttribute("y", top + nf + g1 + uf + g2 + tf / 2);
  r.timeEl.setAttribute("font-size", tf || 10);
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
  clockG.setAttribute("transform", s ? "translate(0 42)" : "");
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
    if (res.state === "free" || res.state === "soon")
      avail.push({ r: r, res: res });
  });
  renderList(avail, !!fresh);
  errEl.textContent = fresh || standby ? "" : errMsg;
}

function tick() {
  const now = new Date(nowMs());
  clockEl.textContent = fmt(now);
  dateEl.textContent = now.toLocaleDateString("en-GB", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
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
    buildLegend();
    render();
  });
setInterval(tick, 1000);
setInterval(applyMode, 10 * 1000);
setInterval(render, 10 * 1000); // re-evaluate states between fetches
setInterval(load, REFRESH_MS);
