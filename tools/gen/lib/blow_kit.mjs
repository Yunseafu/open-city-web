// Shared parts for the low / mid-rise building recipes (tools/gen/assets/buildings_low.mjs).
//
// Conventions used by every helper below:
//  - `ext` is a mass extent { x0, x1, z0, z1 } in builder space; the footprint is centred on the origin.
//  - `frame(b, ext, side, fn)` moves to the middle of a wall, at ground level, with local +Z pointing
//    OUT of that wall (side: "n" = +Z/front, "s" = back, "e" = +X, "w" = -X). Wall-mounted parts
//    (ac, balcony, awning, pipe, signs...) are drawn in that frame: x along the wall, y up, z out.
//  - Triangle cost is tracked with `tris(b)` so recipes can stop adding clutter at their cap.

import { FLOOR_H, SHOP_H, BAY_W } from "./modules.mjs";
import { TAU } from "./math.mjs";
import * as signs from "./signs.mjs";

export const FACADES = ["mat_facade_windows_lit", "mat_facade_windows_dark"];
export const NEONS = ["mat_neon_cyan", "mat_neon_magenta", "mat_neon_amber", "mat_neon_green", "mat_neon_red", "mat_neon_purple"];

/** Paint tints multiplied into wall colours through COLOR_0. */
const PAINTS = [
  [1, 1, 1],
  [1.0, 0.9, 0.82],
  [0.85, 0.92, 1.0],
  [1.0, 0.96, 0.78],
  [0.82, 1.0, 0.92],
  [1.0, 0.82, 0.86],
  [0.78, 0.8, 0.9],
];
export const paint = (r) => r.pick(PAINTS);

/** Saturated colours for awnings, containers, laundry, lanterns. */
export const FABRIC = [
  [0.9, 0.12, 0.2], [0.1, 0.55, 0.95], [0.95, 0.65, 0.05], [0.15, 0.75, 0.4],
  [0.75, 0.2, 0.85], [0.95, 0.35, 0.1], [0.85, 0.85, 0.9], [0.1, 0.8, 0.85],
];

export const BUILDING_AO = { y0: 0, y1: 7, lo: 0.5, hi: 1 };

const ALL = ["s", "e", "n", "w", "t", "b"];

/** Box that only draws the listed faces ("s e n w t b"), to avoid emitting hidden triangles. */
export function boxF(b, mat, min, max, faces, o = {}) {
  b.box(mat, min, max, { ...o, skip: ALL.filter((f) => !faces.includes(f)) });
}

/** Triangles emitted so far (all nodes). */
export function tris(b) {
  let n = 0;
  const walk = (node) => {
    for (const g of node.geo.values()) n += g.tris;
    node.children.forEach(walk);
  };
  walk(b.root);
  return n;
}

export const bays = (len) => Math.round(len / BAY_W);
export const heightOf = (floors, shop = true) => (shop ? SHOP_H : FLOOR_H) + (floors - 1) * FLOOR_H;

/** Run `fn(len)` in a wall frame (see header). `ext` is the mass extent the wall belongs to. */
export function frame(b, ext, side, fn) {
  const cx = (ext.x0 + ext.x1) / 2, cz = (ext.z0 + ext.z1) / 2;
  const w = ext.x1 - ext.x0, d = ext.z1 - ext.z0;
  const f = {
    n: { pos: [cx, 0, ext.z1], rotY: 0, len: w },
    s: { pos: [cx, 0, ext.z0], rotY: Math.PI, len: w },
    e: { pos: [ext.x1, 0, cz], rotY: Math.PI / 2, len: d },
    w: { pos: [ext.x0, 0, cz], rotY: -Math.PI / 2, len: d },
  }[side];
  b.with({ pos: f.pos, rotY: f.rotY }, () => fn(f.len));
}

/**
 * Walls + roof of a rectangular mass.
 *  opts: floors, shop (4.8 m storefront ground floor on the front), upper (facade material),
 *  ground (storefront material), sides { n, e, s, w } material overrides, tint, parapet (m), roofMat,
 *  frontOnly (skip back / side walls, for masses that are hidden behind others).
 * Returns { H, g } (roof height, ground-floor height).
 */
