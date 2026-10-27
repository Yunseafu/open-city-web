// Sprite atlas composition for non-tiling art (signs, billboards, decals).
//
//   export const atlases = [{
//     name: "signs",                    // -> public/textures/atlas/signs.json + signs.<map>.ktx2
//     id: "mat_atlas_signs",            // glTF material name
//     size: [2048, 2048],
//     grid: { cols: 8, rows: 8 },       // cells of size/cols x size/rows
//     padPx: 4,                         // gutter inside every cell; edge pixels are extruded into it
//     params: { ...PbrParams },
//     relief: { depthM, strength },     // optional, for sprites that return a height
//     sprites: [{ name: "ramen", cell: [col, row, colSpan = 1, rowSpan = 1], draw(ctx) { return {albedo, ...}; } }],
//   }];
//
// draw(ctx) receives { w, h, name, seed, sizeM:[1,1], ... } where w x h is the sprite CONTENT size in
// px (cell minus gutters) and returns the same map set as a tiling recipe's build().
// The layout json stores the CONTENT rect of each sprite in UV space (top-left origin, 0..1):
//   { "sprites": { "ramen": { "x": 0.0156, "y": 0.0156, "w": 0.0938, "h": 0.0938 } } }
import { makeContext, finalizeMaps } from "./recipe.mjs";
import { seedFrom } from "./rng.mjs";

/** Content rect of a sprite in atlas pixels. */
export function spriteRect(def, sprite) {
  const [W, H] = def.size;
  const cw = W / def.grid.cols;
  const ch = H / def.grid.rows;
  const [col, row, cs = 1, rs = 1] = sprite.cell;
  const pad = def.padPx ?? 4;
  return { x: Math.round(col * cw) + pad, y: Math.round(row * ch) + pad, w: Math.round(cs * cw) - 2 * pad, h: Math.round(rs * ch) - 2 * pad };
}

export function atlasLayout(def) {
  const [W, H] = def.size;
  const sprites = {};
  for (const s of def.sprites) {
    const r = spriteRect(def, s);
    sprites[s.name] = { x: r.x / W, y: r.y / H, w: r.w / W, h: r.h / H };
  }
  return { sprites };
}

const DEFAULTS = {
  albedo: [0, 0, 0, 255],
  normal: [128, 128, 255, 255],
  orm: [255, 255, 0, 255],
  emissive: [0, 0, 0, 255],
};

/** Draw every sprite and compose full-atlas maps. Returns { maps: {albedo, normal?, orm?, emissive?}, params, layout, warnings }. */
export function composeAtlas(def, { scale = 1 } = {}) {
  const [W, H] = def.size;
  const planes = {};
  const warnings = [];
  const params = { baseColor: [1, 1, 1], metallic: 1, roughness: 1, ...def.params };
  const pad = def.padPx ?? 4;
  const seen = new Set();

  const ensure = (name) => {
    if (!planes[name]) {
      const p = new Uint8Array(W * H * 4);
      for (let i = 0; i < W * H; i++) p.set(DEFAULTS[name], i * 4);
      planes[name] = p;
    }
    return planes[name];
  };
  ensure("albedo");

  for (const sprite of def.sprites) {
    if (seen.has(sprite.name)) throw new Error(`${def.id}: duplicate sprite ${sprite.name}`);
    seen.add(sprite.name);
    const r = spriteRect(def, sprite);
    const ctx = makeContext({ id: `${def.id}/${sprite.name}`, size: [r.w, r.h], tileSizeM: 1, seed: seedFrom(def.id + sprite.name) });
    ctx.name = sprite.name;
    const set = sprite.draw(ctx);
    // Reuse the tiling finalizer for map derivation, but atlas sprites do not tile so skip the seam check.
    const fin = finalizeMaps({ id: ctx.id, params: { ...def.params, roughness: 1, metallic: 1 }, relief: def.relief, noSeamCheck: true }, ctx, set, { checkSeams: false });
    for (const w of fin.warnings) warnings.push(`${sprite.name}: ${w}`);
    // Constant roughness/metal were folded into params by finalize; atlases need per-sprite values, so re-pack them.
    const maps = { albedo: fin.albedo, normal: fin.normal, orm: fin.orm, emissive: fin.emissive };
    if (!fin.orm) {
      const rough = Math.round(255 * (fin.params.roughness ?? 1));
      const metal = Math.round(255 * (fin.params.metallic ?? 0));
      const o = new Uint8Array(r.w * r.h * 4);
      for (let i = 0; i < r.w * r.h; i++) o.set([255, rough, metal, 255], i * 4);
      maps.orm = o;
    }
    for (const [name, src] of Object.entries(maps)) {
      if (!src) continue;
      blit(ensure(name), W, H, src, r, pad, sprite, def);
    }
  }
  if (planes.normal === undefined) delete planes.normal;
  return { maps: planes, params, layout: atlasLayout(def), warnings };
}

/** Copy a sprite into the atlas and extrude its edge pixels into the surrounding cell gutter. */
function blit(dst, W, H, src, r, pad, sprite, def) {
  const [W0, H0] = [W, H];
  const [col, row, cs = 1, rs = 1] = sprite.cell;
  const cw = W0 / def.grid.cols;
  const ch = H0 / def.grid.rows;
  const x0 = Math.round(col * cw);
  const y0 = Math.round(row * ch);
  const x1 = Math.round((col + cs) * cw);
  const y1 = Math.round((row + rs) * ch);
  for (let y = y0; y < y1; y++) {
    const sy = Math.min(r.h - 1, Math.max(0, y - r.y));
    for (let x = x0; x < x1; x++) {
      const sx = Math.min(r.w - 1, Math.max(0, x - r.x));
      const s = (sy * r.w + sx) * 4;
      dst.set(src.subarray(s, s + 4), (y * W0 + x) * 4);
    }
  }
}
