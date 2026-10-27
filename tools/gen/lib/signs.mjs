// Sign helpers shared by buildings, props and the city layout. The signs work package owns the
// internals; the SIGNATURES below are the contract other recipes call, so keep them stable.
//
// Everything draws at the current builder transform. Local +Z points AWAY from the wall the
// sign is mounted on (the direction people read it from), +Y is up.
//
//   wallSign(b, r, { w, h, color })          flat lit panel flush on a wall; origin = bottom centre on the wall surface
//   bladeSign(b, r, { w, h, proj, color })   vertical double-sided blade on a short arm; origin = top, on the wall surface; extends +Z by `proj`
//   roofSign(b, r, { w, h, color })          big sign on posts standing on a roof; origin = bottom centre
//   billboard(b, r, { w, h, sprite, theme })  ad panel on a frame with an atlas sprite; origin = bottom centre.
//       Without `sprite` the ad whose aspect is closest to w:h is picked (hero/singles 2:1, wide 4:1, tall 1:2).
//   neonStrip(b, r, { len, color, axis })    plain neon tube, axis "x" | "y" | "z"; origin = start point
//
// `color` is a neon material id (mat_neon_*), or omitted to pick one at random.
//
// Handedness gotcha: a sign that faces +Z is read from the north looking south, so in the
// builder's world the viewer's RIGHT is -X (and text runs toward -X). The helpers below handle
// that internally; only when you offset several pieces side by side do you need `b.with({ pos: [-xRight, y, z] })`.
//
// Additions (same conventions, all optional options):
//   wallSign / bladeSign / roofSign also take { color2, text, style, sprite, icon }.
//     wallSign styles : "neon" | "board" | "bar" | "atlas" | "icon"
//     bladeSign styles: "kana" | "latin" | "atlas" | "icon"
//     roofSign styles : "corp" | "word"
//   neonText(b, r, { text, h, color, align, vertical, weight, maxW })  neon-tube lettering; origin = baseline
//       centre (align "left": left end, "right": right end; vertical: top centre), faces +Z. maxW shrinks
//       the text to fit. Returns { w, h }. `color` may be any material id (dark letters on a lit lantern, say).
//   neonIcon(b, r, name, { size, color, color2 })   one of ICON_NAMES, origin = bottom centre, faces +Z.
//   neonFrame(b, r, { w, h, t, color })             hollow neon rectangle, origin = bottom centre, faces +Z.
//   neonLine(b, r, pts, { color, t, closed })       neon tube along a polyline [[x, y], ...] in the sign plane
//       (x to the viewer's right, y up, origin = bottom centre), faces +Z.
//   neonRect(b, r, { w, h, color })                 solid emissive rectangle, origin = bottom centre, faces +Z.
//   atlasPanel(b, r, { w, h, sprite, atlas, kind })  flat emissive atlas quad, origin = bottom centre, faces +Z.
//   holoPanel(b, r, { w, h, sprite, color, atlas })  floating atlas panel with corner brackets.
//   Painted content (style "atlas") takes `kind` ("ramen" | "food" | "bar" | "hotel" | "clinic" | "arcade" | "night" |
//   "shop" | "bank" | "taxi" | "neon" | "arrow" | "warn" | "glyph", or guessed from `text`) to pick sprites that suit it.
//   Sprites come from public/textures/atlas/*.json (see docs/atlas.md); sprite names are checked, typos throw.
//   randomWord(r, bank), textWidth(text, h), pickPair(r, c1, c2), NEON, ICON_NAMES.

import { TAU } from "./math.mjs";
import { MATERIALS } from "./materials.mjs";
import { glyph, ICONS, SPACING, textUnits, WORDS } from "./signs_font.mjs";
import { spriteRect, spriteAspect } from "./atlas.mjs";
import { pickSignSprite, pickBillboardSprite, kindOfText, fitRect, SQUARE } from "./signs_sprites.mjs";

export const NEON = ["mat_neon_cyan", "mat_neon_magenta", "mat_neon_amber", "mat_neon_green", "mat_neon_red", "mat_neon_purple"];
export const ICON_NAMES = Object.keys(ICONS);

