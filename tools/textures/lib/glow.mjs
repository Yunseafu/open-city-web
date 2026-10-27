// Neon sign rendering and shape helpers.
//
// NeonCanvas turns polylines (tube centre-lines) into the maps of a dark sign panel with glowing tubes:
//   albedo    dark backing, tubes look like dim coloured glass when "unlit"
//   emissive  white-hot core -> coloured tube body -> soft multi-radius glow baked onto the panel
//   roughness / metallic / height  panel vs. glass tube values
// so a sprite's draw() can simply `return canvas.render()`.
import { Field, blur, map, smoothstep } from "./field.mjs";
import { fbm, perlin, white } from "./noise.mjs";
import { Rgb, hex } from "./color.mjs";
import { polyline, disc } from "./draw.mjs";

/** sRGB neon palette. */
export const NEON = {
  cyan: hex("#00e5ff"),
  magenta: hex("#ff2fa0"),
  amber: hex("#ffa31f"),
  green: hex("#3bff6e"),
  red: hex("#ff3344"),
  purple: hex("#9b5cff"),
  white: hex("#e8f1ff"),
  blue: hex("#2f7bff"),
  pink: hex("#ff6ad5"),
  yellow: hex("#fff23a"),
};

// ---------------------------------------------------------------- geometry (all return polylines in px)
export function arc(cx, cy, r, a0, a1, n) {
  const seg = n ?? Math.max(6, Math.ceil((Math.abs(a1 - a0) / Math.PI) * 14));
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const a = a0 + ((a1 - a0) * i) / seg;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

export const circle = (cx, cy, r, n = 36) => arc(cx, cy, r, 0, Math.PI * 2, n);

export function ellipse(cx, cy, rx, ry, n = 36) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

/** Closed rounded rectangle outline. */
export function rrect(x0, y0, x1, y1, r = 0, seg = 5) {
  r = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  if (r <= 0) return [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
  const c = (cx, cy, a0) => arc(cx, cy, r, a0, a0 + Math.PI / 2, seg);
  const pts = [...c(x1 - r, y0 + r, -Math.PI / 2), ...c(x1 - r, y1 - r, 0), ...c(x0 + r, y1 - r, Math.PI / 2), ...c(x0 + r, y0 + r, Math.PI)];
  pts.push(pts[0]);
  return pts;
}

export function bezier(p0, p1, p2, p3, n = 20) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return pts;
}

/** Catmull-Rom spline through the points (open); `n` samples per span. */
export function smooth(pts, n = 8) {
  const out = [];
  const p = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p(i - 1)[0], p(i)[0], p(i + 1)[0], p(i + 2)[0]), f(p(i - 1)[1], p(i)[1], p(i + 1)[1], p(i + 2)[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function star(cx, cy, R, r, points = 5, rot = -Math.PI / 2) {
  const pts = [];
  for (let i = 0; i <= points * 2; i++) {
    const a = rot + (i * Math.PI) / points;
    const rad = i % 2 === 0 ? R : r;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  return pts;
}

/** Scale/translate a list of polylines about the unit box into a pixel rect. */
export function fitUnit(strokes, x, y, w, h) {
  return strokes.map((s) => s.map(([u, v]) => [x + u * w, y + v * h]));
}

/**
 * Fill polygon contours (even-odd) into a Field with 4x vertical supersampling.
 * contours: array of point arrays (or a single point array). mode as in draw.mjs.
 */
export function fillPolygon(field, contours, value = 1, { mode = "max" } = {}) {
  const polys = Array.isArray(contours[0][0]) ? contours : [contours];
  const { w, h } = field;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of polys) for (const [, y] of p) (minY = Math.min(minY, y), (maxY = Math.max(maxY, y)));
  const SS = 4;
  const acc = new Float32Array(w);
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(h - 1, Math.ceil(maxY)); y++) {
    acc.fill(0);
    for (let s = 0; s < SS; s++) {
      const sy = y + (s + 0.5) / SS;
      const xs = [];
      for (const p of polys) {
        for (let i = 0; i < p.length; i++) {
          const a = p[i];
          const b = p[(i + 1) % p.length];
          if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) xs.push(a[0] + ((sy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(0, xs[k]);
        const b = Math.min(w, xs[k + 1]);
        for (let x = Math.floor(a); x < Math.ceil(b); x++) acc[x] += Math.min(b, x + 1) - Math.max(a, x);
      }
    }
    for (let x = 0; x < w; x++) {
      const cover = Math.min(1, acc[x] / SS);
      if (cover <= 0) continue;
      const i = y * w + x;
      const old = field.data[i];
      if (mode === "add") field.data[i] = old + value * cover;
      else if (mode === "mul") field.data[i] = old * (1 + (value - 1) * cover);
      else if (mode === "max") field.data[i] = Math.max(old, old + (value - old) * cover);
      else field.data[i] = old + (value - old) * cover;
    }
  }
}

// ---------------------------------------------------------------- neon canvas
const WHITE = [1, 1, 1];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** Divide by the maximum so the strongest pixel is 1 (blurred thin lines are very faint otherwise). */
function peakNormalize(f) {
  const m = f.max();
  return m > 0 ? map(f, (v) => v / m) : f;
}

export class NeonCanvas {
  /**
   * ctx: build context ({ w, h, seed }). opts:
   *   tube    tube width as a fraction of the shorter side (default 0.03)
   *   panel   base colour of the backing, sRGB (default very dark blue-grey)
   *   bolts   draw corner bolts (default true)
   *   dirt    amount of grime streaks 0..1 (default 0.6)
   */
  constructor(ctx, { tube = 0.03, panel = [0.05, 0.055, 0.068], bolts = true, dirt = 0.6 } = {}) {
    this.w = ctx.w;
    this.h = ctx.h;
    this.t = Math.max(3, Math.min(ctx.w, ctx.h) * tube);
    this.seed = ctx.seed;
    this.panel = panel;
    this.dirt = dirt;
    this.layers = [];
    this.plates = [];
    this.holes = [];
    this.bolts = bolts;
  }

  /** Lighter or coloured plate on the backing (e.g. a sub-panel behind the text). */
  plate(x0, y0, x1, y1, { radius = 6, color = [0.1, 0.11, 0.13], lift = 0.25 } = {}) {
    const m = new Field(this.w, this.h);
    fillPolygon(m, rrect(x0, y0, x1, y1, radius));
    this.plates.push({ mask: m, color, lift });
    return this;
  }

  /** Neon tube along polylines. color: [r,g,b] sRGB or a NEON key. dim: 0 lit .. 1 completely unlit (broken tube). */
  tube(strokes, color, { width, dim = 0, core = true } = {}) {
    const col = typeof color === "string" ? NEON[color] : color;
    const t = width ?? this.t;
    const body = new Field(this.w, this.h);
    const cr = core ? new Field(this.w, this.h) : null;
    for (const s of strokes) {
      polyline(body, s, t, 1, { mode: "max", wrap: false });
      if (cr) polyline(cr, s, t * 0.4, 1, { mode: "max", wrap: false });
    }
    this.layers.push({ body, core: cr, color: col, dim, t });
    return this;
  }

  /** Filled emissive area (lit panel, LED matrix): mask is a Field 0..1. */
  fill(mask, color, { dim = 0 } = {}) {
    const col = typeof color === "string" ? NEON[color] : color;
    this.layers.push({ body: mask, core: null, color: col, dim, t: this.t, flat: true });
    return this;
  }

  render() {
    const { w, h, seed } = this;
    const n = w * h;
    const grain = white(w, h, seed + 11);
    const mott = fbm(w, h, { fx: 3, fy: 3, octaves: 4, seed: seed + 12 });
    // Vertical grime streaks, strongest near the top where water runs down.
    const streak = smoothstep(perlin(w, h, Math.max(4, Math.round(w / 9)), 2, seed + 13), 0.52, 0.8);
    const albedo = new Rgb(w, h);
    const height = new Field(w, h);
    const rough = new Field(w, h);
    const metal = new Field(w, h);
    const emissive = new Rgb(w, h);
    for (let y = 0; y < h; y++) {
      const top = 1 - y / h;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const g = (grain.data[i] - 0.5) * 0.014;
        const m = (mott.data[i] - 0.5) * 0.05;
        const dirt = this.dirt * streak.data[i] * top * 0.55;
        const k = (1 + m * 4 - dirt) * 1;
        for (let c = 0; c < 3; c++) albedo.data[i * 3 + c] = Math.max(0, this.panel[c] * k + g);
        height.data[i] = 0.45 + (grain.data[i] - 0.5) * 0.06 + (mott.data[i] - 0.5) * 0.1;
        rough.data[i] = Math.min(1, 0.52 + m * 1.5 + dirt * 0.5);
        metal.data[i] = 0.45;
      }
    }

    for (const p of this.plates) {
      for (let i = 0; i < n; i++) {
        const a = p.mask.data[i];
        if (a <= 0) continue;
        for (let c = 0; c < 3; c++) albedo.data[i * 3 + c] += (p.color[c] - albedo.data[i * 3 + c]) * a;
        height.data[i] += p.lift * 0.3 * a;
      }
    }

    if (this.bolts) {
      const b = new Field(w, h);
      const m = Math.max(6, Math.min(w, h) * 0.04);
      for (const [x, y] of [[m, m], [w - m, m], [m, h - m], [w - m, h - m]]) disc(b, x, y, m * 0.45, 1, { wrap: false });
      for (let i = 0; i < n; i++) {
        if (b.data[i] <= 0) continue;
        for (let c = 0; c < 3; c++) albedo.data[i * 3 + c] += (0.16 - albedo.data[i * 3 + c]) * b.data[i];
        height.data[i] += 0.3 * b.data[i];
        metal.data[i] += (0.9 - metal.data[i]) * b.data[i];
      }
    }

    // Slight bevel: the outer 2.5% steps down so the panel reads as a plate.
    const edge = Math.max(2, Math.round(Math.min(w, h) * 0.025));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = Math.min(x, y, w - 1 - x, h - 1 - y);
        if (d < edge) {
          height.data[y * w + x] -= (1 - d / edge) * 0.25;
          for (let c = 0; c < 3; c++) albedo.data[(y * w + x) * 3 + c] *= 0.7 + 0.3 * (d / edge);
        }
      }
    }

    for (const L of this.layers) {
      const body = L.body;
      const lit = 1 - L.dim;
      let glow = null;
      if (lit > 0.01) {
        const g1 = peakNormalize(blur(body, Math.round(L.t * 0.9), 2));
        const g2 = peakNormalize(blur(body, Math.round(L.t * 2.6), 2));
        const g3 = peakNormalize(blur(body, Math.round(L.t * 6), 2));
        glow = new Field(w, h);
        for (let i = 0; i < n; i++) glow.data[i] = g1.data[i] * g1.data[i] * 0.5 + g2.data[i] * g2.data[i] * 0.3 + g3.data[i] * g3.data[i] * 0.2;
      }
      const coreCol = mixc(L.color, WHITE, 0.72);
      const dimCol = [L.color[0] * 0.3 + 0.03, L.color[1] * 0.3 + 0.03, L.color[2] * 0.3 + 0.03];
      for (let i = 0; i < n; i++) {
        const b = body.data[i];
        if (lit > 0.01) {
          const e = Math.min(1, (b * 0.95 + glow.data[i] * 0.8) * lit);
          const cr = L.core ? L.core.data[i] * lit : 0;
          for (let c = 0; c < 3; c++) {
            const base = L.color[c] * e;
            emissive.data[i * 3 + c] += cr > 0 ? base * (1 - cr) + coreCol[c] * cr : base;
          }
        }
        if (b > 0) {
          // Unlit glass tube: dim tinted body over the dark panel.
          for (let c = 0; c < 3; c++) albedo.data[i * 3 + c] += (dimCol[c] - albedo.data[i * 3 + c]) * b;
          if (!L.flat) {
            height.data[i] += 0.3 * b;
            rough.data[i] += (0.1 - rough.data[i]) * b;
            metal.data[i] += (0 - metal.data[i]) * b;
          }
        }
      }
    }
    for (let i = 0; i < emissive.data.length; i++) emissive.data[i] = Math.min(1, emissive.data[i]);
    return { albedo, emissive, roughness: rough, metallic: metal, height };
  }
}

