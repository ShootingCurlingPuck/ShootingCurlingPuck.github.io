// Autumn tuning knobs. Test switches: ?fallpal=a|b  ?haze=0|1  ?seed=<any text> (another day's layout)

export const FALL_PALS = {
  a: [
    "#C0775A",
    "#A9714B",
    "#CFA24F",
    "#D8B76A",
    "#9AA27A",
    "#A85A5A",
    "#C69C6D",
    "#8C6A4F",
  ],
  b: [
    "#D49A80",
    "#C49A72",
    "#DDBB72",
    "#E2CB8E",
    "#B3B892",
    "#C08480",
    "#D2B48C",
    "#A88A70",
  ],
};
export const HAZE = 0.4; // how far back-layer floor leaves fade towards the background

export const FALLING = {
  live: { max: 6, every: 7 }, // at most this many in the air, a new one about every N seconds
  standby: { max: 20, every: 2 },
  landedMax: 25, // resting leaves kept at once; the oldest fade first
  rest: [30, 60], // seconds a landed leaf stays before fading
  fade: 4, // seconds to fade out
};

// Things on the forest floor: how many of each, per day (a random number in the range)
export const FLOOR_PROPS = {
  stump: [1, 1],
  // standing, rooted at the bottom edge
  mushroom: [0, 2],
  mushrooms: [0, 1],
  chanterelles: [0, 2],
  mycena: [0, 2],
  puffball: [0, 1],
  // lying on the ground or in the pile
  acorn: [2, 5], // each one may turn out cap-less, or just a loose cap
  conker: [0, 2],
  husk: [0, 1],
  twig: [1, 3], // straight or forked
  "branch-leaf": [0, 1],
};

// Fungi growing on tiles: toadstools on top edges, bracket fungi on side edges (per day)
export const LEDGE_FUNGI = {
  toadstools: [1, 2],
  brackets: [1, 3],
  chanterelles: [0, 1],
};

// A small spider that lowers itself on a thread now and then
export const SPIDER = {
  every: [5, 10], // minutes between visits
  live: { drop: [60, 150], hang: [40, 90] }, // from the underside of a tile; units, seconds
  standby: { drop: [150, 520], hang: [120, 300] }, // from the top of the screen, stays longer
  speed: { down: 22, up: 32 }, // units per second
  scale: 0.75,
};
