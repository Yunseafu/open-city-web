// Sprite rectangles for atlas materials (mat_atlas_signs, mat_atlas_billboard, mat_atlas_decal).
//
// The texture thread owns the layouts: public/textures/atlas/<atlas material id>.json
// ({ "sprites": { "<name>": { "x", "y", "w", "h" } } }, UV space, origin top-left, already inset
// for bleeding). Rects are used verbatim. Atlas materials use UV0 = 0..1 inside the sprite rect,
// written at generation time (gltfpack merges meshes per material, so the runtime cannot re-map).
// Pass the rect as the `uv` option of builder.quad().
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const cache = new Map();
const warned = new Set();

function load(atlas) {
  if (cache.has(atlas)) return cache.get(atlas);
  const file = path.join(root, "public/textures/atlas", `${atlas}.json`);
  let data = null;
  if (fs.existsSync(file)) data = JSON.parse(fs.readFileSync(file, "utf8")).sprites;
  cache.set(atlas, data);
  return data;
}

/** All sprite names the atlas defines (empty when its JSON is missing). */
export function spriteNames(atlas) {
  return Object.keys(load(atlas) ?? {});
}

/**
 * UV rect { x, y, w, h } (origin top-left) of a sprite. Throws on unknown names so a typo never
 * ships a wrongly mapped sign. If the atlas JSON itself is missing the whole atlas is returned
 * (and a warning printed once) so generation still works before the texture files exist.
 */
export function spriteRect(atlas, name) {
  const data = load(atlas);
  if (!data) {
    if (!warned.has(atlas)) {
      warned.add(atlas);
      console.warn(`atlas ${atlas}: public/textures/atlas/${atlas}.json is missing, sprites map to the whole atlas`);
    }
    return { x: 0, y: 0, w: 1, h: 1 };
  }
  const r = data[name];
  if (!r) throw new Error(`atlas ${atlas}: unknown sprite "${name}"`);
  return { x: r.x, y: r.y, w: r.w, h: r.h };
}

/**
 * Panel aspect (width / height) a sprite should be shown at. Billboard sprites carry it in their
 * rect (the atlas is square). Sign sprites are 1:1 art, except vertical_sign_* (painted for ~1:3
 * panels) and wide_* (painted for ~3:1 panels).
 */
export function spriteAspect(atlas, name) {
  const r = spriteRect(atlas, name);
  if (atlas === "mat_atlas_billboard") return r.w / r.h;
  if (name.startsWith("vertical_sign_")) return 1 / 3;
  if (name.startsWith("wide_")) return 3;
  return r.w / r.h;
}