const PAIRS = [
  ["mat_neon_cyan", "mat_neon_magenta"],
  ["mat_neon_amber", "mat_neon_red"],
  ["mat_neon_green", "mat_neon_cyan"],
  ["mat_neon_purple", "mat_neon_magenta"],
  ["mat_neon_white", "mat_neon_red"],
  ["mat_neon_cyan", "mat_neon_white"],
  ["mat_neon_amber", "mat_neon_green"],
  ["mat_neon_magenta", "mat_neon_amber"],
  ["mat_neon_red", "mat_neon_white"],
  ["mat_neon_magenta", "mat_neon_cyan"],
];

const BODY = "mat_metal_painted_dark";
const FRAME = "mat_metal_galvanized";

/** Main and accent neon material for a sign. */
export function pickPair(r, c1, c2) {
  const p = r.pick(PAIRS);
  const a = c1 ?? p[0];
  let b = c2 ?? (c1 ? r.pick(NEON.filter((n) => n !== c1)) : p[1]);
  if (b === a) b = p[1] === a ? p[0] : p[1];
  return [a, b];
}

export const randomWord = (r, bank = "shop") => r.pick(WORDS[bank] ?? WORDS.shop);
export const textWidth = (text, h) => (textUnits(text) * h) / 6;

/** Light anchor colour for a neon material id. */
export const neonHex = (id) => MATERIALS[id]?.emissive ?? "#ffffff";

// ---- low-level drawing in the READER frame -------------------------------------------------
// Reader frame: the viewer looks along +Z, x to the right, y up, z negative toward the viewer.
// Public functions enter it with rotY(pi), which turns "face toward +Z" into the documented
// convention (viewer on +Z side of the sign). All quads below are bottom-left, bottom-right,
// top-right, top-left as seen by that viewer.

const reader = (b, fn) => b.with({ rotY: Math.PI }, fn);

function strokeSeg(b, mat, p, q, t, z) {
  const dx = q[0] - p[0], dy = q[1] - p[1];
  const L = Math.hypot(dx, dy);
  if (L < 1e-6) return;
  const ux = dx / L, uy = dy / L;
  const e = t * 0.45; // overshoot closes the joints between segments
  const nx = (-uy * t) / 2, ny = (ux * t) / 2;
  const ax = p[0] - ux * e, ay = p[1] - uy * e, bx = q[0] + ux * e, by = q[1] + uy * e;
  b.quad(mat, [ax - nx, ay - ny, z], [bx - nx, by - ny, z], [bx + nx, by + ny, z], [ax + nx, ay + ny, z], { uv: "unit" });
}

function rect(b, mat, x0, y0, x1, y1, z) {
  b.quad(mat, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], { uv: "unit" });
}

/** Draw a glyph / icon at grid origin (x, y) with `s` metres per grid unit and stroke width `t`. */
function shape(b, mat, g, x, y, s, t, z, fillMat = mat) {
  for (const line of g.s ?? []) {
    for (let i = 0; i + 1 < line.length; i++) {
      strokeSeg(b, mat, [x + line[i][0] * s, y + line[i][1] * s], [x + line[i + 1][0] * s, y + line[i + 1][1] * s], t, z);
    }
  }
  for (const f of g.f ?? []) rect(b, fillMat, x + f[0] * s, y + f[1] * s, x + f[2] * s, y + f[3] * s, z);
}

/** Horizontal text in the reader frame; `cx` = centre x, `y` = baseline. Returns the width. */
function text(b, mat, str, cx, y, h, z, { align = "center", weight = 0.55, maxW } = {}) {
  let s = h / 6;
  let width = textUnits(str) * s;
  if (maxW && width > maxW) {
    s *= maxW / width;
    width = maxW;
  }
  const t = s * 6 * 0.08 * (weight / 0.55) + 0.004;
  let x = align === "left" ? cx : align === "right" ? cx - width : cx - width / 2;
  for (const ch of str) {
    const g = glyph(ch);
    shape(b, mat, g, x, y, s, t, z);
    x += (g.w + SPACING) * s;
  }
  return width;
}

