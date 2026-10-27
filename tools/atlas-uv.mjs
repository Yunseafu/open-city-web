// Dependency-free mirror of src/materials/atlas.ts for the model and texture tools.
// Layout: { sprites: { name: { x, y, w, h } } } in UV space, origin top-left.
import { readFileSync } from "node:fs";

export function loadAtlasLayout(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** @returns {[number, number, number, number]} [u0, v0, u1, v1] */
export function getSpriteRect(layout, sprite) {
  const s = layout.sprites[sprite];
  if (!s) throw new Error(`unknown atlas sprite '${sprite}'`);
  return [s.x, s.y, s.x + s.w, s.y + s.h];
}

/** Maps a 0..1 quad UV into the sprite's cell. */
export function remapUV(u, v, rect) {
  return [rect[0] + u * (rect[2] - rect[0]), rect[1] + v * (rect[3] - rect[1])];
}
