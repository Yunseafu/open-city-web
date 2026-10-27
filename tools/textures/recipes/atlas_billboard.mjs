// Billboard / ad screen sprite sheet, 2048x2048, grid 4x8 of 512x256 cells; hero and tall ads span cells.
// Every ad is a lit screen: emissive = the picture, albedo = the same picture at ~10% over black glass,
// thin dark bezel around the edge. All brands are invented.
import { Paint, hex } from "../lib/glow_paint.mjs";
import { ICONS } from "../lib/glow_icons.mjs";
import { arc, circle, fitUnit, rrect } from "../lib/glow.mjs";
import { Field } from "../lib/field.mjs";
import { Rgb } from "../lib/color.mjs";
import { GLYPH_H, glyphRow, hanzi, kana, layoutText, place } from "../lib/font.mjs";
import { rng } from "../lib/rng.mjs";

const K = {
  white: hex("#f4f8ff"),
  black: hex("#05060a"),
  cyan: hex("#00e5ff"),
  magenta: hex("#ff2fa0"),
  pink: hex("#ff7ad9"),
  amber: hex("#ffa31f"),
  orange: hex("#ff6a1f"),
  yellow: hex("#ffe83a"),
  red: hex("#ff2a3a"),
  green: hex("#3bff6e"),
  lime: hex("#b6ff2e"),
  purple: hex("#8a4dff"),
  blue: hex("#2f6bff"),
  teal: hex("#12b5a6"),
  gold: hex("#f5c04a"),
  navy: hex("#0a1130"),
};

/** Wrap an ad painter: builds the albedo / emissive / roughness / metallic maps with a dark bezel. */
function screen(fn) {
  return (ctx) => {
    const { w, h } = ctx;
    const P = new Paint(w, h, [0.02, 0.02, 0.03]);
    const r = rng(ctx.seed);
    fn(P, { w, h, r, seed: ctx.seed });
    P.scanlines(Math.max(3, Math.round(h / 90)), 0.1);
    P.noise(0.012, ctx.seed);
    const bez = Math.max(2, Math.round(Math.min(w, h) * 0.016));
    const albedo = new Rgb(w, h);
    const emissive = new Rgb(w, h);
    const rough = new Field(w, h);
    const metal = new Field(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const d = Math.min(x, y, w - 1 - x, h - 1 - y);
        const inside = Math.min(1, Math.max(0, (d - bez) / 1.5 + 0.5));
        for (let c = 0; c < 3; c++) {
          const v = Math.min(1, Math.max(0, P.img.data[i * 3 + c]));
          emissive.data[i * 3 + c] = v * inside;
          albedo.data[i * 3 + c] = 0.012 + v * 0.1 * inside + (1 - inside) * 0.05;
        }
        rough.data[i] = 0.14 + (1 - inside) * 0.35;
        metal.data[i] = (1 - inside) * 0.8;
      }
    }
    return { albedo, emissive, roughness: rough, metallic: metal };
  };
}

// ---------------------------------------------------------------- shared painters
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** Bold headline: dark offset shadow + colour, thick strokes. */
function brand(P, str, x, y, size, color, shadow, opts = {}) {
  const off = Math.max(2, size * 0.06);
  if (shadow) P.text(str, x + off, y + off, size, shadow, { weight: 0.2, ...opts });
  P.text(str, x, y, size, color, { weight: 0.2, ...opts });
}

/** Text height that makes `str` exactly `maxW` wide, capped at maxSize. */
const fitSize = (str, maxW, maxSize, spacing = 1.2) => Math.min(maxSize, (maxW / layoutText(str, { spacing }).width) * GLYPH_H);

/** Headline that always fits: x is the left edge (or the centre with align "center"). */
function brandFit(P, str, x, y, maxW, maxSize, color, shadow, opts = {}) {
  const size = fitSize(str, maxW, maxSize);
  brand(P, str, x, y, size, color, shadow, opts);
  return size;
}

