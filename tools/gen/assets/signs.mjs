// Standalone neon signs, billboards and sign furniture (category "sign").
// Origin: bottom centre, +Z faces the viewer. Blade signs: origin = wall attachment point (the sign hangs below y = 0).
// Buildings call the same pieces through tools/gen/lib/signs.mjs; these GLBs exist for the gallery
// and for placing free-standing signs.
import * as S from "../lib/signs.mjs";
import { TAU } from "../lib/math.mjs";

const DARK = "mat_metal_painted_dark";
const GALV = "mat_metal_galvanized";
const mk = (base, over) => ({ ...base, ...over });
/** Dark backing box on the wall plane, front at z = d. */
const panel = (b, w, h, d = 0.12) => b.box(DARK, [-w / 2, 0, 0], [w / 2, h, d], { skip: ["s"] });
/** Sign-plane x: signs face +Z, so a viewer on the +Z side has +X on their LEFT. vr(x) takes "x to the viewer's right". */
const vr = (x) => -x;
const light = (b, pos, mat, intensity = 1, range = 10) => b.anchor("light.sign", pos, { color: S.neonHex(mat), intensity, range });

// ---- blades -------------------------------------------------------------------------------------
const bladeBase = { w: 0.9, h: 3.0, proj: 0.9 };

const bladeKana = {
  id: "sign_blade_kana",
  category: "sign",
  tags: ["sign:blade"],
  budget: 400,
  params: mk(bladeBase, { style: "kana", text: "ラーメン", color: "mat_neon_red", color2: "mat_neon_amber" }),
  variants: [
    { suffix: "_a", seed: 11, params: mk(bladeBase, { style: "kana", text: "ラーメン", color: "mat_neon_red", color2: "mat_neon_amber" }) },
    { suffix: "_b", seed: 12, params: mk(bladeBase, { style: "kana", text: "ホテル", color: "mat_neon_cyan", color2: "mat_neon_magenta", h: 2.6 }) },
    { suffix: "_c", seed: 13, params: mk(bladeBase, { style: "kana", text: "カラオケ", color: "mat_neon_magenta", color2: "mat_neon_cyan", h: 3.6, w: 1.0 }) },
    { suffix: "_d", seed: 14, params: mk(bladeBase, { style: "kana", text: "電脳街", color: "mat_neon_green", color2: "mat_neon_cyan", h: 2.4 }) },
  ],
  build(b, r, p) {
    S.bladeSign(b, r, p);
    light(b, [0, -p.h / 2, p.proj + p.w / 2], p.color, 0.8, 8);
  },
};

const bladeLatin = {
  id: "sign_blade_latin",
  category: "sign",
  tags: ["sign:blade"],
  budget: 400,
  params: mk(bladeBase, { style: "latin", text: "BAR", color: "mat_neon_amber", color2: "mat_neon_red" }),
  variants: [
    { suffix: "_a", seed: 21, params: mk(bladeBase, { style: "latin", text: "BAR", color: "mat_neon_amber", color2: "mat_neon_red", h: 2.2 }) },
    { suffix: "_b", seed: 22, params: mk(bladeBase, { style: "latin", text: "HOTEL", color: "mat_neon_cyan", color2: "mat_neon_purple", h: 4.2, w: 1.0 }) },
    { suffix: "_c", seed: 23, params: mk(bladeBase, { style: "latin", text: "24H", color: "mat_neon_green", color2: "mat_neon_white", h: 2.2 }) },
  ],
  build(b, r, p) {
    S.bladeSign(b, r, p);
    light(b, [0, -p.h / 2, p.proj + p.w / 2], p.color, 0.8, 8);
  },
};

const bladeAtlas = {
  id: "sign_blade_atlas",
  category: "sign",
  tags: ["sign:blade", "atlas"],
  budget: 400,
  // vertical_sign_* art is painted for ~1:3 panels
  params: mk(bladeBase, { style: "atlas", sprite: "vertical_sign_1", w: 0.9, h: 2.7 }),
  variants: [
    { suffix: "_a", seed: 31, params: mk(bladeBase, { style: "atlas", sprite: "vertical_sign_1", w: 0.9, h: 2.7, color: "mat_neon_magenta" }) },
    { suffix: "_b", seed: 32, params: mk(bladeBase, { style: "atlas", sprite: "vertical_sign_2", w: 1.0, h: 3.0, color: "mat_neon_cyan" }) },
    { suffix: "_c", seed: 33, params: mk(bladeBase, { style: "atlas", sprite: "vertical_sign_5", w: 0.8, h: 2.4, color: "mat_neon_amber" }) },
  ],
  build(b, r, p) {
    S.bladeSign(b, r, p);
    light(b, [0, -p.h / 2, p.proj + p.w / 2], p.color, 0.8, 8);
  },
};

