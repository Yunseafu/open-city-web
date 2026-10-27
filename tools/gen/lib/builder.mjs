// ModelBuilder: a tiny procedural modelling kit that writes into a node tree of
// per-material triangle batches. See docs/models.md for the conventions.
//
// Space: metres, +Y up, +X east, +Z north, left-handed (this is Babylon's world
// space, not glTF's). The exporter converts to glTF.
//
// Winding: every emitted triangle (a, b, c) satisfies cross(b - a, c - a) = outward
// normal, in builder space. Helpers handle it; only `tri()` is raw.
//
// UV0 for tiling surfaces is in metres. u grows to the right of a viewer who looks
// at the face from outside, v grows DOWNWARD (glTF image space: v = 0 is the top row),
// so on a vertical face v = -y. Horizontal faces: u = +x, v = -z (north is image-up).

import earcut from "earcut";
import { mat4, v3, quat, lerp, clamp, TAU } from "./math.mjs";
import { material as lookupMaterial } from "./materials.mjs";

class Geo {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
  }
  get verts() {
    return this.pos.length / 3;
  }
  get tris() {
    return this.idx.length / 3;
  }
}

class BNode {
  constructor(name, parent = null, t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) {
    this.name = name;
    this.parent = parent;
    this.t = t;
    this.q = q;
    this.s = s;
    this.children = [];
    this.geo = new Map(); // material id -> Geo
    this.extras = null;
  }
}

/** Transform spec -> matrix. `rot` is euler [x,y,z] (YXZ order), `rotY` a heading in radians (0 = north, pi/2 = east). */
export function xformMatrix(xf = {}) {
  const pos = xf.pos ?? [0, 0, 0];
  const sc = typeof xf.scale === "number" ? [xf.scale, xf.scale, xf.scale] : (xf.scale ?? [1, 1, 1]);
  const r = xf.rot ?? [0, 0, 0];
  const q = quat.fromEuler(r[0], (r[1] ?? 0) + (xf.rotY ?? 0), r[2]);
  return mat4.fromTRS(pos, q, sc);
}

export class ModelBuilder {
  /** @param {{flatten?: boolean}} opts flatten = bake nodes into the root (used when placing into a chunk) */
  constructor({ flatten = false } = {}) {
    this.flatten = flatten;
    this.root = new BNode("root");
    this.cur = this.root;
    this.stack = [];
    this._setMatrix(mat4.identity());
    this.anchors = [];
    this.colliders = [];
    this.clips = [];
    /** Default vertex AO: number, or {y0, y1, lo, hi} (darker near the ground). Per-call `ao` overrides. */
    this.ao = null;
    /** Default vertex tint [r,g,b] multiplied into COLOR_0. Per-call `tint` overrides. */
    this.tint = null;
    this._nodeNames = new Set();
  }

  // ---- transforms ---------------------------------------------------------
  _setMatrix(m) {
    this.m = m;
    this.nm = mat4.normalMatrix(m);
    this.flip = mat4.det3(m) < 0;
  }

  push() {
    this.stack.push(this.m);
  }
  pop() {
    this._setMatrix(this.stack.pop());
  }
  transform(xf) {
    this._setMatrix(mat4.mul(this.m, xformMatrix(xf)));
  }

  /** Run `fn` with an extra transform applied to everything it emits. */
  with(xf, fn) {
    this.push();
    this.transform(xf);
    const out = fn(this);
    this.pop();
    return out;
  }

