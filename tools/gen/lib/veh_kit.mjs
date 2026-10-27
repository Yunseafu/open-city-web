// Shared parts for the vehicle recipes (tools/gen/assets/vehicles.mjs).
//
// Vehicle space: origin on the ground at the midpoint between the axles, +Z forward,
// +X to the vehicle's right, +Y up. "L" parts (x < 0) are on the vehicle's left.
// Paint is the white material `mat_veh_paint` tinted through vertex colour (`tint`).

import { v3, lerp, TAU } from "./math.mjs";
import { srgbToLinear } from "./materials.mjs";

export const PAINT = "mat_veh_paint";
export const GLASS = "mat_veh_glass";
export const TIRE = "mat_veh_tire";
export const CHROME = "mat_veh_chrome";
export const DARK = "mat_metal_painted_dark";
export const HEAD = "mat_veh_light_head";
export const TAIL = "mat_veh_light_tail";

/** "#rrggbb" -> linear tint for COLOR_0 (base colour is white, so the tint is the final colour). */
export const paintTint = (hex) => srgbToLinear(hex);

/** Piecewise-linear lookup in rows [key, ...values] sorted by key; returns the interpolated values. */
export function sampleRows(rows, z) {
  if (z <= rows[0][0]) return rows[0].slice(1);
  const last = rows[rows.length - 1];
  if (z >= last[0]) return last.slice(1);
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], c = rows[i + 1];
    if (z <= c[0]) {
      const t = (z - a[0]) / (c[0] - a[0]);
      return a.slice(1).map((v, k) => v + (c[k + 1] - v) * t);
    }
  }
  return last.slice(1);
}

/** Axis-aligned box from centre + size, all faces. */
export function blk(b, mat, c, s, o = {}) {
  b.boxC(mat, c, s, { skip: [], ...o });
}

/** Same box on both sides of the vehicle (x mirrored). */
export function blkSym(b, mat, c, s, o = {}) {
  blk(b, mat, c, s, o);
  blk(b, mat, [-c[0], c[1], c[2]], s, o);
}

/**
 * Lower body: a loft of 8-point rings (flat-shaded, angular). rows = [z, yBottom, yTop, halfWidth].
 * Returns lookups for the body top / bottom / half-width at any z.
 */
export function lowerBody(b, rows, tint, o = {}) {
  const topK = o.topK ?? 0.84; // deck half-width relative to the flank
  const botK = o.botK ?? 0.95; // bottom half-width relative to the flank
  const sillK = o.sillK ?? 0.18; // height of the widest point, as a fraction of the flank height
  const lip = o.lip ?? 0.06; // shoulder chamfer height
  const rings = rows.map(([z, yb, yt, hw]) => {
    const ys = yb + (yt - yb) * sillK;
    const hb = hw * botK, ht = hw * topK;
    return [
      [-hb, yb, z], [hb, yb, z], [hw, ys, z], [hw, yt - lip, z],
      [ht, yt, z], [-ht, yt, z], [-hw, yt - lip, z], [-hw, ys, z],
    ];
  });
  b.loft(PAINT, rings, { capStart: true, capEnd: true, tint });
  return {
    rows,
    yb: (z) => sampleRows(rows, z)[0],
    yt: (z) => sampleRows(rows, z)[1],
    hw: (z) => sampleRows(rows, z)[2],
    zMin: rows[0][0],
    zMax: rows[rows.length - 1][0],
  };
}

/** Cabin ring: [z, y0 (base), yr (roof), bw (half-width at the base), rw (half-width at the roof edge)]. */
function cabinRing([z, y0, yr, bw, rw], inset = 0) {
  const ux = rw + (bw - rw) * 0.15, yu = yr - 0.07, tx = rw * 0.62;
  const s = 1 - inset;
  return [
    [-bw * s, y0, z], [bw * s, y0, z], [ux * s, yu - inset, z],
    [tx * s, yr + 0.01 - inset, z], [-tx * s, yr + 0.01 - inset, z], [-ux * s, yu - inset, z],
  ];
}

