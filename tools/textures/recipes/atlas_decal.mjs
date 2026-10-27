// Road / wall decal sprite sheet, 1024x1024, grid 4x4 of 256 px cells, alpha-blended over the surface.
//
// Drawn to FILL their cell so the quad shape decides the final proportions:
//   arrows ~ a 1:3 (w:h) road quad, STOP / SLOW ~ a roughly square quad (letters come out tall like road text),
//   stop_line fills the whole cell with worn white paint. Alpha carries the shape; colour outside the shape is
//   kept equal to the paint colour so mip-mapping never produces dark halos.
import { Field, add, blur, map, mul, smoothstep } from "../lib/field.mjs";
import { fbm, perlin, white } from "../lib/noise.mjs";
import { disc, line, polyline, rect } from "../lib/draw.mjs";
import { Rgb, hex, scaleRgb } from "../lib/color.mjs";
import { circle, fillPolygon, smooth } from "../lib/glow.mjs";
import { drawStrokes, fitText, layoutText, textStrokes } from "../lib/font.mjs";
import { rng } from "../lib/rng.mjs";

const PAINT_WHITE = hex("#d9dcd8");
const PAINT_YELLOW = hex("#e0b81c");

/** Chipped, faded paint: knocks holes into a 0..1 mask. */
function wear(mask, ctx, amount = 0.5, scaleCycles = 11) {
  const { w, h } = ctx;
  const big = fbm(w, h, { fx: scaleCycles, fy: scaleCycles, octaves: 5, seed: ctx.seed + 1 });
  const fine = white(w, h, ctx.seed + 2);
  const chips = smoothstep(big, 0.58, 0.8);
  const out = new Field(w, h);
  for (let i = 0; i < out.data.length; i++) {
    const hole = Math.min(1, chips.data[i] * 1.1 + (fine.data[i] > 0.96 ? 0.45 : 0)) * amount;
    out.data[i] = mask.data[i] * (1 - hole);
  }
  return out;
}

/** Return value for a single-colour paint decal. */
function paint(ctx, mask, color, { wearAmount = 0.5, rough = 0.55, relief = 0.2 } = {}) {
  const { w, h } = ctx;
  const alpha = wear(mask, ctx, wearAmount);
  const grime = fbm(w, h, { fx: 5, fy: 5, octaves: 4, seed: ctx.seed + 3 });
  const albedo = scaleRgb(Rgb.filled(w, h, color), 1);
  for (let i = 0; i < w * h; i++) {
    const k = 0.82 + grime.data[i] * 0.3;
    for (let c = 0; c < 3; c++) albedo.data[i * 3 + c] *= k;
  }
  return { albedo, alpha, height: mul(alpha, relief), roughness: rough, metallic: 0 };
}

const newMask = (ctx) => new Field(ctx.w, ctx.h);
const poly = (m, pts) => fillPolygon(m, pts, 1);

// ---------------------------------------------------------------- road paint
// Arrows are drawn for a quad about three times taller than wide, so shapes are squeezed vertically here:
// vertical extents are 1/3 of what they should look like once the quad is stretched.
const arrowMask = (ctx, kind) => {
  const { w, h } = ctx;
  const m = newMask(ctx);
  const cx = 0.5 * w;
  const sw = 0.17 * w; // shaft half width
  const ty = sw / 3; // half thickness of a horizontal bar (squeezed)
  const hy = 2 * ty; // arrow head half height at a horizontal tip (squeezed)
  const hx = 0.2 * w; // arrow head length along x
  const straight = () => poly(m, [[cx - sw, 0.96 * h], [cx - sw, 0.34 * h], [cx - 0.44 * w, 0.34 * h], [cx, 0.04 * h], [cx + 0.44 * w, 0.34 * h], [cx + sw, 0.34 * h], [cx + sw, 0.96 * h]]);
  const leftTurn = (mirror) => {
    const y1 = 0.4 * h;
    const xl = 0.3 * w;
    const f = (x) => (mirror ? w - x : x);
    poly(m, [[cx + sw, 0.96 * h], [cx + sw, y1 - ty], [xl, y1 - ty], [xl, y1 + ty], [cx - sw, y1 + ty], [cx - sw, 0.96 * h]].map(([x, y]) => [f(x), y]));
    poly(m, [[xl, y1 - hy], [xl - hx, y1], [xl, y1 + hy]].map(([x, y]) => [f(x), y]));
  };
  if (kind === "straight") straight();
  else if (kind === "left") leftTurn(false);
  else if (kind === "right") leftTurn(true);
  else {
    straight();
    const yb = 0.64 * h;
    const xl = 0.3 * w;
    poly(m, [[cx - sw, yb - ty], [xl, yb - ty], [xl, yb + ty], [cx - sw, yb + ty]]);
    poly(m, [[xl, yb - hy], [xl - hx * 0.9, yb], [xl, yb + hy]]);
  }
  return m;
};

