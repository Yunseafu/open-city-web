// Sign helpers shared by buildings, props and the city layout. The signs work package owns the
// internals; the SIGNATURES below are the contract other recipes call, so keep them stable.
//
// Everything draws at the current builder transform. Local +Z points AWAY from the wall the
// sign is mounted on (the direction people read it from), +Y is up.
//
//   wallSign(b, r, { w, h, color })          flat lit panel flush on a wall; origin = bottom centre on the wall surface
//   bladeSign(b, r, { w, h, proj, color })   vertical double-sided blade on a short arm; origin = top, on the wall surface; extends +Z by `proj`
//   roofSign(b, r, { w, h, color })          big sign on posts standing on a roof; origin = bottom centre
//   billboard(b, r, { w, h, sprite })        ad panel on a frame with an atlas sprite; origin = bottom centre
//   neonStrip(b, r, { len, color, axis })    plain neon tube, axis "x" | "y" | "z"; origin = start point
//
// `color` is a neon material id (mat_neon_*), or omitted to pick one at random.

export const NEON = ["mat_neon_cyan", "mat_neon_magenta", "mat_neon_amber", "mat_neon_green", "mat_neon_red", "mat_neon_purple"];

const pickNeon = (r, c) => c ?? r.pick(NEON);

export function wallSign(b, r, { w = 3, h = 1, color } = {}) {
  const c = pickNeon(r, color);
  b.box("mat_metal_painted_dark", [-w / 2, 0, 0], [w / 2, h, 0.15], { skip: ["b", "s"] });
  b.quad(c, [-w / 2 + 0.1, 0.1, 0.16], [w / 2 - 0.1, 0.1, 0.16], [w / 2 - 0.1, h - 0.1, 0.16], [-w / 2 + 0.1, h - 0.1, 0.16], { uv: "unit" });
}

export function bladeSign(b, r, { w = 0.9, h = 2.4, proj = 0.9, color } = {}) {
  const c = pickNeon(r, color);
  b.box("mat_metal_painted_dark", [-0.04, -0.04, 0], [0.04, 0.04, proj], { skip: ["b", "s", "n"] });
  b.quad(c, [-0.06, -h, proj], [-0.06, -h, proj + w], [-0.06, -0.1, proj + w], [-0.06, -0.1, proj], { uv: "unit", double: true });
}

export function roofSign(b, r, { w = 8, h = 3, color } = {}) {
  const c = pickNeon(r, color);
  for (const x of [-w / 2 + 0.5, w / 2 - 0.5]) b.box("mat_metal_painted_dark", [x - 0.1, 0, -0.1], [x + 0.1, 1.5, 0.1], { skip: ["b"] });
  b.box("mat_metal_painted_dark", [-w / 2, 1.5, -0.15], [w / 2, 1.5 + h, 0.15], { skip: ["b"] });
  b.quad(c, [-w / 2 + 0.2, 1.7, 0.16], [w / 2 - 0.2, 1.7, 0.16], [w / 2 - 0.2, 1.3 + h, 0.16], [-w / 2 + 0.2, 1.3 + h, 0.16], { uv: "unit" });
}

export function billboard(b, r, { w = 6, h = 3 } = {}) {
  b.box("mat_metal_painted_dark", [-0.1, 0, -0.1], [0.1, 2, 0.1], { skip: ["b"] });
  b.box("mat_metal_painted_dark", [-w / 2, 2, -0.15], [w / 2, 2 + h, 0.1], { skip: ["b"] });
  b.quad("mat_neon_white", [-w / 2 + 0.15, 2.15, 0.11], [w / 2 - 0.15, 2.15, 0.11], [w / 2 - 0.15, 1.85 + h, 0.11], [-w / 2 + 0.15, 1.85 + h, 0.11], { uv: "unit" });
}

export function neonStrip(b, r, { len = 2, color, axis = "x" } = {}) {
  const c = pickNeon(r, color);
  const t = 0.05;
  const [dx, dy, dz] = axis === "x" ? [len, t, t] : axis === "y" ? [t, len, t] : [t, t, len];
  b.box(c, [0, 0, 0], [dx, dy, dz], { skip: [] });
}
