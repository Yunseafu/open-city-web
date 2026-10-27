// Building blocks for the high-rise / downtown recipes (tools/gen/assets/buildings_high.mjs).
//
// Frame of reference: footprint centre at the origin, base at y = 0, front (+Z) faces the street.
// The mass rectangle is X in [-w/2, w/2], Z in [-d/2 + 1.5, d/2 - 1.5]; the 1.5 m strips at the
// front and back are left for canopies, blade signs and awnings, so nothing leaves the footprint.
// Mass depth is therefore d - 3, still a multiple of 3 m so facade bays end cleanly at corners.
//
// Facade UVs: walls above the shopfront start their texture tile at y = SHOP_H (UV_OFF), so that
// floor lines fall on 3.6 m multiples in texture space (see docs/models.md, "Modules").

import { SHOP_H, FLOOR_H, BAY_W } from "./modules.mjs";
import { v3 } from "./math.mjs";
import { wallSign, bladeSign, neonStrip } from "./signs.mjs";

export const UV_OFF = -SHOP_H;
export const EDGE = 1.5; // front / back margin inside the footprint

export const M = {
  lit: "mat_facade_windows_lit",
  dark: "mat_facade_windows_dark",
  curtain: "mat_facade_curtainwall",
  shop: "mat_facade_shopfront",
  conc: "mat_wall_concrete_panel",
  concD: "mat_wall_concrete_dark",
  clad: "mat_wall_metal_cladding",
  roof: "mat_roof_tar",
  metal: "mat_metal_painted_dark",
  plate: "mat_metal_plate_worn",
  galv: "mat_metal_galvanized",
  rust: "mat_metal_rust",
  glass: "mat_glass_dark",
  warm: "mat_light_warm",
  leaf: "mat_foliage_leaf",
};

export const PALETTES = [
  { a: "mat_neon_cyan", b: "mat_neon_magenta", ha: "#00f0ff", hb: "#ff2bd6" },
  { a: "mat_neon_amber", b: "mat_neon_cyan", ha: "#ffb000", hb: "#00f0ff" },
  { a: "mat_neon_magenta", b: "mat_neon_purple", ha: "#ff2bd6", hb: "#9d4dff" },
  { a: "mat_neon_green", b: "mat_neon_cyan", ha: "#39ff6a", hb: "#00f0ff" },
  { a: "mat_neon_red", b: "mat_neon_amber", ha: "#ff2a3c", hb: "#ffb000" },
  { a: "mat_neon_purple", b: "mat_neon_cyan", ha: "#9d4dff", hb: "#00f0ff" },
];
export const pickPalette = (r) => r.pick(PALETTES);

/** Default vertex AO: dark at street level, fading out by 14 m. */
export const AO = { y0: 0, y1: 14, lo: 0.5, hi: 1 };

/** Bottom y of floor index f (0 = ground floor, 4.8 m tall; the rest are 3.6 m). floorY(floors) = building height. */
export const floorY = (f) => (f <= 0 ? 0 : SHOP_H + (f - 1) * FLOOR_H);

/** Frame numbers for a footprint. */
export function frame(w, d) {
  return { w, d, hw: w / 2, hd: d / 2, zb: -d / 2 + EDGE, zf: d / 2 - EDGE, D: d - 2 * EDGE };
}

/** Rect inside the mass rectangle: sides inset by `s`, front by `f`, back by `k`. */
export function rectIn(fr, { s = 0, f = 0, k = 0 } = {}) {
  return { x0: -fr.hw + s, x1: fr.hw - s, z0: fr.zb + k, z1: fr.zf - f };
}

/** Random brightness in [lo, hi] used as vertex tint, so neighbours do not all share one grey. */
export function tintVar(b, r, lo = 0.78, hi = 1) {
  const t = r.range(lo, hi);
  b.tint = [t, t, t];
}

const FACES = (x0, x1, z0, z1) => ({
  s: [[x0, z0], [x1, z0]],
  e: [[x1, z0], [x1, z1]],
  n: [[x1, z1], [x0, z1]],
  w: [[x0, z1], [x0, z0]],
});