function skyline(P, y0, color, seed, lit = K.amber, h = 0.2, density = 28) {
  const r = rng(seed);
  const { w } = P;
  let x = 0;
  while (x < w) {
    const bw = (0.4 + r() * 1.2) * (w / density);
    const bh = (0.25 + r() * 0.75) * h * P.h;
    P.rect(x, y0 - bh, x + bw, y0 + 2, color);
    for (let k = 0; k < bw * bh * 0.002; k++) if (r() > 0.45) P.rect(x + 3 + r() * (bw - 8), y0 - bh + 4 + r() * (bh - 8), x + 6 + r() * (bw - 8), y0 - bh + 7 + r() * (bh - 8), lit, { alpha: 0.7 });
    x += bw + 2;
  }
}

function circuit(P, color, seed, cells = 22, alpha = 0.55) {
  const r = rng(seed);
  const cs = P.w / cells;
  const rows = Math.ceil(P.h / cs);
  for (let n = 0; n < cells * 2; n++) {
    let x = Math.floor(r() * cells);
    let y = Math.floor(r() * rows);
    const pts = [[x * cs, y * cs]];
    let dir = Math.floor(r() * 4);
    for (let s = 0; s < 3 + Math.floor(r() * 4); s++) {
      const len = 1 + Math.floor(r() * 3);
      const [dx, dy] = [[1, 0], [0, 1], [1, 1], [-1, 1]][dir];
      x += dx * len;
      y += dy * len;
      pts.push([x * cs, y * cs]);
      dir = (dir + (r() < 0.5 ? 1 : 3)) % 4;
    }
    P.strokes([pts], Math.max(2, cs * 0.12), color, { alpha });
    P.disc(pts[pts.length - 1][0], pts[pts.length - 1][1], cs * 0.16, color, { alpha });
  }
}

function qr(P, x0, y0, size, seed, fg, bg) {
  const n = 25;
  const c = size / n;
  const r = rng(seed);
  P.rect(x0 - c, y0 - c, x0 + size + c, y0 + size + c, bg);
  const finder = (ox, oy) => {
    P.rect(x0 + ox * c, y0 + oy * c, x0 + (ox + 7) * c, y0 + (oy + 7) * c, fg);
    P.rect(x0 + (ox + 1) * c, y0 + (oy + 1) * c, x0 + (ox + 6) * c, y0 + (oy + 6) * c, bg);
    P.rect(x0 + (ox + 2) * c, y0 + (oy + 2) * c, x0 + (ox + 5) * c, y0 + (oy + 5) * c, fg);
  };
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const inFinder = (i < 8 && j < 8) || (i > n - 9 && j < 8) || (i < 8 && j > n - 9);
      if (!inFinder && r() < 0.5) P.rect(x0 + i * c, y0 + j * c, x0 + (i + 1) * c, y0 + (j + 1) * c, fg);
    }
  }
  finder(0, 0);
  finder(n - 7, 0);
  finder(0, n - 7);
}

// ---------------------------------------------------------------- ads
const solarisHero = screen((P, { w, h, r }) => {
  const hz = 0.64 * h;
  P.gradient([[0, hex("#12053a")], [0.5, hex("#7a1b9a")], [1, hex("#ff5a4a")]], Math.PI / 2, [0, 0, w, hz]);
  P.gradient([[0, hex("#1b0838")], [1, hex("#07010f")]], Math.PI / 2, [0, hz, w, h]);
  // stars
  for (let i = 0; i < 70; i++) P.disc(r() * w, r() * hz * 0.7, 1 + r() * 1.5, K.white, { alpha: 0.4 + r() * 0.5 });
  // sun built from slices so the slits cut through it
  const cx = 0.5 * w;
  const cy = 0.46 * h;
  const R = 0.3 * h;
  const bands = 40;
  for (let j = 0; j < bands; j++) {
    const t = j / bands;
    const yy = cy - R + t * 2 * R;
    if (t > 0.5 && Math.floor(((t - 0.5) * 2) * 8) % 2 === 1 && ((t - 0.5) * 2) * 8 % 1 < 0.3 + (t - 0.5)) continue;
    if (yy > hz - 2) continue;
    const dy = yy + R / bands - cy;
    const hw = Math.sqrt(Math.max(0, R * R - dy * dy));
    P.rect(cx - hw, yy, cx + hw, yy + (2 * R) / bands + 0.5, lerp(hex("#fff04a"), hex("#ff2f8a"), t));
  }
  skyline(P, hz, hex("#0b0220"), 5, K.pink, 0.22, 26);
  // perspective grid
  const vx = cx;
  for (let i = -16; i <= 16; i++) P.strokes([[[vx + i * w * 0.012, hz], [vx + i * w * 0.2, h]]], 2.2, K.magenta, { alpha: 0.85 });
  for (let k = 0; k < 9; k++) {
    const t = Math.pow(k / 9, 2.1);
    P.strokes([[[0, hz + t * (h - hz)], [w, hz + t * (h - hz)]]], 1.5 + t * 3, K.magenta, { alpha: 0.85 });
  }
  brand(P, "SOLARIS", 0.05 * w, 0.06 * h, 0.2 * h, K.white, hex("#00c8ff"));
  P.text("POWER FOR THE NEXT CENTURY", 0.5 * w, 0.89 * h, 0.05 * h, hex("#ffd9f2"), { align: "center", weight: 0.14 });
  P.vignette(0.25);
});