const arrow = (kind) => (ctx) => paint(ctx, arrowMask(ctx, kind), PAINT_WHITE);

const stopLine = (ctx) => {
  const m = Field.filled(ctx.w, ctx.h, 1);
  return paint(ctx, m, PAINT_WHITE, { wearAmount: 0.65 });
};

function roadWord(word, color) {
  return (ctx) => {
    const { w, h } = ctx;
    const m = newMask(ctx);
    // narrow, tall letters like text painted on a road seen from a low angle
    const size = h * 0.74;
    const strokes = textStrokes(word, w / 2, 0.13 * h, size, { align: "center", spacing: 0.9 });
    const lay = layoutText(word, { spacing: 0.9 });
    const natural = (lay.width * size) / 6;
    const sx = (0.9 * w) / natural;
    const sc = strokes.map((s) => s.map(([x, y]) => [w / 2 + (x - w / 2) * sx, y]));
    drawStrokes(m, sc, h * 0.075, 1);
    return paint(ctx, m, color, { wearAmount: 0.6 });
  };
}

const bike = (ctx) => {
  const { w, h } = ctx;
  const m = newMask(ctx);
  const t = h * 0.045;
  const r = 0.17 * w;
  const wy = 0.68 * h;
  const w1 = [0.25 * w, wy];
  const w2 = [0.75 * w, wy];
  drawStrokes(m, [circle(w1[0], w1[1], r, 28), circle(w2[0], w2[1], r, 28)], t, 1);
  drawStrokes(m, [[w1, [0.45 * w, 0.46 * h], [0.62 * w, 0.46 * h], w2], [[0.45 * w, 0.46 * h], [0.5 * w, wy], w1], [[0.5 * w, wy], [0.62 * w, 0.46 * h]], [[0.62 * w, 0.46 * h], [0.66 * w, 0.34 * h], [0.76 * w, 0.34 * h]], [[0.4 * w, 0.42 * h], [0.5 * w, 0.42 * h]]], t, 1);
  disc(m, 0.5 * w, 0.2 * h, 0.07 * w, 1, { wrap: false });
  drawStrokes(m, [[[0.46 * w, 0.3 * h], [0.5 * w, 0.4 * h], [0.62 * w, 0.46 * h]]], t * 1.1, 1);
  return paint(ctx, m, PAINT_WHITE, { wearAmount: 0.55 });
};

const chevrons = (ctx) => {
  const { w, h } = ctx;
  const m = newMask(ctx);
  for (let k = 0; k < 3; k++) {
    const y = (0.12 + k * 0.28) * h;
    poly(m, [[0.04 * w, y + 0.3 * h], [0.5 * w, y], [0.96 * w, y + 0.3 * h], [0.96 * w, y + 0.42 * h], [0.5 * w, y + 0.12 * h], [0.04 * w, y + 0.42 * h]]);
  }
  return paint(ctx, m, PAINT_YELLOW, { wearAmount: 0.5 });
};

