// Character kit: a rigid, segmented humanoid with a named joint hierarchy, outfit options and
// animation clips. Used by tools/gen/assets/characters.mjs.
//
// Space: origin at the feet centre on the ground, forward = +Z, character's right = +X.
// Joints are b.node()s with the pivot at the joint, geometry in the joint's local frame:
//   hips -> spine -> chest -> neck -> head
//   chest -> shoulder_L/R -> upperarm_L/R -> forearm_L/R -> hand_L/R
//   hips -> thigh_L/R -> shin_L/R -> foot_L/R
// Rotation sign facts (euler radians, YXZ, applied to the node's local frame):
//   +rotX tilts "up" toward +Z (forward lean, head nods down) and swings hanging limbs BACK.
//   +rotZ swings a hanging limb toward +X (outward for the right limbs, inward for the left).
//   +rotY turns +Z toward +X (turn to the right).

import { srgbToLinear } from "./materials.mjs";
import { TAU } from "./math.mjs";

const SKIN_BASE = "#f0d2bc"; // must match mat_char_skin in materials.mjs

/** Vertex tint from an sRGB hex colour (COLOR_0 is linear in glTF). k scales brightness. */
export const tint = (hex, k = 1) => srgbToLinear(hex).map((v) => Math.min(1, v * k));
/** Tint that turns the light skin base colour into the requested sRGB skin colour. */
export const skinTint = (hex) => {
  const a = srgbToLinear(hex), b = srgbToLinear(SKIN_BASE);
  return a.map((v, i) => Math.min(1, v / b[i]));
};

const lerp = (a, b, t) => a + (b - a) * t;
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export const DEFAULTS = {
  height: 1.8,
  legRatio: 1, // leg length multiplier (torso stays)
  armRatio: 1,
  shoulder: 0.205, // half width at the shoulder joint, metres at 1.8 m
  hip: 0.17,
  waist: 0.15,
  chest: 0.19,
  depth: 1, // torso front-back thickness multiplier
  bust: 0, // 0..1
  limb: 1, // limb thickness multiplier
  headScale: 1,
  armSpread: 0.1, // bind A-pose, radians
  skin: "#c9987c",
  top: { style: "jacket", sleeves: "long", color: "#2a2d36", hem: -0.1, collar: "high", trim: null, zip: true, pockets: false },
  bottom: { kind: "pants", color: "#1d2026", baggy: 1, cuff: false, stripe: null },
  boots: { kind: "boots", color: "#16171a", high: true, sole: "#0e0e10" },
  gloves: null, // hex or null
  hair: { style: "short", color: "#1a1612" },
  face: { visor: null, beard: false, eyes: "#0c0c0e" },
  cyber: [], // ["R"], ["L"], ["L","R"]
  cyberNeon: "mat_neon_cyan",
  extras: [], // holster, backpack, vest, pad_L, pad_R, radio, badge, tie, belt, neck_ring, earpiece, helmet, cap, visorglass
  extraColor: "#2a2d33",
  neon: "mat_neon_cyan",
};

function merge(p) {
  const out = { ...DEFAULTS, ...p };
  for (const k of ["top", "bottom", "boots", "hair", "face"]) out[k] = { ...DEFAULTS[k], ...(p[k] ?? {}) };
  return out;
}

/** Superellipse ring in the XZ plane at height y (8 points). */
function ringXZ(y, hw, hd, zc = 0, n = 8, pw = 2.3) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const c = Math.cos(a), s = Math.sin(a);
    pts.push([hw * Math.sign(c) * Math.pow(Math.abs(c), 2 / pw), y, zc + hd * Math.sign(s) * Math.pow(Math.abs(s), 2 / pw)]);
  }
  return pts;
}
const scaleRing = (ring, sx, sz, cz = 0) => ring.map(([x, y, z]) => [x * sx, y, cz + (z - cz) * sz]);

/** Limb lathe profile hanging down from y = 0 to -len. r = [[frac, radius], ...] top to bottom. */
function limbProfile(len, r, domeTop, domeBot) {
  const pts = [];
  const top = r[0][1], bot = r[r.length - 1][1];
  if (domeBot) pts.push([0, -len - bot * 0.8], [bot * 0.7, -len - bot * 0.4]);
  for (let i = r.length - 1; i >= 0; i--) pts.push([r[i][1], -len * r[i][0]]);
  if (domeTop) pts.push([top * 0.7, top * 0.4], [0, top * 0.8]);
  return pts;
}

export function skeleton(p) {
  const K = p.height / (0.93 * p.legRatio + 0.87);
  const hipY = 0.93 * p.legRatio * K;
  const ankleY = 0.09 * K;
  const kneeY = ankleY + (hipY - ankleY) * 0.488;
  return {
    K, hipY, ankleY, kneeY,
    thighLen: hipY - kneeY,
    shinLen: kneeY - ankleY,
    upLen: 0.29 * K * p.armRatio,
    foreLen: 0.26 * K * p.armRatio,
    spineY: hipY + 0.12 * K,
    chestY: hipY + 0.32 * K,
    shoulderY: hipY + 0.535 * K,
    neckY: hipY + 0.62 * K,
    headY: hipY + 0.67 * K,
  };
}