/**
 * Glass house on top of the body: a glass loft, a dark interior shell inside it, a paint roof slab
 * and paint pillars. rows = [z, y0|null (null = follow the body top), yr, bw, rw]; the first and last
 * rows are the window bases (given a thin lip so the loft can close).
 * o.b: extra B-pillar z positions. o.roof: [i0, i1] row indices the roof slab spans (default 1..n-2).
 */
export function greenhouse(b, body, rows, tint, o = {}) {
  const st = rows.map(([z, y0, yr, bw, rw]) => {
    const base = y0 ?? body.yt(z);
    return [z, base, Math.max(yr, base + 0.04), bw, rw];
  });
  b.loft(GLASS, st.map((r) => cabinRing(r)), { capStart: true, capEnd: true });
  b.loft(DARK, st.map((r) => cabinRing(r, 0.06)), { capStart: true, capEnd: true });
  const [i0, i1] = o.roof ?? [1, st.length - 2];
  const e = 0.012;
  const slabRing = ([z, y0, yr, bw, rw]) => {
    const ux = rw + (bw - rw) * 0.15 + e, yu = yr - 0.07, tx = rw * 0.62 + e;
    return [[-ux, yu, z], [ux, yu, z], [tx, yr + 0.01 + e, z], [-tx, yr + 0.01 + e, z]];
  };
  b.loft(PAINT, st.slice(i0, i1 + 1).map(slabRing), { capStart: true, capEnd: true, tint });
  // pillars: A (first -> second row), C (second to last -> last row) and B at given z positions
  const corner = (r, up) => {
    const [z, y0, yr, bw, rw] = r;
    const ux = rw + (bw - rw) * 0.15;
    return up ? [ux, yr - 0.07, z] : [bw, y0, z];
  };
  const pw = o.pillarW ?? 0.075;
  const pil = (r0, up0, r1, up1) => {
    for (const side of [-1, 1]) {
      const p = corner(r0, up0), q = corner(r1, up1);
      beam(b, PAINT, [p[0] * side, p[1], p[2]], [q[0] * side, q[1], q[2]], pw, 0.05, side, tint);
    }
  };
  const full = (r) => r[2] - r[1] > 0.3; // a full-height end row is a wall (cargo bulkhead), so its pillar is vertical
  const n = st.length;
  if (full(st[0])) pil(st[0], false, st[0], true);
  else pil(st[0], false, st[1], true);
  if (full(st[n - 1])) pil(st[n - 1], false, st[n - 1], true);
  else pil(st[n - 2], true, st[n - 1], false);
  for (const zb of o.b ?? []) {
    const lerpRow = (zz) => {
      const v = sampleRows(st.map((r) => [r[0], r[1], r[2], r[3], r[4]]), zz);
      return [zz, v[0], v[1], v[2], v[3]];
    };
    const r = lerpRow(zb);
    pil(r, false, r, true);
  }
  return st;
}

/** Straight bar between two points with a w x t cross-section; t is measured along x (outward = side). */
export function beam(b, mat, a, c, w, t, side, tint) {
  const d = v3.norm(v3.sub(c, a));
  const e2 = [side, 0, 0];
  let e1 = v3.cross(d, e2);
  if (v3.len(e1) < 1e-6) e1 = [0, 0, 1];
  e1 = v3.norm(e1);
  const ring = (p) => [
    v3.add(v3.add(p, v3.scale(e1, w / 2)), v3.scale(e2, t / 2)),
    v3.add(v3.add(p, v3.scale(e1, -w / 2)), v3.scale(e2, t / 2)),
    v3.add(v3.add(p, v3.scale(e1, -w / 2)), v3.scale(e2, -t / 2)),
    v3.add(v3.add(p, v3.scale(e1, w / 2)), v3.scale(e2, -t / 2)),
  ];
  b.loft(mat, [ring(a), ring(c)], { capStart: true, capEnd: true, tint });
}