/** Vertical stack of glyphs, top centre `cx`, `top` y; each glyph `h` tall. Returns total height. */
function vtext(b, mat, str, cx, top, h, z, weight = 0.55) {
  const s = h / 6;
  const t = h * 0.08 * (weight / 0.55) + 0.004;
  let y = top;
  for (const ch of str) {
    const g = glyph(ch);
    y -= h;
    shape(b, mat, g, cx - (g.w * s) / 2, y, s, t, z);
    y -= h * 0.28;
  }
  return top - y - h * 0.28;
}

function frame(b, mat, x0, y0, x1, y1, t, z) {
  rect(b, mat, x0, y0, x1, y0 + t, z);
  rect(b, mat, x0, y1 - t, x1, y1, z);
  rect(b, mat, x0, y0 + t, x0 + t, y1 - t, z);
  rect(b, mat, x1 - t, y0 + t, x1, y1 - t, z);
}

function atlasQuad(b, atlas, sprite, x0, y0, x1, y1, z) {
  b.quad(atlas, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], { uv: spriteRect(atlas, sprite) });
}

function icon(b, mat, name, cx, y, size, z, fillMat = mat) {
  const g = ICONS[name];
  if (!g) throw new Error(`unknown icon "${name}"`);
  const s = size / 6;
  shape(b, mat, g, cx - (g.w * s) / 2, y, s, size * 0.085 + 0.004, z, fillMat);
}

/** Pick a word from a bank that fits `maxW` at height `h` (shrinking down to 70%); falls back to the shortest. */
function fitWord(r, bank, maxW, h) {
  const words = WORDS[bank] ?? WORDS.shop;
  for (let i = 0; i < 8; i++) {
    const w = r.pick(words);
    if (textWidth(w, h) <= maxW) return w;
    if (textWidth(w, h * 0.7) <= maxW) return w;
  }
  return [...words].sort((a, c) => a.length - c.length)[0];
}

// ---- generic content painter -------------------------------------------------------------------
// Paints neon lettering / icons / atlas sprite inside a rectangle of the reader frame.

