// Recipes 4-6 of the high-rise set: twin core, corporate HQ, LED megablock.
import {
  M, AO, STEP, pickPalette, floorY, frame, rectIn, tintVar, shaft, ledges, ledgeRing, parapet,
  neonBox, neonRim, neonBlade, mast, roofKit, streetFront, groundFloor, skybridgeX, finsWall,
  colliderRect, underside, lightAnchors, centre, cornerBlade, SHOP_H, FLOOR_H,
} from "./bhigh_kit.mjs";
import { roofSign, billboard, wallSign } from "./signs.mjs";

/** Helipad: disc, neon ring and an H. */
function helipad(b, x, y, z, rad) {
  b.cylinder(M.concD, { x, z, y0: y, y1: y + 0.3, r: rad, seg: 14, cap: "top" });
  b.lathe("mat_neon_amber", [[rad - 0.2, y + 0.31], [rad - 0.55, y + 0.31]], { x, z, seg: 14 });
  const t = 0.25, hh = rad * 0.45;
  for (const sx of [-1, 1]) b.box("mat_neon_white", [x + sx * hh * 0.6 - t / 2, y + 0.3, z - hh], [x + sx * hh * 0.6 + t / 2, y + 0.34, z + hh], { skip: ["b"] });
  b.box("mat_neon_white", [x - hh * 0.6, y + 0.3, z - t / 2], [x + hh * 0.6, y + 0.34, z + t / 2], { skip: ["b"] });
}

// --------------------------------------------------------------------------------------------
// 4. Twin-core tower on a shared podium
// --------------------------------------------------------------------------------------------
export function twinCore(b, r, { w, d, floors }) {
  const fr = frame(w, d);
  const pal = pickPalette(r);
  b.ao = AO;
  const base = rectIn(fr);
  const podF = 4;
  const podTop = floorY(podF);
  tintVar(b, r);
  groundFloor(b, r, base);
  ledgeRing(b, M.conc, base.x0, base.x1, base.z0, base.z1, SHOP_H - 0.25, 0.5, 0.2);
  shaft(b, r, { ...base, y0: SHOP_H + 0.25, y1: podTop, mat: M.dark, top: M.roof });
  ledgeRing(b, M.conc, base.x0, base.x1, base.z0, base.z1, podTop - 0.3, 0.5, 0.2);
  b.ao = null;
  const { ex } = streetFront(b, r, { x0: base.x0, x1: base.x1, zf: base.z1, pal, entrance: 0, canopyW: 10, lobbyW: 6 });
  colliderRect(b, base, 0, podTop);

  const gap = w >= 39 ? 9 : 6;
  const total = w - gap; // a multiple of 3, shared unevenly between the cores
  const cA = Math.max(9, Math.round((total * r.range(0.4, 0.5)) / 3) * 3);
  const cB = total - cA;
  const A = { x0: -fr.hw, x1: -fr.hw + cA, z0: base.z0 + 1.5, z1: base.z1 - 1.5 };
  const B = { x0: fr.hw - cB, x1: fr.hw, z0: base.z0, z1: base.z1 - 3 };
  const fA = floors;
  const fB = Math.max(podF + 5, floors - r.int(5, 9));
  const HA = floorY(fA), HB = floorY(fB);
  tintVar(b, r, 0.82, 1);
  shaft(b, r, { ...A, y0: podTop, y1: HA, mat: M.lit, top: M.roof });
  ledges(b, M.galv, A, podF + 3, fA, 5, 0.3, 0.12);
  finsWall(b, M.concD, [A.x1, A.z1], [A.x0, A.z1], podTop, HA, { every: 6, wd: 0.5, out: 0.3 });
  tintVar(b, r, 0.82, 1);
  shaft(b, r, { ...B, y0: podTop, y1: HB, mat: M.curtain, top: M.roof });
  ledges(b, M.galv, B, podF + 3, fB, 4, 0.3, 0.12);
  colliderRect(b, A, podTop, HA);
  colliderRect(b, B, podTop, HB);

  // podium roof between the cores: garden, rim light, two sky bridges
  neonRim(b, pal.b, base.x0 + 0.3, base.x1 - 0.3, base.z0 + 0.3, base.z1 - 0.3, podTop, 0.15, 0.1);
  b.box(M.leaf, [A.x1 + 0.8, podTop, base.z0 + 2], [B.x0 - 0.8, podTop + 0.6, base.z1 - 4], { skip: ["b"] });
  const zb = (Math.max(A.z0, B.z0) + Math.min(A.z1, B.z1)) / 2;
  const yb1 = floorY(Math.round(fB * 0.5)), yb2 = floorY(fB - 4);
  skybridgeX(b, A.x1, B.x0, yb1, zb);
  skybridgeX(b, A.x1, B.x0, yb2, zb);
  for (const yb of [yb1, yb2]) neonBox(b, pal.a, [A.x1, yb - 0.12, zb - 1.5], [B.x0, yb - 0.02, zb + 1.5]);
  cornerBlade(b, r, A.x0 + 0.8, floorY(podF + 9), A.z1, pal.b, 9);

  // crowns: A gets masts, B a helipad
  neonRim(b, pal.a, A.x0, A.x1, A.z0, A.z1, HA - 0.1, 0.25, 0.15);
  roofKit(b, r, A.x0 + 0.5, A.x1 - 0.5, A.z0 + 0.5, A.z1 - 0.5, HA, { masts: 2, ac: 2, dish: true, tank: floors > 26 });
  parapet(b, M.concD, A.x0, A.x1, A.z0, A.z1, HA, 0.8, 0.25);
  neonRim(b, pal.b, B.x0, B.x1, B.z0, B.z1, HB - 0.1, 0.25, 0.15);
  const rad = Math.min(4.5, (cB - 3) / 2, (B.z1 - B.z0 - 3) / 2);
  const [bx] = centre(B);
  const pz = B.z1 - rad - 1.5;
  helipad(b, bx, HB, pz, rad);
  if (pz - rad - 0.5 - (B.z0 + 0.5) >= 4) roofKit(b, r, B.x0 + 0.5, B.x1 - 0.5, B.z0 + 0.5, pz - rad - 0.5, HB, { masts: 1, ac: 1, elevator: true });
  parapet(b, M.concD, B.x0, B.x1, B.z0, B.z1, HB, 0.8, 0.25);
  lightAnchors(b, ex, base.z1, HA, pal, ...centre(A));
  b.anchor("light.helipad", [bx, HB + 2, pz], { color: "#ffb000", intensity: 1, range: 18 });
}

