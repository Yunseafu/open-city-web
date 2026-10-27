// Recipe contract: turns what a recipe's build() returns into export-ready 8-bit maps.
//
//   export const recipes = [{
//     id: "mat_road_asphalt",            // glTF material name
//     tileSizeM: 4 | [w, h],             // metres per texture repeat (UV0 is in metres)
//     size: [1024, 1024],                // texture px; use power-of-two sizes
//     seed: 1,                           // optional, defaults to a hash of the id
//     relief: { depthM: 0.02, strength: 1 },   // how deep a full 0..1 height swing is
//     params: { ... PbrParams from src/materials/manifest.ts ... },
//     note: "short description",
//     build(ctx) { return { albedo, height?, roughness?, metallic?, ao?, emissive?, alpha? }; },
//   }];
//
// build() result fields (all optional except albedo):
//   albedo     Rgb   sRGB colour
//   alpha      Field opacity, only for alphaMode "mask"/"blend" materials
//   height     Field 0..1, becomes the normal map (and the default cavity AO)
//   roughness  Field | number   (default 0.8)
//   metallic   Field | number   (default 0)
//   ao         Field | number   (default: cavity AO from height, else 1)
//   emissive   Rgb   sRGB emitted colour (HDR scale comes from params.emissiveIntensity)
// A number is a constant; if roughness, metallic and ao are all constants no ORM texture is written.
import { Field, blur } from "./field.mjs";
import { heightToNormal, cavityAO, packRgba, packOrm } from "./maps.mjs";
import { seedFrom } from "./rng.mjs";

/** Build context handed to recipe.build(ctx). */
export function makeContext({ id, size, tileSizeM = 1, seed }) {
  const [w, h] = size;
  const sizeM = Array.isArray(tileSizeM) ? tileSizeM : [tileSizeM, tileSizeM];
  const s = seed ?? seedFrom(id);
  return {
    id,
    w,
    h,
    sizeM,
    seed: s,
    /** pixels per metre, [x, y] */
    pxPerM: [w / sizeM[0], h / sizeM[1]],
    /** metres -> pixels along x / y */
    px: (m) => ({ x: m * (w / sizeM[0]), y: m * (h / sizeM[1]) }),
    /** Integer noise cycle counts [fx, fy] so that a feature of `featureM` metres stays round and the tile wraps. */
    cycles: (featureM) => [Math.max(1, Math.round(sizeM[0] / featureM)), Math.max(1, Math.round(sizeM[1] / featureM))],
    /** Derived deterministic sub-seed. */
    sub: (n) => (s + Math.imul(n + 1, 0x9e3779b1)) >>> 0,
  };
}

const isConst = (v) => typeof v === "number";

/** Mean absolute pixel difference across the wrap seam vs. across ordinary neighbours (1 = invisible seam). */
export function seamRatio(field) {
  const { w, h, data } = field;
  let seamX = 0;
  let innerX = 0;
  for (let y = 0; y < h; y++) {
    seamX += Math.abs(data[y * w + w - 1] - data[y * w]);
    for (let x = 0; x < w - 1; x++) innerX += Math.abs(data[y * w + x + 1] - data[y * w + x]) / (w - 1);
  }
  let seamY = 0;
  let innerY = 0;
  for (let x = 0; x < w; x++) {
    seamY += Math.abs(data[(h - 1) * w + x] - data[x]);
    for (let y = 0; y < h - 1; y++) innerY += Math.abs(data[(y + 1) * w + x] - data[y * w + x]) / (h - 1);
  }
  const eps = 1e-4;
  return [(seamX / h + eps) / (innerX / h + eps), (seamY / w + eps) / (innerY / w + eps)];
}

function luma(rgb) {
  const f = new Field(rgb.w, rgb.h);
  for (let i = 0; i < f.data.length; i++) {
    f.data[i] = rgb.data[i * 3] * 0.3 + rgb.data[i * 3 + 1] * 0.59 + rgb.data[i * 3 + 2] * 0.11;
  }
  return f;
}

/**
 * Convert a build() result to export-ready maps.
 * Returns { w, h, albedo, normal?, orm?, emissive?, params, warnings }, maps as Uint8Array RGBA.
 */
export function finalizeMaps(def, ctx, set, { checkSeams = true } = {}) {
  const { w, h } = ctx;
  const warnings = [];
  if (!set?.albedo) throw new Error(`${def.id}: build() must return an albedo`);
  if (set.albedo.w !== w || set.albedo.h !== h) throw new Error(`${def.id}: albedo is ${set.albedo.w}x${set.albedo.h}, expected ${w}x${h}`);

  const params = { baseColor: [1, 1, 1], metallic: 1, roughness: 1, ...def.params };
  const out = { w, h, params, warnings };

  const mode = params.alphaMode ?? "opaque";
  if ((mode === "mask" || mode === "blend") && !set.alpha) throw new Error(`${def.id}: alphaMode ${mode} needs an alpha Field`);
  out.albedo = packRgba(set.albedo, mode === "opaque" ? undefined : set.alpha);

  if (set.height) {
    out.normal = heightToNormal(set.height, { sizeM: ctx.sizeM, ...def.relief });
  }

  const rough = set.roughness ?? 0.8;
  const metal = set.metallic ?? 0;
  const ao = set.ao ?? (set.height ? cavityAO(set.height, { radiusPx: Math.max(2, Math.round(w / 128)) }) : 1);
  if (isConst(rough) && isConst(metal) && isConst(ao)) {
    // Constants live in params, no texture needed.
    params.roughness = rough * (def.params?.roughness ?? 1);
    params.metallic = metal * (def.params?.metallic ?? 1);
    params.aoStrength = ao < 1 ? 1 : 0;
    if (ao < 1) warnings.push("constant ao < 1 is ignored; give a Field for AO");
  } else {
    out.orm = packOrm(ao, rough, metal, w, h);
  }

  if (set.emissive) {
    out.emissive = packRgba(set.emissive);
    params.emissiveColor ??= [1, 1, 1];
    params.emissiveIntensity ??= 1;
  }

  if (checkSeams && !def.noSeamCheck) {
    const sx = seamRatio(luma(set.albedo));
    const worst = Math.max(sx[0], sx[1]);
    if (worst > 3) warnings.push(`visible seam on albedo (ratio x=${sx[0].toFixed(1)}, y=${sx[1].toFixed(1)}); wrap your drawing`);
    if (set.height) {
      const sh = seamRatio(set.height);
      if (Math.max(sh[0], sh[1]) > 3) warnings.push(`visible seam on height (ratio x=${sh[0].toFixed(1)}, y=${sh[1].toFixed(1)})`);
    }
  }
  return out;
}

export { blur };
