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

// The season (see season.js), in days since 1 October (0) to 30 November (60).
// colourPeaks: when each palette colour (same order as FALL_PALS) is most common: greens and yellows
// early, oranges and reds mid-season, browns late; colourSpread: how many days a colour stays
// common; colourRare: how rare it gets out of season. litterLag: the litter's colours follow the
// tree's this many days later. The rest are [day, value] points: litter depth (share of the full
// pile), acorns on the ground (times FLOOR_PROPS), acorns falling from the tree (per minute) and
// mushrooms (times FLOOR_PROPS and LEDGE_FUNGI): fungi peak around mid-October.
export const FALL_SEASON = {
  colourPeaks: [26, 46, 14, 8, 0, 30, 36, 58],
  colourSpread: 16,
  colourRare: 0.05,
  litterLag: 10,
  litter: [
    [0, 0.3],
    [30, 0.7],
    [60, 1],
  ],
  acornsOnGround: [
    [0, 0.5],
    [25, 1.3],
    [60, 0.25],
  ],
  acornsFalling: [
    [0, 0.6],
    [20, 0.4],
    [40, 0],
  ],
  fungi: [
    [0, 0.5],
    [18, 1.5],
    [45, 0.8],
    [60, 0.3],
  ],
};

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
  // What the wind (0..1, see weather/wind.js) does to them: extra drift downwind at full strength and
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

// Acorns dropping from the tree (how often: FALL_SEASON.acornsFalling): at most this many at once,
// their size (the acorns lying on the floor are about the same), how fast they fall (units per
// second, per second), how much of their speed is left after their one small hop on the leaves,
// and how many seconds they rest there before fading
export const ACORNS = {
  max: 4,
  size: 0.8,
  // falling (see core/physics.js): about 4 g, 1.5 by 2.5 cm, rounded (low drag)
  mass: 0.004,
  area: 0.015 * 0.025,
  cd: 0.5,
  bounce: 0.12,
  rest: [40, 90],
  tip: 0.35, // seconds to tip over a quarter turn onto its side after landing
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
  standby: { drop: [150, 520], hang: [120, 300] }, // from a branch, stays longer
  clockClear: 330, // standby: stays this far (left or right) from the clock in the middle
  speed: { down: 22, up: 32 }, // units per second
  scale: 0.75,
  branchMinW: 5, // standby: only hangs from branches at least this thick (not from twigs)
  // Weather. In rain (precip amount above `wet`) it only peeks: a short way down, a moment, then
  // straight back up. In strong wind (wind strength above `windy`) it doesn't come out at all; out
  // already, it swings more in the wind (up to windSway degrees) and climbs back up in a gust
  // stronger than gustUp (0..1). At night (darkness above 0.5) it visits nightMore times as often.
  wet: 0.2,
  windy: 0.6,
  peek: { drop: [15, 35], frame: [6, 12], hang: [1.5, 3] }, // frame: under the clock, above the date
  windSway: 14,
  gustUp: 0.5,
  nightMore: 1.5,
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
  // Day and night go by the sky's darkness (0..1), not live/standby: night from `night[1]` up, day
  // again below `night[0]` (a gap, so it doesn't flip back and forth at dusk)
  night: [0.3, 0.4],
  rainWakes: 0.6, // heavy rain (precip amount, 0..1) wakes it more often in the day...
  rainAwakeEvery: [2, 5], // ...every few minutes instead
  // at night it sits hunched and fluffed up in rain or strong wind (no hunting in that)
  hunker: { rain: 0.35, wind: 0.55 },
  // The night hunt (see owl-flight.js): not in rain or strong wind (when it hunkers down)
  hunt: {
    every: [8, 20], // minutes between hunts, at night
    away: [2, 5], // minutes it's gone
    spot: 1.5, // seconds it stares out before it takes off
    speed: 230, // up close, units per second
    beats: 2.6, // wingbeats per second
    size: 1.3, // up close
    // seen far off while it's away: how many times, how often it drops behind the leaves (else it
    // just glides across), how long it stays down there (seconds), its speed, size and colour
    far: {
      sightings: [1, 3],
      dive: 0.5,
      hidden: [4, 8],
      speed: 100,
      size: 1.5,
      colour: "#140F18",
      opacity: 0.85,
    },
  },
};

// Foxfire (see foxfire.js): the glow of some fungi in the dark. It follows how dark the screen looks
// (the night veil, as a share of its standby maximum): none below `from`, full at `full`, so in
// live mode (a lighter veil) it stays fainter. strength: its opacity at full; falloff: the glow's
// gradient, [offset, opacity]. spots: where each kind glows, in its sprite's units:
// [x, y, half width, half height, opacity]
export const FOXFIRE = {
  colour: "#B4F07A",
  from: 0.35,
  full: 0.9,
  strength: 0.75,
  falloff: [
    [0, 0.7],
    [0.4, 0.35],
    [1, 0],
  ],
  spots: {
    // the bonnets (Mycena): each cap
    mycena: [
      [-14, -21, 11, 9, 1],
      [-4, -30, 11, 9, 1],
      [6, -25, 11, 9, 1],
      [15, -16, 11, 9, 1],
    ],
    // honey fungus threads in the rotting wood of the stump: faint patches
    stump: [
      [-26, -32, 10, 22, 0.45],
      [21, -50, 8, 16, 0.35],
    ],
  },
};

// The will-o'-the-wisp (see wisp.js): a rare light over the leaf litter on dark, calm nights.
// perDarkHour: visits per hour of darkness (about one per long autumn night), times `halloween`
// on 31 October; darkness: the sky's darkness it needs (0..1, not the veil: so also on dark
// mornings and evenings in live mode); maxWind, maxRain: calm enough (0..1)
export const WISP = {
  perDarkHour: 0.08,
  halloween: 5,
  darkness: 0.8,
  maxWind: 0.45,
  maxRain: 0.3,
  life: [25, 45], // seconds per visit
  height: [35, 140], // where it floats, above the litter
  // what it does, one after the other: [chance, seconds]. hover: dancing on the spot; drift: a
  // slow float somewhere else; dart: a quick little dash
  moves: { hover: [0.45, [1.5, 4]], drift: [0.4, [2, 5]], dart: [0.15, [0.5, 1]] },
  startled: [1, 3], // times per visit it's startled: snuffed out, then back further off
  startleGust: 0.5, // chance a gust startles it
  gone: [1, 3], // seconds it stays out when startled
  size: 1.2, // the flame's size (its sprite is about 36 units tall)
  colour: "#7FE6D2", // the flame
  heart: "#D6FFF4", // its brighter middle
  light: { r: 70, colour: "#6FDCC8" }, // the soft light around it
  pool: { rx: 70, ry: 12, near: 130 }, // its light on the leaves below: size; gone above `near`
};