function rimFace(b, R, W, seg, rim, rimNeon) {
  const y = W / 2 + 0.004;
  b.lathe(rim, [[R * 0.62, y], [R * 0.2, y]], { seg }, { ao: 1 });
  b.lathe(DARK, [[R * 0.2, y + 0.012], [0, y + 0.012]], { seg: Math.min(seg, 8) }, { ao: 1 });
  // five dark spokes read as a rim design at game distance
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    b.with({ pos: [Math.cos(a) * R * 0.36, y + 0.004, Math.sin(a) * R * 0.36], rot: [0, -a, 0] }, () => {
      b.boxC(DARK, [0, 0, 0], [R * 0.34, 0.006, R * 0.075], { skip: ["b", "n", "s", "e", "w"], ao: 1 });
    });
  }
  if (rimNeon) b.lathe(rimNeon, [[R * 0.6, y + 0.006], [R * 0.55, y + 0.006]], { seg }, { ao: 1 });
}

/**
 * Tyre + rim + hub, axle along local X, centred on the node origin. side < 0 = left wheel (rim faces -X).
 * o.both draws the rim on both faces (motorcycles).
 */
export function wheelGeo(b, side, o) {
  const { R, W, rim = CHROME, rimNeon = null, seg = 14 } = o;
  b.with({ rot: [0, 0, side < 0 ? Math.PI / 2 : -Math.PI / 2] }, () => {
    b.lathe(
      TIRE,
      [[R * 0.5, -W / 2], [R * 0.9, -W / 2], [R, -W * 0.3], [R, W * 0.3], [R * 0.9, W / 2], [R * 0.5, W / 2]],
      { seg, crease: 30 },
      { ao: 1 },
    );
    rimFace(b, R, W, seg, rim, rimNeon);
    if (o.both) b.with({ rot: [Math.PI, 0, 0] }, () => rimFace(b, R, W, seg, rim, rimNeon));
  });
}

/**
 * Four (or `axles` x 2) wheels as named nodes plus dark wheel-arch discs on the body flanks.
 * axles: [{ z, front?, name: "F"|"R", R?, W? }]; body supplies half-width and bottom height at z.
 */
export function wheels(b, body, axles, o = {}) {
  for (const ax of axles) {
    const R = ax.R ?? o.R, W = ax.W ?? o.W;
    const hw = ax.hw ?? body.hw(ax.z);
    const yb = ax.yb ?? body.yb(ax.z);
    for (const side of [-1, 1]) {
      const x = side * (hw + 0.012 - W / 2);
      const name = `wheel_${ax.name}${side < 0 ? "L" : "R"}`;
      b.node(name, { pos: [x, R, ax.z] }, () => wheelGeo(b, side, { R, W, rimNeon: o.rimNeon, seg: o.seg }));
      if (ax.dual) {
        // second, inner tyre of a dual rear wheel (fixed to the body, not a separate node)
        b.with({ pos: [x - side * (W + 0.02), R, ax.z] }, () => wheelGeo(b, side, { R, W, seg: o.seg }));
      }
      archDisc(b, side, hw + 0.003, R, ax.z, R + (o.archGap ?? 0.07), yb + 0.0);
    }
  }
}

/** Dark half-disc on the flank around a wheel, clipped at the body bottom. */
export function archDisc(b, side, x, cy, cz, Rr, yBottom) {
  const k = Math.max(-0.999, Math.min(0.999, (yBottom - cy) / Rr));
  const phi0 = Math.asin(k);
  const seg = 10;
  const P = [], N = [], UV = [];
  for (let i = 0; i <= seg; i++) {
    const phi = lerp(phi0, Math.PI - phi0, i / seg);
    P.push([x * 1, cy + Math.sin(phi) * Rr, cz + Math.cos(phi) * Rr]);
    N.push([side, 0, 0]);
    UV.push([0, 0]);
  }
  P.push([x, cy, cz]); // fan centre
  N.push([side, 0, 0]);
  UV.push([0, 0]);
  const idx = [];
  for (let i = 0; i < seg; i++) idx.push([P.length - 1, i, i + 1]);
  // pos x already includes the side sign
  for (let i = 0; i < P.length; i++) P[i][0] = side * Math.abs(x);
  b.mesh(DARK, P, N, UV, idx, { ao: 1 });
}

