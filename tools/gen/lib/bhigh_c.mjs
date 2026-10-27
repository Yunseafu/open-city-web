// Recipes 7-10 of the high-rise set: hotel, arcology, needle, brutalist.
import {
  M, AO, STEP, UV_OFF, pickPalette, floorY, frame, rectIn, tintVar, shaft, taperShaft, ledges, ledgeRing, parapet,
  neonBox, neonRim, neonBlade, mast, roofKit, streetFront, groundFloor, finsWall, facadeWall,
  colliderRect, underside, terrace, lightAnchors, centre, tree, SHOP_H, FLOOR_H,
} from "./bhigh_kit.mjs";
import { roofSign, wallSign, bladeSign } from "./signs.mjs";

// --------------------------------------------------------------------------------------------
// 7. Hotel tower: porte-cochere, balconies, big blade sign, rooftop pool
// --------------------------------------------------------------------------------------------
export function hotel(b, r, { w, d, floors }) {
  const fr = frame(w, d);
  const pal = pickPalette(r);
  b.ao = AO;
  const H = floorY(floors);
  const podF = 4;
  const podTop = floorY(podF);
  const zA = fr.zf - 9; // front plane of the podium / tower
  const P = { x0: -fr.hw, x1: fr.hw, z0: fr.zb, z1: zA };
  tintVar(b, r);
  groundFloor(b, r, P);
  ledgeRing(b, M.conc, P.x0, P.x1, P.z0, P.z1, SHOP_H - 0.25, 0.5, 0.2);
  shaft(b, r, { ...P, y0: SHOP_H + 0.25, y1: podTop, mat: M.dark, top: M.roof });
  ledgeRing(b, M.conc, P.x0, P.x1, P.z0, P.z1, podTop - 0.3, 0.5, 0.2);
  b.ao = null;
  colliderRect(b, P, 0, podTop);

  // front annex: two shop wings and an open drive-through under a lit canopy
  const drive = 6;
  const wings = [
    { x0: -fr.hw, x1: -drive, z0: zA, z1: fr.zf },
    { x0: drive, x1: fr.hw, z0: zA, z1: fr.zf },
  ];
  b.ao = AO;
  wings.forEach((W, i) => {
    groundFloor(b, r, W, { mats: { s: M.shop } });
    b.quad(M.roof, [W.x0, SHOP_H, W.z0], [W.x1, SHOP_H, W.z0], [W.x1, SHOP_H, W.z1], [W.x0, SHOP_H, W.z1]);
    parapet(b, M.concD, W.x0, W.x1, W.z0, W.z1, SHOP_H, 0.6, 0.2);
    streetFront(b, r, { x0: W.x0, x1: W.x1, zf: W.z1, pal, entrance: i ? -1 : 1, canopyW: Math.min(7, W.x1 - W.x0 - 1.5), lobbyW: 2.6 });
    colliderRect(b, W, 0, SHOP_H);
  });
  b.ao = null;
  b.quad("mat_road_asphalt_wet", [-drive, 0.03, zA], [drive, 0.03, zA], [drive, 0.03, fr.hd], [-drive, 0.03, fr.hd]);
  const cw = drive + 2;
  b.box(M.metal, [-cw, SHOP_H - 0.1, zA], [cw, SHOP_H + 0.3, fr.zf + 1.2], { skip: ["b"] });
  const cr = { x0: -cw + 0.2, x1: cw - 0.2, z0: zA + 0.2, z1: fr.zf + 1.0 };
  underside(b, M.warm, cr, SHOP_H - 0.12);
  neonBox(b, pal.a, [-cw, SHOP_H - 0.14, fr.zf + 1.2], [cw, SHOP_H + 0.3, fr.zf + 1.28]);
  for (const sx of [-1, 1]) for (const zz of [fr.zf - 0.5, zA + 3.5]) {
    b.box(M.metal, [sx * (drive + 0.8) - 0.25, 0, zz - 0.25], [sx * (drive + 0.8) + 0.25, SHOP_H - 0.1, zz + 0.25], { skip: ["b", "t"] });
  }
  streetFront(b, r, { x0: -drive + 0.5, x1: drive - 0.5, zf: zA, pal, entrance: 0, canopyW: 6, lobbyW: 4, signs: false });
  b.with({ pos: [0, 6.2, zA] }, () => wallSign(b, r, { w: 9, h: 2, color: pal.a }));
  for (const sx of [-1, 1]) {
    b.with({ pos: [sx * (fr.hw - 1.6), podTop - 0.3, zA] }, () => bladeSign(b, r, { w: 0.8, h: 8.5, proj: 0.6, color: sx < 0 ? pal.b : pal.a }));
  }

  // tower slab, set in by 3 m each side
  const T = { x0: -fr.hw + 3, x1: fr.hw - 3, z0: fr.zb, z1: zA };
  tintVar(b, r, 0.8, 1);
  shaft(b, r, { ...T, y0: podTop, y1: H, mat: M.lit, mats: { e: M.dark, w: M.dark }, top: M.roof });
  for (let f = podF; f < floors; f++) {
    const y = floorY(f);
    b.box(M.conc, [T.x0 + 0.2, y, T.z1], [T.x1 - 0.2, y + 0.22, T.z1 + 0.9], { skip: ["b"] });
    b.box(M.conc, [T.x0 + 0.2, y, T.z0 - 0.9], [T.x1 - 0.2, y + 0.22, T.z0], { skip: ["b"] });
  }
  finsWall(b, M.concD, [T.x1, T.z1], [T.x0, T.z1], podTop, H, { every: 12, wd: 0.5, out: 0.9 });
  neonRim(b, pal.b, T.x0, T.x1, T.z0, T.z1, podTop + 0.05, 0.2, 0.15);
  colliderRect(b, T, podTop, H);

  // roof: pool deck with rim light, sign, machinery
  const pool = { x0: T.x0 + 2.5, x1: T.x1 - 2.5, z0: T.z0 + 2, z1: T.z0 + 7 };
  b.box(M.glass, [pool.x0, H, pool.z0], [pool.x1, H + 0.25, pool.z1], { skip: ["b"] });
  neonRim(b, pal.b, pool.x0, pool.x1, pool.z0, pool.z1, H + 0.1, 0.12, 0.2);
  b.with({ pos: [0, H, T.z1 - 2] }, () => roofSign(b, r, { w: Math.min(T.x1 - T.x0 - 3, 10), h: 2.8, color: pal.a }));
  roofKit(b, r, T.x0 + 0.5, T.x1 - 0.5, pool.z1 + 0.8, T.z1 - 5.5, H, { masts: 1, ac: 2, elevator: true, tank: floors > 20 });
  parapet(b, M.concD, T.x0, T.x1, T.z0, T.z1, H, 0.8, 0.25);
  lightAnchors(b, 0, zA, H + 3, pal, 0, T.z1 - 2);
  b.anchor("light.dropoff", [0, SHOP_H - 0.5, zA + 5], { color: "#ffd9a0", intensity: 1.2, range: 16 });
}

