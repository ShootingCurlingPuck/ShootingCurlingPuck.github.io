// "Rooms" and "Booths" panel in the left margin
import { CHIP, NAME_DX, CLOSE_H } from "../config.js";
import { svg, el, label, roomShape } from "../core/svg.js";
import { fit } from "../core/text.js";
import { nowMs, fmt, dayKey } from "../core/time.js";
import { state } from "../core/state.js";
import { LIST, ROOMS, BOOTH_Y, BOOTH_CHIP_Y } from "../layout.js";

export const listG = el("g", {});
const listRows = [];
let boothCells = [];

export function drawList() {
  svg.appendChild(listG);
  label("Rooms", { x: LIST.x, y: LIST.head, class: "h lhead", "font-size": 52 }, listG);
}

// Rows and booths are drawn after the live indicator, as in the original drawing order
export function drawListRows() {
  for (let i = 0; i < LIST.rows; i++) {
    const y = LIST.top + i * LIST.rowH;
    const g = el("g", {}, listG);
    listRows.push({
      g: g,
      chip: roomShape(g, LIST.x, y - CHIP / 2, CHIP, CHIP, "free"),
      name: el("text", { x: LIST.x + NAME_DX, y: y, class: "lname" }, g),
      time: el("text", { x: LIST.x + LIST.w, y: y, class: "ltime", "font-size": LIST.timeF }, g),
    });
  }
  label("Booths", { x: LIST.x, y: BOOTH_Y, class: "h lhead", "font-size": 52 }, listG);
  boothCells = ROOMS.filter((r) => r.booth).map((r, i, all) => {
    const x = LIST.x + (i * LIST.w) / all.length;
    const g = el("g", {}, listG);
    return {
      r: r,
      chip: roomShape(g, x, BOOTH_CHIP_Y, CHIP, CHIP, "nodata"),
      name: label(r.name, { x: x + CHIP + 10, y: BOOTH_CHIP_Y + CHIP / 2 - 3, class: "lname h", "font-size": 34 }, g),
    };
  });
}

const listName = (a) => (a.r.booth ? "Booth " : "") + a.r.name;

function timeLabel(res) {
  if (res.state === "nodata") return "";
  const word = res.state === "busy" ? "busy" : "free";
  const closed =
    !res.until || dayKey(res.until) !== dayKey(new Date(nowMs())) || parseInt(fmt(res.until), 10) % 24 >= CLOSE_H;
  return word + (closed ? " for the day" : ` until ${fmt(res.until)}`);
}

export function renderList(rows, fresh) {
  listG.setAttribute("opacity", fresh || state.standby ? 1 : 0.3); // feed dead: whole panel fades
  boothCells.forEach((c) => {
    const a = rows.find((x) => x.r === c.r);
    c.chip.setAttribute("class", "room " + a.res.state);
    c.name.setAttribute("opacity", a.res.state === "busy" ? 0.6 : 1);
  });
  rows = rows.filter((a) => !a.r.booth);
  rows.sort((a, b) => (a.r.name.toLowerCase() < b.r.name.toLowerCase() ? -1 : 1));
  listRows.forEach((row, i) => {
    const a = rows[i];
    row.g.style.display = a ? "" : "none";
    if (!a) return;
    const nm = listName(a);
    row.chip.setAttribute("class", "room " + a.res.state);
    row.name.textContent = nm;
    row.name.setAttribute("font-size", fit(nm, LIST.w - NAME_DX - 110, LIST.nameF));
    row.name.setAttribute("opacity", a.res.state === "busy" ? 0.6 : 1);
    row.time.textContent = timeLabel(a.res);
    row.time.setAttribute("opacity", row.time.textContent.includes("busy") ? 0.6 : 1);
  });
}