const novamedWide = screen((P, { w, h }) => {
  P.gradient([[0, hex("#effcff")], [1, hex("#7ee8ff")]], 0);
  // logo: rounded plus
  const s = h * 0.62;
  P.rect(0.05 * w, h * 0.19 + s * 0.33, 0.05 * w + s, h * 0.19 + s * 0.67, K.teal, { radius: s * 0.1 });
  P.rect(0.05 * w + s * 0.33, h * 0.19, 0.05 * w + s * 0.67, h * 0.19 + s, K.teal, { radius: s * 0.1 });
  const tx = 0.05 * w + s * 1.3;
  brandFit(P, "NOVAMED", tx, 0.12 * h, 0.5 * w, 0.4 * h, hex("#05494a"), null);
  P.text("BODY 2.0  //  SUBSCRIBE TODAY", tx, 0.62 * h, 0.1 * h, hex("#0a7a85"), { weight: 0.13 });
  // ECG
  const y0 = 0.5 * h;
  const pts = [[0.8, 0], [0.84, 0], [0.86, -0.12], [0.88, 0.2], [0.9, -0.4], [0.92, 0.12], [0.94, 0], [0.99, 0]];
  P.strokes([pts.map(([x, y]) => [x * w, y0 + y * h * 0.5])], 5, K.teal, { alpha: 0.9 });
});

const zenkai = screen((P, { w, h }) => {
  P.gradient([[0, hex("#1a0206")], [1, hex("#c4142a")]], 0.6);
  for (let i = 0; i < 9; i++) P.strokes([[[w * (0.1 + i * 0.12), h], [w * (0.3 + i * 0.12), 0]]], 5, K.black, { alpha: 0.25 });
  P.strokes(place(hanzi(7), 0, 0, 1, 1).map((s) => s.map(([x, y]) => [0.06 * w + x * 0.3 * w, 0.14 * h + y * 0.7 * h])), 0.075 * h, K.white);
  brandFit(P, "ZENKAI", 0.42 * w, 0.22 * h, 0.54 * w, 0.26 * h, K.white, K.black);
  P.text("TOTAL FOCUS", 0.42 * w, 0.62 * h, 0.1 * h, hex("#ffd6d6"), { weight: 0.14 });
  P.rect(0.42 * w, 0.8 * h, 0.9 * w, 0.84 * h, K.white);
});

const vortex = screen((P, { w, h }) => {
  P.gradient([[0, hex("#0b0630")], [1, hex("#2a0a5a")]], 0.8);
  const cx = 0.5 * w;
  const cy = 0.5 * h;
  for (let k = 0; k < 9; k++) {
    const rad = (0.08 + k * 0.1) * h * 1.4;
    P.strokes([circle(cx, cy, rad, 48)], 3 + k * 0.6, lerp(K.cyan, K.magenta, k / 8), { alpha: 0.9 });
  }
  brandFit(P, "VORTEX", cx, 0.38 * h, 0.84 * w, 0.24 * h, K.white, hex("#14063a"), { align: "center" });
});