/** Thin dark door seams + chrome handles on both flanks. zs = seam z positions. */
export function doorSeams(b, body, zs, o = {}) {
  const y0 = o.y0 ?? body.yb(0) + 0.1, y1 = o.y1 ?? body.yt(0) - 0.06;
  for (const side of [-1, 1]) {
    for (const z of zs) {
      const hw = body.hw(z);
      blk(b, DARK, [side * (hw + 0.004), (y0 + y1) / 2, z], [0.01, y1 - y0, 0.014], { ao: 1 });
    }
    for (const z of o.handles ?? []) {
      const hw = body.hw(z);
      blk(b, CHROME, [side * (hw + 0.012), y1 - 0.1, z], [0.025, 0.03, 0.13], { ao: 1 });
    }
  }
}

/** Dark sill skirts along the flanks. */
export function skirts(b, body, z0, z1, o = {}) {
  const h = o.h ?? 0.13;
  for (const side of [-1, 1]) {
    const hw = body.hw((z0 + z1) / 2);
    const yb = body.yb((z0 + z1) / 2);
    blk(b, DARK, [side * (hw + 0.012), yb + h / 2 - 0.01, (z0 + z1) / 2], [0.045, h, z1 - z0], { ao: 1 });
  }
}

/** Side mirrors. */
export function mirrors(b, tint, x, y, z) {
  for (const side of [-1, 1]) {
    blk(b, DARK, [side * x, y, z], [0.1, 0.1, 0.17], { ao: 1 });
    blk(b, PAINT, [side * (x + 0.005), y, z], [0.07, 0.075, 0.14], { tint, ao: 1 });
    blk(b, DARK, [side * (x - 0.07), y - 0.04, z - 0.03], [0.1, 0.03, 0.04], { ao: 1 });
  }
}

/** Underglow neon strips under both sills. */
export function underglow(b, mat, hw, y, z0, z1) {
  for (const side of [-1, 1]) {
    blk(b, mat, [side * (hw * 0.96), y, (z0 + z1) / 2], [0.035, 0.03, z1 - z0], { ao: 1 });
  }
}

/** Number plate (small light-grey slab). */
export function plate(b, x, y, z, front) {
  blk(b, "mat_metal_galvanized", [x, y, z + (front ? 0.01 : -0.01)], [0.52, 0.12, 0.02], { ao: 1 });
}

/** Light anchors (L / R) for the game to put point lights on. */
export function lightAnchors(b, kind, x, y, z, color, intensity = 1, range = 18) {
  b.anchor(`light.${kind}_L`, [-x, y, z], { color, intensity, range });
  b.anchor(`light.${kind}_R`, [x, y, z], { color, intensity, range });
}

export const NEON_UNDERGLOW = ["mat_neon_cyan", "mat_neon_magenta", "mat_neon_purple", "mat_neon_green", "mat_neon_amber"];

/** Paint (or any material) volume using the same ring shape as the glass house; rows = [z, y0, yr, bw, rw]. */
export function paintVolume(b, body, rows, tint, mat = PAINT) {
  const st = rows.map(([z, y0, yr, bw, rw]) => [z, y0 ?? body.yt(z), yr, bw, rw]);
  const rings = st.map(([z, y0, yr, bw, rw]) => {
    const ux = rw + (bw - rw) * 0.15, yu = yr - 0.07, tx = rw * 0.62;
    return [[-bw, y0, z], [bw, y0, z], [ux, yu, z], [tx, yr + 0.01, z], [-tx, yr + 0.01, z], [-ux, yu, z]];
  });
  b.loft(mat, rings, { capStart: true, capEnd: true, tint });
}

/** Flat quad on a vehicle flank (side: -1 left, +1 right) from z0 to z1 (z0 < z1) and y0..y1, at x. */
export function sideQuad(b, mat, side, x, y0, y1, z0, z1, o = {}) {
  const X = side * x;
  if (side > 0) b.quad(mat, [X, y0, z0], [X, y0, z1], [X, y1, z1], [X, y1, z0], { uv: "unit", ao: 1, ...o });
  else b.quad(mat, [X, y0, z1], [X, y0, z0], [X, y1, z0], [X, y1, z1], { uv: "unit", ao: 1, ...o });
}