// ---------------------------------------------------------------- graffiti
function graffiti(word, colorA, colorB, slant, seed) {
  return (ctx) => {
    const { w, h } = ctx;
    const r = rng(seed);
    const core = newMask(ctx);
    const outline = newMask(ctx);
    const size = h * 0.46;
    const lay = layoutText(word, { spacing: 0.6 });
    const natural = (lay.width * size) / 6;
    const scale = (0.86 * w) / (natural + slant * size);
    const strokes = textStrokes(word, 0.07 * w, 0.2 * h, size, { spacing: 0.6, slant }).map((s) =>
      smooth(s.map(([x, y]) => [0.07 * w + (x - 0.07 * w) * scale + (r() - 0.5) * 3, y + (r() - 0.5) * 3]), 4),
    );
    drawStrokes(outline, strokes, h * 0.1, 1);
    drawStrokes(core, strokes, h * 0.055, 1);
    // underline swoosh and a few spray dots
    const sw = smooth([[0.05 * w, 0.82 * h], [0.4 * w, 0.78 * h], [0.7 * w, 0.84 * h], [0.95 * w, 0.76 * h]], 8);
    polyline(core, sw, h * 0.03, 1, { mode: "max", wrap: false });
    for (let i = 0; i < 40; i++) disc(core, r() * w, r() * h, 0.8 + r() * 1.6, 0.6, { wrap: false, mode: "max" });
    // drips from the lower edge of the letters
    for (let i = 0; i < 9; i++) {
      const x = (0.1 + r() * 0.8) * w;
      const y0 = (0.55 + r() * 0.15) * h;
      const len = (0.06 + r() * 0.2) * h;
      line(core, x, y0, x, y0 + len, 2.4, 1, { wrap: false, mode: "max" });
      disc(core, x, y0 + len, 2.6, 1, { wrap: false, mode: "max" });
    }
    const halo = blur(core, 3, 2);
    const alpha = new Field(w, h);
    const albedo = new Rgb(w, h);
    for (let i = 0; i < w * h; i++) {
      const o = Math.min(1, outline.data[i] * 0.9);
      const c = core.data[i];
      alpha.data[i] = Math.min(1, Math.max(c, o, halo.data[i] * 0.45));
      for (let k = 0; k < 3; k++) albedo.data[i * 3 + k] = colorA[k] * c + colorB[k] * (1 - c);
    }
    const wor = wear(alpha, ctx, 0.25, 9);
    return { albedo, alpha: wor, height: mul(wor, 0.1), roughness: 0.6, metallic: 0 };
  };
}

// ---------------------------------------------------------------- posters
function posterBase(ctx, seed) {
  const { w, h } = ctx;
  // paper rectangle with a ragged torn lower-right corner and slightly uneven edges
  const edge = fbm(w, h, { fx: 6, fy: 6, octaves: 5, seed });
  const tear = fbm(w, h, { fx: 3, fy: 3, octaves: 6, seed: seed + 9 });
  const alpha = new Field(w, h);
  const ix = 0.07 * w;
  const iy = 0.05 * h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.min(x - ix, w - ix - x, y - iy, h - iy - y);
      let v = d + (edge.data[y * w + x] - 0.5) * 14;
      // torn corner: bite out a noisy triangle bottom-right
      const t = (x / w - 0.7) + (y / h - 0.7) - (0.5 - tear.data[y * w + x]) * 0.3;
      if (t > 0.22) v = Math.min(v, (0.22 - t) * w * 0.6);
      alpha.data[y * w + x] = Math.min(1, Math.max(0, v + 0.5));
    }
  }
  return { alpha, edge, tear };
}

function posterFinish(ctx, alpha, art, seed) {
  const { w, h } = ctx;
  const wrinkle = perlin(w, h, 5, 7, seed + 21);
  const albedo = new Rgb(w, h);
  const height = new Field(w, h);
  for (let i = 0; i < w * h; i++) {
    const k = 0.88 + 0.24 * wrinkle.data[i];
    for (let c = 0; c < 3; c++) albedo.data[i * 3 + c] = Math.min(1, art.data[i * 3 + c] * k);
    height.data[i] = alpha.data[i] * (0.6 + wrinkle.data[i] * 0.4);
  }
  return { albedo, alpha, height, roughness: 0.7, metallic: 0 };
}

const posterConcert = (ctx) => {
  const { w, h } = ctx;
  const seed = 5;
  const { alpha } = posterBase(ctx, seed);
  const art = Rgb.filled(w, h, hex("#16091f"));
  const P = { img: art };
  // gradient + big shapes
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const t = y / h; const i = (y * w + x) * 3; art.data[i] = 0.09 + 0.7 * t * t; art.data[i + 1] = 0.03 + 0.1 * t; art.data[i + 2] = 0.15 + 0.35 * t; }
  const m = newMask(ctx);
  disc(m, 0.5 * w, 0.38 * h, 0.22 * w, 1, { wrap: false });
  const tint = (mask, color, a = 1) => { for (let i = 0; i < w * h; i++) { const k = mask.data[i] * a; if (k > 0) for (let c = 0; c < 3; c++) art.data[i * 3 + c] += (color[c] - art.data[i * 3 + c]) * k; } };
  tint(m, hex("#ff2fa0"));
  const t1 = newMask(ctx);
  const s1 = fitText("NIGHT", { x: 0.14 * w, y: 0.62 * h, w: 0.68 * w, h: 0.12 * h }).strokes;
  const s2 = fitText("SHIFT", { x: 0.14 * w, y: 0.76 * h, w: 0.68 * w, h: 0.12 * h }).strokes;
  drawStrokes(t1, [...s1, ...s2], 0.02 * h, 1);
  tint(t1, hex("#00e5ff"));
  const t2 = newMask(ctx);
  drawStrokes(t2, fitText("LIVE 11.23 DOCKS", { x: 0.14 * w, y: 0.9 * h, w: 0.68 * w, h: 0.04 * h }).strokes, 0.008 * h + 1, 1);
  tint(t2, hex("#f4f8ff"));
  void P;
  return posterFinish(ctx, alpha, art, seed);
};

