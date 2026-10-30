// Which shapes autumn uses from assets/themes/fall/sprites.svg
import { loadSprites, roughCopies } from "../toolkit.js";

export const SPRITES = "assets/themes/fall/sprites.svg";
export const LEAF_FORM_WEIGHTS = [
  ["maple", 4],
  ["oak", 3],
  ["birch", 3],
];
export const LEAF_VARIANTS = 3; // irregular copies per leaf form

export function loadShapes() {
  return loadSprites(SPRITES, ["leaf-", "prop-", "ledge-", "critter-"]).then(
    () =>
      LEAF_FORM_WEIGHTS.forEach((f) =>
        roughCopies("leaf-" + f[0], LEAF_VARIANTS, {
          stem: 1.5,
          body: 2.2,
          veins: 1.5,
        }),
      ),
  );
}
export const leafShape = (form, v) => "leaf-" + form + "-" + v;
export const propShape = (name) => "prop-" + name;