const halcyonTall = screen((P, { w, h, r }) => {
  P.gradient([[0, hex("#05283a")], [0.55, hex("#0a8f8f")], [1, hex("#f5c04a")]], Math.PI / 2);
  for (let i = 0; i < 80; i++) P.disc(r() * w, r() * h * 0.45, 1 + r() * 1.6, K.white, { alpha: 0.3 + r() * 0.6 });
  // planet with ring
  P.disc(0.5 * w, 0.24 * h, 0.25 * w, hex("#ffdf9a"));
  P.disc(0.56 * w, 0.21 * h, 0.19 * w, hex("#f5a742"), { alpha: 0.5 });
  P.strokes([arc(0.5 * w, 0.24 * h, 0.4 * w, Math.PI * 0.02, Math.PI * 0.98, 40).map(([x, y]) => [x, 0.24 * h + (y - 0.24 * h) * 0.28])], 6, K.white, { alpha: 0.9 });
  // arch with a glowing doorway
  const ax0 = 0.18 * w;
  const ax1 = 0.82 * w;
  const top = 0.5 * h;
  const base = 0.73 * h;
  P.poly([[ax0, base], [ax0, top], ...arc(0.5 * w, top, 0.32 * w, Math.PI, Math.PI * 2, 30), [ax1, base]], hex("#fff3cf"), { alpha: 0.25 });
  P.strokes([[[ax0, base], [ax0, top], ...arc(0.5 * w, top, 0.32 * w, Math.PI, Math.PI * 2, 30), [ax1, base]]], 7, K.gold);
  brandFit(P, "HALCYON", 0.5 * w, 0.78 * h, 0.8 * w, 0.06 * h, K.white, hex("#05283a"), { align: "center" });
  P.text("ORBITAL RESORT", 0.5 * w, 0.855 * h, 0.03 * h, hex("#05283a"), { align: "center", weight: 0.15 });
  P.text("BOOK THE VIEW", 0.5 * w, 0.92 * h, 0.028 * h, hex("#05283a"), { align: "center", weight: 0.15 });
});

const colaWide = screen((P, { w, h, r }) => {
  P.gradient([[0, hex("#ff2fa0")], [0.5, hex("#ff2fa0")], [0.5, hex("#00c8ff")], [1, hex("#00c8ff")]], 0.5);
  for (let i = 0; i < 40; i++) P.disc(r() * w, r() * h, 3 + r() * 14, K.white, { alpha: 0.25 + r() * 0.3 });
  // can
  const cx = 0.28 * w;
  P.rect(cx - 0.11 * w, 0.12 * h, cx + 0.11 * w, 0.9 * h, hex("#101428"), { radius: 14 });
  P.rect(cx - 0.11 * w, 0.4 * h, cx + 0.11 * w, 0.62 * h, K.white);
  P.text("NEON", cx, 0.42 * h, 0.17 * h, hex("#ff2fa0"), { align: "center", weight: 0.2 });
  P.rect(cx - 0.11 * w, 0.12 * h, cx + 0.11 * w, 0.17 * h, hex("#c9d2e8"), { radius: 10 });
  brand(P, "NEON", 0.5 * w, 0.18 * h, 0.3 * h, K.white, hex("#14063a"));
  brand(P, "COLA", 0.5 * w, 0.54 * h, 0.3 * h, K.yellow, hex("#14063a"));
  P.text("TASTES LIKE TOMORROW", 0.5 * w, 0.9 * h, 0.05 * h, K.white, { weight: 0.14 });
});

const colaCan = screen((P, { w, h, r }) => {
  P.gradient([[0, hex("#ff2fa0")], [1, hex("#7a0f6a")]], Math.PI / 2);
  for (let i = 0; i < 24; i++) P.disc(r() * w, r() * h, 4 + r() * 22, K.white, { alpha: 0.2 + r() * 0.3 });
  brand(P, "ICE", 0.5 * w, 0.14 * h, 0.3 * h, K.white, hex("#14063a"), { align: "center" });
  brand(P, "COLD", 0.5 * w, 0.52 * h, 0.3 * h, K.cyan, hex("#14063a"), { align: "center" });
});

