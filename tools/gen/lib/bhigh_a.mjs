// Recipes 1-3 of the high-rise set (see assets/buildings_high.mjs for the asset list).
import {
  M, AO, UV_OFF, STEP, pickPalette, floorY, frame, rectIn, tintVar, shaft, taperShaft, ledges, ledgeRing, parapet,
  neonBox, neonRim, neonBlade, mast, roofKit, streetFront, groundFloor, skybridgeX, skybridgeZ, finsWall,
  maxInset, insetRect, centre, colliderRect, underside, terrace, lightAnchors, tree, wedge, cornerBlade,
  SHOP_H, FLOOR_H, BAY_W,
} from "./bhigh_kit.mjs";
import { roofSign, billboard } from "./signs.mjs";

// --------------------------------------------------------------------------------------------
// 1. Glass curtain-wall tower with three setbacks
// --------------------------------------------------------------------------------------------
export function glassSetback(b, r, { w, d, floors }) {
  const fr = frame(w, d);
  const pal = pickPalette(r);
  b.ao = AO;
  const H = floorY(floors);
  const podF = 4;
  const base = rectIn(fr);
  tintVar(b, r);
  groundFloor(b, r, base);
  ledgeRing(b, M.conc, base.x0, base.x1, base.z0, base.z1, SHOP_H - 0.25, 0.5, 0.2);
  shaft(b, r, { ...base, y0: SHOP_H + 0.25, y1: floorY(podF), mat: M.dark, top: M.roof });
  b.ao = null;
  const { ex } = streetFront(b, r, { x0: base.x0, x1: base.x1, zf: base.z1, pal, entrance: r.pick([-1, 0, 1]) });
  colliderRect(b, base, 0, floorY(podF));

  // tiers: [inset, shift] growing with height; merged when the width cannot shrink further
  const mx = maxInset(fr);
  const raw = [Math.min(3, mx), Math.min(6, mx), Math.min(9, mx)];
  const insets = [...new Set(raw.filter((s) => s > 0))];
  const R = floors - podF;
  const cuts = [podF];
  const share = [0.45, 0.3, 0.25];
  let acc = podF;
  for (let i = 0; i < insets.length; i++) {
    const last = i === insets.length - 1;
    acc = last ? floors : Math.min(floors - 2 * (insets.length - 1 - i), acc + Math.max(2, Math.round(R * share[i])));
    cuts.push(acc);
  }
  let lower = base;
  let lowerY = floorY(podF);
  const shifts = insets.map(() => r.pick([-STEP, 0, STEP]));
  const lean = insets.length && insets[0] >= 3 ? r.pick([-3, -1.5, 0, 0, 1.5, 3]) : 0; // whole tower slides sideways
  for (let i = 0; i < insets.length; i++) {
    const rect = insetRect(fr, insets[i], shifts[i], lean);
    const y1 = floorY(cuts[i + 1]);
    tintVar(b, r, 0.8, 1);
    shaft(b, r, { ...rect, y0: lowerY, y1, mat: M.curtain, top: i === insets.length - 1 ? M.roof : M.roof });
    ledges(b, M.galv, rect, cuts[i] + 3, cuts[i + 1], 4, 0.3, 0.12);
    // fins on the front of the middle tier
    if (i === 0) {
      finsWall(b, M.galv, [rect.x1, rect.z1], [rect.x0, rect.z1], lowerY, y1, { out: 0.2, wd: 0.15 });
      cornerBlade(b, r, rect.x0 + 0.7, lowerY + 14, rect.z1, pal.b, 10);
    }
    terrace(b, lower, rect, lowerY, pal.a);
    colliderRect(b, rect, lowerY, y1);
    lower = rect;
    lowerY = y1;
  }
  // crown: lit lantern, neon rim, spire and rooftop machinery
  const top = lower;
  neonRim(b, pal.b, top.x0, top.x1, top.z0, top.z1, H - 0.1, 0.25, 0.15);
  const lant = { x0: top.x0 + 3, x1: top.x1 - 3, z0: top.z0 + 3, z1: top.z1 - 3 };
  if (lant.x1 - lant.x0 >= 3 && lant.z1 - lant.z0 >= 3) {
    // sloped glass crown, high edge toward the street or away from it
    const hiFront = r.chance(0.5);
    const hLo = FLOOR_H * 0.8, hHi = FLOOR_H * 2.6;
    wedge(b, M.curtain, M.curtain, lant, H, hiFront ? hLo : hHi, hiFront ? hHi : hLo);
    neonRim(b, pal.a, lant.x0, lant.x1, lant.z0, lant.z1, H - 0.05, 0.2, 0.12);
    const [lx, lz] = centre(lant);
    mast(b, lx, lz, H + hHi, r.range(10, 16), 0.35);
  }
  const beacons = roofKit(b, r, top.x0 + 0.5, top.x1 - 0.5, top.z0 + 0.5, top.z1 - 0.5, H, { masts: 1, ac: 2, tank: floors > 24, elevator: false });
  void beacons;
  parapet(b, M.concD, top.x0, top.x1, top.z0, top.z1, H, 0.8, 0.25);
  lightAnchors(b, ex, base.z1, H + FLOOR_H, pal, ...centre(top));
}

