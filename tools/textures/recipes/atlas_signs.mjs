// Neon sign sprite sheet: 8x8 cells of 256 px, one square sign per cell.
//
// The sign art is drawn for a SQUARE cell; the model side may stretch it onto a quad of any aspect,
// so lettering is kept simple and centred. Cell order is the order of SPRITES below
// (row-major, left to right). Names are referenced by the models thread: keep them stable.
import { NeonCanvas, NEON, circle, fillPolygon, fitUnit, rrect } from "../lib/glow.mjs";
import { ICONS } from "../lib/glow_icons.mjs";
import { fitText, glyphColumn, glyphRow, kana, pseudoText, strokeFor } from "../lib/font.mjs";
import { Field } from "../lib/field.mjs";

const PANELS = [
  [0.05, 0.055, 0.07],
  [0.07, 0.045, 0.075],
  [0.04, 0.06, 0.065],
  [0.075, 0.06, 0.05],
  [0.045, 0.045, 0.05],
];

/** Wrap a drawing function with a canvas; fn(S, u) gets unit helpers for the cell. */
function sign(fn, { tube = 0.03, panelIndex, dirt } = {}) {
  return (ctx) => {
    const panel = PANELS[panelIndex ?? ctx.seed % PANELS.length];
    const S = new NeonCanvas(ctx, { tube, panel, dirt });
    const { w, h } = ctx;
    const u = {
      w,
      h,
      box: (x, y, bw, bh) => ({ x: x * w, y: y * h, w: bw * w, h: bh * h }),
      icon: (name, x, y, bw, bh) => fitUnit(ICONS[name](), x * w, y * h, bw * w, bh * h),
      frame: (color, inset = 0.07, radius = 0.07, thin = 0.55) =>
        S.tube([rrect(inset * w, inset * h, (1 - inset) * w, (1 - inset) * h, radius * w)], color, { width: S.t * thin }),
      latin: (text, x, y, bw, bh, color, weight) => {
        const { strokes, size } = fitText(text, u.box(x, y, bw, bh));
        S.tube(strokes, color, { width: strokeFor(size, weight ?? 0.12) * 1 });
      },
      kana: (text, x, y, bw, bh, color, gap = 0.14) => S.tube(glyphRow(kana(text), x * w, y * h, bw * w, bh * h, gap), color, { width: S.t * 0.95 }),
      glyphs: (n, seed, x, y, bw, bh, color, gap = 0.14, width = 0.9, kind = "hanzi") =>
        S.tube(glyphRow(pseudoText(n, seed, kind), x * w, y * h, bw * w, bh * h, gap), color, { width: S.t * width }),
    };
    fn(S, u, ctx);
    return S.render();
  };
}

// kana + latin text sign with an optional icon
const kl = (kanaText, latin, c1, c2, frame, icon) =>
  sign((S, u) => {
    if (frame) u.frame(frame);
    if (icon) {
      u.kana(kanaText, 0.16, 0.16, 0.68, 0.26, c1);
      S.tube(u.icon(icon[0], 0.3, 0.46, 0.4, 0.26), icon[1] ?? c1, { width: S.t * 0.8 });
      u.latin(latin, 0.18, 0.76, 0.64, 0.11, c2);
    } else {
      u.kana(kanaText, 0.14, 0.18, 0.72, 0.36, c1);
      u.latin(latin, 0.18, 0.68, 0.64, 0.14, c2);
    }
  });

// big icon + latin word
const il = (icon, latin, c1, c2, frame) =>
  sign((S, u) => {
    if (frame) u.frame(frame);
    S.tube(u.icon(icon, 0.22, 0.14, 0.56, 0.5), c1, { width: S.t * 1.05 });
    u.latin(latin, 0.16, 0.72, 0.68, 0.14, c2);
  });

// icon only, optionally doubled outline for a heavier tube look
const iconOnly = (icon, c1, c2, pad = 0.14) =>
  sign((S, u) => {
    S.tube(u.icon(icon, pad, pad, 1 - 2 * pad, 1 - 2 * pad), c1, { width: S.t * 1.15 });
    if (c2) u.frame(c2, 0.06, 0.08, 0.5);
  });

