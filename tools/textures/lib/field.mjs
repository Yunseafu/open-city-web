// Single-channel float images and the operations recipes are built from.
// A Field is w*h floats, row 0 is the TOP of the image (glTF UV origin). All spatial operations
// wrap around the edges so that results stay seamlessly tileable.

export class Field {
  constructor(w, h, data) {
    this.w = w;
    this.h = h;
    this.data = data ?? new Float32Array(w * h);
  }

  static filled(w, h, v) {
    const f = new Field(w, h);
    f.data.fill(v);
    return f;
  }

  /** Field from a function of pixel coordinates. */
  static from(w, h, fn) {
    const f = new Field(w, h);
    let i = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) f.data[i++] = fn(x, y);
    return f;
  }

  clone() {
    return new Field(this.w, this.h, this.data.slice());
  }

  /** Wrapped read. */
  at(x, y) {
    const { w, h } = this;
    x = ((x % w) + w) % w;
    y = ((y % h) + h) % h;
    return this.data[y * w + x];
  }

  /** Wrapped bilinear read at continuous pixel coordinates (pixel centres at integers). */
  sample(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const a = this.at(x0, y0);
    const b = this.at(x0 + 1, y0);
    const c = this.at(x0, y0 + 1);
    const d = this.at(x0 + 1, y0 + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  min() {
    let m = Infinity;
    for (const v of this.data) if (v < m) m = v;
    return m;
  }

  max() {
    let m = -Infinity;
    for (const v of this.data) if (v > m) m = v;
    return m;
  }

  mean() {
    let s = 0;
    for (const v of this.data) s += v;
    return s / this.data.length;
  }
}

const isField = (v) => v instanceof Field;

/** Apply fn(a, b) per pixel; a and b may each be a Field or a number. */
function zip(a, b, fn) {
  const ref = isField(a) ? a : b;
  const out = new Field(ref.w, ref.h);
  const ad = isField(a) ? a.data : null;
  const bd = isField(b) ? b.data : null;
  for (let i = 0; i < out.data.length; i++) out.data[i] = fn(ad ? ad[i] : a, bd ? bd[i] : b);
  return out;
}

export const add = (a, b) => zip(a, b, (x, y) => x + y);
export const sub = (a, b) => zip(a, b, (x, y) => x - y);
export const mul = (a, b) => zip(a, b, (x, y) => x * y);
export const max = (a, b) => zip(a, b, Math.max);
export const min = (a, b) => zip(a, b, Math.min);

/** a * (1 - t) + b * t, per pixel. */
export function mix(a, b, t) {
  const ref = [a, b, t].find(isField);
  const out = new Field(ref.w, ref.h);
  for (let i = 0; i < out.data.length; i++) {
    const x = isField(a) ? a.data[i] : a;
    const y = isField(b) ? b.data[i] : b;
    const k = isField(t) ? t.data[i] : t;
    out.data[i] = x + (y - x) * k;
  }
  return out;
}

export function map(a, fn) {
  const out = new Field(a.w, a.h);
  for (let i = 0; i < a.data.length; i++) out.data[i] = fn(a.data[i]);
  return out;
}

export const clamp01 = (a) => map(a, (v) => (v < 0 ? 0 : v > 1 ? 1 : v));
export const invert = (a) => map(a, (v) => 1 - v);
export const pow = (a, e) => map(a, (v) => Math.pow(Math.max(v, 0), e));
export const abs = (a) => map(a, Math.abs);

/** Linear remap of [inLo, inHi] to [outLo, outHi], clamped. */
export function remap(a, inLo, inHi, outLo = 0, outHi = 1) {
  const s = (outHi - outLo) / (inHi - inLo);
  return map(a, (v) => {
    const t = (v - inLo) * s;
    const lo = Math.min(outLo, outHi);
    const hi = Math.max(outLo, outHi);
    return Math.min(hi, Math.max(lo, outLo + t));
  });
}

export function smoothstep(a, lo, hi) {
  return map(a, (v) => {
    const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
    return t * t * (3 - 2 * t);
  });
}

/** Stretch to exactly [0, 1]. */
export function normalize(a) {
  const lo = a.min();
  const hi = a.max();
  const s = hi > lo ? 1 / (hi - lo) : 0;
  return map(a, (v) => (v - lo) * s);
}

/** Contrast around a pivot: (v - pivot) * gain + pivot. */
export const contrast = (a, gain, pivot = 0.5) => map(a, (v) => (v - pivot) * gain + pivot);

export const threshold = (a, t) => map(a, (v) => (v >= t ? 1 : 0));

/** Separable wrapped box blur; several passes approximate a gaussian. radius in pixels. */
export function blur(a, radius, passes = 2) {
  radius = Math.round(radius);
  if (radius < 1) return a.clone();
  let src = a;
  for (let p = 0; p < passes; p++) {
    src = blurAxis(src, radius, true);
    src = blurAxis(src, radius, false);
  }
  return src;
}

function blurAxis(a, r, horizontal) {
  const { w, h } = a;
  const out = new Field(w, h);
  const n = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const inv = 1 / (2 * r + 1);
  const idx = (line, i) => {
    const k = ((i % n) + n) % n;
    return horizontal ? line * w + k : k * w + line;
  };
  for (let line = 0; line < lines; line++) {
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += a.data[idx(line, i)];
    for (let i = 0; i < n; i++) {
      out.data[idx(line, i)] = sum * inv;
      sum += a.data[idx(line, i + r + 1)] - a.data[idx(line, i - r)];
    }
  }
  return out;
}

/** Shift the field by whole pixels with wrapping (useful to move a seam into the middle). */
export function roll(a, dx, dy) {
  const out = new Field(a.w, a.h);
  for (let y = 0; y < a.h; y++) {
    for (let x = 0; x < a.w; x++) out.data[y * a.w + x] = a.at(x - dx, y - dy);
  }
  return out;
}

/** Displace lookups by (dx, dy) fields, scaled to pixels; domain warping for organic shapes. */
export function warp(a, dx, dy, amountPx) {
  const out = new Field(a.w, a.h);
  for (let y = 0; y < a.h; y++) {
    for (let x = 0; x < a.w; x++) {
      const i = y * a.w + x;
      out.data[i] = a.sample(x + (dx.data[i] - 0.5) * 2 * amountPx, y + (dy.data[i] - 0.5) * 2 * amountPx);
    }
  }
  return out;
}

/** Morphological-ish distance falloff: 1 inside mask, fading to 0 over `radius` px (via blur). */
export function feather(mask, radius) {
  return blur(mask, radius, 3);
}

/** Local gradient magnitude, wrapped. Useful for edge wear. */
export function gradientMagnitude(a) {
  const out = new Field(a.w, a.h);
  for (let y = 0; y < a.h; y++) {
    for (let x = 0; x < a.w; x++) {
      const gx = a.at(x + 1, y) - a.at(x - 1, y);
      const gy = a.at(x, y + 1) - a.at(x, y - 1);
      out.data[y * a.w + x] = Math.hypot(gx, gy) * 0.5;
    }
  }
  return out;
}