/** One facade wall; split where the vertex-AO ramp ends so the gradient stays near the ground. */
export function facadeWall(b, mat, a, c, y0, y1, uOff = 0, vOff = UV_OFF) {
  const ys = [y0];
  if (b.ao && b.ao.y1 > y0 + 0.01 && b.ao.y1 < y1 - 0.01) ys.push(b.ao.y1);
  ys.push(y1);
  for (let i = 0; i < ys.length - 1; i++) b.wall(mat, a, c, ys[i], ys[i + 1], { uOff, vOff });
}

/**
 * Rectangular shaft with facade walls. o: { x0,x1,z0,z1,y0,y1, mat, mats:{n,s,e,w}, top (material or false), skip:[faces] }.
 * Tiling UV starts at a random bay boundary per wall for variety.
 */
export function shaft(b, r, o) {
  const { x0, x1, z0, z1, y0, y1 } = o;
  const faces = FACES(x0, x1, z0, z1);
  for (const k of ["s", "e", "n", "w"]) {
    if (o.skip?.includes(k)) continue;
    const mat = o.mats?.[k] ?? o.mat;
    facadeWall(b, mat, faces[k][0], faces[k][1], y0, y1, BAY_W * r.int(0, 3), o.vOff ?? UV_OFF);
  }
  if (o.top !== false) b.quad(o.top ?? M.roof, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]);
}

/** Wall that leans in: bottom rect (a) to top rect (t), both { hx, hz, cx, cz }. Used for tapered towers. */
export function taperShaft(b, r, o) {
  const { y0, y1, mat } = o;
  const A = o.a, T = o.t;
  const corner = (R, sx, sz, y) => [R.cx + sx * R.hx, y, R.cz + sz * R.hz];
  const quads = [
    [[-1, -1], [1, -1]], // south
    [[1, -1], [1, 1]], // east
    [[1, 1], [-1, 1]], // north
    [[-1, 1], [-1, -1]], // west
  ];
  for (const [p, q] of quads) {
    const P = [corner(A, p[0], p[1], y0), corner(A, q[0], q[1], y0), corner(T, q[0], q[1], y1), corner(T, p[0], p[1], y1)];
    // The builder treats faces with |n.y| < 0.01 as vertical (absolute y in v) and leaning faces as
    // relative to the bottom edge, so the v offset that keeps floor lines on 3.6 m multiples differs.
    const n = v3.cross(v3.sub(P[2], P[0]), v3.sub(P[3], P[1]));
    const nl = Math.hypot(n[0], n[1], n[2]) || 1;
    const vertical = Math.abs(n[1] / nl) < 0.01;
    b.quad(mat, ...P, { uOff: BAY_W * r.int(0, 3), vOff: vertical ? UV_OFF : y0 - SHOP_H });
  }
  if (o.top !== false) {
    b.quad(o.top ?? M.roof, corner(T, -1, -1, y1), corner(T, 1, -1, y1), corner(T, 1, 1, y1), corner(T, -1, 1, y1));
  }
}

/** Vertical fins every bay along a wall a -> c (visible side on the right of travel), standing out by `out`. */
export function finsWall(b, mat, a, c, y0, y1, { every = BAY_W, wd = 0.2, out = 0.25, from = 0 } = {}) {
  const dx = c[0] - a[0], dz = c[1] - a[1];
  const len = Math.hypot(dx, dz);
  const d = [dx / len, dz / len];
  const n = [d[1], -d[0]]; // right of travel
  for (let t = from; t <= len + 1e-6; t += every) {
    const px = a[0] + d[0] * t, pz = a[1] + d[1] * t;
    const q0 = [px - d[0] * wd / 2, pz - d[1] * wd / 2];
    const q1 = [px + d[0] * wd / 2 + n[0] * out, pz + d[1] * wd / 2 + n[1] * out];
    b.box(mat, [Math.min(q0[0], q1[0]), y0, Math.min(q0[1], q1[1])], [Math.max(q0[0], q1[0]), y1, Math.max(q0[1], q1[1])], { skip: ["b"] });
  }
}

/** Horizontal band around a rectangle, sticking out by `out`. */
export function ledgeRing(b, mat, x0, x1, z0, z1, y, h = 0.5, out = 0.25) {
  b.box(mat, [x0 - out, y, z0 - out], [x1 + out, y + h, z1 + out], { skip: [] });
}