  /**
   * Named child node. In a normal builder this is a real glTF node (animatable, findable at
   * runtime, geometry stays in its own local space). In a flatten builder it is just `with`.
   */
  node(name, xf, fn) {
    if (this.flatten) return this.with(xf, fn);
    if (this._nodeNames.has(name)) throw new Error(`duplicate node name "${name}"`);
    this._nodeNames.add(name);
    const pos = xf?.pos ?? [0, 0, 0];
    const sc = typeof xf?.scale === "number" ? [xf.scale, xf.scale, xf.scale] : (xf?.scale ?? [1, 1, 1]);
    const r = xf?.rot ?? [0, 0, 0];
    const q = quat.fromEuler(r[0], (r[1] ?? 0) + (xf?.rotY ?? 0), r[2]);
    const node = new BNode(name, this.cur, pos, q, sc);
    if (xf?.extras) node.extras = xf.extras;
    this.cur.children.push(node);
    const saved = { cur: this.cur, stack: this.stack, m: this.m };
    this.cur = node;
    this.stack = [];
    this._setMatrix(mat4.identity());
    fn?.(this);
    this.cur = saved.cur;
    this.stack = saved.stack;
    this._setMatrix(saved.m);
    return node;
  }

  /** Place another asset recipe (`{ build(b, rng, params) }`) at a transform. */
  place(asset, xf, rng, params) {
    return this.with(xf, () => asset.build(this, rng, params));
  }

  // ---- metadata -----------------------------------------------------------
  /** Gameplay marker (light, spawn, door, parking spot...). Node `anchor_<name>` in props, entry in the chunk sidecar. */
  anchor(name, pos, extras = {}) {
    const wp = mat4.point(this.m, pos);
    const heading = Math.atan2(this.m[8], this.m[0]);
    this.anchors.push({ name, pos: wp, rotY: heading, ...extras });
    if (!this.flatten) {
      const q = quat.fromEuler(0, 0, 0);
      const node = new BNode(`anchor_${name}`, this.cur, pos, q, [1, 1, 1]);
      node.extras = { anchor: name, ...extras };
      this.cur.children.push(node);
    }
  }

  /** Oriented box collider for physics: {c: centre, h: half extents} in the current frame. */
  collider(box, kind = "solid") {
    const c = mat4.point(this.m, box.c);
    const sx = Math.hypot(this.m[0], this.m[1], this.m[2]);
    const sy = Math.hypot(this.m[4], this.m[5], this.m[6]);
    const sz = Math.hypot(this.m[8], this.m[9], this.m[10]);
    this.colliders.push({
      kind,
      c,
      h: [box.h[0] * sx, box.h[1] * sy, box.h[2] * sz],
      rotY: Math.atan2(this.m[8], this.m[0]),
    });
  }

  /**
   * Keyframe clip over named nodes. tracks: [{ node, path: "rotation"|"translation"|"scale",
   * keys: [{ t: seconds, v: [x,y,z] }] }]; rotation values are euler radians (YXZ).
   */
  clip(name, tracks) {
    this.clips.push({ name, tracks });
  }

  // ---- core emit ----------------------------------------------------------
  _geo(matId) {
    lookupMaterial(matId);
    let g = this.cur.geo.get(matId);
    if (!g) this.cur.geo.set(matId, (g = new Geo()));
    return g;
  }

  _vertColor(y, o) {
    const ao = o.ao !== undefined ? o.ao : this.ao;
    let a = 1;
    if (typeof ao === "number") a = ao;
    else if (ao) a = lerp(ao.lo, ao.hi, clamp((y - ao.y0) / (ao.y1 - ao.y0), 0, 1));
    const t = o.tint ?? this.tint ?? [1, 1, 1];
    return [t[0] * a, t[1] * a, t[2] * a, 1];
  }

  /**
   * Low-level: P = positions, N = normals, UV = [u,v] each, idx = triangles [i,j,k] with
   * cross(b-a, c-a) along the outward normal.
   */
  _emit(matId, P, N, UV, idx, o = {}) {
    const g = this._geo(matId);
    const base = g.verts;
    for (let i = 0; i < P.length; i++) {
      const p = mat4.point(this.m, P[i]);
      const n = this.nm;
      const nx = N[i][0], ny = N[i][1], nz = N[i][2];
      let wn = [n[0] * nx + n[3] * ny + n[6] * nz, n[1] * nx + n[4] * ny + n[7] * nz, n[2] * nx + n[5] * ny + n[8] * nz];
      wn = v3.norm(wn);
      g.pos.push(p[0], p[1], p[2]);
      g.nrm.push(wn[0], wn[1], wn[2]);
      g.uv.push(UV[i][0], UV[i][1]);
      const c = this._vertColor(P[i][1], o);
      g.col.push(c[0], c[1], c[2], c[3]);
    }
    for (const t of idx) {
      if (this.flip) g.idx.push(base + t[0], base + t[2], base + t[1]);
      else g.idx.push(base + t[0], base + t[1], base + t[2]);
    }
  }