// --------------------------------------------------------------------------------------------
// 8. Stepped arcology with planted terraces and a glowing orb
// --------------------------------------------------------------------------------------------
export function arcology(b, r, { w, d, floors }) {
  const fr = frame(w, d);
  const pal = pickPalette(r);
  b.ao = AO;
  const base = rectIn(fr);
  const n = Math.min(5, Math.floor((Math.min(w, fr.D) - 9) / 6) + 1);
  // floors per tier: bottom tiers are the tallest
  const weights = Array.from({ length: n }, (_, i) => n - i + 1);
  const wsum = weights.reduce((a, c) => a + c, 0);
  const counts = weights.map((x) => Math.max(3, Math.round((floors * x) / wsum)));
  let diff = floors - counts.reduce((a, c) => a + c, 0);
  for (let i = 0; diff !== 0; i = (i + 1) % n) {
    const step = Math.sign(diff);
    if (counts[i] + step >= 3) { counts[i] += step; diff -= step; }
  }
  const rects = Array.from({ length: n }, (_, i) => ({ x0: -fr.hw + 3 * i, x1: fr.hw - 3 * i, z0: base.z0 + 3 * i, z1: base.z1 - 3 * i }));
  const mats = [M.dark, M.lit, M.curtain, M.lit, M.dark];
  let f = 0;
  const tops = [];
  let ex = 0;
  for (let i = 0; i < n; i++) {
    const R = rects[i];
    const y0 = floorY(f), y1 = floorY(f + counts[i]);
    tintVar(b, r, 0.8, 1);
    if (i === 0) {
      groundFloor(b, r, R);
      ledgeRing(b, M.conc, R.x0, R.x1, R.z0, R.z1, SHOP_H - 0.25, 0.5, 0.2);
      shaft(b, r, { ...R, y0: SHOP_H + 0.25, y1, mat: mats[0], top: M.roof });
      b.ao = null;
      ex = streetFront(b, r, { x0: R.x0, x1: R.x1, zf: R.z1, pal, entrance: r.pick([-1, 0, 1]) }).ex;
    } else {
      shaft(b, r, { ...R, y0, y1, mat: mats[i % mats.length], top: M.roof });
      // terrace ring on the roof of the tier below
      const L = rects[i - 1];
      terrace(b, L, R, y0, i % 2 ? pal.b : pal.a);
      for (let x = L.x0 + 2.5; x <= L.x1 - 2.5; x += 3.5) tree(b, x, y0 + 0.7, L.z1 - 1.1, r.range(2.4, 3.4), 0.8);
      for (let z = R.z0 + 1.5; z <= R.z1 - 1; z += 3.5) {
        tree(b, L.x0 + 1.1, y0 + 0.7, z, r.range(2.4, 3.2), 0.75);
        tree(b, L.x1 - 1.1, y0 + 0.7, z, r.range(2.4, 3.2), 0.75);
      }
    }
    // ribs and balcony strips on the front of each tier
    finsWall(b, M.concD, [R.x1, R.z1], [R.x0, R.z1], y0 + (i ? 0 : SHOP_H), y1, { every: 6, wd: 0.5, out: 0.35 });
    for (let k = f + (i ? 1 : 1); k < f + counts[i]; k += 2) {
      b.box(M.conc, [R.x0 + 0.5, floorY(k), R.z1], [R.x1 - 0.5, floorY(k) + 0.2, R.z1 + 0.6], { skip: ["b"] });
    }
    colliderRect(b, R, y0, y1);
    tops.push({ R, y: y1 });
    f += counts[i];
  }
  // crown: lantern, orb on a mast
  const T = tops[n - 1];
  const H = T.y;
  const [cx, cz] = centre(T.R);
  neonRim(b, pal.a, T.R.x0, T.R.x1, T.R.z0, T.R.z1, H - 0.1, 0.3, 0.15);
  const lw = Math.min(6, T.R.x1 - T.R.x0 - 3);
  b.box(M.curtain, [cx - lw / 2, H, cz - lw / 2], [cx + lw / 2, H + FLOOR_H, cz + lw / 2], { skip: ["b"] });
  mast(b, cx, cz, H + FLOOR_H, 9, 0.3, false);
  b.sphere(M.warm, { c: [cx, H + FLOOR_H + 10.5, cz], r: 1.8, seg: 8, rings: 5 });
  b.lathe("mat_neon_cyan", [[3.1, H + FLOOR_H + 10.4], [3.1, H + FLOOR_H + 10.6]], { x: cx, z: cz, seg: 12 });
  roofKit(b, r, T.R.x0 + 0.5, T.R.x1 - 0.5, T.R.z0 + 0.5, T.R.z1 - 0.5, H, { masts: 0, ac: 1, elevator: false });
  lightAnchors(b, ex, base.z1, H + FLOOR_H + 10, pal, cx, cz);
  void STEP; void ledges; void UV_OFF; void facadeWall; void neonBlade; void parapet; void roofSign;
}