const posterWanted = (ctx) => {
  const { w, h } = ctx;
  const seed = 17;
  const { alpha } = posterBase(ctx, seed);
  const art = Rgb.filled(w, h, hex("#d8cfae"));
  const tint = (mask, color, a = 1) => { for (let i = 0; i < w * h; i++) { const k = mask.data[i] * a; if (k > 0) for (let c = 0; c < 3; c++) art.data[i * 3 + c] += (color[c] - art.data[i * 3 + c]) * k; } };
  const t = newMask(ctx);
  drawStrokes(t, fitText("WANTED", { x: 0.14 * w, y: 0.1 * h, w: 0.68 * w, h: 0.15 * h }).strokes, 0.025 * h, 1);
  tint(t, hex("#7a1313"));
  const face = newMask(ctx);
  rect(face, 0.25 * w, 0.3 * h, 0.75 * w, 0.68 * h, 1, { wrap: false });
  tint(face, hex("#3a3a3a"));
  const head = newMask(ctx);
  disc(head, 0.5 * w, 0.46 * h, 0.12 * w, 1, { wrap: false });
  rect(head, 0.34 * w, 0.58 * h, 0.66 * w, 0.68 * h, 1, { wrap: false, radius: 6 });
  tint(head, hex("#8a8a8a"));
  const t2 = newMask(ctx);
  drawStrokes(t2, [...fitText("REWARD 50K", { x: 0.14 * w, y: 0.76 * h, w: 0.66 * w, h: 0.07 * h }).strokes, ...fitText("DEAD OR ALIVE", { x: 0.14 * w, y: 0.87 * h, w: 0.66 * w, h: 0.05 * h }).strokes], 0.012 * h + 1, 1);
  tint(t2, hex("#2a2418"));
  return posterFinish(ctx, alpha, art, seed);
};

// ---------------------------------------------------------------- stains and metal
const stainOil = (ctx) => {
  const { w, h } = ctx;
  const n = fbm(w, h, { fx: 3, fy: 3, octaves: 5, seed: ctx.seed + 5 });
  const n2 = fbm(w, h, { fx: 9, fy: 9, octaves: 3, seed: ctx.seed + 6 });
  const alpha = new Field(w, h);
  const albedo = new Rgb(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = Math.hypot(x / w - 0.5, y / h - 0.5) * 2;
      const blob = 1 - d + (n.data[i] - 0.5) * 1.1;
      const a = Math.min(1, Math.max(0, (blob - 0.12) * 3.2));
      alpha.data[i] = a * 0.85;
      const sheen = n2.data[i];
      albedo.data[i * 3] = 0.035 + 0.05 * Math.max(0, sheen - 0.45) * 2;
      albedo.data[i * 3 + 1] = 0.03 + 0.04 * Math.max(0, 0.55 - sheen) * 2;
      albedo.data[i * 3 + 2] = 0.045 + 0.08 * sheen;
    }
  }
  return { albedo, alpha, height: mul(alpha, 0.1), roughness: add(Field.filled(w, h, 0.1), mul(n2, 0.15)), metallic: 0 };
};

