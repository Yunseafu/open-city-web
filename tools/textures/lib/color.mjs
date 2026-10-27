// RGB images authored in sRGB space (what you see is what you get), plus colour helpers.
import { Field } from "./field.mjs";

export class Rgb {
  constructor(w, h, data) {
    this.w = w;
    this.h = h;
    this.data = data ?? new Float32Array(w * h * 3);
  }

  static filled(w, h, [r, g, b]) {
    const img = new Rgb(w, h);
    for (let i = 0; i < w * h; i++) {
      img.data[i * 3] = r;
      img.data[i * 3 + 1] = g;
      img.data[i * 3 + 2] = b;
    }
    return img;
  }

  clone() {
    return new Rgb(this.w, this.h, this.data.slice());
  }

  /** Wrapped read, returns [r, g, b]. */
  at(x, y) {
    const { w, h } = this;
    x = ((x % w) + w) % w;
    y = ((y % h) + h) % h;
    const i = (y * w + x) * 3;
    return [this.data[i], this.data[i + 1], this.data[i + 2]];
  }
}

/** "#rrggbb" or "#rgb" -> [r, g, b] in 0..1 (sRGB). */
export function hex(s) {
  let h = s.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/** Colour ramp: stops = [[pos, [r,g,b]], ...] with ascending pos; maps a Field to Rgb. */
export function ramp(field, stops) {
  const out = new Rgb(field.w, field.h);
  for (let i = 0; i < field.data.length; i++) {
    const v = field.data[i];
    let k = 0;
    while (k < stops.length - 2 && v > stops[k + 1][0]) k++;
    const [p0, c0] = stops[k];
    const [p1, c1] = stops[k + 1];
    const t = Math.min(1, Math.max(0, (v - p0) / (p1 - p0 || 1)));
    for (let c = 0; c < 3; c++) out.data[i * 3 + c] = c0[c] + (c1[c] - c0[c]) * t;
  }
  return out;
}

/** Per-pixel mix of two Rgb images (or an Rgb and a [r,g,b]) by a Field or number t. */
export function mixRgb(a, b, t) {
  const ref = a instanceof Rgb ? a : b;
  const out = new Rgb(ref.w, ref.h);
  for (let i = 0; i < ref.w * ref.h; i++) {
    const k = t instanceof Field ? t.data[i] : t;
    for (let c = 0; c < 3; c++) {
      const x = a instanceof Rgb ? a.data[i * 3 + c] : a[c];
      const y = b instanceof Rgb ? b.data[i * 3 + c] : b[c];
      out.data[i * 3 + c] = x + (y - x) * k;
    }
  }
  return out;
}

/** Multiply an Rgb by a Field (or number) - e.g. darken by AO / dirt. */
export function scaleRgb(a, s) {
  const out = new Rgb(a.w, a.h);
  for (let i = 0; i < a.w * a.h; i++) {
    const k = s instanceof Field ? s.data[i] : s;
    for (let c = 0; c < 3; c++) out.data[i * 3 + c] = a.data[i * 3 + c] * k;
  }
  return out;
}

/** Multiply by a colour (tint) given as [r,g,b] or another Rgb. */
export function tintRgb(a, tint) {
  const out = new Rgb(a.w, a.h);
  for (let i = 0; i < a.w * a.h; i++) {
    for (let c = 0; c < 3; c++) out.data[i * 3 + c] = a.data[i * 3 + c] * (tint instanceof Rgb ? tint.data[i * 3 + c] : tint[c]);
  }
  return out;
}

export function addRgb(a, b) {
  const out = new Rgb(a.w, a.h);
  for (let i = 0; i < a.data.length; i++) out.data[i] = a.data[i] + b.data[i];
  return out;
}

export function clampRgb(a) {
  const out = new Rgb(a.w, a.h);
  for (let i = 0; i < a.data.length; i++) out.data[i] = Math.min(1, Math.max(0, a.data[i]));
  return out;
}

/** Split into three Fields. */
export function channels(a) {
  const f = [0, 1, 2].map(() => new Field(a.w, a.h));
  for (let i = 0; i < a.w * a.h; i++) for (let c = 0; c < 3; c++) f[c].data[i] = a.data[i * 3 + c];
  return f;
}

export function fromChannels(r, g, b) {
  const out = new Rgb(r.w, r.h);
  for (let i = 0; i < r.w * r.h; i++) {
    out.data[i * 3] = r.data[i];
    out.data[i * 3 + 1] = g.data[i];
    out.data[i * 3 + 2] = b.data[i];
  }
  return out;
}

/** Grey Field -> Rgb. */
export function greyRgb(f) {
  return fromChannels(f, f, f);
}