export function shell(b, r, ext, opts) {
  const { floors, shop = true, upper = r.pick(FACADES), ground = "mat_facade_shopfront", sides = {}, tint = paint(r), parapet = 0.9, roofMat = "mat_roof_tar" } = opts;
  const y0 = opts.y0 ?? 0;
  const g = shop ? SHOP_H : FLOOR_H;
  const H = y0 + g + (floors - 1) * FLOOR_H;
  const top = H + parapet;
  const uo = () => BAY_W * r.int(0, 3);
  // v = -(y + vOff): put a tile boundary at the first plain floor so windows are never cut
  const vUp = (shop ? -(y0 + SHOP_H) : -y0) + (r.chance(0.5) ? FLOOR_H : 0);
  const groundSide = sides.groundSide ?? "mat_wall_concrete_dark";
  const { x0, x1, z0, z1 } = ext;
  const wall = (mat, a, c, ya, yb, vOff) => {
    if (yb - ya > 1e-4) b.wall(mat, a, c, ya, yb, { uOff: uo(), vOff, tint });
  };
  const corner = { n: [[x1, z1], [x0, z1]], e: [[x1, z0], [x1, z1]], s: [[x0, z0], [x1, z0]], w: [[x0, z1], [x0, z0]] };
  for (const s of ["n", "e", "s", "w"]) {
    const [a, c] = corner[s];
    const mat = sides[s] ?? upper;
    if (s === "n" && shop) {
      wall(ground, a, c, y0, y0 + g, 0);
      wall(mat, a, c, y0 + g, top, vUp);
    } else if (shop) {
      wall(groundSide, a, c, y0, y0 + g, 0);
      wall(mat, a, c, y0 + g, top, vUp);
    } else wall(mat, a, c, y0, top, vUp);
  }
  if (opts.roof === false) return { H, g, top };
  b.quad(roofMat, [x0, H, z0], [x1, H, z0], [x1, H, z1], [x0, H, z1], { tint: [0.9, 0.9, 0.9] });
  if (parapet > 0) {
    const t = 0.3;
    const pm = "mat_wall_concrete_dark";
    boxF(b, pm, [x0, H, z1 - t], [x1, top, z1], "st", { tint });
    boxF(b, pm, [x0, H, z0], [x1, top, z0 + t], "nt", { tint });
    boxF(b, pm, [x1 - t, H, z0 + t], [x1, top, z1 - t], "wt", { tint });
    boxF(b, pm, [x0, H, z0 + t], [x0 + t, top, z1 - t], "et", { tint });
  }
  return { H, g, top };
}

// ---- wall-mounted parts (wall frame) --------------------------------------------------------

export function ac(b, x, y, s = 1) {
  boxF(b, "mat_metal_galvanized", [x - 0.4 * s, y, 0], [x + 0.4 * s, y + 0.5 * s, Math.min(0.3, 0.38 * s)], "newt");
}

/** Blade sign whose reach out of the wall (proj + w) is clamped to `reach` m, so it stays inside the lot. */
export function blade(b, r, o, reach = 0.3) {
  const w = Math.min(o.w ?? 0.8, Math.max(0.3, reach - 0.1));
  const proj = Math.max(0, Math.min(o.proj ?? 0.3, reach - w));
  signs.bladeSign(b, r, { ...o, w, proj });
}

/** Balcony: slab + solid-ish railing. Reaches `depth` out of the wall. */
export function balcony(b, x, y, wb, depth = 1.1, rail = "mat_metal_painted_dark") {
  boxF(b, "mat_wall_concrete_dark", [x - wb / 2, y, 0], [x + wb / 2, y + 0.15, depth], "newtb");
  boxF(b, rail, [x - wb / 2, y + 0.15, depth - 0.05], [x + wb / 2, y + 1.05, depth], "nt");
  boxF(b, rail, [x - wb / 2, y + 0.15, 0], [x - wb / 2 + 0.05, y + 1.05, depth], "wt");
  boxF(b, rail, [x + wb / 2 - 0.05, y + 0.15, 0], [x + wb / 2, y + 1.05, depth], "et");
}