const manhole = (ctx) => {
  const { w, h } = ctx;
  const cx = w / 2;
  const cy = h / 2;
  const R = 0.47 * w;
  const alpha = new Field(w, h);
  const height = new Field(w, h);
  const albedo = new Rgb(w, h);
  const rust = fbm(w, h, { fx: 5, fy: 5, octaves: 4, seed: ctx.seed + 8 });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const a = Math.min(1, Math.max(0, R - d + 0.5));
      alpha.data[i] = a;
      const u = d / R;
      let hh = 0.6;
      if (u > 0.9) hh = 0.3; // rim gap
      else if (u > 0.82) hh = 0.7;
      else if (u < 0.2) hh = 0.75; // centre boss
      else {
        // diamond pattern grooves
        const gx = Math.abs(((x + y) % 22) - 11) / 11;
        const gy = Math.abs(((x - y + 400) % 22) - 11) / 11;
        hh = 0.5 + 0.22 * Math.min(gx, gy) + (Math.abs(Math.sin(u * 22)) > 0.8 ? 0.15 : 0);
      }
      height.data[i] = hh;
      const base = 0.07 + 0.05 * rust.data[i] + (hh - 0.5) * 0.08;
      albedo.data[i * 3] = base * 1.15;
      albedo.data[i * 3 + 1] = base;
      albedo.data[i * 3 + 2] = base * 0.9;
    }
  }
  return { albedo, alpha, height, roughness: add(Field.filled(w, h, 0.5), mul(rust, 0.25)), metallic: 0.8 };
};

const drain = (ctx) => {
  const { w, h } = ctx;
  const alpha = Field.filled(w, h, 0);
  const albedo = Rgb.filled(w, h, [0.02, 0.02, 0.025]);
  const height = Field.filled(w, h, 0.3);
  const bars = newMask(ctx);
  rect(alpha, 0.04 * w, 0.14 * h, 0.96 * w, 0.86 * h, 1, { wrap: false, radius: 4 });
  const n = 9;
  for (let i = 0; i < n; i++) {
    const y0 = (0.14 + 0.02 + (i * 0.72) / n) * h;
    rect(bars, 0.04 * w, y0, 0.96 * w, y0 + (0.72 / n) * h * 0.55, 1, { wrap: false });
  }
  rect(bars, 0.04 * w, 0.14 * h, 0.1 * w, 0.86 * h, 1, { wrap: false });
  rect(bars, 0.9 * w, 0.14 * h, 0.96 * w, 0.86 * h, 1, { wrap: false });
  const rust = fbm(w, h, { fx: 4, fy: 4, octaves: 4, seed: ctx.seed + 10 });
  for (let i = 0; i < w * h; i++) {
    const b = bars.data[i];
    const v = 0.09 + 0.05 * rust.data[i];
    for (let c = 0; c < 3; c++) albedo.data[i * 3 + c] += (v * (c === 0 ? 1.15 : c === 2 ? 0.9 : 1) - albedo.data[i * 3 + c]) * b;
    height.data[i] = 0.3 + b * 0.55;
  }
  return { albedo, alpha: map(alpha, (v) => v), height, roughness: add(Field.filled(w, h, 0.85), mul(bars, -0.3)), metallic: mul(bars, 0.85) };
};

// ---------------------------------------------------------------- layout
const SPRITES = [
  ["arrow_straight", arrow("straight")],
  ["arrow_left", arrow("left")],
  ["arrow_right", arrow("right")],
  ["arrow_left_straight", arrow("left_straight")],
  ["stop_line", stopLine],
  ["text_stop", roadWord("STOP", PAINT_WHITE)],
  ["text_slow", roadWord("SLOW", PAINT_WHITE)],
  ["bike_symbol", bike],
  ["hazard_chevrons", chevrons],
  ["graffiti_tag_1", graffiti("RAZE", hex("#ff2fa0"), hex("#ff2fa0"), 0.25, 3)],
  ["graffiti_tag_2", graffiti("NOVA", hex("#00e5ff"), hex("#00e5ff"), -0.15, 9)],
  ["poster_torn_1", posterConcert],
  ["poster_torn_2", posterWanted],
  ["stain_oil", stainOil],
  ["manhole_cover", manhole],
  ["drain_grate", drain],
];

export const atlases = [
  {
    name: "mat_atlas_decal", // layout json: public/textures/atlas/mat_atlas_decal.json
    id: "mat_atlas_decal",
    size: [1024, 1024],
    grid: { cols: 4, rows: 4 },
    padPx: 4,
    relief: { depthM: 0.006, strength: 1 },
    note: "alpha-blended road and wall decals; fills each cell so the quad shape sets the proportions",
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, alphaMode: "blend", zOffset: -2, doubleSided: false },
    sprites: SPRITES.map(([name, draw], i) => ({ name, cell: [i % 4, Math.floor(i / 4)], draw })),
  },
];