// ---- wall boards ----------------------------------------------------------------------------------
const boardBase = { w: 3.2, h: 1.1 };
const shopBoard = {
  id: "sign_shop_board",
  category: "sign",
  tags: ["sign:wall"],
  budget: 400,
  params: mk(boardBase, { style: "neon", text: "NOODLE", color: "mat_neon_cyan", color2: "mat_neon_magenta" }),
  variants: [
    { suffix: "_neon", seed: 41, params: mk(boardBase, { style: "neon", text: "NOODLE", color: "mat_neon_cyan", color2: "mat_neon_magenta" }) },
    { suffix: "_neon_kana", seed: 42, params: mk(boardBase, { style: "neon", color: "mat_neon_amber", color2: "mat_neon_red", h: 1.6, w: 3.6 }) },
    { suffix: "_board", seed: 43, params: mk(boardBase, { style: "board", text: "PHARMA", color: "mat_neon_green", color2: "mat_neon_white" }) },
    { suffix: "_bar", seed: 44, params: mk(boardBase, { style: "bar", text: "SAKE", color: "mat_neon_magenta", color2: "mat_neon_amber" }) },
    { suffix: "_atlas", seed: 45, params: mk(boardBase, { style: "atlas", sprite: "wide_hotel", color: "mat_neon_cyan", w: 3.6, h: 1.2 }) },
    { suffix: "_atlas_ramen", seed: 47, params: mk(boardBase, { style: "atlas", sprite: "wide_ramen", color: "mat_neon_red", w: 3.6, h: 1.2 }) },
    { suffix: "_atlas_sq", seed: 48, params: mk(boardBase, { style: "atlas", sprite: "clinic", color: "mat_neon_green", w: 1.5, h: 1.5 }) },
    { suffix: "_icon", seed: 46, params: mk(boardBase, { style: "icon", icon: "eye", color: "mat_neon_purple", color2: "mat_neon_cyan", w: 1.6, h: 1.6 }) },
  ],
  build(b, r, p) {
    S.wallSign(b, r, p);
    light(b, [0, p.h / 2, 0.6], p.color ?? "mat_neon_cyan", 0.9, 8);
  },
};

// ---- lantern cluster ----------------------------------------------------------------------------------
const lanterns = {
  id: "sign_noodle_lanterns",
  category: "sign",
  tags: ["sign:wall", "sign:lantern"],
  budget: 400,
  params: { word: "ラーメン", color: "mat_neon_red" },
  variants: [
    { suffix: "_red", seed: 51, params: { word: "ラーメン", color: "mat_neon_red" } },
    { suffix: "_amber", seed: 52, params: { word: "サケ", color: "mat_neon_amber" } },
  ],
  build(b, r, { word, color }) {
    const chars = [...word];
    const step = 0.62;
    const total = (chars.length - 1) * step;
    // wall rail with short cords
    b.box(DARK, [-total / 2 - 0.35, 2.55, 0], [total / 2 + 0.35, 2.62, 0.5], { skip: ["b", "s"] });
    chars.forEach((ch, i) => {
      const x = vr((i - (chars.length - 1) / 2) * step);
      b.with({ pos: [x, 0, 0.3] }, () => {
        b.cylinder(DARK, { y0: 2.4, y1: 2.52, r: 0.12, seg: 6, cap: "top" });
        b.lathe(color, [[0.13, 1.78], [0.24, 2.1], [0.13, 2.4]], { seg: 6, crease: 80 });
        b.cylinder(DARK, { y0: 1.7, y1: 1.78, r: 0.13, seg: 6, cap: "bottom" });
        b.box(DARK, [-0.01, 2.52, -0.01], [0.01, 2.56, 0.01], { skip: [] });
        b.with({ pos: [0, 1.93, 0.245] }, () => S.neonText(b, r, { text: ch, h: 0.34, color: DARK, weight: 0.8 }));
      });
    });
    light(b, [0, 2.1, 0.5], color, 0.9, 6);
  },
};