  /** Raw triangle with a flat normal. cross(b-a, c-a) must point outward. */
  tri(matId, a, b, c, o = {}) {
    const n = v3.norm(v3.cross(v3.sub(b, a), v3.sub(c, a)));
    const uvs = o.uv ?? [[0, 0], [1, 0], [0, 1]];
    this._emit(matId, [a, b, c], [n, n, n], uvs, [[0, 1, 2]], o);
  }

  /**
   * Flat quad. Corners are bottom-left, bottom-right, top-right, top-left as seen by a viewer
   * outside the face (left-handed world). `o.uv`: "meters" (default) | "unit" | {x,y,w,h} atlas rect
   * | 4 explicit [u,v]. `o.uOff`/`o.vOff` shift tiling UVs. `o.double` also emits the back face.
   */
  quad(matId, p0, p1, p2, p3, o = {}) {
    const d1 = v3.sub(p2, p0), d2 = v3.sub(p3, p1);
    let n = v3.norm(v3.scale(v3.cross(d1, d2), -1));
    const P = [p0, p1, p2, p3];
    let UV;
    const uvMode = o.uv ?? "meters";
    if (uvMode === "unit") UV = [[0, 1], [1, 1], [1, 0], [0, 0]];
    else if (Array.isArray(uvMode)) UV = uvMode;
    else if (typeof uvMode === "object") {
      const { x, y, w, h } = uvMode;
      UV = [[x, y + h], [x + w, y + h], [x + w, y], [x, y]];
      if (o.flipU) UV = [UV[1], UV[0], UV[3], UV[2]];
    } else UV = this._metersUV(P, n, o);
    this._emit(matId, P, [n, n, n, n], UV, [[0, 2, 1], [0, 3, 2]], o);
    if (o.double) {
      const nb = v3.scale(n, -1);
      this._emit(matId, P, [nb, nb, nb, nb], UV, [[0, 1, 2], [0, 2, 3]], o);
    }
  }

  _metersUV(P, n, o) {
    const up = [0, 1, 0];
    const vert = Math.abs(n[1]) < 0.01;
    let vAxis;
    if (Math.abs(n[1]) > 0.999) vAxis = [0, 0, 1];
    else vAxis = v3.norm(v3.sub(up, v3.scale(n, v3.dot(n, up))));
    const uAxis = v3.norm(v3.cross(n, vAxis));
    const o0 = P[0];
    const uOff = o.uOff ?? 0, vOff = o.vOff ?? 0;
    return P.map((p) => {
      const u = v3.dot(v3.sub(p, o0), uAxis) + uOff;
      const v = vert ? -(p[1] + vOff) : -(v3.dot(v3.sub(p, o0), vAxis) + vOff);
      return [u, v];
    });
  }

  /** Vertical wall from a=[x,z] to b=[x,z]; the visible side is to the RIGHT of the a->b direction. u runs a->b. */
  wall(matId, a, b, y0, y1, o = {}) {
    this.quad(matId, [a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], o);
  }