// --------------------------------------------------------------------------------------------
// 9. Needle tower on a plaza podium, with an observation disc and neon rings
// --------------------------------------------------------------------------------------------
export function needle(b, r, { w, d, floors }) {
  const fr = frame(w, d);
  const pal = pickPalette(r);
  b.ao = AO;
  const base = rectIn(fr);
  const H = floorY(floors);
  const podF = 2;
  const podTop = floorY(podF);
  tintVar(b, r);
  groundFloor(b, r, base);
  ledgeRing(b, M.conc, base.x0, base.x1, base.z0, base.z1, SHOP_H - 0.25, 0.5, 0.2);
  shaft(b, r, { ...base, y0: SHOP_H + 0.25, y1: podTop, mat: M.dark, top: M.roof });
  b.ao = null;
  const { ex } = streetFront(b, r, { x0: base.x0, x1: base.x1, zf: base.z1, pal, entrance: r.pick([-1, 0, 1]) });
  colliderRect(b, base, 0, podTop);
  // plaza deck: planters around the edge, rim light
  neonRim(b, pal.b, base.x0 + 0.3, base.x1 - 0.3, base.z0 + 0.3, base.z1 - 0.3, podTop, 0.15, 0.1);
  const cs = Math.min(w, fr.D) >= 21 ? 12 : 9;
  const zc = (base.z0 + base.z1) / 2;
  const Tq = { x0: -cs / 2, x1: cs / 2, z0: zc - cs / 2, z1: zc + cs / 2 };
  for (const sx of [-1, 1]) {
    b.box(M.leaf, [sx * (fr.hw - 1.6) - 0.5, podTop, base.z0 + 1], [sx * (fr.hw - 1.6) + 0.5, podTop + 0.6, base.z1 - 1], { skip: ["b"] });
    for (let z = base.z0 + 2; z <= base.z1 - 2; z += 3) tree(b, sx * (fr.hw - 1.6), podTop + 0.6, z, r.range(2.2, 3), 0.7);
  }
  // shaft: slightly tapered
  tintVar(b, r, 0.85, 1);
  const taper = 1.5;
  const bottom = { cx: 0, cz: zc, hx: cs / 2, hz: cs / 2 };
  const topR = { cx: 0, cz: zc, hx: cs / 2 - taper, hz: cs / 2 - taper };
  taperShaft(b, r, { a: bottom, t: topR, y0: podTop, y1: H, mat: M.curtain, top: M.roof });
  colliderRect(b, { x0: Tq.x0, x1: Tq.x1, z0: Tq.z0, z1: Tq.z1 }, podTop, H);
  // neon rings every 6 floors and four corner lines
  for (let k = podF + 4; k < floors - 6; k += 6) {
    const y = floorY(k);
    const t = (y - podTop) / (H - podTop);
    const half = cs / 2 - taper * t;
    neonRim(b, k % 12 < 6 ? pal.a : pal.b, -half, half, zc - half, zc + half, y, 0.2, 0.12);
  }
  // observation disc near the top
  const yd = floorY(floors - 3);
  const R = Math.min(cs * 0.8, Math.min(w, fr.D) / 2 - 0.5);
  b.lathe(M.curtain, [[0, yd - 1.6], [R * 0.55, yd - 1.6], [R, yd], [R, yd + 2.8], [R * 0.6, yd + 3.6], [0, yd + 3.6]], { x: 0, z: zc, seg: 12, crease: 50 });
  b.lathe(pal.a, [[R + 0.05, yd + 0.2], [R + 0.05, yd + 0.55]], { x: 0, z: zc, seg: 12 });
  b.lathe(pal.b, [[R * 0.6 + 0.05, yd + 3.55], [R * 0.6 + 0.05, yd + 3.8]], { x: 0, z: zc, seg: 12 });
  // spire
  const sy = H - 0.0 + 0.0;
  b.lathe(M.galv, [[cs / 2 - taper - 0.4, sy], [0.9, sy + 4], [0.35, sy + 14], [0.05, sy + 26]], { x: 0, z: zc, seg: 6, crease: 90 });
  b.box("mat_neon_red", [-0.2, sy + 26, zc - 0.2], [0.2, sy + 26.4, zc + 0.2], { skip: ["b"] });
  shaft(b, r, { x0: -cs / 2 + taper, x1: cs / 2 - taper, z0: zc - cs / 2 + taper, z1: zc + cs / 2 - taper, y0: H, y1: H + 1, mat: M.concD, top: M.roof });
  lightAnchors(b, ex, base.z1, sy + 26, pal, 0, zc);
  b.anchor("light.deck", [0, yd + 1.4, zc], { color: pal.hb, intensity: 1.2, range: 26 });
  void ledges; void parapet; void roofKit; void underside; void terrace; void FLOOR_H; void neonBlade;
}