/** Sloped fabric awning with a front valance. y = height of its front (lower) edge. */
export function awning(b, x, y, wd, proj, tint, rise = 0.55) {
  const l = x - wd / 2, rr = x + wd / 2;
  b.quad("mat_fabric_awning", [l, y, proj], [rr, y, proj], [rr, y + rise, 0], [l, y + rise, 0], { double: true, tint });
  b.quad("mat_fabric_awning", [rr, y - 0.3, proj], [l, y - 0.3, proj], [l, y, proj], [rr, y, proj], { tint });
}

/** Vertical pipe hugging the wall. */
export function pipe(b, x, y0, y1, r = 0.09, mat = "mat_metal_rust") {
  b.cylinder(mat, { x, z: r + 0.04, y0, y1, r, seg: 6, cap: false });
}

/** Thin cable (3-sided tube) from p0 to p1 with a downward sag, in the current frame. */
export function cable(b, p0, p1, sag = 0.5, seg = 3, rad = 0.02) {
  const pts = [];
  const n = 4;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t - Math.sin(t * Math.PI) * sag, p0[2] + (p1[2] - p0[2]) * t]);
  }
  b.tube("mat_prop_rubber", { pts, r: rad, seg, cap: false });
}

/** Cloth on a line: a cable plus `n` hanging cloths. */
export function laundry(b, r, x0, x1, y, z = 0.9, n = 3) {
  cable(b, [x0, y, z], [x1, y, z], 0.18, 3, 0.012);
  const step = (x1 - x0) / (n + 1);
  for (let i = 1; i <= n; i++) {
    const x = x0 + step * i, w = r.range(0.25, 0.5), h = r.range(0.4, 0.8);
    b.quad("mat_fabric_awning", [x + w / 2, y - h, z], [x - w / 2, y - h, z], [x - w / 2, y, z], [x + w / 2, y, z], { double: true, tint: r.pick(FABRIC) });
  }
}

/** Zig-zag fire escape on a wall: platforms every floor from floor 1 up to `top`. x = left edge. */
export function fireEscape(b, x, yFirst, count, width = 2.2) {
  const rail = "mat_metal_painted_dark";
  for (let f = 0; f < count; f++) {
    const y = yFirst + f * FLOOR_H;
    boxF(b, rail, [x, y, 0], [x + width, y + 0.08, 1.1], "newtb");
    boxF(b, rail, [x, y + 0.08, 1.05], [x + width, y + 1.0, 1.1], "nt");
    if (f < count - 1) {
      const a = f % 2 === 0;
      const xa = a ? x : x + width, xb = a ? x + width : x;
      b.quad(rail, [xa, y + 0.08, 1.2], [xb, y + FLOOR_H + 0.08, 1.2], [xb, y + FLOOR_H + 0.55, 1.2], [xa, y + 0.55, 1.2], { double: true });
    }
  }
}

/** Neon-lit door frame + lit lintel on a front wall (wall frame, x = centre). */
export function door(b, x, w = 1.8, h = 2.5, neon = "mat_light_warm") {
  boxF(b, "mat_metal_painted_dark", [x - w / 2 - 0.12, 0, 0], [x + w / 2 + 0.12, h + 0.12, 0.2], "newt");
  b.quad("mat_glass_dark", [x + w / 2, 0.05, 0.21], [x - w / 2, 0.05, 0.21], [x - w / 2, h, 0.21], [x + w / 2, h, 0.21]);
  b.quad(neon, [x + w / 2 + 0.12, h + 0.2, 0.22], [x - w / 2 - 0.12, h + 0.2, 0.22], [x - w / 2 - 0.12, h + 0.32, 0.22], [x + w / 2 + 0.12, h + 0.32, 0.22], { uv: "unit" });
}

/** Horizontal ledge strip along a wall (wall frame). */
export function ledge(b, x0, x1, y, h = 0.25, proj = 0.25, mat = "mat_wall_concrete_dark") {
  boxF(b, mat, [x0, y, 0], [x1, y + h, proj], "newtb");
}

// ---- roof parts (builder space) ---------------------------------------------------------------

