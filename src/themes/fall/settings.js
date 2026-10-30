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
  // Share of new leaves that come from the tree's crown (scaled by how full it still is);
  // the rest fall from above the top edge. Fewer leaves fall as the crown empties.
  fromTree: 0.75,
  breeze: [20, 65], // leftward drift of leaves from the tree, units per second
  // What the wind (0..1, see themes/wind.js) does to them: extra leftward drift at full strength and
  // at a full gust (units per second), faster sway (+60% at full) and fall (+30%), and extra
  // leaves the crown sheds at a gust (still air .. stormy)
  wind: { drift: 160, gustDrift: 140, sway: 0.6, fall: 0.3, shed: [1, 6] },
  // Gusts stir the ground: leaves hop up and swirl, then settle again. Hop height in still air and
  // when stormy (units), how many leaves get kicked up out of the pile (still .. stormy), and how
  // far around the gust's spot landed leaves get lifted too
  // Wet leaves in heavy rain (scaled down in lighter rain): +40% falling speed, half the sway
  wet: { fall: 0.4, sway: 0.5 },
  swirl: { calm: [60, 120], stormy: [180, 320], kick: [4, 10], reach: 160 },
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
  branchMinW: 5, // standby: only hangs from branches at least this thick (not from twigs)
};

// The tree on the right. Its shape is fixed; only the canopy changes with the date.
export const TREE = {
  bark: "#6B4E3A",
  barkLine: "#3B2A1E",
  // Trunk centre line: x relative to the right screen edge, y in plan units
  // ("bottom" = below the screen)
  trunk: [
    [12, "bottom"],
    [6, 1300],
    [-22, 1100],
    [-48, 900],
    [-64, 720],
    [-74, 560],
    [-84, 400],
    [-94, 240],
  ],
  trunkWidth: [100, 46], // at the bottom, at the top
  swell: { y: 930, extra: 16, spread: 160 }, // a gentle widening around the owl's hollow
  barkLines: 9, // grooves in the bark
  bend: 2, // how curvy the branches are
  thickness: 1.25, // branches are drawn this much thicker than their size above
  // Main limbs: where they leave the trunk (y), direction (degrees, -90 = up,
  // -180 = left), length, thickness, and how many times they split
  limbs: [
    { y: 690, deg: -158, len: 220, w: 20, depth: 2 },
    { y: 600, deg: -148, len: 260, w: 22, depth: 2 },
    { y: 510, deg: -140, len: 260, w: 21, depth: 2 },
    { y: 420, deg: -132, len: 240, w: 19, depth: 2 },
    { y: 340, deg: -122, len: 200, w: 17, depth: 2 },
    { y: 300, deg: -100, len: 140, w: 14, depth: 2 },
    { y: 560, deg: -40, len: 100, w: 12, depth: 1 },
  ],
  sideEvery: 60, // spacing of side branches along the thick limbs
  sideLen: [60, 105], // their length
  // The crown's outline: an ellipse (centre relative to the right screen edge and the top
  // of the screen, and its two radii). Branches shorten towards its edge and stay out of the
  // clear areas (Kitchen label, QR code, logos). Leaves also stay above leavesAbove.
  crown: { cx: -120, cy: 20, rx: 540, ry: 400 },
  maxTurn: 18, // how far (degrees) a branch may turn to fit the crown
  leavesAbove: 660,
  twigFrom: 11, // branches this thin or thinner grow twigs
  twigEvery: 24, // spacing of twigs along a branch
  twigLeaves: [1, 3], // leaves per twig
  tipLeaves: 2, // leaves at the very end of each outer branch
  // Each canopy leaf drops on a random day in this range (days since 1 October);
  // leaves past 60 are still hanging on 30 November
  dropFrom: 4,
  dropTo: 64,
};

// The tawny owl in its hollow in the trunk
export const OWL = {
  y: 930, // height of the hollow on the trunk (see TREE.swell)
  hollow: { rx: 34, ry: 42 },
  scale: 1.15, // size of the owl
  breath: 6, // seconds per breath
  awakeEvery: [10, 20], // minutes between awake moments during the day
  awakeFor: [30, 60], // seconds
  lookFor: 5, // seconds it looks at a room that just changed state
  spiderFor: 8, // seconds it watches the spider when it shows up; then it loses interest
  blink: [2.5, 6], // seconds between blinks when awake (a bit slower in standby)
  zEvery: [8, 14], // seconds between z's while it dozes
};