// pseudo-hanzi block sign
const glyphSign = (n, seed, c1, c2, layout, kanaText) =>
  sign((S, u) => {
    u.frame(c2, 0.07, 0.08);
    if (kanaText) u.kana(kanaText, 0.12, 0.2, 0.76, 0.42, c1, 0.1);
    else if (layout === "single") u.glyphs(1, seed, 0.2, 0.15, 0.6, 0.6, c1, 0, 1.25);
    else if (layout === "pair") u.glyphs(2, seed, 0.12, 0.2, 0.76, 0.42, c1, 0.12, 1.1);
    else S.tube(glyphColumn(pseudoText(n, seed, "hanzi"), 0.38 * u.w, 0.12 * u.h, 0.24 * u.w, 0.6 * u.h, 0.22), c1, { width: S.t * 0.95 });
    u.latin(`${String(seed % 90 + 10)}-${String.fromCharCode(65 + (seed % 26))}`, 0.3, 0.8, 0.4, 0.08, c2);
  });

// tall sign: narrow vertical panel centred in the cell
const vertical = (n, seed, c1, c2, withLatin) =>
  sign(
    (S, u) => {
      const { w, h } = u;
      S.plate(0.3 * w, 0.04 * h, 0.7 * w, 0.96 * h, { radius: 6, color: [0.08, 0.085, 0.1] });
      S.tube([rrect(0.31 * w, 0.05 * h, 0.69 * w, 0.95 * h, 6)], c2, { width: S.t * 0.55 });
      S.tube(glyphColumn(pseudoText(n, seed), 0.35 * w, 0.1 * h, 0.3 * w, (withLatin ? 0.62 : 0.78) * h, 0.16), c1, { width: S.t * 0.85 });
      void withLatin;
    },
    { tube: 0.032 },
  );

// ---------------------------------------------------------------- special signs
const hologramGirl = sign((S, u) => {
  const { w, h } = u;
  const fig = ICONS.figure();
  const m = new Field(w, h);
  // filled silhouette from the figure outline, cut into scanlines
  const body = fitUnit(
    [[[0.3, 0.3], [0.42, 0.26], [0.58, 0.26], [0.7, 0.3], [0.76, 0.54], [0.66, 0.56], [0.64, 0.9], [0.36, 0.9], [0.34, 0.56], [0.24, 0.54]]],
    0.12 * w, 0.06 * h, 0.76 * w, 0.88 * h,
  )[0];
  fillPolygon(m, body);
  fillPolygon(m, fitUnit([circle(0.5, 0.14, 0.1, 20)], 0.12 * w, 0.06 * h, 0.76 * w, 0.88 * h)[0]);
  const band = Math.max(3, Math.round(h / 40));
  for (let y = 0; y < h; y++) if (Math.floor(y / band) % 2 === 1) for (let x = 0; x < w; x++) m.data[y * w + x] *= 0.25;
  S.fill(m, "cyan");
  S.tube(fitUnit(fig, 0.12 * w, 0.06 * h, 0.76 * w, 0.88 * h), "magenta", { width: S.t * 0.7 });
  u.frame("purple", 0.04, 0.05, 0.4);
});

const hazard = sign(
  (S, u) => {
    const { w, h } = u;
    const band = w / 7;
    // 45 degree stripes
    const bands = new Field(w, h);
    for (let i = -4; i < 12; i++) {
      const x0 = i * band;
      fillPolygon(bands, [[x0, h], [x0 + band / 2, h], [x0 + band / 2 + h, 0], [x0 + h, 0]]);
    }
    S.fill(bands, "amber", { dim: 0.7 });
    u.frame("amber", 0.03, 0.04, 0.7);
    u.latin("DANGER", 0.16, 0.38, 0.68, 0.22, "red", 0.17);
  },
  { tube: 0.03 },
);