const colaBubbles = screen((P, { w, h, r }) => {
  P.gradient([[0, hex("#00c8ff")], [1, hex("#0a3a8a")]], Math.PI / 2);
  for (let i = 0; i < 30; i++) {
    const rad = 6 + r() * 26;
    const x = r() * w;
    const y = r() * h;
    P.strokes([circle(x, y, rad, 24)], 3, K.white, { alpha: 0.8 });
    P.disc(x - rad * 0.3, y - rad * 0.3, rad * 0.15, K.white, { alpha: 0.9 });
  }
  brand(P, "-40%", 0.5 * w, 0.28 * h, 0.4 * h, K.yellow, hex("#0a1a50"), { align: "center" });
});

const priceTag = screen((P, { w, h }) => {
  P.gradient([[0, K.yellow], [1, K.amber]], 0.8);
  for (let i = -3; i < 9; i++) {
    P.poly([[i * 0.1 * w, 0], [i * 0.1 * w + 0.05 * w, 0], [i * 0.1 * w + 0.05 * w + 0.12 * h, 0.12 * h], [i * 0.1 * w + 0.12 * h, 0.12 * h]], K.black);
    P.poly([[i * 0.1 * w, 0.88 * h], [i * 0.1 * w + 0.05 * w, 0.88 * h], [i * 0.1 * w + 0.05 * w + 0.12 * h, h], [i * 0.1 * w + 0.12 * h, h]], K.black);
  }
  brand(P, "199", 0.5 * w, 0.24 * h, 0.5 * h, K.black, null, { align: "center" });
  P.disc(0.82 * w, 0.3 * h, 0.1 * h * 1.2, K.red);
  P.text("NEW", 0.82 * w, 0.24 * h, 0.1 * h, K.white, { align: "center", weight: 0.2 });
});

const qrAd = screen((P, { w, h, seed }) => {
  P.gradient([[0, hex("#070b1c")], [1, hex("#0c2a4a")]], 0.8);
  const size = 0.62 * h;
  qr(P, 0.5 * w - size / 2, 0.24 * h, size, seed, K.black, K.white);
  P.text("SCAN TO JOIN", 0.5 * w, 0.06 * h, 0.1 * h, K.cyan, { align: "center", weight: 0.16 });
  P.strokes([rrect(0.04 * w, 0.03 * h, 0.96 * w, 0.97 * h, 12)], 4, K.cyan, { alpha: 0.8 });
});

const glitch = screen((P, { w, h, r }) => {
  P.rect(0, 0, w, h, hex("#04060c"));
  for (let i = 0; i < 26; i++) {
    const y = r() * h;
    const bh = (0.01 + r() * 0.07) * h;
    const x = r() * w * 0.6;
    const c = [K.red, K.cyan, K.magenta, K.white][Math.floor(r() * 4)];
    P.rect(x, y, x + (0.1 + r() * 0.5) * w, y + bh, c, { alpha: 0.35 + r() * 0.4 });
  }
  const gs = fitSize("SIGNAL LOST", 0.86 * w, 0.2 * h);
  P.text("SIGNAL LOST", 0.5 * w + 6, 0.36 * h, gs, K.red, { align: "center", weight: 0.17, additive: true });
  P.text("SIGNAL LOST", 0.5 * w - 6, 0.36 * h, gs, K.cyan, { align: "center", weight: 0.17, additive: true });
  P.text("ERR 0x7F // RECONNECTING", 0.5 * w, 0.72 * h, 0.07 * h, K.white, { align: "center", weight: 0.14 });
  for (let i = 0; i < 14; i++) P.rect(r() * w, r() * h, r() * w, r() * h * 1 + 3, K.white, { alpha: 0.05 });
});