  /** Horizontal polygon at height y. pts = [[x,z]...]. Faces up unless o.down. */
  poly(matId, pts, y, o = {}) {
    const flat = pts.flat();
    const tris = earcut(flat);
    const P = pts.map(([x, z]) => [x, y, z]);
    const dir = o.down ? -1 : 1;
    const N = pts.map(() => [0, dir, 0]);
    const UV = pts.map(([x, z]) => [x + (o.uOff ?? 0), -(z + (o.vOff ?? 0))]);
    const idx = [];
    for (let i = 0; i < tris.length; i += 3) {
      const [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]];
      const cr = v3.cross(v3.sub(P[b], P[a]), v3.sub(P[c], P[a]));
      if (cr[1] * dir > 0) idx.push([a, b, c]);
      else idx.push([a, c, b]);
    }
    this._emit(matId, P, N, UV, idx, o);
  }

  /**
   * Axis-aligned box from min corner to max corner. `o.mats` overrides the material per face:
   * { s, e, n, w, t, b, side }. `o.skip` lists faces to leave out (e.g. ["b"]). Faces: s = -z, e = +x, n = +z, w = -x, t = top, b = bottom.
   */
  box(matId, min, max, o = {}) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    const skip = o.skip ?? ["b"];
    const m = o.mats ?? {};
    const side = m.side ?? matId;
    const face = (k, fn) => {
      if (!skip.includes(k)) fn(m[k] ?? (k === "t" || k === "b" ? matId : side));
    };
    face("s", (mm) => this.wall(mm, [x0, z0], [x1, z0], y0, y1, o));
    face("e", (mm) => this.wall(mm, [x1, z0], [x1, z1], y0, y1, o));
    face("n", (mm) => this.wall(mm, [x1, z1], [x0, z1], y0, y1, o));
    face("w", (mm) => this.wall(mm, [x0, z1], [x0, z0], y0, y1, o));
    face("t", (mm) => this.quad(mm, [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], o));
    face("b", (mm) => this.quad(mm, [x1, y0, z0], [x0, y0, z0], [x0, y0, z1], [x1, y0, z1], o));
  }

  /** Box from centre and size. */
  boxC(matId, c, s, o = {}) {
    this.box(matId, [c[0] - s[0] / 2, c[1] - s[1] / 2, c[2] - s[2] / 2], [c[0] + s[0] / 2, c[1] + s[1] / 2, c[2] + s[2] / 2], o);
  }

  /**
   * Prism over an arbitrary footprint [[x,z]...] between y0 and y1. Footprint winding does not matter.
   * `o.mats`: { side, top, bottom }. `o.top` (default true) / `o.bottom` (default false).
   */
  prism(matId, pts, y0, y1, o = {}) {
    let area = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      area += a[0] * b[1] - b[0] * a[1];
    }
    const ring = area >= 0 ? pts : [...pts].reverse(); // CCW with x right / z up
    const m = o.mats ?? {};
    let u = o.uOff ?? 0;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], b = ring[(i + 1) % ring.length];
      this.wall(m.side ?? matId, a, b, y0, y1, { ...o, uOff: o.uContinuous ? u : (o.uOff ?? 0) });
      u += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    if (o.top !== false) this.poly(m.top ?? matId, ring, y1, o);
    if (o.bottom) this.poly(m.bottom ?? matId, ring, y0, { ...o, down: true });
  }

  /** Generic indexed mesh. Triangles are re-wound to match the vertex normals if `autoWind` (default). */
  mesh(matId, P, N, UV, idx, o = {}) {
    let tris = idx;
    if (o.autoWind !== false) {
      tris = idx.map(([a, b, c]) => {
        const cr = v3.cross(v3.sub(P[b], P[a]), v3.sub(P[c], P[a]));
        const n = v3.add(v3.add(N[a], N[b]), N[c]);
        return v3.dot(cr, n) < 0 ? [a, c, b] : [a, b, c];
      });
    }
    this._emit(matId, P, N, UV, tris, o);
  }

  /**
   * Vertical (or tapered) cylinder / cone. { x, z, y0, y1, r, r1 (top radius, default r), seg, cap: "top"|"bottom"|"both"|false }.
   * Smooth-shaded sides.
   */
  cylinder(matId, s, o = {}) {
    const { x = 0, z = 0, y0, y1, r, seg = 12 } = s;
    const r1 = s.r1 ?? r;
    const cap = s.cap ?? "top";
    const P = [], N = [], UV = [], idx = [];
    const slope = (r - r1) / (y1 - y0); // radial normal tilts up when the top is narrower
    const circ = TAU * Math.max(r, r1);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * TAU;
      const ca = Math.cos(a), sa = Math.sin(a);
      const n = v3.norm([ca, slope, sa]);
      P.push([x + ca * r, y0, z + sa * r], [x + ca * r1, y1, z + sa * r1]);
      N.push(n, n);
      const u = (i / seg) * circ;
      UV.push([u, -y0], [u, -y1]);
    }
    for (let i = 0; i < seg; i++) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      idx.push([a, b, c], [b, d, c]);
    }
    this.mesh(matId, P, N, UV, idx, o);
    const disc = (y, rr, dir) => {
      if (rr <= 1e-6) return;
      const cp = [[x, y, z]], cn = [[0, dir, 0]], cuv = [[0, 0]], ci = [];
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * TAU;
        cp.push([x + Math.cos(a) * rr, y, z + Math.sin(a) * rr]);
        cn.push([0, dir, 0]);
        cuv.push([Math.cos(a) * rr, -Math.sin(a) * rr]);
      }
      for (let i = 0; i < seg; i++) ci.push([0, 1 + i, 1 + ((i + 1) % seg)]);
      this.mesh(matId, cp, cn, cuv, ci, o);
    };
    if (cap === "top" || cap === "both") disc(y1, r1, 1);
    if (cap === "bottom" || cap === "both") disc(y0, r, -1);
  }

  /** Low-poly UV sphere / ellipsoid. { c, r (number or [rx,ry,rz]), seg, rings }. */
  sphere(matId, s, o = {}) {
    const { c = [0, 0, 0], seg = 10, rings = 6 } = s;
    const rr = typeof s.r === "number" ? [s.r, s.r, s.r] : s.r;
    const P = [], N = [], UV = [], idx = [];
    for (let j = 0; j <= rings; j++) {
      const phi = (j / rings) * Math.PI;
      for (let i = 0; i <= seg; i++) {
        const th = (i / seg) * TAU;
        const d = [Math.sin(phi) * Math.cos(th), Math.cos(phi), Math.sin(phi) * Math.sin(th)];
        P.push([c[0] + d[0] * rr[0], c[1] + d[1] * rr[1], c[2] + d[2] * rr[2]]);
        N.push(v3.norm([d[0] / rr[0], d[1] / rr[1], d[2] / rr[2]]));
        UV.push([(i / seg) * TAU * rr[0], -(c[1] + d[1] * rr[1])]);
      }
    }
    const row = seg + 1;
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * row + i, b = a + 1, c2 = a + row, d2 = c2 + 1;
        if (j > 0) idx.push([a, c2, b]);
        if (j < rings - 1) idx.push([b, c2, d2]);
      }
    }
    this.mesh(matId, P, N, UV, idx, o);
  }

  /**
   * Surface of revolution around the vertical axis through (x, z).
   * profile = [[radius, y]...] from bottom to top. Corners sharper than `crease` degrees
   * (default 40) stay hard; softer ones are smooth-shaded.
   */
  lathe(matId, profile, s = {}, o = {}) {
    const { x = 0, z = 0, seg = 12, crease = 40 } = s;
    const n2 = profile.length;
    // 2D outward normals of each profile segment (radius, y)
    const segN = [];
    for (let i = 0; i < n2 - 1; i++) {
      const dr = profile[i + 1][0] - profile[i][0], dy = profile[i + 1][1] - profile[i][1];
      const l = Math.hypot(dr, dy) || 1;
      segN.push([dy / l, -dr / l]); // rotate segment direction by -90deg: outward when walking bottom->top on the outside
    }
    // build "ring points": each has (radius, y, normal2)
    const rp = [];
    const cosCrease = Math.cos((crease * Math.PI) / 180);
    for (let i = 0; i < n2; i++) {
      const a = segN[i - 1], b = segN[i];
      if (!a) rp.push({ r: profile[i][0], y: profile[i][1], n: b, seg: i });
      else if (!b) rp.push({ r: profile[i][0], y: profile[i][1], n: a, seg: i - 1 });
      else if (a[0] * b[0] + a[1] * b[1] >= cosCrease) {
        const n = v3.norm([a[0] + b[0], a[1] + b[1], 0]);
        rp.push({ r: profile[i][0], y: profile[i][1], n: [n[0], n[1]], seg: i - 1, seg2: i });
      } else {
        rp.push({ r: profile[i][0], y: profile[i][1], n: a, seg: i - 1, end: true });
        rp.push({ r: profile[i][0], y: profile[i][1], n: b, seg: i, start: true });
      }
    }
    const P = [], N = [], UV = [], idx = [];
    const ringStart = [];
    let vAcc = 0;
    const vOf = rp.map((q, i) => {
      if (i > 0) vAcc += Math.hypot(q.r - rp[i - 1].r, q.y - rp[i - 1].y);
      return vAcc;
    });
    rp.forEach((q, ri) => {
      ringStart.push(P.length);
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * TAU;
        const ca = Math.cos(a), sa = Math.sin(a);
        P.push([x + ca * q.r, q.y, z + sa * q.r]);
        N.push(v3.norm([ca * q.n[0], q.n[1], sa * q.n[0]]));
        UV.push([(i / seg) * TAU * Math.max(q.r, 0.05), -vOf[ri]]);
      }
    });
    const row = seg + 1;
    for (let ri = 0; ri < rp.length - 1; ri++) {
      const q = rp[ri], q2 = rp[ri + 1];
      if (q.end) continue; // duplicate ring at a hard corner: do not bridge to its twin
      if (q.r === 0 && q2.r === 0) continue;
      for (let i = 0; i < seg; i++) {
        const a = ringStart[ri] + i, b = a + 1, c = ringStart[ri + 1] + i, d = c + 1;
        idx.push([a, c, b], [b, c, d]);
      }
    }
    this.mesh(matId, P, N, UV, idx, o);
  }

  /**
   * Loft closed rings of 3D points. rings = [[p,...], ...] with the same point count; consecutive
   * rings are joined with quads. Orientation is chosen so normals point away from the ring centres,
   * so rings should wrap a roughly convex section. `o.smooth` shares vertices and averages normals
   * (soft body shapes); otherwise every quad is flat. `o.capStart`/`o.capEnd` add fan caps.
   */
  loft(matId, rings, o = {}) {
    const n = rings[0].length, R = rings.length;
    const cen = rings.map((r) => v3.scale(r.reduce((a, p) => v3.add(a, p), [0, 0, 0]), 1 / n));
    const quadNormal = (k, i) => {
      const j = (i + 1) % n;
      const a = rings[k][i], b = rings[k][j], c = rings[k + 1][i], d = rings[k + 1][j];
      let nq = v3.cross(v3.sub(d, a), v3.sub(c, b));
      const mid = v3.scale(v3.add(v3.add(a, b), v3.add(c, d)), 0.25);
      if (v3.dot(nq, v3.sub(mid, v3.lerp(cen[k], cen[k + 1], 0.5))) < 0) nq = v3.scale(nq, -1);
      return nq;
    };
    const P = [], N = [], UV = [], idx = [];
    if (o.smooth) {
      for (let k = 0; k < R; k++) for (let i = 0; i < n; i++) P.push(rings[k][i]);
      const acc = P.map(() => [0, 0, 0]);
      for (let k = 0; k < R - 1; k++) {
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const nq = quadNormal(k, i);
          for (const vi of [k * n + i, k * n + j, (k + 1) * n + i, (k + 1) * n + j]) acc[vi] = v3.add(acc[vi], nq);
          idx.push([k * n + i, k * n + j, (k + 1) * n + i], [k * n + j, (k + 1) * n + j, (k + 1) * n + i]);
        }
      }
      for (let vi = 0; vi < P.length; vi++) {
        N.push(v3.norm(acc[vi]));
        UV.push(boxUV(P[vi], N[vi]));
      }
    } else {
      for (let k = 0; k < R - 1; k++) {
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const nq = v3.norm(quadNormal(k, i));
          const b0 = P.length;
          for (const p of [rings[k][i], rings[k][j], rings[k + 1][i], rings[k + 1][j]]) {
            P.push(p);
            N.push(nq);
            UV.push(boxUV(p, nq));
          }
          idx.push([b0, b0 + 1, b0 + 2], [b0 + 1, b0 + 3, b0 + 2]);
        }
      }
    }
    this.mesh(matId, P, N, UV, idx, o);
    const cap = (ring, c, outward) => {
      const cp = [c, ...ring];
      const nrm = v3.norm(outward);
      const ci = [];
      for (let i = 0; i < n; i++) ci.push([0, 1 + i, 1 + ((i + 1) % n)]);
      this.mesh(matId, cp, cp.map(() => nrm), cp.map((p) => boxUV(p, nrm)), ci, o);
    };
    if (o.capStart) cap(rings[0], cen[0], v3.sub(cen[0], cen[1]));
    if (o.capEnd) cap(rings[R - 1], cen[R - 1], v3.sub(cen[R - 1], cen[R - 2]));
  }

  /**
   * Tube along a polyline. { pts: [[x,y,z]...], r, seg (default 6), cap }. Used for pipes, cables, rails.
   * Smooth shaded; joints are mitred crudely by sharing the ring at each point.
   */
  tube(matId, s, o = {}) {
    const { pts, r, seg = 6, cap = true } = s;
    const rings = [];
    let prevN = null;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const t = v3.norm(v3.sub(b, a));
      let ref = Math.abs(t[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0];
      if (prevN) ref = prevN;
      let nrm = v3.norm(v3.sub(ref, v3.scale(t, v3.dot(ref, t))));
      const bin = v3.cross(t, nrm);
      prevN = nrm;
      const ring = [];
      for (let k = 0; k < seg; k++) {
        const ang = (k / seg) * TAU;
        const rr = typeof r === "function" ? r(i / (pts.length - 1)) : r;
        ring.push(v3.add(pts[i], v3.add(v3.scale(nrm, Math.cos(ang) * rr), v3.scale(bin, Math.sin(ang) * rr))));
      }
      rings.push(ring);
    }
    this.loft(matId, rings, { smooth: true, capStart: cap, capEnd: cap, ...o });
  }

  // ---- stats --------------------------------------------------------------
  stats() {
    let tris = 0, verts = 0;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    const byMat = {};
    const walk = (node, parentM) => {
      const m = mat4.mul(parentM, mat4.fromTRS(node.t, node.q, node.s));
      for (const [id, g] of node.geo) {
        tris += g.tris;
        verts += g.verts;
        byMat[id] = (byMat[id] ?? 0) + g.tris;
        for (let i = 0; i < g.pos.length; i += 3) {
          const p = mat4.point(m, [g.pos[i], g.pos[i + 1], g.pos[i + 2]]);
          for (let k = 0; k < 3; k++) {
            if (p[k] < min[k]) min[k] = p[k];
            if (p[k] > max[k]) max[k] = p[k];
          }
        }
      }
      for (const ch of node.children) walk(ch, m);
    };
    walk(this.root, mat4.identity());
    return { tris, verts, min, max, byMat };
  }
}

/** Box-projected UV for generic meshes (dominant normal axis). */
export function boxUV(p, n) {
  const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  if (ay >= ax && ay >= az) return [p[0], -p[2]];
  if (ax >= az) return [p[2] * Math.sign(n[0] || 1), -p[1]];
  return [-p[0] * Math.sign(n[2] || 1), -p[1]];
}
