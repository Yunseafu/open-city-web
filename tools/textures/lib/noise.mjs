// Seamlessly tileable noise. `fx` / `fy` are INTEGER cycle counts across the tile horizontally /
// vertically; pick them from physical feature size with ctx.cycles(metres) so features stay round
// on non-square tiles.
import { Field, normalize } from "./field.mjs";
import { hash2 } from "./rng.mjs";

/**
 * strictNyquist: fbm() throws when even its base octave is above Nyquist (an authoring bug at full size).
 * Reduced-size runs (preview --scale, unit tests) turn it off: they just lose the finest layer.
 */
export const settings = { strictNyquist: true };

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Periodic gradient (Perlin-style) noise, roughly in [0, 1], centred on 0.5. */
export function perlin(w, h, fx, fy, seed = 0) {
  fx = Math.max(1, Math.round(fx));
  fy = Math.max(1, Math.round(fy));
  // One unit gradient vector per lattice point (wrapped).
  const gx = new Float32Array(fx * fy);
  const gy = new Float32Array(fx * fy);
  for (let j = 0; j < fy; j++) {
    for (let i = 0; i < fx; i++) {
      const a = hash2(i, j, seed) * Math.PI * 2;
      gx[j * fx + i] = Math.cos(a);
      gy[j * fx + i] = Math.sin(a);
    }
  }
  const out = new Field(w, h);
  for (let y = 0; y < h; y++) {
    const v = (y / h) * fy;
    const j0 = Math.floor(v);
    const ty = v - j0;
    const sy = fade(ty);
    const j1 = (j0 + 1) % fy;
    const jj0 = j0 % fy;
    for (let x = 0; x < w; x++) {
      const u = (x / w) * fx;
      const i0 = Math.floor(u);
      const tx = u - i0;
      const sx = fade(tx);
      const i1 = (i0 + 1) % fx;
      const ii0 = i0 % fx;
      const n00 = gx[jj0 * fx + ii0] * tx + gy[jj0 * fx + ii0] * ty;
      const n10 = gx[jj0 * fx + i1] * (tx - 1) + gy[jj0 * fx + i1] * ty;
      const n01 = gx[j1 * fx + ii0] * tx + gy[j1 * fx + ii0] * (ty - 1);
      const n11 = gx[j1 * fx + i1] * (tx - 1) + gy[j1 * fx + i1] * (ty - 1);
      const a = n00 + (n10 - n00) * sx;
      const b = n01 + (n11 - n01) * sx;
      out.data[y * w + x] = (a + (b - a) * sy) * 0.7071 + 0.5;
    }
  }
  return out;
}

/**
 * Fractal Brownian motion of periodic perlin noise.
 * opts: { fx, fy, octaves=5, lacunarity=2, gain=0.5, seed=0 } -> normalised to [0, 1].
 */
export function fbm(w, h, { fx, fy, octaves = 5, lacunarity = 2, gain = 0.5, seed = 0 }) {
  const out = new Field(w, h);
  let amp = 1;
  let total = 0;
  let cx = fx;
  let cy = fy;
  for (let o = 0; o < octaves; o++) {
    // Octaves above Nyquist only add aliasing.
    if (cx > w / 2 || cy > h / 2) break;
    const n = perlin(w, h, cx, cy, seed + o * 101);
    for (let i = 0; i < out.data.length; i++) out.data[i] += (n.data[i] - 0.5) * amp;
    total += amp;
    amp *= gain;
    cx = Math.round(cx * lacunarity);
    cy = Math.round(cy * lacunarity);
  }
  if (total === 0 && settings.strictNyquist) throw new Error(`fbm: frequency ${fx}x${fy} is above Nyquist for a ${w}x${h} field`);
  for (let i = 0; i < out.data.length; i++) out.data[i] = total ? out.data[i] / (total * 0.9) + 0.5 : 0.5;
  return out;
}

/** Ridged multifractal: sharp creases (cracks, veins, scratches). [0, 1]. */
export function ridged(w, h, opts) {
  const n = fbm(w, h, opts);
  for (let i = 0; i < n.data.length; i++) {
    const v = 1 - Math.abs(n.data[i] * 2 - 1);
    n.data[i] = v * v;
  }
  return normalize(n);
}

/** Per-pixel white noise in [0, 1). */
export function white(w, h, seed = 0) {
  const out = new Field(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out.data[y * w + x] = hash2(x, y, seed);
  return out;
}

/**
 * Periodic cellular (Worley) noise with a jittered point in each of fx*fy cells.
 * Returns { f1, f2, edge, id }: distances to the nearest / second nearest point normalised by the
 * mean cell size (so ~0..1), edge = f2 - f1 (cell borders are 0), id = random per-cell value in [0, 1).
 * `jitter` 0 gives a regular grid, 1 fully random.
 */
export function worley(w, h, fx, fy, seed = 0, jitter = 1) {
  fx = Math.max(1, Math.round(fx));
  fy = Math.max(1, Math.round(fy));
  const px = new Float32Array(fx * fy);
  const py = new Float32Array(fx * fy);
  const pid = new Float32Array(fx * fy);
  for (let j = 0; j < fy; j++) {
    for (let i = 0; i < fx; i++) {
      const k = j * fx + i;
      px[k] = 0.5 + (hash2(i, j, seed) - 0.5) * jitter;
      py[k] = 0.5 + (hash2(i, j, seed + 7919) - 0.5) * jitter;
      pid[k] = hash2(i, j, seed + 15485863);
    }
  }
  const cw = w / fx;
  const ch = h / fy;
  const norm = 1 / Math.sqrt(cw * ch);
  const f1 = new Field(w, h);
  const f2 = new Field(w, h);
  const edge = new Field(w, h);
  const id = new Field(w, h);
  for (let y = 0; y < h; y++) {
    const cj = Math.floor(y / ch);
    for (let x = 0; x < w; x++) {
      const ci = Math.floor(x / cw);
      let d1 = Infinity;
      let d2 = Infinity;
      let best = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const i = ci + di;
          const j = cj + dj;
          const k = (((j % fy) + fy) % fy) * fx + (((i % fx) + fx) % fx);
          const dx = (i + px[k]) * cw - x;
          const dy = (j + py[k]) * ch - y;
          const d = dx * dx + dy * dy;
          if (d < d1) {
            d2 = d1;
            d1 = d;
            best = k;
          } else if (d < d2) {
            d2 = d;
          }
        }
      }
      const o = y * w + x;
      f1.data[o] = Math.sqrt(d1) * norm;
      f2.data[o] = Math.sqrt(d2) * norm;
      edge.data[o] = f2.data[o] - f1.data[o];
      id.data[o] = pid[best];
    }
  }
  return { f1, f2, edge, id };
}