// --------------------------------------------------------------------------------------------
// 10. Brutalist tower: raised block on pilotis, deep concrete frame, recessed windows
// --------------------------------------------------------------------------------------------
export function brutalist(b, r, { w, d, floors }) {
  const fr = frame(w, d);
  const pal = pickPalette(r);
  b.ao = AO;
  const base = rectIn(fr);
  const H = floorY(floors);
  // ground floor set in by 3 m at the sides and 3 m at the front: a covered arcade
  const G = { x0: base.x0 + 3, x1: base.x1 - 3, z0: base.z0, z1: base.z1 - 3 };
  tintVar(b, r, 0.8, 0.95);
  groundFloor(b, r, G);
  const { ex } = streetFront(b, r, { x0: G.x0, x1: G.x1, zf: G.z1, pal, entrance: r.pick([-1, 0, 1]), canopyW: 6 });
  colliderRect(b, G, 0, SHOP_H);
  // pilotis along the front line and at the back corners
  const nPil = Math.max(2, Math.round(w / 9));
  for (let i = 0; i <= nPil; i++) {
    const x = base.x0 + 0.6 + ((base.x1 - base.x0 - 1.2) * i) / nPil;
    b.box(M.conc, [x - 0.6, 0, base.z1 - 1.2], [x + 0.6, SHOP_H, base.z1], { skip: ["b"] });
  }
  for (const sx of [-1, 1]) b.box(M.conc, [sx * (fr.hw - 0.6) - 0.6, 0, base.z0], [sx * (fr.hw - 0.6) + 0.6, SHOP_H, base.z0 + 1.2], { skip: ["b"] });
  b.ao = null;

  // main block: recessed window plane inside a concrete frame
  const rec = 0.9;
  const I = { x0: base.x0 + rec, x1: base.x1 - rec, z0: base.z0 + rec, z1: base.z1 - rec };
  tintVar(b, r, 0.85, 1);
  shaft(b, r, { ...I, y0: SHOP_H, y1: H, mat: M.dark, top: false });
  underside(b, M.concD, base, SHOP_H);
  const faces = {
    n: [[I.x1, I.z1], [I.x0, I.z1]], s: [[I.x0, I.z0], [I.x1, I.z0]], e: [[I.x1, I.z0], [I.x1, I.z1]], w: [[I.x0, I.z1], [I.x0, I.z0]],
  };
  for (const k of ["n", "s", "e", "w"]) finsWall(b, M.conc, faces[k][0], faces[k][1], SHOP_H, H, { every: 6, wd: 0.8, out: rec });
  for (const sx of [-1, 1]) for (const sz of [0, 1]) {
    const zz = sz ? base.z1 - 1.4 : base.z0;
    b.box(M.concD, [sx < 0 ? base.x0 : base.x1 - 1.4, SHOP_H, zz], [sx < 0 ? base.x0 + 1.4 : base.x1, H, zz + 1.4], { skip: ["b", "t"] });
  }
  const every = floors > 24 ? 2 : 1;
  for (let k = 2; k < floors; k += every) {
    ledgeRing(b, M.conc, base.x0, base.x1, base.z0, base.z1, floorY(k) - 0.4, 0.8, 0);
  }
  // heavy roof slab, a cantilevered penthouse, a windowless stair tower
  b.box(M.conc, [base.x0, H, base.z0], [base.x1, H + 1.0, base.z1], { skip: [] });
  const ph = { x0: base.x1 - Math.min(18, w * 0.5), x1: base.x1, z0: base.z0 + 3, z1: base.z0 + 3 + Math.min(12, base.z1 - base.z0 - 6) };
  b.box(M.concD, [ph.x0, H + 1, ph.z0], [ph.x1, H + 1 + 4.2, ph.z1], { skip: ["b"] });
  b.box(M.metal, [ph.x0 - 0.3, H + 5.2, ph.z0 - 0.3], [ph.x1, H + 5.5, ph.z1 + 0.3], { skip: ["b"] });
  neonBox(b, "mat_neon_red", [ph.x0, H + 4.6, ph.z1], [ph.x1, H + 4.7, ph.z1 + 0.08]);
  roofKit(b, r, base.x0 + 1, ph.x0 - 1, base.z0 + 1, base.z1 - 1, H + 1, { masts: 1, ac: 2, tank: true, elevator: false, vents: 2 });
  colliderRect(b, base, SHOP_H, H + 1);
  neonBox(b, pal.a, [base.x0, SHOP_H - 0.12, base.z1 - 0.12], [base.x1, SHOP_H - 0.02, base.z1 + 0.02]);
  lightAnchors(b, ex, G.z1, H + 5, pal, 0, 0);
}