// ---- arrows ------------------------------------------------------------------------------------------------
const arrowSign = {
  id: "sign_neon_arrow",
  category: "sign",
  tags: ["sign:wall", "sign:arrow"],
  budget: 400,
  params: { dir: 1, color: "mat_neon_amber", color2: "mat_neon_red", text: "OPEN" },
  variants: [
    { suffix: "_right", seed: 61, params: { dir: 1, color: "mat_neon_amber", color2: "mat_neon_red", text: "OPEN" } },
    { suffix: "_left", seed: 62, params: { dir: -1, color: "mat_neon_cyan", color2: "mat_neon_magenta", text: "BAR" } },
  ],
  build(b, r, { dir, color, color2, text }) {
    const w = 3.0, h = 1.6;
    panel(b, w, h, 0.1);
    b.with({ pos: [0, 0.07, 0.1] }, () => {
      S.neonFrame(b, r, { w: w - 0.16, h: h - 0.14, t: 0.04, color: color2 });
      const a = (x, y) => [x * dir, y + 0.08];
      S.neonLine(b, r, [a(-1.25, 0.26), a(0.25, 0.26), a(0.25, 0.04), a(1.25, 0.4), a(0.25, 0.76), a(0.25, 0.54), a(-1.25, 0.54)], { color, closed: true, t: 0.05 });
    });
    b.with({ pos: [0, 1.0, 0.1] }, () => S.neonText(b, r, { text, h: 0.34, color: color2, weight: 0.55, maxW: 2.4 }));
    light(b, [0, h / 2, 0.6], color, 0.9, 7);
  },
};

// ---- rooftop ----------------------------------------------------------------------------------------------------
const roofCorp = {
  id: "sign_roof_corp",
  category: "sign",
  tags: ["sign:roof"],
  budget: 400,
  params: { w: 8, h: 3, style: "corp", text: "KIRO", color: "mat_neon_cyan", color2: "mat_neon_white" },
  variants: [
    { suffix: "_a", seed: 71, params: { w: 8, h: 3, style: "corp", text: "KIRO", color: "mat_neon_cyan", color2: "mat_neon_white" } },
    { suffix: "_b", seed: 72, params: { w: 10, h: 3.2, style: "corp", text: "ORBITAL", color: "mat_neon_magenta", color2: "mat_neon_cyan" } },
    { suffix: "_c", seed: 73, params: { w: 7, h: 2.6, style: "word", text: "NEXUS", color: "mat_neon_red", color2: "mat_neon_amber" } },
    { suffix: "_d", seed: 74, params: { w: 9, h: 3, style: "word", text: "HOTEL", color: "mat_neon_amber", color2: "mat_neon_red" } },
  ],
  build(b, r, p) {
    S.roofSign(b, r, p);
  },
};

// ---- billboards --------------------------------------------------------------------------------------------------------
const billboardSmall = {
  id: "sign_billboard_frame",
  category: "sign",
  tags: ["sign:billboard"],
  budget: 900,
  params: { w: 8, h: 4, sprite: "ad_solaris_hero" },
  variants: [
    // panel aspect = sprite aspect: 4:1 wide, 2:1 hero, 1:2 tall
    { suffix: "_wide", seed: 81, params: { w: 8, h: 2, sprite: "ad_neon_cola_wide" } },
    { suffix: "_hero", seed: 82, params: { w: 8, h: 4, sprite: "ad_solaris_hero" } },
    { suffix: "_tall", seed: 83, params: { w: 2.6, h: 5.2, sprite: "ad_halcyon_tall" } },
    { suffix: "_single", seed: 84, params: { w: 5, h: 2.5, sprite: "ad_kaisen_noodle_01" } },
  ],
  build(b, r, p) {
    S.billboard(b, r, p);
  },
};