function paint(b, r, rc, z, spec) {
  const { x0, y0, x1, y1 } = rc;
  const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2;
  const { c1, c2, style } = spec;
  const ft = Math.min(0.07, Math.max(0.025, Math.min(w, h) * 0.05));
  switch (style) {
    case "neon": {
      frame(b, c1, x0 + ft * 1.2, y0 + ft * 1.2, x1 - ft * 1.2, y1 - ft * 1.2, ft, z);
      const th = h * 0.5;
      const word = spec.text ?? fitWord(r, "shop", w * 0.84, th);
      const hasSub = h >= 1.3 && !spec.text;
      const ty = hasSub ? y0 + h * 0.45 : y0 + (h - th) / 2;
      text(b, c2, word, cx, ty, hasSub ? h * 0.32 : th, z, { maxW: w * 0.84 });
      if (hasSub) text(b, c1, randomWord(r, "kana"), cx, y0 + h * 0.14, h * 0.2, z, { maxW: w * 0.8 });
      break;
    }
    case "board": {
      rect(b, c2, x0 + w * 0.06, y1 - h * 0.12, x1 - w * 0.06, y1 - h * 0.12 + ft, z);
      rect(b, c2, x0 + w * 0.06, y0 + h * 0.12 - ft, x1 - w * 0.06, y0 + h * 0.12, z);
      const th = h * 0.42;
      const word = spec.text ?? fitWord(r, "shop", w * 0.86, th);
      text(b, c1, word, cx, y0 + (h - th) / 2, th, z, { maxW: w * 0.86 });
      break;
    }
    case "bar": {
      const ih = h * 0.62;
      icon(b, c1, spec.icon ?? r.pick(["cocktail", "bowl", "star", "bolt", "moon", "eye", "chip", "heart"]), x0 + ih * 0.7, y0 + (h - ih) / 2, ih, z);
      const word = spec.text ?? fitWord(r, "short", w - ih * 1.7, h * 0.46);
      text(b, c2, word, x0 + ih * 1.5, y0 + h * 0.26, h * 0.46, z, { align: "left", maxW: w - ih * 1.8 });
      rect(b, c1, x0 + w * 0.05, y0 + h * 0.08, x1 - w * 0.05, y0 + h * 0.08 + ft, z);
      break;
    }
    case "atlas": {
      // Painted content: the sprite keeps its intended aspect (square art, ~1:3 vertical_sign_*, ~3:1 wide_*);
      // the panel shows it letterboxed with a neon frame around the art.
      const m = Math.min(w, h) * 0.06;
      const inner = { x0: x0 + m, y0: y0 + m, x1: x1 - m, y1: y1 - m };
      const sprite = spec.sprite ?? pickSignSprite(r, { kind: spec.kind ?? kindOfText(spec.text), aspect: (w - 2 * m) / (h - 2 * m) });
      const fit = fitRect(inner, spriteAspect("mat_atlas_signs", sprite));
      atlasQuad(b, "mat_atlas_signs", sprite, fit.x0, fit.y0, fit.x1, fit.y1, z);
      const ft2 = Math.max(0.02, m * 0.3);
      frame(b, c1, fit.x0 - ft2 * 1.3, fit.y0 - ft2 * 1.3, fit.x1 + ft2 * 1.3, fit.y1 + ft2 * 1.3, ft2, z);
      break;
    }
    case "icon": {
      const d = Math.min(w, h);
      icon(b, c2, "ring", cx, y0 + (h - d * 0.86) / 2, d * 0.86, z);
      icon(b, c1, spec.icon ?? r.pick(["cross", "eye", "bolt", "star", "heart", "pill", "skull", "key"]), cx, y0 + (h - d * 0.5) / 2, d * 0.5, z);
      break;
    }
    case "kana":
    case "latin": {
      frame(b, c2, x0 + ft * 1.2, y0 + ft * 1.2, x1 - ft * 1.2, y1 - ft * 1.2, ft, z);
      const str = spec.text ?? (style === "kana" ? r.pick([...WORDS.kana, ...WORDS.kanji].filter((s) => [...s].length <= 4)) : r.pick(WORDS.short.filter((s) => s.length <= 5)));
      const n = [...str].length;
      const gh = Math.min(w * 0.62, (h * 0.9) / (n * 1.28));
      const total = n * gh * 1.28 - gh * 0.28;
      vtext(b, c1, str, cx, y1 - (h - total) / 2, gh, z);
      break;
    }
    default:
      throw new Error(`unknown sign style "${style}"`);
  }
}

// ---- public API ----------------------------------------------------------------------------------

export function wallSign(b, r, { w = 3, h = 1, color, color2, text: str, style, sprite, icon: ic, kind } = {}) {
  const [c1, c2] = pickPair(r, color, color2);
  const st = style ?? r.pick(["neon", "neon", "board", "bar", "atlas", "icon"]);
  const d = 0.12;
  reader(b, () => {
    b.box(BODY, [-w / 2, 0, -d], [w / 2, h, 0], { skip: ["n"] });
    paint(b, r, { x0: -w / 2, y0: 0, x1: w / 2, y1: h }, -d - 0.006, { c1, c2, style: st, text: str, sprite, icon: ic, kind });
  });
}

export function bladeSign(b, r, { w = 0.9, h = 2.4, proj = 0.9, color, color2, text: str, style, sprite, icon: ic, kind } = {}) {
  const [c1, c2] = pickPair(r, color, color2);
  const st = style ?? r.pick(["kana", "kana", "latin", "atlas", "icon"]);
  // bracket arm out of the wall plus a diagonal brace
  b.box(FRAME, [-0.03, -0.1, 0], [0.03, -0.04, proj + 0.1], { skip: ["b"] });
  b.box(FRAME, [-0.02, -0.5, 0], [0.02, -0.46, 0.04], { skip: ["b", "n"] });
  b.box(BODY, [-0.05, -h, proj], [0.05, 0, proj + w], { skip: ["b"] });
  for (const sgn of [1, -1]) {
    b.with({ pos: [sgn * 0.05, 0, proj + w / 2], rotY: sgn > 0 ? -Math.PI / 2 : Math.PI / 2 }, () => {
      paint(b, r, { x0: -w / 2, y0: -h, x1: w / 2, y1: 0 }, -0.006, { c1, c2, style: st, text: str, sprite, icon: ic, kind });
    });
  }
}