export function buildCharacter(b, r, params) {
  const p = merge(params);
  const S = skeleton(p);
  const { K, hipY } = S;
  const k = (v) => v * K;
  const lm = p.limb;

  // ---- materials / tints per body region ------------------------------------
  const skin = { mat: "mat_char_skin", tint: skinTint(p.skin) };
  const cloth = (hex, kk = 1) => ({ mat: "mat_char_cloth", tint: tint(hex, kk) });
  const leather = (hex = "#ffffff", kk = 1) => ({ mat: "mat_char_leather", tint: tint(hex, kk) });
  const topC = cloth(p.top.color);
  const topC2 = cloth(p.top.color, 0.8);
  const botC = cloth(p.bottom.color);
  const botC2 = cloth(p.bottom.color, 0.8);
  const longS = p.top.sleeves === "long", shortS = p.top.sleeves === "short";
  const tintBoot = tint(p.boots.color);
  const glove = p.gloves ? leather(p.gloves) : null;
  const has = (x) => p.extras.includes(x);
  const cyberOn = (side) => p.cyber.includes(side);
  const metal = (hex = "#ffffff") => ({ mat: "mat_metal_painted_dark", tint: tint(hex) });
  const D = (m) => ({ tint: m.tint });

  const hw = { hip: k(p.hip), waist: k(p.waist), chest: k(p.chest), sh: k(p.shoulder) };
  const dep = p.depth;
  const bust = p.bust;

  // One torso profile shared by pelvis, spine and chest so the segments meet exactly.
  // Rows: [y above the hips in K units, half width (m), half depth (K units), forward shift (K units)].
  const prof = [
    [-0.1, hw.hip * 0.97, 0.105, 0],
    [0.0, hw.hip, 0.108, 0],
    [0.08, lerp(hw.hip, hw.waist, 0.6), 0.1, 0],
    [0.14, hw.waist, 0.096, 0],
    [0.2, hw.waist, 0.097, 0],
    [0.3, lerp(hw.waist, hw.chest, 0.55), 0.106, 0],
    [0.4, hw.chest * 0.97, 0.114 + 0.02 * bust, 0.008 + 0.014 * bust],
    [0.49, hw.chest, 0.114 + 0.012 * bust, 0.004 + 0.008 * bust],
    [0.55, hw.sh * 0.98, 0.098, 0],
    [0.585, hw.sh * 0.66, 0.08, 0],
    [0.608, k(0.075), 0.068, 0],
  ];
  const T = (y) => {
    if (y <= prof[0][0]) return prof[0].slice(1);
    for (let i = 0; i < prof.length - 1; i++) {
      const [y0, w0, d0, z0] = prof[i], [y1, w1, d1, z1] = prof[i + 1];
      if (y <= y1) {
        const t = (y - y0) / (y1 - y0);
        return [lerp(w0, w1, t), lerp(d0, d1, t), lerp(z0, z1, t)];
      }
    }
    return prof[prof.length - 1].slice(1);
  };
  /** Torso ring at height y (K units above the hips) for a node whose origin is at `origin` (same units); s = scale. */
  const tring = (y, origin, s = 1, sd = s, n = 12) => {
    const [w, d, z] = T(y);
    return ringXZ(k(y - origin), w * s, k(d) * dep * sd, k(z), n);
  };
  const front = (y) => k(T(y)[1]) * dep + k(T(y)[2]); // z of the torso front surface

  // Outer garment hem (jacket / coat / shirt) flares over the pelvis.
  const hasHem = p.top.hem !== null && p.top.style !== "vest";
  const hemY = p.top.hem ?? 0;
  const coatScale = (y) => {
    if (!hasHem) return 1;
    const ym = lerp(hemY, 0.1, 0.5);
    if (y <= hemY) return 1.1;
    if (y <= ym) return lerp(1.1, 1.07, (y - hemY) / (ym - hemY));
    return lerp(1.07, 1.05, clamp01((y - ym) / (0.1 - ym)));
  };

  b.node("hips", { pos: [0, hipY, 0] }, () => {
    // ---- pelvis ---------------------------------------------------------------
    b.loft(botC.mat, [tring(-0.1, 0), tring(0, 0), tring(0.08, 0), tring(0.12, 0)], { smooth: true, capStart: true, tint: botC.tint });
    if (hasHem) {
      b.loft(topC.mat, [tring(hemY, 0, 1.1), tring(lerp(hemY, 0.1, 0.5), 0, 1.07), tring(0.1, 0, 1.05)], { smooth: true, tint: topC.tint });
    }
    if (has("belt") || has("holster") || p.top.style === "vest") {
      const lea = leather("#ffffff", 0.9);
      const bs = (y) => Math.max(1.05, coatScale(y) + 0.025);
      b.loft(lea.mat, [tring(0.03, 0, bs(0.03)), tring(0.075, 0, bs(0.075))], { smooth: true, tint: lea.tint });
      b.boxC("mat_metal_galvanized", [0, k(0.052), front(0.052) * bs(0.052) + k(0.004)], [k(0.05), k(0.05), k(0.012)], { skip: ["b", "s", "e", "w"] });
    }
    if (has("holster")) {
      const lea = leather("#ffffff", 0.8);
      b.boxC(lea.mat, [hw.hip * 1.12, k(-0.07), k(0.01)], [k(0.045), k(0.15), k(0.085)], { skip: ["b"], tint: lea.tint });
      b.boxC("mat_metal_painted_dark", [hw.hip * 1.12, k(0.035), k(-0.01)], [k(0.03), k(0.05), k(0.07)], { skip: ["b"] });
    }
    if (has("backpack_low")) {
      b.boxC("mat_char_leather", [0, k(0.02), -k(0.16)], [k(0.26), k(0.2), k(0.1)], { skip: ["b"], tint: tint("#3a3f48") });
    }

    // ---- spine ----------------------------------------------------------------
    b.node("spine", { pos: [0, S.spineY - hipY, 0] }, () => {
      const rings = [tring(0.1, 0.12, 1.02), tring(0.2, 0.12), tring(0.34, 0.12)];
      const m = p.top.style === "vest" ? cloth(p.top.inner ?? p.top.color, 0.9) : topC;
      b.loft(m.mat, rings, { smooth: true, tint: m.tint });
      if (p.top.zip && p.top.style === "jacket") {
        b.boxC("mat_metal_galvanized", [0, k(0.04), front(0.16) + k(0.002)], [k(0.012), k(0.2), k(0.008)], { skip: ["b", "s", "e", "w", "t"] });
      }
      if (p.top.trim) for (const sx of [-1, 1]) b.boxC(p.top.trim, [sx * hw.waist * 0.5, k(0.06), front(0.18) * 0.985], [k(0.015), k(0.14), k(0.008)], { skip: ["b", "s", "e", "w", "t"] });
      if (p.top.pockets) {
        for (const sx of [-1, 1]) b.boxC(topC2.mat, [sx * hw.waist * 0.55, k(0.0), front(0.15) * 0.98], [k(0.07), k(0.07), k(0.016)], { skip: ["b"], tint: topC2.tint });
      }

      // ---- chest --------------------------------------------------------------
      b.node("chest", { pos: [0, S.chestY - S.spineY, 0] }, () => {
        const cy = (abs) => hipY + k(abs) - S.chestY; // chest-local y of a "hip + abs" height
        const chestRings = [tring(0.3, 0.32, 1.02), tring(0.4, 0.32), tring(0.49, 0.32), tring(0.55, 0.32), tring(0.585, 0.32), tring(0.608, 0.32)];
        const m = p.top.style === "vest" ? cloth(p.top.inner ?? p.top.color, 0.9) : topC;
        b.loft(m.mat, chestRings, { smooth: true, capEnd: true, tint: m.tint });
        if (p.top.zip && p.top.style === "jacket") {
          b.boxC("mat_metal_galvanized", [0, cy(0.43), front(0.43) + k(0.002)], [k(0.012), k(0.25), k(0.008)], { skip: ["b", "s", "e", "w", "t"] });
        }
        // collar
        if (p.top.collar === "high" || p.top.collar === "normal") {
          const hi = p.top.collar === "high";
          const base = cy(0.585), top = cy(hi ? 0.662 : 0.64);
          const c1 = scaleRing(ringXZ(base, k(0.1), k(0.088) * dep, -k(0.004), 10), 1, 1);
          const c2 = scaleRing(ringXZ(top, k(hi ? 0.098 : 0.11), k(hi ? 0.09 : 0.1) * dep, -k(0.008), 10), 1, 1);
          b.loft(topC.mat, [c1, c2], { smooth: true, tint: topC2.tint });
          if (p.top.trim && hi) {
            const t1 = ringXZ(top, k(0.1), k(0.092) * dep, -k(0.008), 10);
            const t2 = ringXZ(top + k(0.012), k(0.1), k(0.092) * dep, -k(0.008), 10);
            b.loft(p.top.trim, [t1, t2], { smooth: true });
          }
        } else if (p.top.collar === "hood") {
          const c1 = ringXZ(cy(0.585), k(0.105), k(0.095) * dep, -k(0.01), 10);
          const c2 = ringXZ(cy(0.66), k(0.11), k(0.1) * dep, -k(0.02), 10);
          b.loft(topC.mat, [c1, c2], { smooth: true, tint: topC.tint });
          b.sphere(topC.mat, { c: [0, cy(0.64), -k(0.1)], r: [k(0.08), k(0.07), k(0.06)], seg: 8, rings: 4 }, { tint: topC2.tint });
        }
        if (has("neck_ring")) {
          b.lathe(p.neon, [[k(0.1), cy(0.668)], [k(0.108), cy(0.678)], [k(0.1), cy(0.688)]], { seg: 10, x: 0, z: -k(0.008) }, {});
        }
        if (has("tie")) {
          const lea = cloth("#8a1428");
          b.boxC(lea.mat, [0, cy(0.5), front(0.5) + k(0.003)], [k(0.03), k(0.2), k(0.006)], { skip: ["b", "s", "e", "w", "t"], tint: lea.tint });
        }
        if (has("badge")) b.boxC("mat_metal_galvanized", [hw.chest * 0.45, cy(0.46), front(0.46) + k(0.003)], [k(0.035), k(0.04), k(0.008)], { skip: ["b", "s", "e", "w"] });
        if (has("radio")) {
          b.boxC("mat_metal_painted_dark", [-hw.chest * 0.62, cy(0.5), front(0.5) * 0.99], [k(0.04), k(0.085), k(0.03)], { skip: ["b"] });
          b.boxC("mat_neon_green", [-hw.chest * 0.62, cy(0.5) + k(0.02), front(0.5) * 0.99 + k(0.016)], [k(0.02), k(0.012), k(0.002)], { skip: ["b", "s", "e", "w", "t"] });
        }
        if (has("vest")) {
          const m2 = metal("#cfd3da");
          b.loft(m2.mat, [tring(0.3, 0.32, 1.04, 1.1), tring(0.41, 0.32, 1.07, 1.12), tring(0.52, 0.32, 1.06, 1.1)], { smooth: true, tint: m2.tint });
          b.boxC("mat_metal_plate_worn", [0, cy(0.43), front(0.43) * 1.11 + k(0.004)], [hw.chest * 1.0, k(0.13), k(0.016)], { skip: ["b"] });
          b.boxC(p.neon, [0, cy(0.5), front(0.5) * 1.11 + k(0.014)], [hw.chest * 0.75, k(0.012), k(0.002)], { skip: ["b", "s", "e", "w", "t"] });
        }
        if (has("backpack")) {
          const bk = tint(p.extraColor);
          b.boxC("mat_char_cloth", [0, cy(0.43), -k(0.2) * dep], [k(0.27), k(0.34), k(0.12)], { skip: ["b"], tint: bk });
          b.boxC(p.neon, [0, cy(0.5), -k(0.263) * dep], [k(0.2), k(0.012), k(0.004)], { skip: ["b", "s", "e", "w", "t"] });
          for (const sx of [-1, 1]) {
            b.boxC("mat_char_cloth", [sx * k(0.085), cy(0.47), front(0.47) * 1.0 + k(0.004)], [k(0.03), k(0.22), k(0.01)], { skip: ["b"], tint: bk });
            b.boxC("mat_char_cloth", [sx * k(0.085), cy(0.575), (front(0.575) - k(0.09)) * 0.0], [k(0.03), k(0.012), k(0.3)], { skip: ["b"], tint: bk });
          }
        }

        // ---- neck + head --------------------------------------------------------
        b.node("neck", { pos: [0, S.neckY - S.chestY, 0] }, () => {
          b.lathe(skin.mat, [[k(0.042), k(-0.045)], [k(0.04), k(0.0)], [k(0.037), k(0.05)], [k(0.0), k(0.056)]], { seg: 8 }, D(skin));
          b.node("head", { pos: [0, S.headY - S.neckY, 0] }, () => buildHead(b, p, k));
        });

        // ---- arms ---------------------------------------------------------------
        for (const sx of [-1, 1]) {
          const side = sx < 0 ? "L" : "R";
          const clavY = hipY + k(0.55) - S.chestY;
          b.node(`shoulder_${side}`, { pos: [sx * k(0.05), clavY, 0] }, () => {
            if (has(`pad_${side}`)) {
              const m2 = metal("#cfd3da");
              b.sphere(m2.mat, { c: [sx * (hw.sh - k(0.05) + k(0.02)), k(0.0), 0], r: [k(0.075), k(0.05), k(0.075)], seg: 8, rings: 4 }, { tint: m2.tint });
              b.boxC(p.neon, [sx * (hw.sh - k(0.05) + k(0.02)), k(0.052), 0], [k(0.06), k(0.008), k(0.06)], { skip: ["b"] });
            }
            const armPos = [sx * (hw.sh - k(0.05)), S.shoulderY - (hipY + k(0.55)), 0];
            b.node(`upperarm_${side}`, { pos: armPos, rot: [0, 0, sx * p.armSpread] }, () => {
              buildArm(b, p, S, k, lm, sx, side, { topC, topC2, skin, glove, longS, shortS, cyberOn, metal });
            });
          });
        }
      });
    });

    // ---- legs -----------------------------------------------------------------
    for (const sx of [-1, 1]) {
      const side = sx < 0 ? "L" : "R";
      b.node(`thigh_${side}`, { pos: [sx * hw.hip * 0.5, 0, 0] }, () => {
        const tl = S.thighLen;
        const rr = (a, c) => k(c) * lm * p.bottom.baggy * (a === 0 ? 1.04 : 1);
        const prof = limbProfile(tl, [[0, k(0.08) * lm], [0.3, k(0.077) * lm * p.bottom.baggy], [0.75, k(0.06) * lm * p.bottom.baggy], [1, k(0.052) * lm * p.bottom.baggy]], true, true);
        const m = p.bottom.kind === "shorts" ? skin : botC;
        if (p.bottom.kind === "shorts") {
          b.lathe(skin.mat, prof, { seg: 8, crease: 75 }, D(skin));
          const sp = limbProfile(tl * 0.62, [[0, k(0.091) * lm], [1, k(0.074) * lm * p.bottom.baggy]], false, false);
          b.lathe(botC.mat, sp, { seg: 8, crease: 75 }, D(botC));
        } else {
          b.lathe(m.mat, prof, { seg: 8, crease: 75 }, D(m));
        }
        if (p.bottom.stripe) {
          b.boxC(p.bottom.stripe, [sx * k(0.082) * lm * p.bottom.baggy, -tl * 0.5, 0], [k(0.008), tl * 0.9, k(0.03)], { skip: ["b", "t", "n", "s"] });
        }
        b.node(`shin_${side}`, { pos: [0, -tl, 0] }, () => {
          const sl = S.shinLen;
          const prof2 = limbProfile(sl, [[0, k(0.054) * lm * p.bottom.baggy], [0.22, k(0.058) * lm * p.bottom.baggy], [0.7, k(0.04) * lm * (p.bottom.cuff ? 1.2 : 1) * p.bottom.baggy], [1, k(0.034) * lm * (p.bottom.cuff ? 1.45 : 1) * p.bottom.baggy]], true, false);
          if (p.bottom.kind === "shorts") b.lathe(skin.mat, prof2, { seg: 8, crease: 75 }, D(skin));
          else b.lathe(botC.mat, prof2, { seg: 8, crease: 75 }, D(botC));
          if (p.boots.high && p.boots.kind === "boots") {
            const rb = (f) => k(lerp(0.058, 0.04, clamp01((f - 0.22) / 0.48))) * lm * p.bottom.baggy * 1.0 + k(0.007);
            const bp = [[rb(1) * 0.8, -sl * 1.0], [rb(0.75) + k(0.002), -sl * 0.75], [rb(0.55) + k(0.002), -sl * 0.55], [rb(0.5) + k(0.012), -sl * 0.52], [rb(0.5) * 0.9, -sl * 0.52]];
            b.lathe("mat_char_leather", bp, { seg: 8, crease: 80 }, { tint: tintBoot });
          }
          b.node(`foot_${side}`, { pos: [0, -sl, 0] }, () => buildFoot(b, p, S, k, tintBoot));
        });
      });
    }
  });

  // gameplay data
  b.collider({ c: [0, p.height * 0.5, 0], h: [k(0.24), p.height * 0.5, k(0.2)] });
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function buildFoot(b, p, S, k, tintBoot) {
  const ay = S.ankleY;
  const kind = p.boots.kind;
  const sole = tint(p.boots.sole);
  const ring = (z, w, yTop, yBot = -ay + k(0.022)) => [
    [-w * 0.78, yBot, z], [w * 0.78, yBot, z], [w, (yBot + yTop) * 0.5, z], [w * 0.86, yTop, z], [-w * 0.86, yTop, z], [-w, (yBot + yTop) * 0.5, z],
  ];
  const mat = kind === "sneakers" ? "mat_char_cloth" : "mat_char_leather";
  const rings = [
    ring(-k(0.07), k(0.036), k(0.03)),
    ring(-k(0.03), k(0.04), k(0.03)),
    ring(k(0.06), k(0.046), k(-0.005)),
    ring(k(0.14), k(0.05), k(-0.03)),
    ring(k(0.205), k(0.04), k(-0.045)),
    ring(k(0.225), k(0.024), k(-0.05)),
  ];
  b.loft(mat, rings, { smooth: true, capStart: true, capEnd: true, tint: tintBoot });
  b.box(kind === "sneakers" ? "mat_neon_white" : "mat_prop_rubber", [-k(0.052), -ay, -k(0.08)], [k(0.052), -ay + k(0.024), k(0.23)], { skip: ["b"], tint: kind === "sneakers" ? undefined : sole });
}

function buildArm(b, p, S, k, lm, sx, side, o) {
  const { topC, topC2, skin, glove, longS, shortS, cyberOn, metal } = o;
  const ul = S.upLen, fl = S.foreLen;
  const D = (m) => ({ tint: m.tint });
  const prof = limbProfile(ul, [[0, k(0.05) * lm], [0.3, k(0.047) * lm], [0.75, k(0.04) * lm], [1, k(0.036) * lm]], true, true);
  const sleeve = longS || shortS ? topC : skin;
  if (longS) b.lathe(sleeve.mat, limbProfile(ul, [[0, k(0.054) * lm], [0.3, k(0.051) * lm], [0.75, k(0.045) * lm], [1, k(0.041) * lm]], true, true), { seg: 8, crease: 75 }, D(topC));
  else {
    b.lathe(skin.mat, prof, { seg: 8, crease: 75 }, D(skin));
    if (shortS) b.lathe(topC.mat, limbProfile(ul * 0.55, [[0, k(0.056) * lm], [1, k(0.052) * lm]], true, false), { seg: 8, crease: 75 }, D(topC));
  }
  b.node(`forearm_${side}`, { pos: [0, -ul, 0] }, () => {
    const cy = cyberOn(side);
    const fprof = limbProfile(fl, [[0, k(0.038) * lm], [0.2, k(0.04) * lm], [0.7, k(0.032) * lm], [1, k(0.027) * lm]], true, false);
    if (cy) {
      const m = metal("#9aa2ad");
      b.lathe(m.mat, limbProfile(fl, [[0, k(0.04) * lm], [0.25, k(0.044) * lm], [0.75, k(0.036) * lm], [1, k(0.03) * lm]], true, false), { seg: 8, crease: 80 }, D(m));
      b.boxC(p.cyberNeon, [0, -fl * 0.45, k(0.043) * lm], [k(0.012), fl * 0.5, k(0.006)], { skip: ["b", "s", "e", "w"] });
      b.boxC("mat_metal_plate_worn", [sx * k(0.038) * lm, -fl * 0.3, 0], [k(0.012), fl * 0.38, k(0.05)], { skip: ["b"] });
    } else if (longS) {
      b.lathe(topC.mat, limbProfile(fl, [[0, k(0.04) * lm], [0.2, k(0.043) * lm], [0.75, k(0.036) * lm], [1, k(0.033) * lm]], true, false), { seg: 8, crease: 75 }, D(topC));
      b.lathe(skin.mat, [[k(0.03) * lm, -fl * 0.97], [k(0.03) * lm, -fl * 1.02]], { seg: 8 }, D(skin));
    } else {
      b.lathe(skin.mat, fprof, { seg: 8, crease: 75 }, D(skin));
    }
    b.node(`hand_${side}`, { pos: [0, -fl, 0] }, () => {
      const hm = cy ? metal("#9aa2ad") : (glove ?? skin);
      const hk = k(1) * lm;
      b.boxC(hm.mat, [0, -k(0.05), 0], [k(0.082) * lm, k(0.1), k(0.036)], { skip: ["t"], tint: hm.tint });
      b.boxC(hm.mat, [0, -k(0.125), k(0.004)], [k(0.076) * lm, k(0.056), k(0.03)], { skip: ["t"], tint: hm.tint });
      b.boxC(hm.mat, [-sx * k(0.052), -k(0.055), k(0.014)], [k(0.024), k(0.07), k(0.026)], { skip: ["t"], tint: hm.tint });
      b.anchor(`hand_${side}_grip`, [0, -k(0.07), k(0.02)]);
      void hk;
    });
  });
}

function buildHead(b, p, k) {
  const hs = p.headScale;
  const skin = { mat: "mat_char_skin", tint: skinTint(p.skin) };
  const cx = 0, cy = k(0.095) * hs, cz = k(0.008);
  const rx = k(0.076) * hs, ry = k(0.1) * hs, rz = k(0.09) * hs;
  b.sphere(skin.mat, { c: [cx, cy, cz], r: [rx, ry, rz], seg: 10, rings: 7 }, { tint: skin.tint });
  b.sphere(skin.mat, { c: [0, cy - ry * 0.5, cz + rz * 0.12], r: [rx * 0.8, ry * 0.46, rz * 0.78], seg: 10, rings: 4 }, { tint: skin.tint });
  // nose and ears
  b.boxC(skin.mat, [0, cy - ry * 0.14, cz + rz * 0.96], [k(0.016) * hs, k(0.032) * hs, k(0.02) * hs], { skip: ["b"], tint: skin.tint });
  for (const sx of [-1, 1]) b.boxC(skin.mat, [sx * (rx + k(0.002)), cy - ry * 0.05, cz - rz * 0.05], [k(0.012), k(0.04) * hs, k(0.026) * hs], { skip: ["b", "n", "s"], tint: skin.tint });
  // eyes
  const eyeMat = "mat_prop_rubber";
  for (const sx of [-1, 1]) {
    b.boxC(eyeMat, [sx * rx * 0.42, cy + ry * 0.1, cz + rz * 0.93], [k(0.022) * hs, k(0.011) * hs, k(0.012)], { skip: ["b", "t", "s", "e", "w"] });
  }
  if (p.face.beard) {
    b.sphere("mat_char_cloth", { c: [0, cy - ry * 0.55, cz + rz * 0.22], r: [rx * 0.86, ry * 0.46, rz * 0.9], seg: 8, rings: 4 }, { tint: tint(p.hair.color) });
  }
  // top of head: used by the game for name tags
  b.anchor("head_top", [0, cy + ry + k(0.02), 0]);
  b.anchor("eyes", [0, cy + ry * 0.1, cz + rz]);

  // hair / headgear
  const hairC = tint(p.hair.color);
  const cap = (mat, t, o) => hairCap(b, mat, { cx, cy, cz, rx, ry, rz }, t, o);
  const style = p.hair.style;
  const helmet = p.extras.includes("helmet"), capOn = p.extras.includes("cap");
  if (helmet) {
    const m = { mat: "mat_metal_painted_dark", tint: tint(p.extraColor) };
    cap(m.mat, k(0.012), { latF: 22, latS: 4, latB: -22, tint: m.tint, rings: 5 });
    b.boxC(p.neon, [0, cy + ry * 0.62, cz + rz * 1.0], [k(0.09), k(0.01), k(0.004)], { skip: ["b", "t", "s", "e", "w"] });
    if (p.extras.includes("visorglass")) b.boxC("mat_glass_dark", [0, cy + ry * 0.05, cz + rz * 1.04], [rx * 2.0, ry * 0.5, k(0.01)], { skip: ["b", "t"] });
  } else if (capOn) {
    const m = { mat: "mat_char_cloth", tint: tint(p.extraColor) };
    cap(m.mat, k(0.01), { latF: 30, latS: 5, latB: -10, tint: m.tint });
    b.boxC(m.mat, [0, cy + ry * 0.38, cz + rz * 1.12], [rx * 1.5, k(0.008), k(0.1)], { skip: ["b"], tint: m.tint });
  } else if (style === "short" || style === "long" || style === "bun" || style === "ponytail") {
    cap("mat_char_cloth", k(0.008), { latF: 32, latS: 2, latB: -26, tint: hairC });
  } else if (style === "bob") {
    cap("mat_char_cloth", k(0.008), { latF: 32, latS: -20, latB: -42, tint: hairC });
  } else if (style === "buzz") {
    cap("mat_char_cloth", k(0.003), { latF: 34, latS: 12, latB: -2, tint: hairC });
  } else if (style === "mohawk") {
    cap("mat_char_cloth", k(0.002), { latF: 34, latS: 14, latB: -4, tint: tint("#1a1612"), rings: 3 });
    const fin = [];
    const zs = [0.085, 0.04, -0.01, -0.06, -0.09];
    for (const zz of zs) {
      const yb = cy + Math.sqrt(Math.max(0, 1 - (zz / (rz / k(1))) ** 2)) * ry * 0.98;
      const hgt = k(0.075) * (1 - Math.abs(zz) * 2.2);
      fin.push([[-k(0.009), yb - k(0.004), cz + k(zz)], [k(0.009), yb - k(0.004), cz + k(zz)], [k(0.006), yb + hgt, cz + k(zz) * 1.02], [-k(0.006), yb + hgt, cz + k(zz) * 1.02]]);
    }
    b.loft(p.hair.fin ?? "mat_neon_magenta", fin, { capStart: true, capEnd: true });
  }
  if (style === "long") {
    const ring = (y, w, zc) => [[-w, y, zc], [-w * 0.5, y, zc - k(0.035)], [w * 0.5, y, zc - k(0.035)], [w, y, zc], [w * 0.5, y, zc + k(0.01)], [-w * 0.5, y, zc + k(0.01)]];
    b.loft("mat_char_cloth", [ring(cy + ry * 0.2, rx * 1.0, cz - rz * 0.55), ring(cy - ry * 0.7, rx * 1.08, cz - rz * 0.68), ring(cy - ry * 1.85, rx * 1.0, cz - rz * 0.62)], { smooth: true, capEnd: true, tint: hairC });
  } else if (style === "bun") {
    b.sphere("mat_char_cloth", { c: [0, cy + ry * 0.95, cz - rz * 0.35], r: k(0.045) * hs, seg: 8, rings: 4 }, { tint: hairC });
  } else if (style === "ponytail") {
    b.tube("mat_char_cloth", { pts: [[0, cy + ry * 0.4, cz - rz * 0.9], [0, cy - ry * 0.1, cz - rz * 1.35], [0, cy - ry * 1.4, cz - rz * 1.3]], r: k(0.03), seg: 5 }, { tint: hairC });
  }
  // visor / face accessories
  if (p.face.visor) {
    b.boxC(p.face.visor, [0, cy + ry * 0.1, cz + rz * 0.95], [rx * 2.04, k(0.036) * hs, k(0.016)], { skip: ["b", "t"] });
    for (const sx of [-1, 1]) b.boxC(p.face.visor, [sx * rx * 1.0, cy + ry * 0.1, cz + rz * 0.35], [k(0.01), k(0.03) * hs, rz * 1.2], { skip: ["b", "t"] });
  }
  if (p.extras.includes("earpiece")) {
    b.boxC("mat_metal_painted_dark", [rx + k(0.008), cy - ry * 0.05, cz], [k(0.014), k(0.03), k(0.02)], { skip: ["b"] });
    b.tube("mat_prop_rubber", { pts: [[rx + k(0.01), cy - ry * 0.12, cz], [rx + k(0.012), cy - ry * 0.9, cz - k(0.01)], [k(0.05), -k(0.03), -k(0.02)]], r: k(0.004), seg: 3, cap: false });
  }
}

/** Hair / helmet cap: a shell over the skull, rim latitude varies front/side/back (degrees). */
function hairCap(b, mat, h, t, o) {
  const { cx, cy, cz, rx, ry, rz } = h;
  const n = 10, nr = o.rings ?? 4;
  const rings = [];
  for (let kk = 0; kk < nr; kk++) {
    const ring = [];
    for (let i = 0; i < n; i++) {
      const th = (i / n) * TAU;
      const c = Math.cos(th), s = Math.sin(th);
      const rim = c >= 0 ? lerp(o.latS, o.latF, c) : lerp(o.latS, o.latB, -c);
      const lat = lerp(rim, 82, kk / (nr - 1)) * (Math.PI / 180);
      const cl = Math.cos(lat), sl = Math.sin(lat);
      ring.push([cx + (rx + t) * cl * s, cy + (ry + t) * sl, cz + (rz + t) * cl * c]);
    }
    rings.push(ring);
  }
  b.loft(mat, rings, { smooth: true, capEnd: true, tint: o.tint });
}

// ---------------------------------------------------------------------------------------------
// Animation clips
// ---------------------------------------------------------------------------------------------

/**
 * Build a looping clip. spec = { nodeName: { rot?: (ph) => [x,y,z], pos?: (ph) => [x,y,z] } }, ph in [0,1).
 * Keys are sampled `n` times and the loop is closed with a copy of key 0.
 */
function clipFrom(b, name, dur, n, spec) {
  const tracks = [];
  for (const [node, f] of Object.entries(spec)) {
    for (const path of ["rot", "pos"]) {
      if (!f[path]) continue;
      const keys = [];
      for (let i = 0; i < n; i++) keys.push({ t: (i / n) * dur, v: f[path](i / n) });
      keys.push({ t: dur, v: keys[0].v });
      tracks.push({ node, path: path === "rot" ? "rotation" : "translation", keys });
    }
  }
  b.clip(name, tracks);
}

export function addClips(b, params) {
  const p = merge(params);
  const S = skeleton(p);
  const sp = p.armSpread;
  const hipsPos = [0, S.hipY, 0];
  const sin = (ph, off = 0) => Math.sin((ph + off) * TAU);
  const cos = (ph, off = 0) => Math.cos((ph + off) * TAU);
  const pos0 = (x) => Math.max(0, x);
  const armBase = (side) => (side === "L" ? -sp : sp);
  const sides = [["R", 0, 1], ["L", 0.5, -1]];

  // idle: breathing and a slow weight shift
  {
    const spec = {
      hips: { pos: (ph) => [0.012 * sin(ph), hipsPos[1] - 0.004 * (1 - cos(ph * 2)) * 0.5, 0], rot: (ph) => [0, 0.02 * sin(ph), 0.025 * sin(ph)] },
      spine: { rot: (ph) => [0.012 * sin(ph * 2) + 0.01, -0.015 * sin(ph), -0.02 * sin(ph)] },
      chest: { rot: (ph) => [0.02 * sin(ph * 2 - 0.1), 0.01 * sin(ph), 0] },
      head: { rot: (ph) => [-0.015 * sin(ph * 2) + 0.02, 0.07 * sin(ph), 0.02 * sin(ph + 0.25)] },
    };
    for (const [s, off, sg] of sides) {
      spec[`upperarm_${s}`] = { rot: (ph) => [0.03 * sin(ph * 2, off), 0, armBase(s) + 0.012 * sin(ph * 2, off)] };
      spec[`forearm_${s}`] = { rot: (ph) => [-0.18 - 0.02 * sin(ph * 2, off + 0.1), 0, 0] };
      spec[`thigh_${s}`] = { rot: (ph) => [0.02 * sg * sin(ph), 0, 0] };
    }
    clipFrom(b, "idle", 2, 8, spec);
  }

  const locomotion = (name, dur, A) => {
    const spec = {
      hips: {
        pos: (ph) => [0.012 * A.sway * sin(ph), hipsPos[1] + A.bob * cos(ph * 2), 0],
        rot: (ph) => [A.lean * 0.4, -A.twist * sin(ph), 0.04 * A.sway * cos(ph * 2) * 0 + 0.03 * A.sway * sin(ph)],
      },
      spine: { rot: (ph) => [A.lean * 0.6, A.twist * 0.9 * sin(ph), -0.02 * A.sway * sin(ph)] },
      chest: { rot: (ph) => [0.01, A.twist * 0.7 * sin(ph), 0] },
      neck: { rot: (ph) => [-A.lean * 0.5, -A.twist * 0.9 * sin(ph), 0] },
      head: { rot: (ph) => [-A.lean * 0.4 + 0.02, -A.twist * 0.8 * sin(ph), 0] },
    };
    for (const [s, off, sg] of sides) {
      const th = (ph) => -A.thigh * sin(ph, off);
      const kn = (ph) => A.kneeBase + A.knee * Math.pow(pos0(cos(ph, off)), A.kneePow) + A.kneeStance * pos0(-cos(ph, off)) * pos0(sin(ph, off));
      spec[`thigh_${s}`] = { rot: (ph) => [th(ph), 0, sg * 0.01] };
      spec[`shin_${s}`] = { rot: (ph) => [kn(ph), 0, 0] };
      spec[`foot_${s}`] = { rot: (ph) => [-(th(ph) + kn(ph)) * 0.55 + (A.toe * pos0(cos(ph, off))), 0, 0] };
      spec[`upperarm_${s}`] = { rot: (ph) => [A.arm * sin(ph, off), 0, armBase(s) * (A.armOut)] };
      spec[`forearm_${s}`] = { rot: (ph) => [-(A.elbow + A.elbowSwing * pos0(-sin(ph, off))), 0, 0] };
    }
    clipFrom(b, name, dur, 12, spec);
  };
  locomotion("walk", 1.0, { thigh: 0.42, kneeBase: 0.06, knee: 0.62, kneePow: 2, kneeStance: 0.18, toe: 0.25, arm: 0.36, elbow: 0.3, elbowSwing: 0.25, armOut: 1, bob: 0.018, lean: 0.04, twist: 0.1, sway: 1 });
  locomotion("run", 0.7, { thigh: 0.85, kneeBase: 0.12, knee: 1.35, kneePow: 1.4, kneeStance: 0.3, toe: 0.45, arm: 0.95, elbow: 1.2, elbowSwing: 0.3, armOut: 0.4, bob: 0.05, lean: 0.2, twist: 0.2, sway: 0.5 });

  // aim: two-handed pistol stance, tiny breathing sway
  {
    const spec = {
      hips: { pos: (ph) => [0, hipsPos[1] - 0.025 + 0.002 * sin(ph), 0], rot: () => [0.03, -0.18, 0] },
      spine: { rot: (ph) => [0.05 + 0.006 * sin(ph), 0.1, 0] },
      chest: { rot: (ph) => [0.02 + 0.01 * sin(ph), 0.1, 0] },
      neck: { rot: () => [0.05, 0, 0] },
      head: { rot: (ph) => [0.06 + 0.005 * sin(ph), 0.0, 0] },
      thigh_R: { rot: () => [-0.28, 0, 0.02] },
      shin_R: { rot: () => [0.35, 0, 0] },
      foot_R: { rot: () => [-0.07, 0, 0] },
      thigh_L: { rot: () => [0.2, 0, -0.02] },
      shin_L: { rot: () => [0.4, 0, 0] },
      foot_L: { rot: () => [-0.55, 0, 0] },
      upperarm_R: { rot: (ph) => [-1.45 + 0.01 * sin(ph), 0, -0.2] },
      forearm_R: { rot: () => [-0.1, 0, -0.1] },
      upperarm_L: { rot: (ph) => [-1.38 + 0.01 * sin(ph), 0, 0.26] },
      forearm_L: { rot: () => [-0.32, 0, 0.08] },
    };
    clipFrom(b, "aim", 2, 4, spec);
  }
}