const billboardPole = {
  id: "sign_billboard_pole",
  category: "sign",
  tags: ["sign:billboard", "sign:pole"],
  budget: 900,
  params: { w: 8, h: 4, a: "ad_vortex_hero", back: "ad_solaris_hero" },
  variants: [
    { suffix: "_a", seed: 91, params: { w: 8, h: 4, a: "ad_vortex_hero", back: "ad_solaris_hero" } },
    { suffix: "_b", seed: 92, params: { w: 10, h: 5, a: "ad_aurum_bank_01", back: "ad_chrome_clinic_01" } },
  ],
  build(b, r, { w, h, a, back }) {
    const poleH = 7;
    b.lathe(GALV, [[0.45, 0], [0.38, 0.4], [0.3, poleH + h * 0.5]], { seg: 8, crease: 80 });
    const y0 = poleH;
    b.box(DARK, [-w / 2, y0, -0.3], [w / 2, y0 + h, 0.3], { skip: ["b"] });
    // both faces
    const face = (sprite) => {
      b.quad("mat_atlas_billboard", [w / 2 - 0.15, y0 + 0.15, 0.31], [-w / 2 + 0.15, y0 + 0.15, 0.31], [-w / 2 + 0.15, y0 + h - 0.15, 0.31], [w / 2 - 0.15, y0 + h - 0.15, 0.31], {
        uv: spriteRectFor(sprite),
      });
    };
    // viewer at +Z looks toward -Z: his left is +X, so the corners above go +X first
    face(a);
    b.with({ rotY: Math.PI }, () => face(back));
    // catwalk under the sign with rail posts
    b.box(DARK, [-w / 2 - 0.3, y0 - 0.12, 0.3], [w / 2 + 0.3, y0 - 0.04, 1.0], { skip: [] });
    const n = Math.round(w / 1.6);
    for (let i = 0; i <= n; i++) {
      const x = -w / 2 - 0.3 + ((w + 0.6) * i) / n;
      b.box(GALV, [x - 0.02, y0 - 0.04, 0.96], [x + 0.02, y0 + 0.9, 1.0], { skip: ["b", "t", "n", "s"] });
    }
    b.box(GALV, [-w / 2 - 0.3, y0 + 0.86, 0.95], [w / 2 + 0.3, y0 + 0.92, 1.01], { skip: ["b", "n"] });
    // lamps on top
    const lamps = Math.max(2, Math.round(w / 2.6));
    for (let i = 0; i < lamps; i++) {
      const x = -w / 2 + (w * (i + 0.5)) / lamps;
      b.box(GALV, [x - 0.02, y0 + h, 0.3], [x + 0.02, y0 + h + 0.4, 0.9], { skip: ["b", "s", "n"] });
      b.box("mat_neon_white", [x - 0.14, y0 + h + 0.36, 0.8], [x + 0.14, y0 + h + 0.44, 1.2], { skip: ["b"] });
    }
    b.anchor("light.sign", [0, y0 + h / 2, 2.0], { color: "#cfe8ff", intensity: 1.2, range: 18 });
    b.collider({ c: [0, poleH / 2, 0], h: [0.4, poleH / 2, 0.4] });
  },
};

// ---- LED wall --------------------------------------------------------------------------------------------------------------------
const ledWall = {
  id: "sign_led_wall",
  category: "sign",
  tags: ["sign:wall", "sign:led"],
  budget: 400,
  params: { w: 4.8, h: 3, bars: 14, mode: "eq" },
  variants: [
    { suffix: "_eq", seed: 101, params: { w: 4.8, h: 3, bars: 14, mode: "eq" } },
    { suffix: "_ad", seed: 102, params: { w: 4.8, h: 2.4, bars: 0, mode: "ad", sprite: "ad_news_01" } },
  ],
  build(b, r, { w, h, bars, mode, sprite }) {
    b.box(DARK, [-w / 2, 0, 0], [w / 2, h, 0.15], { skip: ["b", "s"] });
    if (mode === "ad") {
      // billboard-atlas ads are 2:1; the panel is sized to match
      b.with({ pos: [0, 0.1, 0.15] }, () => {
        S.atlasPanel(b, r, { w: w - 0.2, h: h - 0.2, sprite, atlas: "mat_atlas_billboard" });
        S.neonFrame(b, r, { w: w - 0.2, h: h - 0.2, t: 0.04, color: "mat_neon_cyan" });
      });
      light(b, [0, h / 2, 0.6], "mat_neon_cyan", 1, 9);
      return;
    }
    const cols = ["mat_neon_cyan", "mat_neon_magenta", "mat_neon_purple"];
    const bw = (w - 0.4) / bars;
    for (let i = 0; i < bars; i++) {
      const x0 = -w / 2 + 0.2 + i * bw;
      const bh = (h - 0.5) * (0.25 + 0.75 * r());
      b.with({ pos: [0, 0, 0.16] }, () => {
        b.quad(cols[i % cols.length], [x0 + bw * 0.85, 0.2, 0], [x0 + bw * 0.1, 0.2, 0], [x0 + bw * 0.1, 0.2 + bh, 0], [x0 + bw * 0.85, 0.2 + bh, 0], { uv: "unit" });
      });
    }
    light(b, [0, h / 2, 0.6], "mat_neon_magenta", 1, 9);
  },
};