export function roofSign(b, r, { w = 8, h = 3, color, color2, text: str, style, sprite } = {}) {
  const [c1, c2] = pickPair(r, color, color2);
  const st = style ?? r.pick(["corp", "word"]);
  const legH = 1.4;
  const dd = 0.3;
  // legs and cross braces (3 legs on wide signs)
  const legs = w > 9 ? [-w / 2 + 0.6, 0, w / 2 - 0.6] : [-w / 2 + 0.5, w / 2 - 0.5];
  for (const x of legs) b.box(FRAME, [x - 0.1, 0, -0.12], [x + 0.1, legH + 0.1, 0.12], { skip: ["b"] });
  b.box(BODY, [-w / 2, legH, -dd], [w / 2, legH + h, dd], { skip: ["b"] });
  reader(b, () => {
    const z = -dd - 0.008;
    const rc = { x0: -w / 2, y0: legH, x1: w / 2, y1: legH + h };
    const ft = Math.min(0.12, h * 0.04);
    frame(b, c2, rc.x0 + ft * 1.5, rc.y0 + ft * 1.5, rc.x1 - ft * 1.5, rc.y1 - ft * 1.5, ft, z);
    if (st === "corp") {
      const word = str ?? fitWord(r, "corp", w * 0.62, h * 0.42);
      const lh = h * 0.42;
      const lw = textWidth(word, lh);
      const ic = r.pick(["ringDot", "chip", "star", "bolt", "key"]);
      const isz = h * 0.5;
      const total = lw + isz * 1.15;
      const x = -total / 2;
      icon(b, c2, ic, x + isz / 2, legH + (h - isz) / 2, isz, z);
      text(b, c1, word, x + isz * 1.15, legH + (h - lh) / 2, lh, z, { align: "left" });
      rect(b, c1, -w * 0.4, legH + h * 0.12, w * 0.4, legH + h * 0.12 + ft, z);
    } else {
      const th = h * 0.52;
      const word = str ?? fitWord(r, "shop", w * 0.86, th);
      text(b, c1, word, 0, legH + (h - th) / 2, th, z, { maxW: w * 0.86 });
    }
  });
  // spotlights on the top edge give the sign a light source anchor
  b.anchor("light.sign", [0, legH + h * 0.5, 1.2], { color: neonHex(c1), intensity: 1.2, range: 14 });
  void sprite;
}

export function billboard(b, r, { w = 6, h = 3, sprite, theme } = {}) {
  const spr = sprite ?? pickBillboardSprite(r, w / h, theme);
  const legH = 2;
  const legs = w > 8 ? [-w / 2 + 0.5, 0, w / 2 - 0.5] : [-w / 4, w / 4];
  for (const x of legs) b.box(FRAME, [x - 0.12, 0, -0.12], [x + 0.12, legH + 0.2, 0.12], { skip: ["b"] });
  b.box(BODY, [-w / 2, legH, -0.2], [w / 2, legH + h, 0.1], { skip: ["b"] });
  reader(b, () => {
    const z = -0.1 - 0.008;
    // the ad keeps its own aspect (the panel should match it; otherwise it is letterboxed)
    const fit = fitRect({ x0: -w / 2 + 0.14, y0: legH + 0.14, x1: w / 2 - 0.14, y1: legH + h - 0.14 }, spriteAspect("mat_atlas_billboard", spr));
    atlasQuad(b, "mat_atlas_billboard", spr, fit.x0, fit.y0, fit.x1, fit.y1, z);
  });
  // lamp bar along the top: three light heads on short arms
  const n = Math.max(2, Math.round(w / 2.4));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / n;
    b.box(FRAME, [x - 0.02, legH + h, 0.1], [x + 0.02, legH + h + 0.32, 0.5], { skip: ["b", "s", "n"] });
    b.box("mat_neon_white", [x - 0.12, legH + h + 0.28, 0.4], [x + 0.12, legH + h + 0.36, 0.7], { skip: ["b"] });
  }
  b.anchor("light.sign", [0, legH + h * 0.5, 1.5], { color: "#cfe8ff", intensity: 1.0, range: 16 });
}