/** Ledge bands at floor boundaries `from`, `from + every`, ... below floor `to`. */
export function ledges(b, mat, rect, from, to, every, h = 0.45, out = 0.2) {
  for (let f = from; f < to; f += every) ledgeRing(b, mat, rect.x0, rect.x1, rect.z0, rect.z1, floorY(f) - h / 2, h, out);
}

/** Low wall around a roof edge. */
export function parapet(b, mat, x0, x1, z0, z1, y, h = 1, t = 0.3) {
  b.box(mat, [x0, y, z0], [x1, y + h, z0 + t], { skip: ["b", "s"] });
  b.box(mat, [x0, y, z1 - t], [x1, y + h, z1], { skip: ["b", "n"] });
  b.box(mat, [x0, y, z0 + t], [x0 + t, y + h, z1 - t], { skip: ["b", "w"] });
  b.box(mat, [x1 - t, y, z0 + t], [x1, y + h, z1 - t], { skip: ["b", "e"] });
}

/** Thin neon frame / strip box. */
export function neonBox(b, mat, min, max) {
  b.box(mat, min, max, { skip: [] });
}

/** Neon strip running along the top edge of a rect at height y (all four sides). */
export function neonRim(b, mat, x0, x1, z0, z1, y, t = 0.18, out = 0.12) {
  neonBox(b, mat, [x0 - out, y, z1], [x1 + out, y + t, z1 + out]);
  neonBox(b, mat, [x0 - out, y, z0 - out], [x1 + out, y + t, z0]);
  neonBox(b, mat, [x1, y, z0], [x1 + out, y + t, z1]);
  neonBox(b, mat, [x0 - out, y, z0], [x0, y + t, z1]);
}

/** Tall vertical neon blade standing proud of a wall at (x, z); extends outward by `out` along +Z. */
export function neonBlade(b, mat, x, z, y0, y1, wd = 0.35, out = 0.35) {
  neonBox(b, mat, [x - wd / 2, y0, z], [x + wd / 2, y1, z + out]);
}

/** Antenna mast with a red beacon on top. Returns the beacon position. */
export function mast(b, x, z, y, h, t = 0.18, beacon = true) {
  b.box(M.metal, [x - t / 2, y, z - t / 2], [x + t / 2, y + h, z + t / 2], { skip: ["b"] });
  const seg = Math.max(2, Math.floor(h / 4));
  for (let i = 1; i <= seg; i++) {
    const yy = y + (h * i) / (seg + 1);
    b.box(M.metal, [x - t * 2, yy, z - t / 3], [x + t * 2, yy + 0.1, z + t / 3], { skip: [] });
  }
  if (beacon) b.box("mat_neon_red", [x - 0.18, y + h, z - 0.18], [x + 0.18, y + h + 0.36, z + 0.18], { skip: ["b"] });
  return [x, y + h + 0.2, z];
}

