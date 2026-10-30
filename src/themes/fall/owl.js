// A tawny owl living in a hollow in the tree's trunk.
// Daytime: dozes (the odd nod, little z's, a sigh every few seconds), with a short awake moment every so often.
// It wakes up to look at a room that just changed state, and watches the spider while it's out.
// Standby (evenings, weekends): awake, looking around, with a glint in its eyes.
// Test switches: ?owl=awake (frequent awake moments), ?owl=look (pretends rooms change often)
import { QS } from "../../core/params.js";
import { el, use } from "../../core/svg.js";
import { everyFrame, addStyle } from "../toolkit.js";
import { OWL, TREE } from "./settings.js";

export function startOwl(layer, scene, tree, spider) {
  const test = QS.get("owl");
  const between = (r) => r[0] + Math.random() * (r[1] - r[0]);
  const awakeEvery = () =>
    test === "awake" ? 20 : between(OWL.awakeEvery) * 60;

  // ---- Drawing ----
  const at = tree.trunkAt(OWL.y);
  const hx = at.x,
    hy = OWL.y,
    H = OWL.hollow;
  const g = el("g", { class: "owl" }, layer);
  el(
    "ellipse",
    {
      cx: hx,
      cy: hy,
      rx: H.rx,
      ry: H.ry,
      fill: "#2A1D14",
      stroke: TREE.barkLine,
      "stroke-width": 3,
    },
    g
  );
  // The owl sits on the floor of the hollow; its feet are hidden by the hollow's lower lip
  const bx = hx,
    by = hy + H.ry - 6;
  const owl = el(
    "g",
    {
      transform: `translate(${bx.toFixed(1)} ${by.toFixed(1)}) scale(${OWL.scale})`,
    },
    g
  );
  // Sighs: every few seconds the owl puffs up a little and settles back. A short CSS animation
  // (scaling around the owl's base, this group's 0,0); quick movements read well even at this
  // small size, where slow continuous breathing showed up as pixel steps.
  addStyle(
    "@keyframes owl-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.03,1.08)}}" +
      ".owl-breathe{animation:owl-breathe " +
      OWL.breath +
      "s ease-in-out infinite}"
  );
  const breath = el("g", { class: "owl-breathe" }, owl);
  use(breath, "critter-owl-body", "");
  const head = el("g", {}, breath); // turns a little towards what it looks at
  use(head, "critter-owl-face", "");
  const eyes = [-7.5, 7.5].map((ex) => {
    const eg = el("g", {}, head); // squashed vertically to close
    el(
      "circle",
      {
        cx: 0,
        cy: 0,
        r: 6.2,
        fill: "#F3E6CF",
        stroke: "#8A5A3B",
        "stroke-width": 1,
      },
      eg
    );
    const iris = el("circle", { cx: 0, cy: 0, r: 4.6, fill: "#2B1D12" }, eg);
    const glint = el(
      "circle",
      { cx: -1.4, cy: -1.6, r: 1.4, fill: "#FFFFFF" },
      eg
    );
    const shut = el(
      "path",
      {
        d: "M-6,0Q0,3.5 6,0",
        fill: "none",
        stroke: "#5E3B25",
        "stroke-width": 1.6,
        "stroke-linecap": "round",
      },
      head
    );
    return {
      ex: ex,
      g: eg,
      iris: iris,
      glint: glint,
      shut: shut,
      open: 0,
      target: 0,
      delay: 0,
    };
  });
  // Lower lip of the hollow, in front of the owl
  el(
    "path",
    {
      d: `M${hx - H.rx * 0.8},${hy + H.ry * 0.6}A${H.rx},${H.ry} 0 0 0 ${hx + H.rx * 0.8},${hy + H.ry * 0.6}Q${hx},${hy + H.ry * 0.78} ${hx - H.rx * 0.8},${hy + H.ry * 0.6}Z`,
      fill: TREE.bark,
      stroke: TREE.barkLine,
      "stroke-width": 2.5,
      "stroke-linejoin": "round",
    },
    g
  );
  const zs = el("g", {}, g); // the little z's

  // ---- State ----
  let t = 0,
    awakeUntil = 0,
    nextAwake = awakeEvery(),
    lookUntil = 0,
    lookAt = null,
    wanderAt = null,
    nextWander = 0,
    nextBlink = 0,
    blinkUntil = 0,
    nodUntil = 0,
    nextNod = 25,
    nextZ = between(OWL.zEvery),
    wasAwake = false,
    gx = 0,
    gy = 0; // current gaze direction, -1..1
  const zList = [];

  scene.on("room", (e) => {
    lookAt = { x: e.x, y: e.y };
    lookUntil = t + OWL.lookFor;
  });
  if (test === "look") {
    const rooms = scene.geo.ROOMS.filter((r) => !r.booth);
    setInterval(() => {
      const r = rooms[Math.floor(Math.random() * rooms.length)];
      lookAt = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      lookUntil = t + OWL.lookFor;
    }, 12000);
  }

  function addZ() {
    const z = el(
      "text",
      {
        x: bx + 18 * OWL.scale,
        y: by - 62 * OWL.scale,
        class: "h",
        "font-size": 14,
        fill: "#5E3B25",
      },
      zs
    );
    z.textContent = "z";
    zList.push({ el: z, t: 0 });
  }

  everyFrame((now, dt) => {
    t += dt;
    const standby = scene.isStandby();
    const spiderOut = spider && spider.out();

    // What is it doing? Most important first.
    let target = null; // a point to look at, or null for "straight ahead"
    let awake = true;
    if (spiderOut) target = spider.pos();
    else if (t < lookUntil) target = lookAt;
    else if (standby || t < awakeUntil) {
      // looking around: a new spot every few seconds, sometimes straight ahead
      if (t > nextWander) {
        wanderAt =
          Math.random() < 0.3
            ? null
            : {
                x: hx - 300 - Math.random() * 1500,
                y: hy - 400 + Math.random() * 700,
              };
        nextWander = t + 2.5 + Math.random() * (standby ? 5 : 3);
      }
      target = wanderAt;
    } else awake = false;

    if (!standby && t > nextAwake) {
      awakeUntil = t + between(OWL.awakeFor);
      nextAwake = awakeUntil + awakeEvery();
    }

    // Waking up: one eye first, then the other
    if (awake && !wasAwake) {
      eyes[0].delay = t;
      eyes[1].delay = t + 0.6 + Math.random() * 0.4;
    }
    wasAwake = awake;

    // Blinks
    if (awake && t > nextBlink) {
      blinkUntil = t + 0.15;
      nextBlink = t + between(OWL.blink) * (standby ? 1.5 : 1);
    }

    eyes.forEach((e) => {
      e.target = awake && t >= e.delay ? (t < blinkUntil ? 0 : 1) : 0;
      const speed = t < blinkUntil ? 14 : awake ? 4 : 1.2; // drowsy eyes close slowly
      e.open += Math.max(-speed * dt, Math.min(speed * dt, e.target - e.open));
    });

    // Gaze: ease towards the target direction
    let tx = 0,
      ty = 0;
    if (target) {
      const dx = target.x - hx,
        dy = target.y - (by - 45);
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      tx = dx / len;
      ty = dy / len;
    }
    gx += (tx - gx) * Math.min(1, dt * 5);
    gy += (ty - gy) * Math.min(1, dt * 5);

    // Dozing: the odd nod, and z's
    if (!awake && t > nextNod) {
      nodUntil = t + 1.2;
      nextNod = t + 25 + Math.random() * 15;
    }
    const nod =
      !awake && t < nodUntil
        ? 2.5 * Math.sin(((nodUntil - t) / 1.2) * Math.PI)
        : 0;
    if (!awake && t > nextZ) {
      addZ();
      setTimeout(addZ, 700);
      nextZ = t + between(OWL.zEvery);
    }

    head.setAttribute(
      "transform",
      `translate(${(gx * 2.5).toFixed(2)} ${(nod + gy * 1).toFixed(2)}) rotate(${(gx * 6).toFixed(2)} 0 -45)`
    );
    const glintR = standby ? 2.1 : 1.4;
    eyes.forEach((e) => {
      const o = Math.max(0.08, e.open);
      e.g.setAttribute(
        "transform",
        `translate(${e.ex} -45) scale(1 ${o.toFixed(3)})`
      );
      e.iris.setAttribute("cx", (gx * 1.8).toFixed(2));
      e.iris.setAttribute("cy", (gy * 1.4).toFixed(2));
      e.glint.setAttribute("cx", (gx * 1.8 - 1.4).toFixed(2));
      e.glint.setAttribute("cy", (gy * 1.4 - 1.6).toFixed(2));
      e.glint.setAttribute("r", glintR);
      e.g.style.display = e.open < 0.15 ? "none" : "";
      e.shut.style.display = e.open < 0.15 ? "" : "none";
      e.shut.setAttribute("transform", `translate(${e.ex} -45)`);
    });

    // z's drift up and fade
    for (let i = zList.length - 1; i >= 0; i--) {
      const z = zList[i];
      z.t += dt;
      const k = z.t / 3;
      if (k >= 1) {
        zs.removeChild(z.el);
        zList.splice(i, 1);
        continue;
      }
      z.el.setAttribute(
        "transform",
        `translate(${(6 * k + 3 * Math.sin(k * 6)).toFixed(1)} ${(-34 * k).toFixed(1)})`
      );
      z.el.setAttribute(
        "opacity",
        (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8).toFixed(2)
      );
    }
  });
}