// ---- cross-street banner --------------------------------------------------------------------------------------------------------
const crossBanner = {
  id: "sign_banner_cross_street",
  category: "sign",
  tags: ["sign:banner", "span"],
  budget: 400,
  params: { span: 14, w: 10, h: 2.5, sprite: "ad_zenkai_banner" },
  variants: [
    { suffix: "_a", seed: 111, params: { span: 14, w: 10, h: 2.5, sprite: "ad_zenkai_banner" } },
    { suffix: "_b", seed: 112, params: { span: 16, w: 11, h: 2.75, sprite: "ad_neon_cola_wide" } },
  ],
  build(b, r, { span, w, h, sprite }) {
    const topY = h + 0.5;
    const cableY = (x) => {
      const t = x / span + 0.5;
      return topY + 0.55 * (1 - 4 * t * (1 - t));
    };
    // two cables with a slight sag, ending in wall plates at +-span/2 (origin = banner bottom centre)
    for (const dz of [-0.04, 0.04]) {
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const x = (i / 6 - 0.5) * span;
        pts.push([x, cableY(x), dz]);
      }
      b.tube(DARK, { pts, r: 0.03, seg: 3, cap: false });
    }
    for (const sx of [-1, 1]) b.box(GALV, [(sx * span) / 2 - 0.1, topY - 0.1, -0.15], [(sx * span) / 2 + 0.1, topY + 0.7, 0.15], { skip: ["b"] });
    const y0 = 0, y1 = h;
    for (const rot of [0, Math.PI]) {
      b.with({ rotY: rot }, () => b.quad("mat_atlas_billboard", [w / 2, y0, 0.01], [-w / 2, y0, 0.01], [-w / 2, y1, 0.01], [w / 2, y1, 0.01], { uv: spriteRectFor(sprite) }));
    }
    b.box(DARK, [-w / 2, y0, -0.01], [w / 2, y1, 0.01], { skip: ["t", "b", "n", "s"] });
    for (const x of [-w / 2 + 0.2, -w / 6, w / 6, w / 2 - 0.2]) b.box(DARK, [x - 0.015, y1, -0.015], [x + 0.015, cableY(x), 0.015], { skip: ["b", "t"] });
    b.anchor("light.sign", [0, h / 2, 1.5], { color: "#ffb870", intensity: 0.8, range: 12 });
  },
};

// ---- themed pieces -------------------------------------------------------------------------------------------------------------------
const hotelVertical = {
  id: "sign_hotel_vertical",
  category: "sign",
  tags: ["sign:wall", "sign:vertical"],
  budget: 400,
  params: { color: "mat_neon_amber", color2: "mat_neon_red", text: "HOTEL" },
  variants: [
    { suffix: "_a", seed: 121, params: { color: "mat_neon_amber", color2: "mat_neon_red", text: "HOTEL" } },
    { suffix: "_b", seed: 122, params: { color: "mat_neon_cyan", color2: "mat_neon_magenta", text: "MOTEL" } },
  ],
  build(b, r, { color, color2, text }) {
    const w = 1.5, h = 6.2;
    panel(b, w, h);
    // star row, vertical letters, kana strip
    b.with({ pos: [0, h - 0.9, 0.126] }, () => {
      for (const x of [-0.42, 0, 0.42]) b.with({ pos: [x, 0, 0] }, () => S.neonIcon(b, r, "star", { size: 0.36, color: color2 }));
    });
    b.with({ pos: [0, h - 1.2, 0.126] }, () => S.neonText(b, r, { text, h: 0.62, color, vertical: true }));
    b.with({ pos: [0, 0.18, 0.126] }, () => S.neonFrame(b, r, { w: w - 0.3, h: h - 0.36, t: 0.04, color: color2 }));
    light(b, [0, h / 2, 0.8], color, 1.1, 9);
  },
};