/** Rooftop clutter: elevator overrun, AC units, a water tank, vents, optional masts / dish / helipad. */
export function roofKit(b, r, x0, x1, z0, z1, y, o = {}) {
  const wd = x1 - x0, dp = z1 - z0;
  if (wd < 4 || dp < 4) return [];
  const cols = wd > 12 ? 3 : 2, rows = dp > 12 ? 3 : 2;
  const cells = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) cells.push([i, j]);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const cw = (wd - 2) / cols, cd = (dp - 2) / rows;
  let n = 0;
  // Each feature gets its own grid cell; once the roof is full the remaining features are skipped.
  const spot = (margin = 0.3) => {
    if (n >= cells.length) return null;
    const [ci, cj] = cells[n++];
    return {
      x: x0 + 1 + (ci + 0.5) * cw + r.range(-margin, margin) * cw * 0.3,
      z: z0 + 1 + (cj + 0.5) * cd + r.range(-margin, margin) * cd * 0.3,
      cw: cw * 0.8, cd: cd * 0.8,
    };
  };
  if (o.elevator !== false) {
    const s = spot();
    if (s) {
    const sx = Math.min(5, s.cw), sz = Math.min(4, s.cd);
    b.box(M.concD, [s.x - sx / 2, y, s.z - sz / 2], [s.x + sx / 2, y + 3, s.z + sz / 2], { skip: ["b"] });
    b.box(M.metal, [s.x - sx / 2 - 0.1, y + 3, s.z - sz / 2 - 0.1], [s.x + sx / 2 + 0.1, y + 3.25, s.z + sz / 2 + 0.1], { skip: ["b"] });
    }
  }
  const nAc = o.ac ?? 2;
  for (let i = 0; i < nAc; i++) {
    const s = spot();
    if (!s) break;
    const sx = Math.min(r.range(2, 3.4), s.cw), sz = Math.min(r.range(1.4, 2.2), s.cd), sh = r.range(1, 1.7);
    b.box(M.galv, [s.x - sx / 2, y, s.z - sz / 2], [s.x + sx / 2, y + sh, s.z + sz / 2], { skip: ["b"] });
    b.box(M.metal, [s.x - sx / 2 + 0.2, y + sh, s.z - sz / 2 + 0.2], [s.x + sx / 2 - 0.2, y + sh + 0.15, s.z + sz / 2 - 0.2], { skip: ["b"] });
  }
  const tankSpot = o.tank ? spot() : null;
  if (tankSpot) {
    const s = tankSpot;
    const rad = Math.min(1.5, s.cw / 2, s.cd / 2);
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      b.box(M.rust, [s.x + dx * rad * 0.6 - 0.1, y, s.z + dz * rad * 0.6 - 0.1], [s.x + dx * rad * 0.6 + 0.1, y + 2, s.z + dz * rad * 0.6 + 0.1], { skip: ["b", "t"] });
    }
    b.cylinder(M.plate, { x: s.x, z: s.z, y0: y + 2, y1: y + 4.2, r: rad, seg: 8, cap: "top" });
    b.cylinder(M.rust, { x: s.x, z: s.z, y0: y + 4.2, y1: y + 4.7, r: rad, r1: rad * 0.4, seg: 8, cap: "top" });
  }
  const beacons = [];
  const nMast = o.masts ?? 1;
  for (let i = 0; i < nMast; i++) {
    const s = spot();
    if (!s) break;
    beacons.push(mast(b, s.x, s.z, y, o.mastH ?? r.range(6, 11)));
  }
  const dishSpot = o.dish ? spot() : null;
  if (dishSpot) {
    const s = dishSpot;
    b.box(M.metal, [s.x - 0.1, y, s.z - 0.1], [s.x + 0.1, y + 1.2, s.z + 0.1], { skip: ["b"] });
    b.with({ pos: [s.x, y + 1.6, s.z], rot: [-0.9, r.range(-1.5, 1.5), 0] }, () => {
      b.lathe(M.galv, [[0, 0], [0.9, 0.35], [1.2, 0.5]], { seg: 8, crease: 80 });
    });
  }
  if (o.vents) {
    for (let i = 0; i < o.vents; i++) {
      const s = spot();
      if (!s) break;
      b.cylinder(M.galv, { x: s.x, z: s.z, y0: y, y1: y + r.range(1.2, 2.4), r: 0.35, seg: 6, cap: "top" });
    }
  }
  return beacons;
}

/**
 * Ground-floor extras on the front plane z = zf: pilasters, lobby glow, entrance canopy,
 * neon strips, wall signs and corner blade signs. The facade itself (mat_facade_shopfront) is drawn by the caller.
 * o: { x0, x1, zf, pal, entrance: -1|0|1 (left/centre/right as seen from the street), width of entrance canopy, signs }
 */