// --------------------------------------------------------------------------------------------
// 2. Stacked-box megatower with a concrete core and sky-bridge stubs
// --------------------------------------------------------------------------------------------
export function megaStack(b, r, { w, d, floors }) {
  const fr = frame(w, d);
  const pal = pickPalette(r);
  b.ao = AO;
  const H = floorY(floors);
  const base = rectIn(fr);
  const podF = 3;
  tintVar(b, r);
  groundFloor(b, r, base);
  ledgeRing(b, M.conc, base.x0, base.x1, base.z0, base.z1, SHOP_H - 0.25, 0.5, 0.2);
  shaft(b, r, { ...base, y0: SHOP_H + 0.25, y1: floorY(podF), mat: M.clad, top: M.roof });
  b.ao = null;
  const { ex } = streetFront(b, r, { x0: base.x0, x1: base.x1, zf: base.z1, pal, entrance: r.pick([-1, 0, 1]) });
  colliderRect(b, base, 0, floorY(podF));

  // concrete core, full height
  const cw = Math.max(9, Math.round((w * 0.4) / 3) * 3);
  const cd = Math.max(9, Math.round((fr.D * 0.45) / 3) * 3);
  const zc = (base.z0 + base.z1) / 2 + r.pick([-1.5, 0, 1.5]) * (fr.D > cd + 3 ? 1 : 0);
  const core = { x0: -cw / 2, x1: cw / 2, z0: zc - cd / 2, z1: zc + cd / 2 };
  shaft(b, r, { ...core, y0: floorY(podF), y1: H + 2 * FLOOR_H, mat: M.concD, top: M.roof });
  colliderRect(b, core, floorY(podF), H + 2 * FLOOR_H);

  // modules separated by one-floor gaps where only the core, columns and bridge stubs show
  const mats = [M.lit, M.curtain, M.dark, M.clad];
  let f = podF;
  let i = 0;
  let last = null;
  const mods = [];
  while (f < floors) {
    const left = floors - f;
    let nf = Math.min(r.int(3, 6), left);
    if (left - nf < 4) nf = left; // fold a short remainder into this module
    const gapAfter = f + nf < floors;
    const dw = r.int(0, Math.floor((w - (cw + 6)) / 6)) * 3; // multiples of 3 keep w - dw a multiple of 3
    const wi = Math.max(cw + 6, w - dw);
    const dd = r.int(0, Math.floor((fr.D - (cd + 3)) / 3));
    const di = Math.max(cd + 3, fr.D - 3 * dd);
    const offX = r.pick([-1, 0, 1]) * (w - wi) / 2;
    const offZ = r.pick([-1, 0, 1]) * (fr.D - di) / 2;
    const cz = (fr.zb + fr.zf) / 2 + offZ;
    const rect = { x0: offX - wi / 2, x1: offX + wi / 2, z0: cz - di / 2, z1: cz + di / 2 };
    const y0 = floorY(f), y1 = floorY(f + nf);
    tintVar(b, r, 0.8, 1);
    shaft(b, r, { ...rect, y0, y1, mat: mats[i % mats.length], top: M.roof });
    underside(b, M.concD, rect, y0);
    ledgeRing(b, M.plate, rect.x0, rect.x1, rect.z0, rect.z1, y0 + 0.05, 0.4, 0.2);
    neonBox(b, i % 2 ? pal.b : pal.a, [rect.x0, y0 - 0.14, rect.z1], [rect.x1, y0, rect.z1 + 0.12]);
    colliderRect(b, rect, y0, y1);
    mods.push({ rect, y0, y1 });
    last = rect;
    if (gapAfter) {
      // gap floor: four columns at the lower module's corners and a glass bridge stub out of the core
      const gy0 = y1, gy1 = floorY(f + nf + 1);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const px = sx < 0 ? rect.x0 + 1 : rect.x1 - 1, pz = sz < 0 ? rect.z0 + 1 : rect.z1 - 1;
        b.box(M.concD, [px - 0.5, gy0, pz - 0.5], [px + 0.5, gy1, pz + 0.5], { skip: ["b", "t"] });
      }
      const side = r.pick([-1, 1]);
      const zb = (core.z0 + core.z1) / 2 + r.range(-1.5, 1.5);
      if (side > 0) skybridgeX(b, core.x1, fr.hw, gy0 + 0.2, zb);
      else skybridgeX(b, -fr.hw, core.x0, gy0 + 0.2, zb);
      f += nf + 1;
    } else f += nf;
    i++;
  }
  // crown: core lantern with neon ring, mast cluster
  const [cx, ccz] = centre(core);
  neonRim(b, pal.a, core.x0, core.x1, core.z0, core.z1, H + 2 * FLOOR_H - 0.2, 0.3, 0.15);
  mast(b, cx, ccz, H + 2 * FLOOR_H, r.range(12, 18), 0.4);
  for (const sx of [-1, 1]) mast(b, cx + sx * (cw / 2 - 1), ccz, H + 2 * FLOOR_H, r.range(5, 8), 0.2);
  const t = mods[mods.length - 1];
  roofKit(b, r, t.rect.x0 + 0.5, t.rect.x1 - 0.5, t.rect.z0 + 0.5, t.rect.z1 - 0.5, t.y1, { masts: 0, ac: 3, tank: true, elevator: false, vents: 2 });
  void last;
  lightAnchors(b, ex, base.z1, H + 2 * FLOOR_H, pal, cx, ccz);
}