const barCocktail = {
  id: "sign_bar_cocktail",
  category: "sign",
  tags: ["sign:wall", "sign:bar"],
  budget: 400,
  params: { color: "mat_neon_magenta", color2: "mat_neon_cyan", text: "BAR" },
  variants: [
    { suffix: "_a", seed: 131, params: { color: "mat_neon_magenta", color2: "mat_neon_cyan", text: "BAR" } },
    { suffix: "_b", seed: 132, params: { color: "mat_neon_amber", color2: "mat_neon_green", text: "LOUNGE" } },
  ],
  build(b, r, { color, color2, text }) {
    const w = 2.6, h = 1.6;
    panel(b, w, h);
    b.with({ pos: [vr(-0.75), 0.2, 0.126] }, () => S.neonIcon(b, r, "cocktail", { size: 1.15, color }));
    b.with({ pos: [vr(0.5), 0.45, 0.126] }, () => S.neonText(b, r, { text, h: 0.5, color: color2, maxW: 1.4 }));
    b.with({ pos: [0, 0.1, 0.126] }, () => S.neonFrame(b, r, { w: w - 0.2, h: h - 0.2, t: 0.04, color }));
    light(b, [0, h / 2, 0.7], color, 1, 8);
  },
};

const pharmacy = {
  id: "sign_pharmacy_cross",
  category: "sign",
  tags: ["sign:blade", "sign:pharmacy"],
  budget: 400,
  params: { color: "mat_neon_green", size: 1.2 },
  variants: [
    { suffix: "_a", seed: 141, params: { color: "mat_neon_green", size: 1.2 } },
    { suffix: "_b", seed: 142, params: { color: "mat_neon_cyan", size: 1.0 } },
  ],
  build(b, r, { color, size }) {
    const proj = 0.8;
    b.box(GALV, [-0.03, -0.1, 0], [0.03, -0.04, proj + size / 2], { skip: ["b"] });
    b.box(DARK, [-0.05, -size - 0.1, proj], [0.05, -0.1, proj + size], { skip: ["b"] });
    // icons face +X / -X (rotY = compass heading of the viewer-facing side)
    for (const sgn of [1, -1]) {
      b.with({ pos: [sgn * 0.06, -size - 0.1, proj + size / 2], rotY: sgn > 0 ? Math.PI / 2 : -Math.PI / 2 }, () => {
        b.with({ pos: [0, size * 0.04, 0] }, () => S.neonIcon(b, r, "ring", { size: size * 0.92, color: "mat_neon_white" }));
        b.with({ pos: [0, size * 0.225, 0] }, () => S.neonIcon(b, r, "cross", { size: size * 0.55, color }));
      });
    }
    light(b, [0, -size / 2, proj + size / 2], color, 0.9, 8);
  },
};

const arcade = {
  id: "sign_arcade",
  category: "sign",
  tags: ["sign:wall", "sign:arcade"],
  budget: 400,
  params: { color: "mat_neon_magenta", color2: "mat_neon_cyan", text: "ARCADE" },
  variants: [
    { suffix: "_a", seed: 151, params: { color: "mat_neon_magenta", color2: "mat_neon_cyan", text: "ARCADE" } },
    { suffix: "_b", seed: 152, params: { color: "mat_neon_green", color2: "mat_neon_amber", text: "GAMES" } },
  ],
  build(b, r, { color, color2, text }) {
    const w = 3.8, h = 1.3;
    panel(b, w, h);
    b.with({ pos: [0, 0.34, 0.126] }, () => S.neonText(b, r, { text, h: 0.6, color, maxW: 2.2 }));
    for (const sx of [-1, 1]) b.with({ pos: [sx * 1.5, 0.32, 0.126] }, () => S.neonIcon(b, r, "invader", { size: 0.7, color: color2 }));
    b.with({ pos: [0, 0.1, 0.126] }, () => S.neonFrame(b, r, { w: w - 0.2, h: h - 0.2, t: 0.04, color: color2 }));
    light(b, [0, h / 2, 0.7], color, 1, 8);
  },
};