const holo = screen((P, { w, h }) => {
  P.gradient([[0, hex("#050a24")], [1, hex("#1a0a40")]], Math.PI / 2);
  for (let k = 0; k < 4; k++) P.strokes([circle(0.5 * w, 0.86 * h, (0.12 + k * 0.05) * h * 2.2, 40).map(([x, y]) => [x, 0.86 * h + (y - 0.86 * h) * 0.25])], 3, K.cyan, { alpha: 0.9 - k * 0.2 });
  const fig = fitUnit(ICONS.figure(), 0.3 * w, 0.06 * h, 0.4 * w, 0.8 * h);
  const mask = new Field(w, h);
  const body = fitUnit([[[0.3, 0.3], [0.42, 0.26], [0.58, 0.26], [0.7, 0.3], [0.76, 0.54], [0.66, 0.56], [0.64, 0.9], [0.36, 0.9], [0.34, 0.56], [0.24, 0.54]]], 0.3 * w, 0.06 * h, 0.4 * w, 0.8 * h)[0];
  P.poly(body, K.cyan, { alpha: 0.55 });
  P.disc(0.5 * w, 0.06 * h + 0.14 * 0.8 * h, 0.1 * 0.8 * h * 1.05, K.cyan, { alpha: 0.55 });
  for (let y = 0.1 * h; y < 0.9 * h; y += 7) P.rect(0.2 * w, y, 0.8 * w, y + 2.5, K.black, { alpha: 0.5 });
  P.strokes(fig, 3.5, K.magenta);
  void mask;
  brand(P, "MAYA", 0.04 * w, 0.1 * h, 0.17 * h, K.white, hex("#ff2fa0"));
  P.text("VIRTUAL IDOL", 0.04 * w, 0.3 * h, 0.06 * h, K.cyan, { weight: 0.14 });
  P.text("LIVE 21:00", 0.96 * w, 0.88 * h, 0.07 * h, K.pink, { align: "right", weight: 0.15 });
});

const bank = screen((P, { w, h }) => {
  P.gradient([[0, hex("#04221a")], [1, hex("#0a5a3a")]], 0.7);
  P.strokes([[[0.05, 0.9], [0.2, 0.75], [0.35, 0.8], [0.5, 0.6], [0.65, 0.62], [0.8, 0.4], [0.95, 0.25]].map(([x, y]) => [x * w, y * h])], 5, K.lime);
  const c = fitUnit(ICONS.coin(), 0.06 * w, 0.1 * h, 0.26 * h * 1.0, 0.4 * h);
  P.strokes(c, 4, K.gold);
  brand(P, "AURUM", 0.28 * w, 0.1 * h, 0.2 * h, K.gold, null);
  P.text("CREDIT", 0.28 * w, 0.36 * h, 0.12 * h, K.white, { weight: 0.15 });
  P.text("+12.4%", 0.95 * w, 0.1 * h, 0.1 * h, K.lime, { align: "right", weight: 0.16 });
});

const noodle = screen((P, { w, h }) => {
  P.gradient([[0, hex("#ff8a1f")], [1, hex("#c41e1e")]], 0.8);
  const bowl = fitUnit(ICONS.bowl(), 0.04 * w, 0.14 * h, 0.4 * w, 0.72 * h);
  P.strokes(bowl, 6, K.white);
  P.strokes(glyphRow(kana("ラーメン"), 0.5 * w, 0.1 * h, 0.44 * w, 0.3 * h, 0.1), 7, K.white);
  brand(P, "KAISEN", 0.5 * w, 0.48 * h, 0.17 * h, K.yellow, hex("#7a0f0f"));
  P.text("NOODLES 2X", 0.5 * w, 0.76 * h, 0.09 * h, K.white, { weight: 0.15 });
});

const clinic = screen((P, { w, h }) => {
  P.gradient([[0, hex("#021a22")], [1, hex("#05424a")]], 0.8);
  circuit(P, K.cyan, 31, 20, 0.5);
  P.disc(0.3 * w, 0.46 * h, 0.3 * h, hex("#021a22"));
  P.strokes(fitUnit(ICONS.eye(), 0.08 * w, 0.2 * h, 0.44 * w, 0.52 * h), 6, K.cyan);
  brand(P, "CHROME", 0.55 * w, 0.2 * h, 0.15 * h, K.white, null);
  brand(P, "CLINIC", 0.55 * w, 0.42 * h, 0.15 * h, K.cyan, null);
  P.text("UPGRADE YOURSELF", 0.55 * w, 0.68 * h, 0.06 * h, K.pink, { weight: 0.14 });
});

