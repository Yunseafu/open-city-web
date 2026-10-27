// Tiny RGB painter for lit screens (billboards): shapes are rasterised into a scratch coverage mask and
// blended into an sRGB image. Everything is non-wrapping and limited to the shape's bounding box.
import { Field, blur } from "./field.mjs";
import { Rgb, hex } from "./color.mjs";
import { rect as rectMask, disc as discMask } from "./draw.mjs";
import { fillPolygon } from "./glow.mjs";
import { drawStrokes, strokeFor, textStrokes } from "./font.mjs";
import { white } from "./noise.mjs";

export { hex };

export class Paint {
  constructor(w, h, bg = [0, 0, 0]) {
    this.w = w;
    this.h = h;
    this.img = Rgb.filled(w, h, bg);
    this.m = new Field(w, h);
  }

  /** Clamp and clear the scratch mask over a bbox; returns the integer region. */
  _begin(x0, y0, x1, y1, pad = 3) {
    const r = [Math.max(0, Math.floor(x0 - pad)), Math.max(0, Math.floor(y0 - pad)), Math.min(this.w, Math.ceil(x1 + pad)), Math.min(this.h, Math.ceil(y1 + pad))];
    for (let y = r[1]; y < r[3]; y++) this.m.data.fill(0, y * this.w + r[0], y * this.w + Math.max(r[0], r[2]));
    return r;
  }

  _commit(r, color, alpha = 1, additive = false) {
    const { w, img, m } = this;
    for (let y = r[1]; y < r[3]; y++) {
      for (let x = r[0]; x < r[2]; x++) {
        const a = m.data[y * w + x] * alpha;
        if (a <= 0) continue;
        const i = (y * w + x) * 3;
        if (additive) {
          img.data[i] += color[0] * a;
          img.data[i + 1] += color[1] * a;
          img.data[i + 2] += color[2] * a;
        } else {
          img.data[i] += (color[0] - img.data[i]) * a;
          img.data[i + 1] += (color[1] - img.data[i + 1]) * a;
          img.data[i + 2] += (color[2] - img.data[i + 2]) * a;
        }
      }
    }
  }

  rect(x0, y0, x1, y1, color, { radius = 0, alpha = 1, soft = 0, additive = false } = {}) {
    const r = this._begin(x0, y0, x1, y1, 3 + soft);
    rectMask(this.m, x0, y0, x1, y1, 1, { wrap: false, radius, soft });
    this._commit(r, color, alpha, additive);
    return this;
  }

  disc(cx, cy, rad, color, { alpha = 1, soft = 0, additive = false } = {}) {
    const r = this._begin(cx - rad, cy - rad, cx + rad, cy + rad, 3 + soft);
    discMask(this.m, cx, cy, rad, 1, { wrap: false, soft });
    this._commit(r, color, alpha, additive);
    return this;
  }

  poly(pts, color, { alpha = 1, additive = false } = {}) {
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const r = this._begin(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    fillPolygon(this.m, pts);
    this._commit(r, color, alpha, additive);
    return this;
  }

  strokes(strokes, thickness, color, { alpha = 1, additive = false } = {}) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const s of strokes) for (const [x, y] of s) (x0 = Math.min(x0, x), (y0 = Math.min(y0, y)), (x1 = Math.max(x1, x)), (y1 = Math.max(y1, y)));
    if (x0 === Infinity) return this;
    const r = this._begin(x0 - thickness, y0 - thickness, x1 + thickness, y1 + thickness);
    drawStrokes(this.m, strokes, thickness, 1);
    this._commit(r, color, alpha, additive);
    return this;
  }

  text(str, x, y, size, color, { weight = 0.14, align = "left", spacing = 1.2, slant = 0, alpha = 1, additive = false } = {}) {
    return this.strokes(textStrokes(str, x, y, size, { align, spacing, slant }), strokeFor(size, weight), color, { alpha, additive });
  }

  /** Linear gradient over a bbox (default: everything). stops: [[0..1, [r,g,b]], ...]; angle in radians (0 = left to right). */
  gradient(stops, angle = Math.PI / 2, [x0, y0, x1, y1] = [0, 0, this.w, this.h]) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const bw = x1 - x0;
    const bh = y1 - y0;
    const span = Math.abs(dx) * bw + Math.abs(dy) * bh || 1;
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.h, Math.ceil(y1)); y++) {
      for (let x = Math.max(0, Math.floor(x0)); x < Math.min(this.w, Math.ceil(x1)); x++) {
        const t = Math.min(1, Math.max(0, ((x - x0 - bw / 2) * dx + (y - y0 - bh / 2) * dy) / span + 0.5));
        let k = 0;
        while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
        const [p0, c0] = stops[k];
        const [p1, c1] = stops[k + 1];
        const f = Math.min(1, Math.max(0, (t - p0) / (p1 - p0 || 1)));
        const i = (y * this.w + x) * 3;
        for (let c = 0; c < 3; c++) this.img.data[i + c] = c0[c] + (c1[c] - c0[c]) * f;
      }
    }
    return this;
  }

  /** Additive soft glow around whatever `draw(mask)` paints (mask is a full-size Field). */
  bloom(draw, color, radius, gain = 1) {
    const mask = new Field(this.w, this.h);
    draw(mask);
    const b = blur(mask, radius, 2);
    const peak = b.max() || 1;
    for (let i = 0; i < b.data.length; i++) {
      const a = (b.data[i] / peak) * gain;
      if (a > 0) for (let c = 0; c < 3; c++) this.img.data[i * 3 + c] += color[c] * a;
    }
    return this;
  }

  /** Darken every other band of rows (CRT / LED matrix look). */
  scanlines(period = 4, strength = 0.14) {
    for (let y = 0; y < this.h; y++) {
      if (y % period < period / 2) continue;
      for (let x = 0; x < this.w * 3; x++) this.img.data[y * this.w * 3 + x] *= 1 - strength;
    }
    return this;
  }

  vignette(strength = 0.35) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const d = Math.hypot(x / this.w - 0.5, y / this.h - 0.5) * 1.4;
        const k = 1 - strength * d * d;
        const i = (y * this.w + x) * 3;
        for (let c = 0; c < 3; c++) this.img.data[i + c] *= k;
      }
    }
    return this;
  }

  noise(amount = 0.03, seed = 1) {
    const n = white(this.w, this.h, seed);
    for (let i = 0; i < n.data.length; i++) for (let c = 0; c < 3; c++) this.img.data[i * 3 + c] += (n.data[i] - 0.5) * amount;
    return this;
  }
}