export function streetFront(b, r, o) {
  const { x0, x1, zf, pal } = o;
  const cx = (x0 + x1) / 2;
  const span = x1 - x0;
  const ex = cx + (o.entrance ?? 0) * Math.max(0, span / 2 - 6) * -1; // viewed from +Z, +X is to the viewer's right
  // pilasters every 6 m
  for (let x = x0 + 1.5; x < x1 - 1; x += 6) {
    if (Math.abs(x - ex) < 3.2) continue;
    b.box(M.concD, [x - 0.25, 0, zf], [x + 0.25, SHOP_H, zf + 0.3], { skip: ["b"] });
  }
  // lobby glow + frame
  const lw = o.lobbyW ?? 3.6;
  b.quad(M.warm, [ex - lw / 2, 0, zf + 0.03], [ex + lw / 2, 0, zf + 0.03], [ex + lw / 2, 3.4, zf + 0.03], [ex - lw / 2, 3.4, zf + 0.03], { uv: "unit" });
  for (const sx of [-1, 1]) b.box(M.metal, [ex + sx * lw / 2 - 0.12, 0, zf], [ex + sx * lw / 2 + 0.12, 3.8, zf + 0.25], { skip: ["b"] });
  // canopy over the entrance
  const cw = o.canopyW ?? 7, cd = o.canopyD ?? 1.4;
  b.box(M.metal, [ex - cw / 2, 3.9, zf], [ex + cw / 2, 4.25, zf + cd], { skip: [] });
  neonBox(b, pal.a, [ex - cw / 2, 3.88, zf + cd], [ex + cw / 2, 3.98, zf + cd + 0.08]);
  // shop strip lights and signs on both sides of the entrance
  if (o.signs !== false) {
    for (const side of [-1, 1]) {
      const sx0 = side < 0 ? x0 + 1.2 : ex + cw / 2 + 0.6;
      const sx1 = side < 0 ? ex - cw / 2 - 0.6 : x1 - 1.2;
      const len = sx1 - sx0;
      if (len < 2.5) continue;
      neonBox(b, side < 0 ? pal.b : pal.a, [sx0, 3.45, zf], [sx1, 3.52, zf + 0.06]);
      b.with({ pos: [(sx0 + sx1) / 2, 3.75, zf] }, () => wallSign(b, r, { w: Math.min(len - 0.4, r.range(3, 5)), h: 0.85, color: r.chance(0.5) ? pal.a : pal.b }));
    }
    for (const side of [-1, 1]) {
      const bx = side * (span / 2 - 0.8) + cx;
      if (Math.abs(bx - ex) < cw / 2 + 1) continue;
      b.with({ pos: [bx, 7, zf], rotY: 0 }, () => bladeSign(b, r, { w: 0.8, h: r.range(2.4, 4), proj: 0.6, color: side < 0 ? pal.a : pal.b }));
    }
  }
  return { ex };
}

/** Shopfront podium shell: ground floor walls (shopfront front/sides, plain back) from y = 0 to SHOP_H. */
export function groundFloor(b, r, rect, extra = {}) {
  shaft(b, r, {
    ...rect, y0: 0, y1: SHOP_H, mat: M.shop, mats: { s: M.concD, ...(extra.mats ?? {}) }, top: false, vOff: 0,
  });
}

/** Skybridge between two vertical faces along X at height y between x0 and x1 (a glass tube with metal frame). */
export function skybridgeX(b, x0, x1, y, z, wd = 3, ht = 3.2) {
  b.box(M.metal, [x0, y, z - wd / 2], [x1, y + 0.4, z + wd / 2], { skip: [] });
  b.box(M.glass, [x0, y + 0.4, z - wd / 2 + 0.1], [x1, y + ht - 0.3, z + wd / 2 - 0.1], { skip: [] });
  b.box(M.metal, [x0, y + ht - 0.3, z - wd / 2], [x1, y + ht, z + wd / 2], { skip: ["b"] });
}

/** Skybridge along Z. */
export function skybridgeZ(b, z0, z1, y, x, wd = 3, ht = 3.2) {
  b.box(M.metal, [x - wd / 2, y, z0], [x + wd / 2, y + 0.4, z1], { skip: [] });
  b.box(M.glass, [x - wd / 2 + 0.1, y + 0.4, z0], [x + wd / 2 - 0.1, y + ht - 0.3, z1], { skip: [] });
  b.box(M.metal, [x - wd / 2, y + ht - 0.3, z0], [x + wd / 2, y + ht, z1], { skip: ["b"] });
}



// ---- shared recipe helpers ----------------------------------------------------------------
export const STEP = 1.5;

/** Largest side inset that leaves a 9 m wide, 9 m deep tier. */
export const maxInset = (fr) => Math.max(0, Math.floor((Math.min(fr.w, fr.D) - 9) / 2 / STEP) * STEP);