export function neonStrip(b, r, { len = 2, color, axis = "x" } = {}) {
  const c = color ?? r.pick(NEON);
  const t = 0.05;
  const [dx, dy, dz] = axis === "x" ? [len, t, t] : axis === "y" ? [t, len, t] : [t, t, len];
  const skip = axis === "x" ? ["e", "w", "b"] : axis === "y" ? ["t", "b"] : ["n", "s", "b"];
  b.box(c, [0, 0, 0], [dx, dy, dz], { skip });
}

// ---- standalone building blocks -----------------------------------------------------------------

export function neonText(b, r, { text: str = "NEON", h = 0.6, color, align = "center", vertical = false, weight = 0.55, maxW } = {}) {
  const c = color ?? r.pick(NEON);
  let w = 0, tall = h;
  reader(b, () => {
    const z = -0.02;
    if (vertical) tall = vtext(b, c, str, 0, 0, h, z, weight);
    else w = text(b, c, str, 0, 0, h, z, { align, weight, maxW });
  });
  if (vertical) w = h;
  return { w, h: tall };
}

export function neonIcon(b, r, name, { size = 1, color, color2 } = {}) {
  const c = color ?? r.pick(NEON);
  reader(b, () => icon(b, c, name, 0, 0, size, -0.02, color2 ?? c));
}

export function neonFrame(b, r, { w = 2, h = 1, t = 0.05, color } = {}) {
  const c = color ?? r.pick(NEON);
  reader(b, () => frame(b, c, -w / 2, 0, w / 2, h, t, -0.02));
}

export function neonLine(b, r, pts, { color, t = 0.05, closed = false } = {}) {
  const c = color ?? r.pick(NEON);
  reader(b, () => {
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) strokeSeg(b, c, pts[i], pts[(i + 1) % pts.length], t, -0.02);
  });
}

export function neonRect(b, r, { w = 1, h = 1, color } = {}) {
  const c = color ?? r.pick(NEON);
  reader(b, () => rect(b, c, -w / 2, 0, w / 2, h, -0.02));
}

export function atlasPanel(b, r, { w = 1, h = 1, sprite, atlas = "mat_atlas_signs", kind } = {}) {
  const spr = sprite ?? (atlas === "mat_atlas_billboard" ? pickBillboardSprite(r, w / h) : pickSignSprite(r, { kind: kind ?? "shop", aspect: w / h }));
  reader(b, () => atlasQuad(b, atlas, spr, -w / 2, 0, w / 2, h, -0.02));
}

export function holoPanel(b, r, { w = 3, h = 2, sprite, color, atlas = "mat_atlas_signs" } = {}) {
  const c = color ?? r.pick(NEON);
  const spr = sprite ?? (atlas === "mat_atlas_billboard" ? r.pick(["ad_glitch_01", "ad_hologirl_01"]) : r.pick(["hologram_girl", ...SQUARE.neon]));
  reader(b, () => {
    atlasQuad(b, atlas, spr, -w / 2, 0, w / 2, h, -0.02);
    const L = Math.min(w, h) * 0.18, t = 0.04, z = -0.025;
    for (const [sx, sy] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) {
      const x = sx * (w / 2 + 0.04), y = sy ? h + 0.04 : -0.04;
      const dx = -sx, dy = sy ? -1 : 1;
      rect(b, c, Math.min(x, x + dx * L), y - (dy < 0 ? t : 0), Math.max(x, x + dx * L), y + (dy > 0 ? t : 0), z);
      rect(b, c, x - (dx < 0 ? t : 0), Math.min(y, y + dy * L), x + (dx > 0 ? t : 0), Math.max(y, y + dy * L), z);
    }
  });
}

void TAU;