/** Rooftop machine: box with a fan stub. */
export function hvac(b, x, y, z, sx, sy, sz, mat = "mat_metal_galvanized") {
  boxF(b, mat, [x - sx / 2, y, z - sz / 2], [x + sx / 2, y + sy, z + sz / 2], "sentw");
  b.cylinder("mat_metal_painted_dark", { x, z, y0: y + sy, y1: y + sy + 0.15, r: Math.min(sx, sz) * 0.32, seg: 6, cap: "top" });
}

export function waterTank(b, x, y, z, r = 1.2, h = 2.0) {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.5;
    b.cylinder("mat_metal_rust", { x: x + Math.cos(a) * r * 0.75, z: z + Math.sin(a) * r * 0.75, y0: y, y1: y + 1.2, r: 0.07, seg: 3, cap: false });
  }
  b.cylinder("mat_metal_plate_worn", { x, z, y0: y + 1.2, y1: y + 1.2 + h, r, seg: 8, cap: "both" });
  b.cylinder("mat_roof_tar", { x, z, y0: y + 1.2 + h, y1: y + 1.2 + h + 0.5, r, r1: 0.15, seg: 8, cap: false });
}

/** Satellite dish: cone on a short arm. `yaw` = heading it faces (compass radians). */
export function dish(b, x, y, z, yaw = 0, s = 1) {
  b.with({ pos: [x, y, z], rotY: yaw }, () => {
    boxF(b, "mat_metal_galvanized", [-0.04 * s, 0, -0.04 * s], [0.04 * s, 0.5 * s, 0.04 * s], "sentw");
    b.with({ pos: [0, 0.6 * s, 0], rot: [Math.PI / 2 - 0.5, 0, 0] }, () => {
      b.cylinder("mat_metal_galvanized", { x: 0, z: 0, y0: 0, y1: 0.28 * s, r: 0.5 * s, r1: 0.04 * s, seg: 8, cap: false });
    });
  });
}

/** Thin mast with two cross arms. */
export function antenna(b, x, y, z, h = 4) {
  b.cylinder("mat_metal_galvanized", { x, z, y0: y, y1: y + h, r: 0.04, seg: 4, cap: false });
  boxF(b, "mat_metal_galvanized", [x - 0.6, y + h * 0.7, z - 0.02], [x + 0.6, y + h * 0.7 + 0.04, z + 0.02], "ne");
  boxF(b, "mat_metal_galvanized", [x - 0.4, y + h * 0.88, z - 0.02], [x + 0.4, y + h * 0.88 + 0.04, z + 0.02], "ne");
  b.quad("mat_neon_red", [x + 0.04, y + h, z + 0.04], [x - 0.04, y + h, z + 0.04], [x - 0.04, y + h + 0.1, z + 0.04], [x + 0.04, y + h + 0.1, z + 0.04], { uv: "unit" });
}

/** Stair / lift bulkhead on the roof. */
export function bulkhead(b, x, y, z, sx = 3, sy = 2.6, sz = 3) {
  boxF(b, "mat_wall_concrete_panel", [x - sx / 2, y, z - sz / 2], [x + sx / 2, y + sy, z + sz / 2], "sentw");
  b.quad("mat_roof_tar", [x - sx / 2, y + sy, z - sz / 2], [x + sx / 2, y + sy, z - sz / 2], [x + sx / 2, y + sy, z + sz / 2], [x - sx / 2, y + sy, z + sz / 2]);
}

export function collide(b, ext, H, y0 = 0) {
  b.collider({ c: [(ext.x0 + ext.x1) / 2, y0 + (H - y0) / 2, (ext.z0 + ext.z1) / 2], h: [(ext.x1 - ext.x0) / 2, (H - y0) / 2, (ext.z1 - ext.z0) / 2] });
}

export function light(b, name, pos, color = "#ff2bd6", intensity = 1, range = 18) {
  b.anchor(`light.${name}`, pos, { color, intensity, range });
}

export function shuffle(r, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** x centres (wall-local) of each bay along a wall of length `len`. */
export function bayXs(len) {
  const n = bays(len);
  return Array.from({ length: n }, (_, i) => -len / 2 + BAY_W / 2 + BAY_W * i);
}

/** Draw `fn` at wall-local (x, y) with +Z out of the wall: shorthand for b.with({pos}). */
export const at = (b, x, y, z, fn) => b.with({ pos: [x, y, z] }, fn);