const news = screen((P, { w, h, r }) => {
  P.rect(0, 0, w, h, hex("#0a0d1c"));
  P.rect(0, 0, w, 0.18 * h, K.red);
  P.text("BREAKING", 0.04 * w, 0.03 * h, 0.12 * h, K.white, { weight: 0.18 });
  P.text("N7", 0.96 * w, 0.03 * h, 0.12 * h, K.white, { align: "right", weight: 0.2 });
  P.rect(0.04 * w, 0.26 * h, 0.5 * w, 0.8 * h, hex("#1b2c5a"));
  P.disc(0.27 * w, 0.5 * h, 0.12 * h, hex("#4f6bb5"));
  P.rect(0.15 * w, 0.62 * h, 0.39 * w, 0.8 * h, hex("#4f6bb5"), { radius: 8 });
  for (let i = 0; i < 5; i++) P.rect(0.56 * w, (0.28 + i * 0.1) * h, (0.56 + 0.3 + r() * 0.1) * w, (0.28 + i * 0.1 + 0.05) * h, K.white, { alpha: 0.8 });
  P.rect(0, 0.88 * h, w, h, hex("#ffd21f"));
  P.text("TRANSIT STRIKE ENDS  //  RAIN FORECAST  //  CORP INDEX UP 3.1%", 0.02 * w, 0.9 * h, 0.08 * h, K.black, { weight: 0.14 });
});

const zenkaiBanner = screen((P, { w, h }) => {
  P.gradient([[0, hex("#14060a")], [1, hex("#d01a2e")]], 0.2);
  for (let i = 0; i < 14; i++) P.strokes([[[w * (0.45 + i * 0.05), h * (0.1 + (i % 5) * 0.18)], [w * (0.85 + i * 0.05), h * (0.1 + (i % 5) * 0.18)]]], 5, K.white, { alpha: 0.25 });
  // sneaker silhouette
  P.poly([[0.05, 0.62], [0.08, 0.3], [0.2, 0.28], [0.26, 0.42], [0.4, 0.48], [0.46, 0.62], [0.44, 0.76], [0.06, 0.76]].map(([x, y]) => [x * w * 0.5 + 0.03 * w, y * h]), K.white);
  P.rect(0.03 * w + 0.05 * w * 0.5, 0.72 * h, 0.03 * w + 0.46 * w * 0.5 + 0.02 * w, 0.82 * h, K.red, { radius: 5 });
  brandFit(P, "ZENKAI RUN", 0.42 * w, 0.14 * h, 0.54 * w, 0.4 * h, K.white, K.black);
  P.text("LIGHTER. FASTER. FURTHER.", 0.42 * w, 0.66 * h, 0.12 * h, hex("#ffd6d6"), { weight: 0.14 });
});

const vortexHero = screen((P, { w, h }) => {
  P.rect(0, 0, w, h, hex("#06021a"));
  const cx = 0.5 * w;
  const cy = 0.46 * h;
  for (let k = 11; k >= 0; k--) {
    const s = Math.pow(0.78, k);
    const c = lerp(K.magenta, K.cyan, (k % 6) / 5);
    P.strokes([rrect(cx - 0.62 * w * s, cy - 0.5 * h * s * 1.1, cx + 0.62 * w * s, cy + 0.5 * h * s * 1.1, 20 * s + 4)], 2 + 6 * s, c, { alpha: 0.95 });
  }
  brandFit(P, "VORTEX", cx, 0.3 * h, 0.7 * w, 0.26 * h, K.white, hex("#14063a"), { align: "center" });
  P.text("PLAY NOW", cx, 0.7 * h, 0.1 * h, K.yellow, { align: "center", weight: 0.16 });
  P.vignette(0.3);
});

