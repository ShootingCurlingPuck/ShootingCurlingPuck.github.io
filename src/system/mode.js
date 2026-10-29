// Live (office hours) or standby (evenings, nights, weekends). Emits "mode" when it changes.
import { svg } from "../core/svg.js";
import { state } from "../core/state.js";
import { nowMs, isStandby } from "../core/time.js";
import { emit } from "../core/events.js";

export function applyMode() {
  const s = isStandby(new Date(nowMs()));
  if (s === state.standby) return;
  state.standby = s;
  svg.classList.toggle("standby", s);
  emit("mode", s);
}
