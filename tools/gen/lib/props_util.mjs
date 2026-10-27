// Small helpers shared by the street / alley / plaza prop recipes.
import { v3, TAU } from "./math.mjs";

/** Square or rectangular bar between two points (flat shaded, capped). w = side width, d = thickness. */
export function strut(b, mat, p0, p1, w = 0.05, d = w, o = {}) {
  const t = v3.norm(v3.sub(p1, p0));
  const ref = Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const s = v3.norm(v3.cross(ref, t));
  const u = v3.cross(t, s);
  const mk = (p) => [
    v3.add(p, v3.add(v3.scale(s, -w / 2), v3.scale(u, -d / 2))),
    v3.add(p, v3.add(v3.scale(s, w / 2), v3.scale(u, -d / 2))),
    v3.add(p, v3.add(v3.scale(s, w / 2), v3.scale(u, d / 2))),
    v3.add(p, v3.add(v3.scale(s, -w / 2), v3.scale(u, d / 2))),
  ];
  const caps = o.caps !== false;
  b.loft(mat, [mk(p0), mk(p1)], { capStart: caps, capEnd: caps, ...o });
}

/** Flat fan disc at `c` with normal `axis`. Cheap lamp lens / vent / grille. */
export function disc(b, mat, c, r, axis, seg = 8, o = {}) {
  const n = v3.norm(axis);
  const ref = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const s = v3.norm(v3.cross(ref, n));
  const u = v3.cross(n, s);
  const P = [c], N = [n], UV = [[0, 0]], idx = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * TAU;
    const ca = Math.cos(a) * r, sa = Math.sin(a) * r;
    P.push(v3.add(c, v3.add(v3.scale(s, ca), v3.scale(u, sa))));
    N.push(n);
    UV.push([ca, -sa]);
  }
  for (let i = 0; i < seg; i++) idx.push([0, 1 + i, 1 + ((i + 1) % seg)]);
  b.mesh(mat, P, N, UV, idx, o);
}

/** Thin horizontal neon band wrapped around a vertical axis (halo / ring light). */
export function halo(b, mat, y, r, h = 0.08, seg = 12, x = 0, z = 0) {
  b.lathe(mat, [[r - h * 0.5, y], [r, y + h * 0.3], [r, y + h * 0.7], [r - h * 0.5, y + h]], { x, z, seg, crease: 100 });
}

/** Axis-aligned slab given by centre and size, shorthand. */
export const slab = (b, mat, cx, cy, cz, sx, sy, sz, o = {}) => b.boxC(mat, [cx, cy, cz], [sx, sy, sz], o);

/** Vertical pole with optional taper. */
export function pole(b, mat, x, z, y0, y1, r, r1 = r, seg = 8, cap = "top") {
  b.cylinder(mat, { x, z, y0, y1, r, r1, seg, cap });
}

/** Cylinder lying along Z from z0 to z1 at (x, y). */
export function cylZ(b, mat, x, y, z0, z1, r, r1 = r, seg = 8, cap = "both") {
  b.with({ pos: [x, y, z0], rot: [Math.PI / 2, 0, 0] }, () => b.cylinder(mat, { y0: 0, y1: z1 - z0, r, r1, seg, cap }));
}

/** Cylinder lying along X from x0 to x1 at (y, z). */
export function cylX(b, mat, x0, x1, y, z, r, r1 = r, seg = 8, cap = "both") {
  b.with({ pos: [x0, y, z], rot: [0, 0, -Math.PI / 2] }, () => b.cylinder(mat, { y0: 0, y1: x1 - x0, r, r1, seg, cap }));
}

/**
 * Flat rectangles for emissive panels, screens and decals. Corner order follows the builder's rule
 * (bottom-left, bottom-right, top-right, top-left as seen from outside in the left-handed world),
 * so the face is visible from the side its normal points to.
 */
/** In the XY plane at z. Faces +Z unless `back` (then faces -Z). */
export function panelZ(b, mat, cx, cy, z, w, h, back = false, o = {}) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  if (!back) b.quad(mat, [x1, y0, z], [x0, y0, z], [x0, y1, z], [x1, y1, z], { uv: "unit", ...o });
  else b.quad(mat, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], { uv: "unit", ...o });
}

/** In the YZ plane at x. Faces +X unless `back` (then faces -X). */
export function panelX(b, mat, x, cy, cz, w, h, back = false, o = {}) {
  const z0 = cz - w / 2, z1 = cz + w / 2, y0 = cy - h / 2, y1 = cy + h / 2;
  if (!back) b.quad(mat, [x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], { uv: "unit", ...o });
  else b.quad(mat, [x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1], { uv: "unit", ...o });
}

/** In the XZ plane at height y. Faces down unless `up` (lamp lenses, light strips under canopies). */
export function panelY(b, mat, cx, y, cz, w, d, up = false, o = {}) {
  const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
  if (up) b.quad(mat, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], { uv: "unit", ...o });
  else b.quad(mat, [x1, y, z0], [x0, y, z0], [x0, y, z1], [x1, y, z1], { uv: "unit", ...o });
}