const clinic = {
  id: "sign_clinic",
  category: "sign",
  tags: ["sign:wall", "sign:clinic"],
  budget: 400,
  params: { color: "mat_neon_cyan", color2: "mat_neon_white", text: "CLINIC", kanji: "医" },
  variants: [
    { suffix: "_a", seed: 161, params: { color: "mat_neon_cyan", color2: "mat_neon_white", text: "CLINIC", kanji: "医" } },
    { suffix: "_b", seed: 162, params: { color: "mat_neon_green", color2: "mat_neon_cyan", text: "IMPLANTS", kanji: "薬" } },
  ],
  build(b, r, { color, color2, text, kanji }) {
    const w = 3.4, h = 1.4;
    panel(b, w, h);
    b.with({ pos: [vr(-1.2), 0.22, 0.126] }, () => S.neonIcon(b, r, "crossOutline", { size: 0.95, color }));
    b.with({ pos: [vr(0.35), 0.78, 0.126] }, () => S.neonText(b, r, { text: kanji, h: 0.42, color: color2 }));
    b.with({ pos: [vr(0.45), 0.25, 0.126] }, () => S.neonText(b, r, { text, h: 0.4, color, maxW: 1.9 }));
    b.with({ pos: [0, 0.08, 0.126] }, () => S.neonFrame(b, r, { w: w - 0.16, h: h - 0.16, t: 0.035, color: color2 }));
    light(b, [0, h / 2, 0.7], color, 1, 8);
  },
};

const openWindow = {
  id: "sign_open_window",
  category: "sign",
  tags: ["sign:wall", "sign:small"],
  budget: 400,
  params: { color: "mat_neon_red", color2: "mat_neon_cyan", text: "OPEN" },
  variants: [
    { suffix: "_a", seed: 171, params: { color: "mat_neon_red", color2: "mat_neon_cyan", text: "OPEN" } },
    { suffix: "_b", seed: 172, params: { color: "mat_neon_green", color2: "mat_neon_amber", text: "24H" } },
  ],
  build(b, r, { color, color2, text }) {
    const w = 1.0, h = 0.42;
    panel(b, w, h, 0.06);
    b.with({ pos: [0, 0.09, 0.066] }, () => S.neonText(b, r, { text, h: 0.24, color, maxW: 0.76 }));
    b.with({ pos: [0, 0.03, 0.066] }, () => S.neonFrame(b, r, { w: w - 0.06, h: h - 0.06, t: 0.02, color: color2 }));
    light(b, [0, h / 2, 0.4], color, 0.5, 4);
  },
};

const warning = {
  id: "sign_warning_plate",
  category: "sign",
  tags: ["sign:post", "sign:warning"],
  budget: 400,
  params: { sprite: "hazard_stripes" },
  variants: [
    { suffix: "_hazard", seed: 181, params: { sprite: "hazard_stripes" } },
    { suffix: "_triangle", seed: 182, params: { sprite: "warning_triangle" } },
    { suffix: "_noentry", seed: 183, params: { sprite: "no_entry" } },
  ],
  build(b, r, { sprite }) {
    b.cylinder(GALV, { y0: 0, y1: 2.2, r: 0.04, seg: 6, cap: "top" });
    b.with({ pos: [0, 1.55, 0.06], rotY: 0 }, () => {
      b.box(DARK, [-0.4, 0, -0.04], [0.4, 0.8, 0.0], { skip: ["b", "n"] });
      b.with({ pos: [0, 0, 0.0] }, () => S.atlasPanel(b, r, { w: 0.72, h: 0.72, sprite }));
    });
    b.collider({ c: [0, 1.1, 0], h: [0.05, 1.1, 0.05] });
  },
};

const karaoke = {
  id: "sign_karaoke_stack",
  category: "sign",
  tags: ["sign:blade", "sign:stack"],
  budget: 400,
  params: {},
  build(b, r) {
    S.bladeSign(b, r, { w: 0.8, h: 2.4, proj: 0.9, style: "atlas", sprite: "vertical_sign_3", color: "mat_neon_magenta" });
    b.with({ pos: [0, -2.5, 0] }, () => S.bladeSign(b, r, { w: 0.9, h: 1.6, proj: 0.9, style: "kana", text: "カラオケ", color: "mat_neon_cyan", color2: "mat_neon_magenta" }));
    b.with({ pos: [0, -4.2, 0] }, () => S.bladeSign(b, r, { w: 0.9, h: 0.9, proj: 0.9, style: "atlas", sprite: "karaoke", color: "mat_neon_amber" }));
    light(b, [0, -2.5, 1.4], "mat_neon_magenta", 1, 9);
  },
};