// --------------------------------------------------------------------------------------------
// 5. Corporate HQ: glowing atrium, vertical neon blades, logo ring, roof sign
// --------------------------------------------------------------------------------------------
export function corpHQ(b, r, { w, d, floors }) {
  const fr = frame(w, d);
  const pal = pickPalette(r);
  b.ao = AO;
  const base = rectIn(fr);
  const H = floorY(floors);
  const atTop = floorY(3);
  const crownF = 3;
  const yCrown = floorY(floors - crownF);
  tintVar(b, r);
  groundFloor(b, r, base, { mats: { n: M.glass } });
  shaft(b, r, { ...base, y0: SHOP_H, y1: atTop, mat: M.dark, mats: { s: M.concD }, skip: ["n"], top: false });
  b.quad(M.glass, [base.x1, SHOP_H, base.z1], [base.x0, SHOP_H, base.z1], [base.x0, atTop, base.z1], [base.x1, atTop, base.z1], { uv: "unit" });
  b.ao = null;
  // glowing mullions across the atrium glass, piers and a heavy beam
  finsWall(b, M.warm, [base.x1, base.z1], [base.x0, base.z1], 0.2, atTop - 1.5, { every: 3, wd: 0.14, out: 0.1 });
  for (const sx of [-1, 1]) {
    const xa = sx > 0 ? fr.hw - 1.5 : -fr.hw - 0.2, xb = sx > 0 ? fr.hw + 0.2 : -fr.hw + 1.5;
    b.box(M.concD, [xa, 0, base.z1 - 1.5], [xb, atTop, base.z1 + 0.3], { skip: ["b"] });
  }
  b.box(M.conc, [base.x0 - 0.2, atTop - 1.5, base.z1 - 0.3], [base.x1 + 0.2, atTop, base.z1 + 0.8], { skip: [] });
  neonBox(b, pal.a, [base.x0, atTop - 1.62, base.z1 + 0.8], [base.x1, atTop - 1.52, base.z1 + 0.88]);
  const { ex } = streetFront(b, r, { x0: base.x0 + 1.5, x1: base.x1 - 1.5, zf: base.z1, pal, entrance: 0, canopyW: 8, lobbyW: 5 });
  colliderRect(b, base, 0, atTop);

  // tower and crown
  tintVar(b, r, 0.85, 1);
  shaft(b, r, { ...base, y0: atTop, y1: yCrown, mat: M.curtain, top: M.roof });
  ledges(b, M.galv, base, 6, floors - crownF, 6, 0.3, 0.1);
  const crown = { x0: base.x0 + 1.5, x1: base.x1 - 1.5, z0: base.z0 + 1.5, z1: base.z1 - 1.5 };
  shaft(b, r, { ...crown, y0: yCrown, y1: H, mat: M.lit, top: M.roof });
  neonRim(b, pal.b, base.x0, base.x1, base.z0, base.z1, yCrown - 0.05, 0.3, 0.2);
  neonRim(b, pal.a, crown.x0, crown.x1, crown.z0, crown.z1, H - 0.1, 0.3, 0.15);
  colliderRect(b, base, atTop, yCrown);
  colliderRect(b, crown, yCrown, H);

  // vertical neon blades on the front, and a square logo ring
  for (const sx of [-1, 1]) {
    neonBlade(b, pal.a, sx * (fr.hw - 0.9), base.z1, atTop + 2, yCrown - 2, 0.5, 0.4);
    neonBlade(b, pal.b, sx * (fr.hw * 0.5), base.z1, atTop + 6, yCrown - 10, 0.3, 0.3);
  }
  const yc = floorY(Math.round(floors * 0.6));
  const half = 3.3, t = 0.35, o = 0.4, zf = base.z1;
  neonBox(b, pal.b, [-half, yc + half, zf], [half, yc + half + t, zf + o]);
  neonBox(b, pal.b, [-half, yc - half, zf], [half, yc - half + t, zf + o]);
  neonBox(b, pal.b, [-half, yc - half, zf], [-half + t, yc + half + t, zf + o]);
  neonBox(b, pal.b, [half - t, yc - half, zf], [half, yc + half + t, zf + o]);
  neonBox(b, pal.a, [-1, yc - 1, zf], [1, yc + 1, zf + o]);

  // roof: big sign, machinery
  const rw = Math.min(w - 6, 12);
  b.with({ pos: [0, H, crown.z1 - 1.8] }, () => roofSign(b, r, { w: rw, h: 3.5, color: pal.b }));
  roofKit(b, r, crown.x0 + 0.5, crown.x1 - 0.5, crown.z0 + 0.5, crown.z1 - 5.5, H, { masts: 2, ac: 2, tank: floors > 24, vents: 1 });
  parapet(b, M.concD, crown.x0, crown.x1, crown.z0, crown.z1, H, 0.8, 0.25);
  lightAnchors(b, ex, zf, H + 5, pal, 0, crown.z1 - 1.8);
  b.anchor("light.logo", [0, yc, zf + 2], { color: pal.hb, intensity: 1, range: 20 });
}

