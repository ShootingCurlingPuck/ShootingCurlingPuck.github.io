// Small helpers to build SVG. Everything is drawn into the one <svg id="plan"> in index.html.
export const SVGNS = "http://www.w3.org/2000/svg";
export const XLINK = "http://www.w3.org/1999/xlink";
export const svg = document.getElementById("plan");
export const defs = svg.querySelector("defs");

// A transparent drawing stacked on top of the plan, with the same coordinates. The TV redraws a
// whole drawing whenever anything in it changes, so things that move get their own: then the plan
// and the static scene are drawn once and kept, and only this (mostly empty) layer is redrawn.
// Call after the plan's viewBox is set; stacks in call order.
export function overlay(name) {
  const o = document.createElementNS(SVGNS, "svg");
  o.setAttribute("class", "overlay " + name);
  o.setAttribute("viewBox", svg.getAttribute("viewBox"));
  o.setAttribute("preserveAspectRatio", svg.getAttribute("preserveAspectRatio"));
  document.body.appendChild(o);
  return o;
}

export function el(tag, attrs, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}
export function label(text, attrs, parent) {
  const t = el("text", attrs, parent);
  t.textContent = text;
  return t;
}
export function img(file, x, y, w, h, parent, extra) {
  const n = el(
    "image",
    Object.assign({ x, y, width: w, height: h }, extra || {}),
    parent || svg,
  );
  n.setAttributeNS(XLINK, "xlink:href", file);
  return n;
}
// <use> of something in <defs>
export function use(parent, id, transform, attrs) {
  const u = el(
    "use",
    Object.assign({ transform: transform }, attrs || {}),
    parent,
  );
  u.setAttributeNS(XLINK, "xlink:href", "#" + id);
  return u;
}
// A room tile: double outline, colour comes from its state class (free / soon / busy / nodata)
export function roomShape(parent, x, y, w, h, state) {
  const g = el("g", { class: "room " + state }, parent);
  el("rect", { x, y, width: w, height: h, rx: 8, class: "base" }, g);
  el(
    "rect",
    { x: x + 2, y: y + 2, width: w - 4, height: h - 4, rx: 6, class: "base" },
    g,
  );
  return g;
}