const capsule = {
  id: "sign_capsule_hotel",
  category: "sign",
  tags: ["sign:wall", "sign:hotel"],
  budget: 400,
  params: {},
  build(b, r) {
    S.wallSign(b, r, { w: 3.6, h: 1.2, style: "atlas", sprite: "wide_hotel", color: "mat_neon_cyan" });
    b.with({ pos: [1.8, -0.1, 0] }, () => S.neonStrip(b, r, { len: 3.6, color: "mat_neon_magenta", axis: "x" }));
    light(b, [0, 0.6, 0.7], "mat_neon_cyan", 1, 8);
  },
};

const holoFrame = {
  id: "sign_holo_billboard",
  category: "sign",
  tags: ["sign:billboard", "sign:holo"],
  budget: 900,
  params: { w: 2.4, h: 2.4, sprite: "hologram_girl", atlas: "mat_atlas_signs", color: "mat_neon_cyan" },
  variants: [
    { suffix: "_a", seed: 191, params: { w: 2.4, h: 2.4, sprite: "hologram_girl", atlas: "mat_atlas_signs", color: "mat_neon_cyan" } },
    { suffix: "_b", seed: 192, params: { w: 4.0, h: 2.0, sprite: "ad_hologirl_01", atlas: "mat_atlas_billboard", color: "mat_neon_magenta" } },
    { suffix: "_c", seed: 193, params: { w: 2.4, h: 2.4, sprite: "neon_dragon", atlas: "mat_atlas_signs", color: "mat_neon_purple" } },
    { suffix: "_d", seed: 194, params: { w: 4.0, h: 2.0, sprite: "ad_glitch_01", atlas: "mat_atlas_billboard", color: "mat_neon_cyan" } },
  ],
  build(b, r, { w, h, sprite, atlas, color }) {
    // emitter base: two slim posts with glowing feet, the panel floats above and shows the same art from both sides
    for (const sx of [-1, 1]) {
      b.box(DARK, [sx * (w / 2 - 0.3) - 0.07, 0, -0.07], [sx * (w / 2 - 0.3) + 0.07, 1.4, 0.07], { skip: ["b"] });
      b.box(color, [sx * (w / 2 - 0.3) - 0.1, 1.4, -0.1], [sx * (w / 2 - 0.3) + 0.1, 1.46, 0.1], { skip: ["b"] });
      b.box(color, [sx * (w / 2 - 0.3) - 0.1, 0.04, -0.1], [sx * (w / 2 - 0.3) + 0.1, 0.1, 0.1], { skip: ["b"] });
    }
    b.with({ pos: [0, 1.6, 0] }, () => S.holoPanel(b, r, { w, h, sprite, atlas, color }));
    b.with({ pos: [0, 1.6, 0], rotY: Math.PI }, () => S.holoPanel(b, r, { w, h, sprite, atlas, color }));
    light(b, [0, 1.6 + h / 2, 1.0], color, 1.2, 9);
  },
};

const accentStrips = {
  id: "sign_accent_lines",
  category: "sign",
  tags: ["sign:strip"],
  budget: 400,
  params: {},
  build(b, r) {
    // a corner trim: horizontal + vertical neon tubes, plus a short double line
    S.neonStrip(b, r, { len: 4, color: "mat_neon_cyan", axis: "x" });
    b.with({ pos: [0, 0.2, 0] }, () => S.neonStrip(b, r, { len: 4, color: "mat_neon_magenta", axis: "x" }));
    b.with({ pos: [-2, 0, 0] }, () => S.neonStrip(b, r, { len: 3, color: "mat_neon_cyan", axis: "y" }));
    b.with({ pos: [2, 0, 0] }, () => S.neonStrip(b, r, { len: 3, color: "mat_neon_magenta", axis: "y" }));
  },
};

// Billboard sprite UV helper (the atlas module resolves names; kept here to avoid a second import style).
import { spriteRect } from "../lib/atlas.mjs";
function spriteRectFor(name) {
  return spriteRect("mat_atlas_billboard", name);
}

export const assets = [
  bladeKana, bladeLatin, bladeAtlas, shopBoard, lanterns, arrowSign, roofCorp, billboardSmall, billboardPole,
  ledWall, crossBanner, hotelVertical, barCocktail, pharmacy, arcade, clinic, openWindow, warning, karaoke,
  capsule, holoFrame, accentStrips,
];

void TAU;
