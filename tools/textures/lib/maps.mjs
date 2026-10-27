// Derived maps (normal, AO) and 8-bit packing for export.
import { Field, blur, clamp01 } from "./field.mjs";
import { Rgb } from "./color.mjs";

/**
 * Tangent-space normal map (glTF/OpenGL convention: +X right, +Y up in the image, +Z out) from a
 * height Field in [0, 1]. Returns Uint8Array RGBA.
 *  depthM    physical height of a full 0..1 swing, in metres (a paving joint is ~0.01-0.03).
 *  sizeM     [w, h] tile size in metres, used to get the real slope per pixel.
 *  strength  artistic multiplier on the slope.
 */
export function heightToNormal(height, { depthM = 0.02, sizeM = [1, 1], strength = 1 } = {}) {
  const { w, h } = height;
  const mx = sizeM[0] / w;
  const my = sizeM[1] / h;
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dhdx = ((height.at(x + 1, y) - height.at(x - 1, y)) * depthM) / (2 * mx);
      const dhdrow = ((height.at(x, y + 1) - height.at(x, y - 1)) * depthM) / (2 * my);
      let nx = -dhdx * strength;
      let ny = dhdrow * strength; // image-up is -row, so d/dup = -d/drow and ny = -d/dup
      let nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nx *= inv;
      ny *= inv;
      nz *= inv;
      const o = (y * w + x) * 4;
      out[o] = Math.round((nx * 0.5 + 0.5) * 255);
      out[o + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out[o + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out[o + 3] = 255;
    }
  }
  return out;
}

/** Cheap cavity ambient occlusion from height: low spots darker than their surroundings. */
export function cavityAO(height, { radiusPx = 6, strength = 3 } = {}) {
  const b = blur(height, radiusPx, 2);
  const out = new Field(height.w, height.h);
  for (let i = 0; i < out.data.length; i++) out.data[i] = 1 - strength * Math.max(0, b.data[i] - height.data[i]);
  return clamp01(out);
}

const to8 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));

/** Rgb (+ optional alpha Field) -> Uint8Array RGBA. */
export function packRgba(rgb, alpha) {
  const n = rgb.w * rgb.h;
  const out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    out[i * 4] = to8(rgb.data[i * 3]);
    out[i * 4 + 1] = to8(rgb.data[i * 3 + 1]);
    out[i * 4 + 2] = to8(rgb.data[i * 3 + 2]);
    out[i * 4 + 3] = alpha ? to8(alpha.data[i]) : 255;
  }
  return out;
}

/** glTF occlusion / roughness / metallic packing: R = AO, G = roughness, B = metallic. */
export function packOrm(ao, roughness, metallic, w, h) {
  const out = new Uint8Array(w * h * 4);
  const get = (v, i) => (v instanceof Field ? v.data[i] : v);
  for (let i = 0; i < w * h; i++) {
    out[i * 4] = to8(get(ao, i));
    out[i * 4 + 1] = to8(get(roughness, i));
    out[i * 4 + 2] = to8(get(metallic, i));
    out[i * 4 + 3] = 255;
  }
  return out;
}

export { Rgb };