// --------------------------------------------------------------------------------------------
// 3. Tapered tower with step-ins, a crown and an antenna array
// --------------------------------------------------------------------------------------------
export function taperedSpire(b, r, { w, d, floors }) {
  const fr = frame(w, d);
  const pal = pickPalette(r);
  b.ao = AO;
  const H = floorY(floors);
  const base = rectIn(fr);
  const podF = 3;
  tintVar(b, r);
  groundFloor(b, r, base);
  ledgeRing(b, M.conc, base.x0, base.x1, base.z0, base.z1, SHOP_H - 0.25, 0.5, 0.2);
  shaft(b, r, { ...base, y0: SHOP_H + 0.25, y1: floorY(podF), mat: M.dark, top: M.roof });
  b.ao = null;
  const { ex } = streetFront(b, r, { x0: base.x0, x1: base.x1, zf: base.z1, pal, entrance: r.pick([-1, 0, 1]) });
  colliderRect(b, base, 0, floorY(podF));

  // three tapering sections with a step-in between them; insets run from s0 to the 9 m minimum
  const mx = maxInset(fr);
  const s0 = Math.min(3, mx);
  const sEnd = Math.max(s0 + STEP, mx);
  const R = floors - podF;
  const f1 = podF + Math.max(3, Math.round(R * 0.42));
  const f2 = Math.min(floors - 2, f1 + Math.max(3, Math.round(R * 0.33)));
  const sections = [
    { f0: podF, f1, a: s0, t: s0 + (sEnd - s0) * 0.35, mat: M.curtain },
    { f0: f1, f1: f2, a: s0 + (sEnd - s0) * 0.35 + STEP, t: s0 + (sEnd - s0) * 0.7, mat: M.lit },
    { f0: f2, f1: floors, a: s0 + (sEnd - s0) * 0.7 + STEP, t: sEnd, mat: M.curtain },
  ];
  const rectR = (s) => ({ cx: 0, cz: (fr.zb + fr.zf) / 2, hx: fr.hw - s, hz: fr.D / 2 - s });
  let lowerRect = base;
  let tTop = null;
  for (let i = 0; i < sections.length; i++) {
    const S = sections[i];
    const A = rectR(S.a), T = rectR(S.t);
    const y0 = floorY(S.f0), y1 = floorY(S.f1);
    tintVar(b, r, 0.8, 1);
    taperShaft(b, r, { a: A, t: T, y0, y1, mat: S.mat, top: M.roof });
    // step-in ring: lower roof edge glows
    const lr = i === 0 ? base : (() => {
      const P = rectR(sections[i - 1].t);
      return { x0: P.cx - P.hx, x1: P.cx + P.hx, z0: P.cz - P.hz, z1: P.cz + P.hz };
    })();
    const ur = { x0: A.cx - A.hx, x1: A.cx + A.hx, z0: A.cz - A.hz, z1: A.cz + A.hz };
    terrace(b, lr, ur, y0, i % 2 ? pal.b : pal.a);
    ledgeRing(b, M.galv, ur.x0, ur.x1, ur.z0, ur.z1, y0 - 0.1, 0.4, 0.15);
    colliderRect(b, { x0: T.cx - T.hx, x1: T.cx + T.hx, z0: T.cz - T.hz, z1: T.cz + T.hz }, y0, y1);
    lowerRect = ur;
    tTop = T;
  }
  void lowerRect;
  // crown and spire
  const top = { x0: tTop.cx - tTop.hx, x1: tTop.cx + tTop.hx, z0: tTop.cz - tTop.hz, z1: tTop.cz + tTop.hz };
  neonRim(b, pal.a, top.x0, top.x1, top.z0, top.z1, H - 0.1, 0.3, 0.15);
  const crownH = 3 * FLOOR_H;
  const cr = { x0: top.x0 + 1.5, x1: top.x1 - 1.5, z0: top.z0 + 1.5, z1: top.z1 - 1.5 };
  shaft(b, r, { ...cr, y0: H, y1: H + crownH, mat: M.curtain, top: M.roof });
  neonRim(b, pal.b, cr.x0, cr.x1, cr.z0, cr.z1, H + crownH - 0.1, 0.25, 0.12);
  const [cx, cz] = centre(cr);
  b.lathe(M.galv, [[0.8, H + crownH], [0.5, H + crownH + 6], [0.25, H + crownH + 16], [0.05, H + crownH + 26]], { x: cx, z: cz, seg: 6, crease: 90 });
  b.box("mat_neon_red", [cx - 0.2, H + crownH + 26, cz - 0.2], [cx + 0.2, H + crownH + 26.4, cz + 0.2], { skip: ["b"] });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    mast(b, cx + sx * (cr.x1 - cr.x0) / 2 * 0.9, cz + sz * (cr.z1 - cr.z0) / 2 * 0.9, H + crownH, r.range(7, 12), 0.22);
  }
  lightAnchors(b, ex, base.z1, H + crownH + 26, pal, cx, cz);
}

