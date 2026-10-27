// Sprite rectangles for atlas materials (mat_atlas_signs, mat_atlas_billboard).
//
// Atlas materials use UV0 = 0..1 inside the sprite's rect, written at generation time
// (gltfpack merges meshes per material, so the runtime cannot re-map them later).
// Rects are in UV space with the origin at the top-left, like glTF images.
//
// The texture thread publishes the real layout at public/textures/atlas/<atlas>.json
// ({ "sprites": { "<name>": { "x", "y", "w", "h" } } }); when that file exists it wins.
// Until then DEFAULT_LAYOUT below is used, so sprite names are the contract.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** 8x8 grid, 64 cells; names are assigned by the signs work (see docs/atlas.md). */
export const DEFAULT_LAYOUT = {
  mat_atlas_signs: { grid: 8, sprites: {} },
  mat_atlas_billboard: { grid: 4, sprites: {} },
};

const cache = new Map();

function load(atlas) {
  if (cache.has(atlas)) return cache.get(atlas);
  const file = path.join(root, "public/textures/atlas", `${atlas}.json`);
  let data = null;
  if (fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, "utf8")).sprites;
  cache.set(atlas, data);
  return data;
}

/**
 * UV rect {x, y, w, h} for a sprite. `cell` is the grid index (0-based, row-major from the
 * top-left) used by the default layout; names registered in DEFAULT_LAYOUT[atlas].sprites resolve to cells.
 */
export function spriteRect(atlas, name) {
  const real = load(atlas);
  if (real?.[name]) return real[name];
  const lay = DEFAULT_LAYOUT[atlas];
  if (!lay) throw new Error(`unknown atlas ${atlas}`);
  const cell = lay.sprites[name];
  if (cell === undefined) throw new Error(`atlas ${atlas}: unknown sprite "${name}"`);
  const n = lay.grid, s = 1 / n;
  return { x: (cell % n) * s, y: Math.floor(cell / n) * s, w: s, h: s };
}