/** Mass rect inset by s on the sides, with the front/back split moved by `shift` (0 or +-1.5). */
export function insetRect(fr, s, shift = 0, shiftX = 0) {
  if (s < STEP) shift = 0;
  return { x0: -fr.hw + s + shiftX, x1: fr.hw - s + shiftX, z0: fr.zb + s - shift, z1: fr.zf - s - shift };
}

export const centre = (R) => [(R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2];

export function colliderRect(b, R, y0, y1) {
  const [cx, cz] = centre(R);
  b.collider({ c: [cx, (y0 + y1) / 2, cz], h: [(R.x1 - R.x0) / 2, (y1 - y0) / 2, (R.z1 - R.z0) / 2] });
}

/** Bottom face for overhangs seen from below. */
export function underside(b, mat, R, y) {
  b.quad(mat, [R.x1, y, R.z0], [R.x0, y, R.z0], [R.x0, y, R.z1], [R.x1, y, R.z1]);
}

/** Roof-edge terrace between a lower roof and the tier standing on it: neon rim at the edge and planters. */
export function terrace(b, lower, upper, y, mat) {
  neonRim(b, mat, lower.x0 + 0.3, lower.x1 - 0.3, lower.z0 + 0.3, lower.z1 - 0.3, y, 0.15, 0.1);
  const ringF = lower.z1 - upper.z1;
  if (ringF >= 2) {
    b.box(M.leaf, [lower.x0 + 1, y, lower.z1 - 1.5], [lower.x1 - 1, y + 0.7, lower.z1 - 0.7], { skip: ["b"] });
  }
  const ringS = upper.x0 - lower.x0;
  if (ringS >= 2) {
    b.box(M.leaf, [lower.x0 + 0.7, y, upper.z0], [lower.x0 + 1.5, y + 0.7, upper.z1], { skip: ["b"] });
    b.box(M.leaf, [lower.x1 - 1.5, y, upper.z0], [lower.x1 - 0.7, y + 0.7, upper.z1], { skip: ["b"] });
  }
}

export function lightAnchors(b, ex, zf, topY, pal, cx = 0, cz = 0) {
  b.anchor("light.entrance", [ex, 3.2, zf + 1.1], { color: "#ffd9a0", intensity: 1, range: 14 });
  b.anchor("light.crown", [cx, topY + 1, cz], { color: pal.ha, intensity: 1.2, range: 30 });
}


/** Box with a sloped roof: height h0 on the back (z0) edge, h1 on the front (z1) edge. */
export function wedge(b, mat, roofMat, R, y, h0, h1) {
  const { x0, x1, z0, z1 } = R;
  b.quad(mat, [x0, y, z0], [x1, y, z0], [x1, y + h0, z0], [x0, y + h0, z0]);
  b.quad(mat, [x1, y, z0], [x1, y, z1], [x1, y + h1, z1], [x1, y + h0, z0]);
  b.quad(mat, [x1, y, z1], [x0, y, z1], [x0, y + h1, z1], [x1, y + h1, z1]);
  b.quad(mat, [x0, y, z1], [x0, y, z0], [x0, y + h0, z0], [x0, y + h1, z1]);
  b.quad(roofMat, [x0, y + h0, z0], [x1, y + h0, z0], [x1, y + h1, z1], [x0, y + h1, z1]);
}

/** Vertical blade sign hung on a wall at (x, y_top, z); wraps signs.bladeSign with a sensible size. */
export function cornerBlade(b, r, x, yTop, z, mat, h) {
  b.with({ pos: [x, yTop, z] }, () => bladeSign(b, r, { w: 0.8, h, proj: 0.6, color: mat }));
}

/** Small low-poly conifer: trunk plus a 5-sided cone. */
export function tree(b, x, y, z, h = 2.6, r = 0.8) {
  b.box(M.rust, [x - 0.07, y, z - 0.07], [x + 0.07, y + h * 0.3, z + 0.07], { skip: ["b", "t"] });
  b.lathe(M.leaf, [[r, y + h * 0.22], [0, y + h]], { x, z, seg: 5, crease: 80 });
}

export { neonStrip, FLOOR_H, SHOP_H, BAY_W };
