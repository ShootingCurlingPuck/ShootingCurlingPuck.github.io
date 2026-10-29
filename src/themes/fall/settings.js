// Autumn tuning knobs. Test switches: ?fallpal=a|b  ?haze=0|1  ?seed=<any text> (another day's layout)

export const FALL_PALS = {
  a: ["#C0775A", "#A9714B", "#CFA24F", "#D8B76A", "#9AA27A", "#A85A5A", "#C69C6D", "#8C6A4F"],
  b: ["#D49A80", "#C49A72", "#DDBB72", "#E2CB8E", "#B3B892", "#C08480", "#D2B48C", "#A88A70"],
};
export const HAZE = 0.4; // how far back-layer floor leaves fade towards the background

export const FALLING = {
  live: { max: 6, every: 7 }, // at most this many in the air, a new one about every N seconds
  standby: { max: 20, every: 2 },
  landedMax: 25, // resting leaves kept at once; the oldest fade first
  rest: [30, 60], // seconds a landed leaf stays before fading
  fade: 4, // seconds to fade out
};

// Leaves that catch on the top edge of a tile (live mode only), then wobble and drop
export const PERCH = {
  chance: 0.35, // when a falling leaf crosses a free ledge
  perLedge: 2,
  max: 8,
  rest: [20, 90], // seconds before it wobbles loose
  wobble: 2.5, // seconds of wobbling before the drop
  atStart: 4, // already sitting on ledges after a reload
};
