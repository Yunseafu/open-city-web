// Which atlas sprite suits which sign. Names come from the texture thread's atlas JSON
// (public/textures/atlas/*.json); atlas.mjs throws on anything unknown, so a rename shows up
// as a generator error rather than a wrong sign.
import { spriteAspect, spriteNames } from "./atlas.mjs";

const SIGNS = "mat_atlas_signs";
const BILL = "mat_atlas_billboard";

/** Square (1:1) sign art by shop kind. */
export const SQUARE = {
  ramen: ["ramen", "noodles", "noodle_bar"],
  food: ["ramen", "noodles", "sushi", "izakaya", "cafe", "pizza", "burger", "taco", "noodle_bar"],
  bar: ["bar", "izakaya", "karaoke"],
  hotel: ["hotel"],
  clinic: ["clinic", "cyberware", "pharmacy", "neon_cross"],
  arcade: ["arcade", "karaoke"],
  night: ["bar", "izakaya", "karaoke", "arcade", "vape", "tattoo", "hologram_girl"],
  shop: ["pawn", "vape", "tattoo", "cyberware", "drone_repair", "bank", "taxi", "open_24h", "cafe"],
  bank: ["bank", "pawn"],
  taxi: ["taxi", "arrow_right"],
  neon: ["neon_cross", "neon_star", "neon_dragon", "neon_koi", "neon_katana", "neon_skull", "neon_eye", "neon_heart", "neon_lightning", "neon_moon"],
  arrow: ["arrow_left", "arrow_right", "arrow_up", "arrow_down"],
  warn: ["hazard_stripes", "warning_triangle", "no_entry", "wifi", "battery", "power", "exit", "blank_dark"],
  glyph: ["glyph_1", "glyph_2", "glyph_3", "glyph_4", "glyph_5", "glyph_6", "glyph_7", "glyph_8"],
};
export const SQUARE_ANY = [...new Set(Object.values(SQUARE).flat())];

/** ~1:3 tall panels (blade signs). */
export const VERTICAL = ["vertical_sign_1", "vertical_sign_2", "vertical_sign_3", "vertical_sign_4", "vertical_sign_5", "vertical_sign_6"];

/** ~3:1 wide panels, by kind where the art is themed. */
export const WIDE = { ramen: "wide_ramen", food: "wide_ramen", hotel: "wide_hotel", clinic: "wide_cyberware", shop: "wide_open_24h", open: "wide_open_24h" };
export const WIDE_ANY = ["wide_hotel", "wide_ramen", "wide_cyberware", "wide_open_24h"];

/** Guess the shop kind from a sign word. */
export function kindOfText(text = "") {
  const t = text.toUpperCase();
  if (/RAMEN|NOODLE|ラーメン|麺/.test(t)) return "ramen";
  if (/SUSHI|PIZZA|BURGER|GRILL|CAFE|DELI|TEA|スシ|コーヒー/.test(t)) return "food";
  if (/HOTEL|MOTEL|ホテル|宿/.test(t)) return "hotel";
  if (/CLINIC|PHARMA|DRUGS|MED|IMPLANT|BIOTECH|薬|医/.test(t)) return "clinic";
  if (/ARCADE|GAMES|VR|カラオケ/.test(t)) return "arcade";
  if (/BAR|PUB|SAKE|LOUNGE|CLUB|DISCO|DRINKS|LIVE|NIGHT|酒/.test(t)) return "bar";
  if (/BANK|LOANS|PAWN|銀行/.test(t)) return "bank";
  if (/TAXI|タクシー/.test(t)) return "taxi";
  return "shop";
}

/**
 * Pick a mat_atlas_signs sprite for a panel. aspect = width / height of the panel: tall panels get
 * vertical_sign_*, wide ones wide_*, everything else 1:1 art for the kind.
 */
export function pickSignSprite(r, { kind = "shop", aspect = 1 } = {}) {
  const have = new Set(spriteNames(SIGNS));
  const ok = (n) => have.size === 0 || have.has(n);
  if (aspect <= 0.5) return r.pick(VERTICAL.filter(ok));
  if (aspect >= 2.2) {
    const themed = WIDE[kind];
    if (themed && ok(themed) && r.chance(0.7)) return themed;
    return r.pick(WIDE_ANY.filter(ok));
  }
  const list = (SQUARE[kind] ?? SQUARE.shop).filter(ok);
  return r.pick(list.length ? list : SQUARE_ANY.filter(ok));
}

/** Billboard ad sprites grouped by aspect, with a theme tag. */
export const BILLBOARDS = {
  // 2:1 (hero = 2x2 cells, singles = 1x1)
  ad_solaris_hero: "hero", ad_vortex_hero: "hero",
  ad_zenkai_01: "ad", ad_vortex_01: "ad", ad_neon_cola_can: "cola", ad_neon_cola_bubbles: "cola", ad_price_tag_01: "ad",
  ad_qr_01: "ad", ad_glitch_01: "holo", ad_hologirl_01: "holo", ad_aurum_bank_01: "bank", ad_kaisen_noodle_01: "ramen",
  ad_chrome_clinic_01: "clinic", ad_news_01: "ad", ad_arcade_promo_01: "arcade", ad_fizz0_promo_01: "cola",
  // 4:1
  ad_novamed_wide: "clinic", ad_neon_cola_wide: "cola", ad_zenkai_banner: "ad",
  // 1:2
  ad_halcyon_tall: "ad",
};

/** Pick a billboard sprite whose aspect is closest to the requested one (random among near ties). */
export function pickBillboardSprite(r, aspect, theme) {
  const names = spriteNames(BILL).filter((n) => BILLBOARDS[n]);
  const pool = names.length ? names : Object.keys(BILLBOARDS);
  const scored = pool.map((n) => ({ n, d: Math.abs(Math.log(aspectOf(n) / aspect)), theme: BILLBOARDS[n] }));
  const best = Math.min(...scored.map((s) => s.d));
  let near = scored.filter((s) => s.d <= best + 0.12);
  if (theme) {
    const themed = near.filter((s) => s.theme === theme);
    if (themed.length) near = themed;
  }
  return r.pick(near).n;
}

function aspectOf(name) {
  try {
    return spriteAspect(BILL, name);
  } catch {
    return 2;
  }
}

/** Fit a rect {x0,y0,x1,y1} to an aspect (w / h), centred, never larger than the original. */
export function fitRect(rc, aspect) {
  const w = rc.x1 - rc.x0, h = rc.y1 - rc.y0;
  let fw = w, fh = w / aspect;
  if (fh > h) {
    fh = h;
    fw = h * aspect;
  }
  const cx = (rc.x0 + rc.x1) / 2, cy = (rc.y0 + rc.y1) / 2;
  return { x0: cx - fw / 2, x1: cx + fw / 2, y0: cy - fh / 2, y1: cy + fh / 2 };
}