// --------------------------------------------------------------------------------------------
// 6. Residential megablock with huge LED wall panels
// --------------------------------------------------------------------------------------------
export function ledMegablock(b, r, { w, d, floors }) {
  const fr = frame(w, d);
  const pal = pickPalette(r);
  b.ao = AO;
  const base = rectIn(fr);
  const H = floorY(floors);
  const podF = 3;
  const podTop = floorY(podF);
  tintVar(b, r);
  groundFloor(b, r, base);
  ledgeRing(b, M.conc, base.x0, base.x1, base.z0, base.z1, SHOP_H - 0.25, 0.5, 0.2);
  shaft(b, r, { ...base, y0: SHOP_H + 0.25, y1: podTop, mat: M.conc, top: M.roof });
  const { ex } = streetFront(b, r, { x0: base.x0, x1: base.x1, zf: base.z1, pal, entrance: r.pick([-1, 0, 1]), canopyW: 8 });
  colliderRect(b, base, 0, H);

  tintVar(b, r, 0.8, 1);
  shaft(b, r, { ...base, y0: podTop, y1: H, mat: M.lit, mats: { e: M.dark, w: M.dark, s: M.dark }, top: M.roof });
  b.ao = null;
  finsWall(b, M.concD, [base.x1, base.z1], [base.x0, base.z1], podTop, H, { every: 12, wd: 0.6, out: 0.5 });
  finsWall(b, M.concD, [base.x0, base.z0], [base.x1, base.z0], podTop, H, { every: 12, wd: 0.6, out: 0.5 });
  ledgeRing(b, M.concD, base.x0, base.x1, base.z0, base.z1, podTop - 0.2, 0.4, 0.2);
  // balconies on the back, every second floor
  for (let f = podF + 1; f < floors; f += 2) {
    b.box(M.conc, [base.x0 + 0.3, floorY(f), base.z0 - 0.9], [base.x1 - 0.3, floorY(f) + 0.25, base.z0], { skip: ["b"] });
  }

  // LED wall panels on the front
  const nP = w >= 36 ? 3 : 2;
  const pw = 9;
  const xs = nP === 3 ? [-w / 3, 0, w / 3] : [-w / 4, w / 4];
  const zf = base.z1;
  const stripe = [pal.a, pal.b, "mat_neon_white", "mat_neon_amber"];
  const room = floorY(floors) - 3 * FLOOR_H - floorY(4);
  for (const xc of xs) {
    const ph = Math.min(FLOOR_H * r.int(5, 9), Math.floor(room / FLOOR_H) * FLOOR_H);
    if (ph < FLOOR_H * 4) continue;
    const spare = Math.floor((room - ph) / FLOOR_H);
    const y0 = floorY(4) + r.int(0, Math.max(0, spare)) * FLOOR_H;
    const x0 = xc - pw / 2, x1 = xc + pw / 2;
    b.box(M.metal, [x0, y0, zf], [x0 + 0.35, y0 + ph, zf + 0.45], { skip: ["b"] });
    b.box(M.metal, [x1 - 0.35, y0, zf], [x1, y0 + ph, zf + 0.45], { skip: ["b"] });
    b.box(M.metal, [x0 + 0.35, y0, zf], [x1 - 0.35, y0 + 0.35, zf + 0.45], { skip: ["b"] });
    b.box(M.metal, [x0 + 0.35, y0 + ph - 0.35, zf], [x1 - 0.35, y0 + ph, zf + 0.45], { skip: ["b"] });
    b.quad(M.glass, [x1 - 0.35, y0 + 0.35, zf + 0.05], [x0 + 0.35, y0 + 0.35, zf + 0.05], [x0 + 0.35, y0 + ph - 0.35, zf + 0.05], [x1 - 0.35, y0 + ph - 0.35, zf + 0.05], { uv: "unit" });
    // animated-looking ad: random bars of neon
    let y = y0 + 0.6;
    while (y < y0 + ph - 1.2) {
      const hbar = r.range(0.5, 1.6);
      const a = r.range(0, 0.4) * (pw - 1), bw = r.range(0.35, 1) * (pw - 1 - a);
      const xa = x0 + 0.5 + a;
      const yb = Math.min(y + hbar, y0 + ph - 0.6);
      b.quad(r.pick(stripe), [xa + bw, y, zf + 0.2], [xa, y, zf + 0.2], [xa, yb, zf + 0.2], [xa + bw, yb, zf + 0.2], { uv: "unit" });
      y = yb + r.range(0.25, 0.7);
    }
    b.anchor(`light.led_${nP}_${Math.round(xc)}`, [xc, y0 + ph / 2, zf + 3], { color: r.chance(0.5) ? pal.ha : pal.hb, intensity: 1.2, range: 22 });
  }
  for (const sx of [-1, 1]) neonBlade(b, pal.b, sx * (fr.hw - 0.4), zf, podTop, H - 1, 0.3, 0.3);

  // roof: billboards, tank, masts
  for (const sx of [-1, 1]) b.with({ pos: [sx * w / 4, H, zf - 2.2] }, () => billboard(b, r, { w: 8, h: 3.5 }));
  roofKit(b, r, base.x0 + 0.5, base.x1 - 0.5, base.z0 + 0.5, zf - 5.5, H, { masts: 2, ac: 3, tank: true, dish: true, vents: 2 });
  parapet(b, M.concD, base.x0, base.x1, base.z0, base.z1, H, 0.8, 0.25);
  b.anchor("light.entrance", [ex, 3.2, zf + 1.1], { color: "#ffd9a0", intensity: 1, range: 14 });
  void STEP; void ledges; void underside; void skybridgeX; void mast; void wallSign;
}