// ---------------------------------------------------------------- sprite table (64 cells)
const C = NEON;
export const SPRITES = [
  ["ramen", kl("ラーメン", "RAMEN", C.amber, C.magenta, C.cyan)],
  ["noodles", kl("メン", "NOODLES", C.cyan, C.amber, C.purple, ["bowl", C.magenta])],
  ["sushi", kl("スシ", "SUSHI", C.red, C.white, C.amber, ["nigiri", C.pink])],
  ["izakaya", kl("サケ", "IZAKAYA", C.amber, C.green, C.red)],
  ["bar", il("cocktail", "BAR", C.magenta, C.cyan, C.purple)],
  ["hotel", kl("ホテル", "HOTEL", C.cyan, C.magenta, C.blue, ["bed", C.amber])],
  ["open_24h", sign((S, u) => { u.frame("green"); u.latin("OPEN", 0.16, 0.18, 0.68, 0.22, "green", 0.16); u.latin("24H", 0.22, 0.52, 0.56, 0.3, "amber", 0.17); })],
  ["pharmacy", kl("クスリ", "PHARMACY", C.green, C.white, C.green, ["medcross", C.green])],
  ["cyberware", kl("サイバー", "CYBERWARE", C.cyan, C.purple, C.cyan, ["chip", C.magenta])],
  ["clinic", il("heartpulse", "CLINIC", C.red, C.white, C.red)],
  ["arcade", kl("ゲーム", "ARCADE", C.purple, C.cyan, C.magenta, ["joystick", C.amber])],
  ["karaoke", kl("カラオケ", "KARAOKE", C.pink, C.cyan, C.purple, ["mic", C.amber])],
  ["cafe", il("cup", "CAFE", C.amber, C.pink, C.amber)],
  ["pizza", il("pizza", "PIZZA", C.amber, C.red, C.red)],
  ["burger", il("burger", "BURGER", C.amber, C.green, C.amber)],
  ["taco", kl("タコス", "TACOS", C.green, C.amber, C.red, ["taco", C.amber])],
  ["noodle_bar", kl("ラーメン", "NOODLE BAR", C.cyan, C.magenta, C.cyan)],
  ["vape", il("cloud", "VAPE", C.purple, C.pink, C.purple)],
  ["tattoo", kl("タトゥー", "TATTOO", C.red, C.white, C.red, ["anchor", C.red])],
  ["pawn", il("pawn", "PAWN", C.amber, C.white, C.amber)],
  ["hologram_girl", hologramGirl],
  ["arrow_left", sign((S, u) => { const a = u.icon("arrow", 0.1, 0.2, 0.8, 0.6).map((s) => s.map(([x, y]) => [u.w - x, y])); S.tube(a, "cyan", { width: S.t * 1.1 }); u.frame("cyan", 0.05, 0.08, 0.45); })],
  ["arrow_right", sign((S, u) => { S.tube(u.icon("arrow", 0.1, 0.2, 0.8, 0.6), "cyan", { width: S.t * 1.1 }); u.frame("cyan", 0.05, 0.08, 0.45); })],
  ["arrow_up", sign((S, u) => { const a = u.icon("arrow", 0.1, 0.2, 0.8, 0.6).map((s) => s.map(([x, y]) => [y * u.w / u.h, u.h - x])); S.tube(a, "magenta", { width: S.t * 1.1 }); u.frame("magenta", 0.05, 0.08, 0.45); })],
  ["arrow_down", sign((S, u) => { const a = u.icon("arrow", 0.1, 0.2, 0.8, 0.6).map((s) => s.map(([x, y]) => [y * u.w / u.h, x])); S.tube(a, "magenta", { width: S.t * 1.1 }); u.frame("magenta", 0.05, 0.08, 0.45); })],
  ["neon_cross", sign((S, u) => { S.tube(u.icon("medcross", 0.16, 0.16, 0.68, 0.68), "green", { width: S.t * 1.1 }); S.tube([circle(u.w / 2, u.h / 2, u.w * 0.45, 40)], "cyan", { width: S.t * 0.6 }); })],
  ["neon_star", iconOnly("star", "amber", "purple")],
  ["neon_dragon", iconOnly("dragon", "red", "amber", 0.1)],
  ["neon_koi", iconOnly("koi", "amber", "cyan", 0.1)],
  ["neon_katana", iconOnly("katana", "cyan", "magenta", 0.08)],
  ["neon_skull", iconOnly("skull", "white", "red", 0.14)],
  ["neon_eye", iconOnly("eye", "magenta", "cyan", 0.12)],
  ["neon_heart", iconOnly("heart", "pink", "red", 0.14)],
  ["neon_lightning", iconOnly("bolt", "yellow", "purple", 0.12)],
  ["neon_moon", iconOnly("moon", "white", "blue", 0.12)],
  ["glyph_1", glyphSign(1, 11, C.magenta, C.cyan, "single")],
  ["glyph_2", glyphSign(2, 22, C.cyan, C.purple, "pair")],
  ["glyph_3", glyphSign(3, 33, C.amber, C.red, "column")],
  ["glyph_4", glyphSign(1, 44, C.green, C.green, "single", "ネオン")],
  ["glyph_5", glyphSign(2, 55, C.red, C.amber, "pair")],
  ["glyph_6", glyphSign(3, 66, C.purple, C.magenta, "column")],
  ["glyph_7", glyphSign(1, 77, C.white, C.blue, "single")],
  ["glyph_8", glyphSign(2, 88, C.pink, C.cyan, "pair", "ヨルノ")],
  ["vertical_sign_1", vertical(4, 101, C.magenta, C.cyan)],
  ["vertical_sign_2", vertical(5, 102, C.cyan, C.magenta)],
  ["vertical_sign_3", vertical(4, 103, C.amber, C.red)],
  ["vertical_sign_4", vertical(3, 104, C.green, C.cyan)],
  ["vertical_sign_5", vertical(5, 105, C.red, C.amber)],
  ["vertical_sign_6", vertical(4, 106, C.purple, C.pink)],
  ["hazard_stripes", hazard],
  ["warning_triangle", iconOnly("warning", "amber", "red", 0.1)],
  ["no_entry", iconOnly("noentry", "red", "red", 0.08)],
  ["wifi", iconOnly("wifi", "cyan", "blue", 0.1)],
  ["battery", sign((S, u) => { S.tube(u.icon("battery", 0.08, 0.2, 0.84, 0.6).slice(0, 2), "green", { width: S.t * 1.1 }); S.tube(u.icon("battery", 0.08, 0.2, 0.84, 0.6).slice(2), "green", { width: S.t * 1.4 }); u.frame("green", 0.05, 0.08, 0.4); })],
  ["power", iconOnly("power", "red", "red", 0.14)],
  ["blank_dark", sign((S, u) => { u.frame("purple", 0.1, 0.1, 0.5); }, { panelIndex: 4 })],
  ["bank", il("coin", "BANK", C.yellow, C.white, C.amber)],
  ["data_hub", il("server", "DATA", C.cyan, C.green, C.blue)],
  ["net_cafe", il("wifi", "NET CAFE", C.green, C.cyan, C.green)],
  ["chromedoc", il("eye", "CHROME DOC", C.cyan, C.magenta, C.purple)],
  ["drone_repair", il("drone", "DRONE FIX", C.amber, C.cyan, C.amber)],
  ["noodle_24", sign((S, u) => { u.frame("amber"); u.latin("24", 0.2, 0.12, 0.6, 0.45, "amber", 0.18); u.kana("ラーメン", 0.14, 0.64, 0.72, 0.2, "magenta"); })],
  ["exit", sign((S, u) => { u.frame("green", 0.06, 0.08, 0.6); u.latin("EXIT", 0.14, 0.22, 0.72, 0.28, "green", 0.17); S.tube(u.icon("arrow", 0.3, 0.6, 0.4, 0.22), "green", { width: S.t * 0.8 }); })],
  ["taxi", sign((S, u) => { u.frame("amber", 0.06, 0.08, 0.6); u.latin("TAXI", 0.14, 0.22, 0.72, 0.3, "amber", 0.17); S.tube(u.icon("chevrons", 0.2, 0.64, 0.6, 0.22), "yellow", { width: S.t * 0.8 }); })],
];

export const atlases = [
  {
    name: "signs",
    id: "mat_atlas_signs",
    size: [2048, 2048],
    grid: { cols: 8, rows: 8 },
    padPx: 4,
    relief: { depthM: 0.012, strength: 1 },
    note: "neon sign sprite sheet, 64 square cells; emissive carries colour + baked glow",
    params: {
      baseColor: [1, 1, 1],
      metallic: 1,
      roughness: 1,
      emissiveColor: [1, 1, 1],
      emissiveIntensity: 3,
      envIntensity: 0.8,
    },
    sprites: SPRITES.map(([name, draw], i) => ({ name, cell: [i % 8, Math.floor(i / 8)], draw })),
  },
];