const INVADER = ["00100000100", "00010001000", "00111111100", "01101110110", "11111111111", "10111111101", "10100000101", "00011011000"];
const arcadePromo = screen((P, { w, h }) => {
  P.rect(0, 0, w, h, hex("#02100a"));
  const cs = 0.5 * h / 8 * 0.7;
  for (let k = 0; k < 3; k++) {
    const ox = 0.1 * w + k * (11 * cs + 0.06 * w);
    for (let j = 0; j < 8; j++) for (let i = 0; i < 11; i++) if (INVADER[j][i] === "1") P.rect(ox + i * cs, 0.12 * h + j * cs, ox + (i + 1) * cs - 1, 0.12 * h + (j + 1) * cs - 1, k === 1 ? K.magenta : K.green);
  }
  brand(P, "INSERT COIN", 0.5 * w, 0.58 * h, 0.2 * h, K.yellow, null, { align: "center" });
  P.text("HI-SCORE 099999", 0.5 * w, 0.86 * h, 0.07 * h, K.green, { align: "center", weight: 0.15 });
});

const sodaPromo = screen((P, { w, h, r }) => {
  P.gradient([[0, K.lime], [1, K.orange]], 0.7);
  for (let i = 0; i < 20; i++) {
    const x = r() * w;
    const y = r() * h;
    const rad = 5 + r() * 18;
    P.strokes([circle(x, y, rad, 20)], 3, K.white, { alpha: 0.8 });
  }
  brand(P, "FIZZ-0", 0.5 * w, 0.22 * h, 0.4 * h, K.white, hex("#7a2a00"), { align: "center" });
  P.text("ZERO SUGAR. FULL VOLTAGE.", 0.5 * w, 0.76 * h, 0.07 * h, hex("#4a1a00"), { align: "center", weight: 0.16 });
});

// ---------------------------------------------------------------- layout (4 cols x 8 rows of 512x256)
const SPRITES = [
  ["ad_solaris_hero", [0, 0, 2, 2], solarisHero],
  ["ad_novamed_wide", [2, 0, 2, 1], novamedWide],
  ["ad_zenkai_01", [2, 1], zenkai],
  ["ad_vortex_01", [3, 1], vortex],
  ["ad_halcyon_tall", [0, 2, 1, 4], halcyonTall],
  ["ad_neon_cola_wide", [1, 2, 2, 1], colaWide],
  ["ad_neon_cola_can", [1, 3], colaCan],
  ["ad_neon_cola_bubbles", [2, 3], colaBubbles],
  ["ad_price_tag_01", [3, 2], priceTag],
  ["ad_qr_01", [3, 3], qrAd],
  ["ad_glitch_01", [1, 4], glitch],
  ["ad_hologirl_01", [2, 4], holo],
  ["ad_aurum_bank_01", [3, 4], bank],
  ["ad_kaisen_noodle_01", [1, 5], noodle],
  ["ad_chrome_clinic_01", [2, 5], clinic],
  ["ad_news_01", [3, 5], news],
  ["ad_zenkai_banner", [0, 6, 2, 1], zenkaiBanner],
  ["ad_vortex_hero", [2, 6, 2, 2], vortexHero],
  ["ad_arcade_promo_01", [0, 7], arcadePromo],
  ["ad_fizz0_promo_01", [1, 7], sodaPromo],
];

// Guard against overlapping / missing cells when editing the layout.
{
  const used = new Set();
  for (const [name, [c, r, cs = 1, rs = 1]] of SPRITES) {
    for (let j = r; j < r + rs; j++) {
      for (let i = c; i < c + cs; i++) {
        if (used.has(`${i},${j}`)) throw new Error(`billboard atlas: ${name} overlaps cell ${i},${j}`);
        used.add(`${i},${j}`);
      }
    }
  }
  if (used.size !== 32) throw new Error(`billboard atlas: ${used.size} of 32 cells used`);
}

export const atlases = [
  {
    name: "mat_atlas_billboard", // layout json: public/textures/atlas/mat_atlas_billboard.json
    id: "mat_atlas_billboard",
    size: [2048, 2048],
    grid: { cols: 4, rows: 8 },
    padPx: 4,
    note: "lit ad screens (invented brands); cells are 512x256, big ads span cells",
    params: {
      baseColor: [1, 1, 1],
      metallic: 1,
      roughness: 1,
      emissiveColor: [1, 1, 1],
      emissiveIntensity: 2.5,
      envIntensity: 1,
    },
    sprites: SPRITES.map(([name, cell, draw]) => ({ name, cell, draw })),
  },
];
