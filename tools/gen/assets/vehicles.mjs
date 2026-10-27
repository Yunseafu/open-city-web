// Vehicles: wheeled cars, trucks, a bus, a motorcycle and a hover coupe.
//
// Contract (see docs/models.md): origin on the ground at the midpoint between the axles,
// forward = +Z, width along X. Wheels are named nodes (wheel_FL/FR/RL/RR, axle along X, rotation
// centre at the node origin; front wheels steer about Y). Light anchors: light.head_L/R,
// light.tail_L/R; also seat_driver and exhaust. Paint is mat_veh_paint tinted by vertex colour
// (params.color, "#rrggbb"); params.underglow: a neon material id, or null for none (default: random).
import { TAU } from "../lib/math.mjs";
import {
  PAINT, GLASS, DARK, CHROME, HEAD, TAIL, TIRE, NEON_UNDERGLOW,
  paintTint, blk, blkSym, lowerBody, greenhouse, paintVolume, wheels, wheelGeo, doorSeams, skirts, mirrors,
  underglow, plate, lightAnchors, sideQuad,
} from "../lib/veh_kit.mjs";

const AO = { y0: 0.05, y1: 0.6, lo: 0.55, hi: 1 };
const WHITE = [1, 1, 1];
const BLACK = [0.03, 0.03, 0.035];

function pickUnderglow(r, p, chance = 0.45) {
  if (p.underglow === null) return null;
  if (p.underglow) return p.underglow;
  return r.chance(chance) ? r.pick(NEON_UNDERGLOW) : null;
}

// ---------------------------------------------------------------------------------------------
// Sedan family (sedan, taxi, police)
// ---------------------------------------------------------------------------------------------
function sedan(b, r, p, v = {}) {
  b.ao = AO;
  const tint = paintTint(p.color ?? "#b8bcc4");
  const body = lowerBody(b, [
    [-2.35, 0.30, 0.84, 0.80],
    [-2.22, 0.20, 0.95, 0.90],
    [-1.85, 0.17, 0.98, 0.93],
    [-0.60, 0.15, 0.96, 0.93],
    [0.60, 0.15, 0.96, 0.93],
    [1.30, 0.15, 0.93, 0.93],
    [1.85, 0.17, 0.84, 0.92],
    [2.20, 0.23, 0.72, 0.88],
    [2.35, 0.30, 0.60, 0.80],
  ], tint);
  greenhouse(b, body, [
    [0.95, null, 0, 0.74, 0.70],
    [0.18, null, 1.44, 0.74, 0.62],
    [-1.0, null, 1.43, 0.74, 0.62],
    [-1.6, null, 0, 0.74, 0.70],
  ], tint, { b: [-0.12] });
  wheels(b, body, [{ z: 1.4, name: "F" }, { z: -1.4, name: "R" }], { R: 0.33, W: 0.235, rimNeon: v.rimNeon });
  doorSeams(b, body, [0.7, -0.12, -1.1], { handles: [0.3, -0.75] });
  skirts(b, body, -0.95, 0.95);
  mirrors(b, tint, 0.98, 1.03, 0.82);
  blk(b, HEAD, [0, 0.5, 2.33], [1.34, 0.045, 0.08]);
  blkSym(b, HEAD, [0.62, 0.56, 2.28], [0.34, 0.07, 0.16]);
  blk(b, DARK, [0, 0.4, 2.33], [0.95, 0.14, 0.07]);
  blk(b, DARK, [0, 0.33, 2.3], [1.45, 0.06, 0.12]);
  blk(b, TAIL, [0, 0.76, -2.34], [1.5, 0.05, 0.06]);
  blkSym(b, TAIL, [0.66, 0.79, -2.31], [0.38, 0.11, 0.1]);
  blk(b, DARK, [0, 0.36, -2.31], [1.3, 0.12, 0.08]);
  plate(b, 0, 0.58, -2.36, false);
  const ug = pickUnderglow(r, p);
  if (ug) underglow(b, ug, 0.93, 0.13, -1.0, 1.0);
  lightAnchors(b, "head", 0.62, 0.55, 2.35, "#f2f8ff", 1, 22);
  lightAnchors(b, "tail", 0.66, 0.78, -2.35, "#ff1020", 0.6, 8);
  b.anchor("seat_driver", [-0.38, 0.72, 0.25]);
  b.anchor("exhaust", [0.5, 0.25, -2.3]);
  b.collider({ c: [0, 0.73, 0], h: [0.93, 0.73, 2.35] });
  v.extra?.(b, { body, tint });
}

function taxi(b, r, p) {
  sedan(b, r, { underglow: null, ...p, color: p.color ?? "#e6b400" }, {
    extra(b2, { body }) {
      // checker band along both flanks
      for (const side of [-1, 1]) {
        for (let i = 0; i < 9; i++) {
          const z0 = -1.15 + i * 0.27;
          sideQuad(b2, PAINT, side, 0.936, 0.58, 0.66, z0, z0 + 0.27, { tint: i % 2 ? WHITE : BLACK });
        }
      }
      // roof sign
      blk(b2, DARK, [0, 1.5, -0.1], [0.56, 0.1, 0.26]);
      blk(b2, "mat_neon_amber", [0, 1.57, -0.1], [0.5, 0.1, 0.22]);
      b2.anchor("light.roof_sign", [0, 1.6, -0.1], { color: "#ffb000", intensity: 0.4, range: 6 });
    },
  });
}

function police(b, r, p) {
  sedan(b, r, { underglow: null, ...p, color: p.color ?? "#16181d" }, {
    extra(b2, { body }) {
      // white door panels and a blue stripe
      for (const side of [-1, 1]) {
        sideQuad(b2, PAINT, side, 0.938, 0.3, 0.88, -1.08, -0.16, { tint: WHITE });
        sideQuad(b2, PAINT, side, 0.938, 0.3, 0.88, -0.08, 0.68, { tint: WHITE });
        sideQuad(b2, "mat_neon_cyan", side, 0.944, 0.62, 0.66, -1.9, 1.9);
      }
      // light bar
      blk(b2, DARK, [0, 1.5, -0.15], [1.0, 0.07, 0.3]);
      blk(b2, "mat_neon_red", [0.25, 1.56, -0.15], [0.48, 0.07, 0.26]);
      blk(b2, "mat_neon_cyan", [-0.25, 1.56, -0.15], [0.48, 0.07, 0.26]);
      b2.anchor("light.bar_L", [-0.25, 1.6, -0.15], { color: "#00f0ff", intensity: 1.2, range: 14 });
      b2.anchor("light.bar_R", [0.25, 1.6, -0.15], { color: "#ff2a3c", intensity: 1.2, range: 14 });
      // push bar
      blk(b2, DARK, [0, 0.45, 2.38], [1.3, 0.28, 0.06]);
    },
  });
}

// ---------------------------------------------------------------------------------------------
// Compact hatchback
// ---------------------------------------------------------------------------------------------
function hatch(b, r, p) {
  b.ao = AO;
  const tint = paintTint(p.color ?? "#d8d2c4");
  const body = lowerBody(b, [
    [-1.95, 0.28, 0.80, 0.78],
    [-1.85, 0.20, 0.88, 0.85],
    [-1.5, 0.16, 0.90, 0.87],
    [0.2, 0.15, 0.90, 0.87],
    [0.8, 0.15, 0.88, 0.87],
    [1.35, 0.16, 0.80, 0.86],
    [1.72, 0.22, 0.68, 0.82],
    [1.95, 0.28, 0.56, 0.74],
  ], tint);
  greenhouse(b, body, [
    [0.78, null, 0, 0.7, 0.66],
    [0.05, null, 1.48, 0.7, 0.6],
    [-1.2, null, 1.46, 0.7, 0.6],
    [-1.82, null, 0, 0.7, 0.66],
  ], tint, { b: [-0.45] });
  wheels(b, body, [{ z: 1.2, name: "F" }, { z: -1.2, name: "R" }], { R: 0.3, W: 0.2, rimNeon: p.rimNeon });
  doorSeams(b, body, [0.55, -0.42], { handles: [0.1, -0.85] });
  mirrors(b, tint, 0.9, 0.97, 0.7);
  blk(b, HEAD, [0, 0.47, 1.93], [1.2, 0.04, 0.08]);
  blkSym(b, HEAD, [0.52, 0.52, 1.88], [0.3, 0.08, 0.16]);
  blk(b, DARK, [0, 0.36, 1.93], [0.8, 0.14, 0.07]);
  blk(b, DARK, [0, 0.3, 1.9], [1.3, 0.06, 0.12]);
  blkSym(b, TAIL, [0.62, 0.74, -1.93], [0.2, 0.3, 0.1]);
  blk(b, TAIL, [0, 0.86, -1.92], [1.0, 0.035, 0.06]);
  blk(b, DARK, [0, 0.34, -1.91], [1.2, 0.1, 0.08]);
  plate(b, 0, 0.55, -1.96, false);
  const ug = pickUnderglow(r, p, 0.35);
  if (ug) underglow(b, ug, 0.87, 0.13, -0.8, 0.8);
  lightAnchors(b, "head", 0.52, 0.5, 1.95, "#f2f8ff", 1, 20);
  lightAnchors(b, "tail", 0.62, 0.74, -1.95, "#ff1020", 0.6, 8);
  b.anchor("seat_driver", [-0.34, 0.7, 0.1]);
  b.anchor("exhaust", [0.45, 0.25, -1.9]);
  b.collider({ c: [0, 0.74, 0], h: [0.87, 0.74, 1.95] });
}

// ---------------------------------------------------------------------------------------------
// Low sports coupe
// ---------------------------------------------------------------------------------------------
function coupe(b, r, p) {
  b.ao = AO;
  const tint = paintTint(p.color ?? "#1d1f26");
  const body = lowerBody(b, [
    [-2.25, 0.26, 0.80, 0.84],
    [-2.12, 0.18, 0.90, 0.94],
    [-1.7, 0.14, 0.95, 0.98],
    [-0.5, 0.13, 0.86, 0.98],
    [0.6, 0.13, 0.76, 0.98],
    [1.3, 0.14, 0.66, 0.97],
    [1.9, 0.17, 0.58, 0.94],
    [2.1, 0.19, 0.50, 0.9],
    [2.25, 0.25, 0.42, 0.8],
  ], tint, { topK: 0.8, lip: 0.07 });
  greenhouse(b, body, [
    [0.55, null, 0, 0.74, 0.7],
    [-0.1, null, 1.17, 0.72, 0.6],
    [-0.95, null, 1.16, 0.72, 0.6],
    [-1.55, null, 0, 0.74, 0.7],
  ], tint, { b: [-0.7] });
  wheels(b, body, [{ z: 1.32, name: "F", R: 0.33, W: 0.26 }, { z: -1.32, name: "R", R: 0.35, W: 0.3 }], { rimNeon: p.rimNeon, seg: 16 });
  doorSeams(b, body, [0.4, -0.95], { handles: [0.1], y0: 0.25, y1: 0.78 });
  mirrors(b, tint, 1.0, 0.86, 0.45);
  blk(b, HEAD, [0, 0.4, 2.23], [1.25, 0.035, 0.08]);
  blkSym(b, HEAD, [0.66, 0.47, 2.1], [0.5, 0.04, 0.16]);
  blk(b, DARK, [0, 0.31, 2.2], [1.1, 0.1, 0.07]);
  blk(b, DARK, [0, 0.27, 2.16], [1.5, 0.05, 0.14]);
  // hood vents
  blkSym(b, DARK, [0.3, 0.665, 1.25], [0.28, 0.01, 0.5]);
  // tail: thin full-width bar, ducktail spoiler on two plates
  blk(b, TAIL, [0, 0.8, -2.22], [1.7, 0.04, 0.06]);
  blkSym(b, TAIL, [0.8, 0.84, -2.17], [0.22, 0.1, 0.12]);
  blk(b, PAINT, [0, 1.0, -2.08], [1.8, 0.035, 0.36], { tint });
  blkSym(b, PAINT, [0.9, 0.93, -2.08], [0.035, 0.16, 0.36], { tint });
  blk(b, DARK, [0, 0.33, -2.18], [1.3, 0.14, 0.1]);
  // side intake behind the door
  blkSym(b, DARK, [1.0, 0.55, -0.95], [0.03, 0.2, 0.6]);
  plate(b, 0, 0.5, -2.27, false);
  const ug = pickUnderglow(r, p, 0.7);
  if (ug) underglow(b, ug, 0.98, 0.12, -1.0, 1.0);
  lightAnchors(b, "head", 0.66, 0.44, 2.25, "#f2f8ff", 1, 22);
  lightAnchors(b, "tail", 0.8, 0.82, -2.25, "#ff1020", 0.7, 9);
  b.anchor("seat_driver", [-0.4, 0.62, -0.05]);
  b.anchor("exhaust", [0.5, 0.25, -2.2]);
  b.collider({ c: [0, 0.6, 0], h: [0.98, 0.6, 2.25] });
}

// ---------------------------------------------------------------------------------------------
// SUV
// ---------------------------------------------------------------------------------------------
function suv(b, r, p) {
  b.ao = AO;
  const tint = paintTint(p.color ?? "#3a4150");
  const body = lowerBody(b, [
    [-2.4, 0.34, 1.0, 0.90],
    [-2.3, 0.28, 1.12, 0.96],
    [-1.5, 0.24, 1.14, 0.98],
    [0.6, 0.24, 1.12, 0.98],
    [1.4, 0.25, 1.1, 0.98],
    [2.0, 0.27, 1.02, 0.96],
    [2.3, 0.3, 0.88, 0.92],
    [2.4, 0.34, 0.78, 0.86],
  ], tint, { topK: 0.88 });
  greenhouse(b, body, [
    [1.0, null, 0, 0.84, 0.8],
    [0.45, null, 1.85, 0.84, 0.74],
    [-2.0, null, 1.85, 0.84, 0.74],
    [-2.28, null, 0, 0.84, 0.8],
  ], tint, { b: [-0.2, -1.25] });
  wheels(b, body, [{ z: 1.45, name: "F" }, { z: -1.45, name: "R" }], { R: 0.38, W: 0.26, rimNeon: p.rimNeon });
  doorSeams(b, body, [0.9, -0.2, -1.25], { handles: [0.5, -0.7], y0: 0.34, y1: 1.06 });
  skirts(b, body, -1.0, 1.0, { h: 0.18 });
  mirrors(b, tint, 1.03, 1.2, 0.95);
  // roof rails
  blkSym(b, DARK, [0.62, 1.9, -0.8], [0.04, 0.04, 2.5]);
  blk(b, HEAD, [0, 0.98, 2.4], [1.3, 0.04, 0.08]);
  blkSym(b, HEAD, [0.7, 0.9, 2.34], [0.3, 0.1, 0.18]);
  blk(b, DARK, [0, 0.82, 2.38], [1.1, 0.3, 0.06]);
  blk(b, DARK, [0, 0.45, 2.36], [1.5, 0.22, 0.12]);
  blk(b, TAIL, [0, 1.06, -2.35], [1.5, 0.06, 0.06]);
  blkSym(b, TAIL, [0.75, 0.96, -2.32], [0.18, 0.4, 0.1]);
  blk(b, DARK, [0, 0.42, -2.33], [1.5, 0.2, 0.1]);
  plate(b, 0, 0.75, -2.37, false);
  const ug = pickUnderglow(r, p, 0.3);
  if (ug) underglow(b, ug, 0.98, 0.18, -1.0, 1.0);
  lightAnchors(b, "head", 0.7, 0.92, 2.4, "#f2f8ff", 1, 24);
  lightAnchors(b, "tail", 0.75, 0.98, -2.4, "#ff1020", 0.6, 8);
  b.anchor("seat_driver", [-0.42, 1.0, 0.35]);
  b.anchor("exhaust", [0.55, 0.3, -2.35]);
  b.collider({ c: [0, 0.98, 0], h: [0.98, 0.98, 2.4] });
}

// ---------------------------------------------------------------------------------------------
// Delivery van
// ---------------------------------------------------------------------------------------------
function van(b, r, p) {
  b.ao = AO;
  const tint = paintTint(p.color ?? "#d5d9de");
  const body = lowerBody(b, [
    [-2.7, 0.32, 1.0, 0.92],
    [-2.6, 0.26, 1.1, 0.98],
    [-1.0, 0.25, 1.12, 1.0],
    [1.0, 0.25, 1.1, 1.0],
    [1.9, 0.26, 1.0, 0.98],
    [2.5, 0.28, 0.82, 0.92],
    [2.7, 0.32, 0.62, 0.84],
  ], tint, { topK: 0.92 });
  paintVolume(b, body, [
    [-2.62, null, 2.3, 0.96, 0.92],
    [0.5, null, 2.3, 0.96, 0.92],
  ], tint);
  greenhouse(b, body, [
    [2.2, null, 0, 0.92, 0.9],
    [1.3, null, 2.3, 0.92, 0.86],
    [0.5, null, 2.3, 0.92, 0.86],
  ], tint, { roof: [1, 2] });
  wheels(b, body, [{ z: 1.65, name: "F" }, { z: -1.65, name: "R" }], { R: 0.36, W: 0.24, rimNeon: p.rimNeon });
  doorSeams(b, body, [1.75, 1.0, 0.45], { handles: [1.45], y0: 0.34, y1: 1.05 });
  // cargo panel lines: sliding door + rear doors
  for (const side of [-1, 1]) {
    for (const z of [-0.2, -1.6]) {
      blk(b, DARK, [side * 0.975, 1.5, z], [0.012, 1.3, 0.016], { ao: 1 });
    }
    sideQuad(b, "mat_neon_cyan", side, 0.985, 1.12, 1.16, -2.55, 0.4, { ao: 1 });
  }
  blk(b, DARK, [0, 1.5, -2.63], [0.016, 1.3, 0.016], { ao: 1 });
  mirrors(b, tint, 1.05, 1.38, 2.05);
  blk(b, HEAD, [0, 0.62, 2.68], [1.3, 0.04, 0.08]);
  blkSym(b, HEAD, [0.72, 0.7, 2.62], [0.26, 0.14, 0.18]);
  blk(b, DARK, [0, 0.5, 2.67], [1.0, 0.2, 0.07]);
  blk(b, DARK, [0, 0.38, 2.64], [1.7, 0.1, 0.14]);
  blkSym(b, TAIL, [0.88, 0.78, -2.67], [0.14, 0.5, 0.1]);
  blk(b, DARK, [0, 0.4, -2.66], [1.7, 0.14, 0.1]);
  plate(b, 0, 0.65, -2.7, false);
  lightAnchors(b, "head", 0.72, 0.68, 2.7, "#f2f8ff", 1, 22);
  lightAnchors(b, "tail", 0.88, 0.78, -2.7, "#ff1020", 0.6, 8);
  b.anchor("seat_driver", [-0.45, 1.2, 1.5]);
  b.anchor("exhaust", [0.6, 0.3, -2.65]);
  b.collider({ c: [0, 1.31, 0], h: [1.0, 1.3, 2.7] });
}

// ---------------------------------------------------------------------------------------------
// Pickup truck
// ---------------------------------------------------------------------------------------------
function pickup(b, r, p) {
  b.ao = AO;
  const tint = paintTint(p.color ?? "#6b4a2f");
  const body = lowerBody(b, [
    [-2.7, 0.40, 0.84, 0.92],
    [-2.6, 0.34, 0.86, 0.97],
    [-0.5, 0.30, 0.86, 0.98],
    [-0.4, 0.30, 1.04, 0.98],
    [1.5, 0.30, 1.04, 0.98],
    [2.3, 0.34, 0.92, 0.95],
    [2.7, 0.38, 0.74, 0.86],
  ], tint, { topK: 0.9, lip: 0.05 });
  greenhouse(b, body, [
    [1.3, null, 0, 0.84, 0.82],
    [0.7, null, 1.92, 0.84, 0.74],
    [-0.4, null, 1.92, 0.84, 0.74],
    [-0.62, null, 0, 0.84, 0.82],
  ], tint, { b: [0.15] });
  // bed: liner, side walls, tailgate, front wall
  blk(b, DARK, [0, 0.865, -1.6], [1.62, 0.025, 2.0]);
  blkSym(b, PAINT, [0.94, 1.0, -1.6], [0.11, 0.3, 2.05], { tint });
  blk(b, PAINT, [0, 1.0, -2.62], [1.96, 0.3, 0.07], { tint });
  blk(b, PAINT, [0, 1.0, -0.62], [1.8, 0.3, 0.07], { tint });
  blkSym(b, PAINT, [0.74, 0.95, -2.0], [0.18, 0.2, 0.65], { tint }); // wheel housings
  wheels(b, body, [{ z: 1.65, name: "F" }, { z: -1.65, name: "R" }], { R: 0.38, W: 0.27, rimNeon: p.rimNeon });
  doorSeams(b, body, [1.1, 0.2, -0.4], { handles: [0.85, -0.1], y0: 0.4, y1: 0.98 });
  skirts(b, body, -0.4, 1.0, { h: 0.18 });
  mirrors(b, tint, 1.04, 1.25, 1.12);
  blk(b, HEAD, [0, 0.82, 2.68], [1.4, 0.045, 0.08]);
  blkSym(b, HEAD, [0.74, 0.88, 2.62], [0.3, 0.12, 0.16]);
  blk(b, DARK, [0, 0.62, 2.66], [1.1, 0.26, 0.07]);
  blk(b, DARK, [0, 0.46, 2.66], [1.8, 0.14, 0.12]);
  blkSym(b, TAIL, [0.9, 1.0, -2.68], [0.1, 0.22, 0.1]);
  blk(b, DARK, [0, 0.5, -2.69], [1.7, 0.14, 0.1]);
  plate(b, 0, 0.68, -2.74, false);
  const ug = pickUnderglow(r, p, 0.3);
  if (ug) underglow(b, ug, 0.98, 0.2, -0.9, 1.0);
  lightAnchors(b, "head", 0.74, 0.86, 2.7, "#f2f8ff", 1, 24);
  lightAnchors(b, "tail", 0.9, 1.0, -2.7, "#ff1020", 0.6, 8);
  b.anchor("seat_driver", [-0.42, 1.0, 0.45]);
  b.anchor("exhaust", [0.55, 0.3, -2.65]);
  b.collider({ c: [0, 0.97, 0], h: [0.98, 0.97, 2.7] });
}

// ---------------------------------------------------------------------------------------------
// Box truck
// ---------------------------------------------------------------------------------------------
function boxTruck(b, r, p) {
  b.ao = AO;
  const tint = paintTint(p.color ?? "#c9ccd1");
  const cab = lowerBody(b, [
    [1.55, 0.5, 1.15, 1.1],
    [2.95, 0.5, 1.12, 1.1],
    [3.4, 0.52, 0.95, 1.04],
    [3.6, 0.56, 0.78, 0.96],
  ], tint, { topK: 0.92 });
  greenhouse(b, cab, [
    [3.3, null, 0, 1.0, 0.98],
    [2.55, null, 2.3, 1.0, 0.94],
    [1.7, null, 2.3, 1.0, 0.94],
  ], tint, { roof: [1, 2] });
  // cargo box
  paintVolume(b, cab, [
    [-3.6, 0.95, 3.3, 1.2, 1.2],
    [1.45, 0.95, 3.3, 1.2, 1.2],
  ], tint);
  // chassis rails and bumper
  blk(b, DARK, [0, 0.72, -0.3], [1.5, 0.3, 7.2]);
  blk(b, DARK, [0, 0.62, -3.6], [2.2, 0.2, 0.15]);
  blk(b, DARK, [0, 0.4, 3.58], [2.1, 0.14, 0.14]);
  const body = { hw: (z) => (z > 1.5 ? 1.1 : 1.2), yb: (z) => (z > 1.5 ? 0.5 : 0.95) };
  wheels(b, body, [
    { z: 2.15, name: "F", R: 0.45, W: 0.3 },
    { z: -2.1, name: "R", R: 0.45, W: 0.3, dual: true },
  ], { rimNeon: p.rimNeon });
  doorSeams(b, cab, [2.75, 1.95], { handles: [2.4], y0: 0.6, y1: 1.1 });
  // box details: rear doors, ribs, side logo band
  blk(b, DARK, [0, 2.1, -3.62], [0.02, 2.2, 0.02], { ao: 1 });
  for (const z of [-2.7, -1.5, -0.3, 0.9]) blkSym(b, DARK, [1.205, 2.1, z], [0.012, 2.2, 0.03], { ao: 1 });
  for (const side of [-1, 1]) sideQuad(b, "mat_neon_magenta", side, 1.21, 1.2, 1.26, -3.5, 1.35);
  mirrors(b, tint, 1.2, 1.55, 3.2);
  blk(b, HEAD, [0, 0.78, 3.58], [1.5, 0.05, 0.08]);
  blkSym(b, HEAD, [0.8, 0.88, 3.52], [0.3, 0.14, 0.18]);
  blk(b, DARK, [0, 0.62, 3.58], [1.2, 0.28, 0.06]);
  blkSym(b, TAIL, [1.05, 1.15, -3.62], [0.1, 0.34, 0.1]);
  plate(b, 0, 0.72, -3.74, false);
  lightAnchors(b, "head", 0.8, 0.84, 3.6, "#f2f8ff", 1, 24);
  lightAnchors(b, "tail", 1.05, 1.15, -3.65, "#ff1020", 0.6, 8);
  b.anchor("seat_driver", [-0.5, 1.5, 2.6]);
  b.anchor("exhaust", [1.0, 0.5, -3.5]);
  b.collider({ c: [0, 1.9, 0], h: [1.2, 1.65, 3.6] });
}

// ---------------------------------------------------------------------------------------------
// City bus
// ---------------------------------------------------------------------------------------------
function bus(b, r, p) {
  b.ao = AO;
  const tint = paintTint(p.color ?? "#2a6f8c");
  const body = lowerBody(b, [
    [-4.5, 0.42, 1.0, 1.16],
    [-4.38, 0.34, 1.1, 1.24],
    [-3.0, 0.32, 1.1, 1.26],
    [3.0, 0.32, 1.1, 1.26],
    [4.38, 0.34, 1.12, 1.24],
    [4.5, 0.4, 1.0, 1.18],
  ], tint, { topK: 0.94, lip: 0.05 });
  const gh = greenhouse(b, body, [
    [4.42, null, 0, 1.19, 1.17],
    [4.3, null, 3.05, 1.19, 1.14],
    [-4.3, null, 3.05, 1.19, 1.14],
    [-4.42, null, 0, 1.19, 1.17],
  ], tint, { b: [3.0, 2.0, 1.0, 0.0, -1.0, -2.0, -3.0], pillarW: 0.11 });
  void gh;
  // paint bands above and below the windows, so the glass reads as a window strip
  for (const side of [-1, 1]) {
    sideQuad(b, PAINT, side, 1.205, 2.62, 3.0, -4.3, 4.3, { tint });
    sideQuad(b, PAINT, side, 1.205, 1.08, 1.42, -4.3, 4.3, { tint });
  }
  // doors (right side): front and middle
  for (const z of [3.5, -0.5]) {
    blk(b, DARK, [1.21, 1.55, z], [0.03, 2.15, 1.05], { ao: 1 });
    blk(b, "mat_neon_cyan", [1.225, 1.55, z + 0.52], [0.02, 2.0, 0.03], { ao: 1 });
    blk(b, "mat_neon_cyan", [1.225, 1.55, z - 0.52], [0.02, 2.0, 0.03], { ao: 1 });
  }
  wheels(b, body, [
    { z: 3.1, name: "F", R: 0.5, W: 0.3 },
    { z: -2.5, name: "R", R: 0.5, W: 0.3, dual: true },
  ], { rimNeon: p.rimNeon });
  // destination display (front, above the windshield) and rear
  blk(b, DARK, [0, 2.88, 4.43], [1.5, 0.22, 0.08], { ao: 1 });
  blk(b, "mat_neon_amber", [0, 2.88, 4.47], [1.35, 0.12, 0.03], { ao: 1 });
  blk(b, DARK, [0, 2.7, -4.43], [0.9, 0.2, 0.06], { ao: 1 });
  blk(b, "mat_neon_amber", [0, 2.7, -4.46], [0.8, 0.1, 0.03], { ao: 1 });
  // roof AC pods
  blk(b, PAINT, [0, 3.2, -1.9], [1.5, 0.22, 2.2], { tint });
  blk(b, DARK, [0, 3.33, -1.9], [1.2, 0.05, 1.8]);
  blk(b, PAINT, [0, 3.18, 1.4], [1.0, 0.15, 1.4], { tint });
  // front/rear
  blk(b, HEAD, [0, 0.62, 4.48], [1.9, 0.05, 0.06]);
  blkSym(b, HEAD, [0.95, 0.74, 4.44], [0.28, 0.14, 0.12]);
  blk(b, DARK, [0, 0.45, 4.5], [1.6, 0.2, 0.05]);
  blkSym(b, TAIL, [1.0, 1.1, -4.46], [0.14, 0.7, 0.08]);
  blk(b, DARK, [0, 0.5, -4.47], [1.8, 0.2, 0.08]);
  blk(b, DARK, [0, 1.55, -4.46], [1.0, 0.8, 0.06], { ao: 1 }); // engine hatch
  plate(b, 0, 0.78, -4.52, false);
  mirrors(b, tint, 1.38, 2.1, 4.1);
  const ug = pickUnderglow(r, p, 0.5);
  if (ug) underglow(b, ug, 1.26, 0.28, -2.0, 2.4);
  lightAnchors(b, "head", 0.95, 0.7, 4.5, "#f2f8ff", 1, 24);
  lightAnchors(b, "tail", 1.0, 1.1, -4.5, "#ff1020", 0.6, 8);
  b.anchor("seat_driver", [-0.55, 1.55, 3.7]);
  b.anchor("exhaust", [1.0, 0.4, -4.4]);
  b.collider({ c: [0, 1.7, 0], h: [1.26, 1.7, 4.5] });
}

// ---------------------------------------------------------------------------------------------
// Motorcycle (rider-less)
// ---------------------------------------------------------------------------------------------
function motorcycle(b, r, p) {
  b.ao = { y0: 0.05, y1: 0.5, lo: 0.6, hi: 1 };
  const tint = paintTint(p.color ?? "#a3202b");
  const R = 0.31;
  // steering assembly: origin at the front axle so the game can rotate this node about Y
  b.node("steer", { pos: [0, R, 0.75] }, () => {
    b.node("wheel_F", { pos: [0, 0, 0] }, () => wheelGeo(b, 1, { R, W: 0.13, both: true, rimNeon: p.rimNeon, seg: 14 }));
    for (const s of [-1, 1]) {
      // fork legs: chrome lower slider, dark upper tube, up to the handlebar clamp
      b.tube(CHROME, { pts: [[s * 0.1, 0.02, 0], [s * 0.1, 0.3, -0.07]], r: 0.034, seg: 6 });
      b.tube(DARK, { pts: [[s * 0.1, 0.3, -0.07], [s * 0.1, 0.62, -0.15], [s * 0.1, 0.76, -0.19]], r: 0.03, seg: 6 });
    }
    // triple clamp, handlebar, grips, mirrors
    blk(b, DARK, [0, 0.7, -0.17], [0.24, 0.05, 0.08]);
    b.tube(DARK, { pts: [[-0.36, 0.8, -0.1], [-0.2, 0.79, -0.17], [0.2, 0.79, -0.17], [0.36, 0.8, -0.1]], r: 0.017, seg: 5 });
    blkSym(b, DARK, [0.35, 0.8, -0.1], [0.1, 0.04, 0.04]);
    for (const s of [-1, 1]) b.tube(DARK, { pts: [[s * 0.32, 0.82, -0.12], [s * 0.36, 0.98, -0.1]], r: 0.01, seg: 4 });
    // headlight fairing, light, small screen
    b.sphere(PAINT, { c: [0, 0.74, 0.04], r: [0.17, 0.15, 0.19], seg: 8, rings: 5 }, { tint });
    blk(b, HEAD, [0, 0.74, 0.2], [0.2, 0.09, 0.04]);
    blk(b, GLASS, [0, 0.93, 0.0], [0.2, 0.012, 0.14], { ao: 1 });
    // front mudguard
    blk(b, PAINT, [0, 0.4, -0.02], [0.15, 0.03, 0.46], { tint });
  });
  b.node("wheel_R", { pos: [0, R, -0.75] }, () => wheelGeo(b, 1, { R, W: 0.18, both: true, rimNeon: p.rimNeon, seg: 14 }));
  // frame: headstock -> spine -> seat rail, and a cradle under the engine
  b.tube(DARK, { pts: [[0, 0.98, 0.54], [0, 0.9, 0.1], [0, 0.84, -0.3], [0, 0.88, -0.78]], r: 0.026, seg: 6 });
  b.tube(DARK, { pts: [[0, 0.95, 0.52], [0, 0.55, 0.32], [0, 0.34, 0.1], [0, 0.34, -0.22], [0, 0.46, -0.3]], r: 0.026, seg: 6 });
  b.tube(DARK, { pts: [[0, 0.84, -0.3], [0, 0.46, -0.3]], r: 0.024, seg: 6 });
  // engine
  blk(b, "mat_metal_plate_worn", [0, 0.44, 0.04], [0.3, 0.3, 0.42]);
  b.with({ pos: [0, 0.64, 0.14], rot: [-0.35, 0, 0] }, () => blk(b, "mat_metal_plate_worn", [0, 0, 0], [0.26, 0.2, 0.24]));
  blk(b, DARK, [0, 0.3, -0.05], [0.2, 0.06, 0.3]); // sump
  // tank, seat, tail
  b.sphere(PAINT, { c: [0, 0.97, 0.22], r: [0.17, 0.12, 0.32], seg: 8, rings: 5 }, { tint });
  b.with({ pos: [0, 0.91, -0.38], rot: [0.06, 0, 0] }, () => blk(b, DARK, [0, 0, 0], [0.24, 0.07, 0.62]));
  b.with({ pos: [0, 0.97, -0.84], rot: [-0.15, 0, 0] }, () => blk(b, PAINT, [0, 0, 0], [0.2, 0.1, 0.42], { tint }));
  blk(b, TAIL, [0, 0.99, -1.05], [0.17, 0.045, 0.04]);
  b.with({ pos: [0, 0.69, -0.9], rot: [0.12, 0, 0] }, () => blk(b, PAINT, [0, 0, 0], [0.17, 0.025, 0.5], { tint })); // rear fender
  // swingarm + shocks
  for (const s of [-1, 1]) {
    b.tube(DARK, { pts: [[s * 0.11, 0.45, -0.3], [s * 0.11, R + 0.02, -0.75]], r: 0.028, seg: 5 });
    b.tube(CHROME, { pts: [[s * 0.1, 0.8, -0.55], [s * 0.11, 0.42, -0.7]], r: 0.022, seg: 5 });
  }
  // exhaust, footpegs, chain guard
  b.tube(CHROME, { pts: [[0.17, 0.3, 0.2], [0.18, 0.28, -0.4], [0.2, 0.4, -1.0]], r: 0.045, seg: 6 });
  blk(b, DARK, [0.2, 0.4, -1.04], [0.07, 0.07, 0.04]);
  blkSym(b, DARK, [0.2, 0.32, -0.12], [0.1, 0.03, 0.06]);
  const ug = pickUnderglow(r, p, 0.7);
  if (ug) blk(b, ug, [0, 0.22, -0.05], [0.04, 0.025, 0.8], { ao: 1 });
  b.anchor("light.head", [0, 0.74, 0.96], { color: "#f2f8ff", intensity: 1, range: 20 });
  b.anchor("light.tail", [0, 0.99, -1.07], { color: "#ff1020", intensity: 0.5, range: 6 });
  b.anchor("seat_driver", [0, 1.0, -0.38]);
  b.anchor("exhaust", [0.2, 0.4, -1.05]);
  b.collider({ c: [0, 0.55, 0], h: [0.4, 0.55, 1.1] });
}

// ---------------------------------------------------------------------------------------------
// Armoured corp sedan: heavy plates, narrow greenhouse, run-flat wheels
// ---------------------------------------------------------------------------------------------
function armored(b, r, p) {
  b.ao = AO;
  const tint = paintTint(p.color ?? "#15171c");
  const body = lowerBody(b, [
    [-2.5, 0.36, 1.0, 0.86],
    [-2.38, 0.26, 1.1, 0.96],
    [-1.9, 0.22, 1.15, 1.0],
    [0.9, 0.22, 1.16, 1.0],
    [1.6, 0.22, 1.1, 1.0],
    [2.1, 0.25, 0.98, 0.96],
    [2.5, 0.32, 0.78, 0.86],
  ], tint, { topK: 0.88, lip: 0.08 });
  greenhouse(b, body, [
    [1.0, null, 0, 0.74, 0.7],
    [0.3, null, 1.5, 0.76, 0.56],
    [-1.2, null, 1.5, 0.76, 0.56],
    [-1.75, null, 0, 0.76, 0.7],
  ], tint, { b: [-0.45], pillarW: 0.12 });
  wheels(b, body, [{ z: 1.5, name: "F", R: 0.37, W: 0.28 }, { z: -1.5, name: "R", R: 0.37, W: 0.28 }], { rimNeon: p.rimNeon ?? "mat_neon_cyan" });
  // fender flares and armour plates
  for (const z of [1.5, -1.5]) blkSym(b, PAINT, [1.0, 0.72, z], [0.07, 0.07, 1.05], { tint });
  for (const side of [-1, 1]) {
    for (const z of [0.85, -0.5]) blk(b, "mat_metal_plate_worn", [side * 1.015, 0.7, z], [0.03, 0.5, 0.95], { ao: 1 });
    sideQuad(b, "mat_neon_cyan", side, 1.032, 0.46, 0.49, -2.0, 2.0);
  }
  doorSeams(b, body, [1.25, 0.35, -1.35], { y0: 0.34, y1: 1.08 });
  skirts(b, body, -1.05, 1.05, { h: 0.2 });
  mirrors(b, tint, 1.04, 1.12, 0.95);
  // roof sensor dome and light blade
  b.sphere(DARK, { c: [0, 1.55, -0.4], r: [0.2, 0.1, 0.2], seg: 8, rings: 4 });
  blk(b, "mat_neon_cyan", [0, 1.56, -0.2], [0.28, 0.02, 0.02]);
  blk(b, HEAD, [0, 0.56, 2.48], [1.25, 0.04, 0.08]);
  blkSym(b, HEAD, [0.62, 0.62, 2.43], [0.3, 0.06, 0.14]);
  blk(b, DARK, [0, 0.42, 2.48], [1.1, 0.26, 0.07]);
  blk(b, "mat_metal_plate_worn", [0, 0.3, 2.5], [1.5, 0.12, 0.12]); // ram bumper
  blk(b, TAIL, [0, 0.9, -2.47], [1.5, 0.045, 0.06]);
  blk(b, DARK, [0, 0.42, -2.46], [1.5, 0.22, 0.1]);
  plate(b, 0, 0.68, -2.52, false);
  lightAnchors(b, "head", 0.62, 0.6, 2.5, "#f2f8ff", 1, 24);
  lightAnchors(b, "tail", 0.66, 0.9, -2.5, "#ff1020", 0.6, 8);
  b.anchor("seat_driver", [-0.38, 0.8, 0.3]);
  b.anchor("exhaust", [0.5, 0.3, -2.45]);
  b.collider({ c: [0, 0.78, 0], h: [1.03, 0.78, 2.5] });
}

// ---------------------------------------------------------------------------------------------
// Hover coupe (no wheels: four thruster nodes)
// ---------------------------------------------------------------------------------------------
function hover(b, r, p) {
  b.ao = { y0: 0.2, y1: 0.7, lo: 0.6, hi: 1 };
  const tint = paintTint(p.color ?? "#e9ecf2");
  // smooth body: superellipse rings through control rows [z, yBottom, yTop, halfWidth],
  // resampled with a Catmull-Rom spline so the silhouette is smooth
  const ctl = [
    [-2.2, 0.56, 0.76, 0.34],
    [-2.0, 0.44, 0.88, 0.62],
    [-1.4, 0.38, 0.98, 0.8],
    [-0.4, 0.36, 0.98, 0.84],
    [0.7, 0.36, 0.88, 0.82],
    [1.5, 0.38, 0.76, 0.7],
    [2.0, 0.44, 0.64, 0.5],
    [2.25, 0.52, 0.58, 0.26],
  ];
  const rows = [];
  const cr = (p0, p1, p2, p3, t) =>
    0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
  for (let i = 0; i < ctl.length - 1; i++) {
    const c0 = ctl[Math.max(0, i - 1)], c1 = ctl[i], c2 = ctl[i + 1], c3 = ctl[Math.min(ctl.length - 1, i + 2)];
    for (const t of [0, 1 / 3, 2 / 3]) rows.push([0, 1, 2, 3].map((k) => cr(c0[k], c1[k], c2[k], c3[k], t)));
  }
  rows.push(ctl[ctl.length - 1]);
  const N = 16;
  const rings = rows.map(([z, yb, yt, hw]) => {
    const pts = [];
    const cy = (yb + yt) / 2, hh = (yt - yb) / 2;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TAU;
      const c = Math.cos(a), s = Math.sin(a);
      const e = 0.6; // superellipse exponent: boxier than an ellipse
      pts.push([Math.sign(c) * Math.pow(Math.abs(c), e) * hw, cy + Math.sign(s) * Math.pow(Math.abs(s), e) * hh, z]);
    }
    return pts;
  });
  b.loft(PAINT, rings, { smooth: true, capStart: true, capEnd: true, tint });
  // canopy bubble: smooth glass loft with a dark shell inside
  const canopy = [
    [0.95, 0.9, 0.05, 0.4],
    [0.5, 1.2, 0.18, 0.64],
    [-0.3, 1.34, 0.2, 0.7],
    [-1.0, 1.1, 0.14, 0.6],
    [-1.35, 0.98, 0.06, 0.4],
  ].map(([z, yt, hh, hw]) => {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      pts.push([Math.cos(a) * hw, yt - hh + Math.max(0, Math.sin(a)) * hh * 0.8 + Math.min(0, Math.sin(a)) * 0.1, z]);
    }
    return pts;
  });
  b.loft(GLASS, canopy, { smooth: true, capStart: true, capEnd: true });
  // side nacelles on struts, small winglets and a rear blade
  const ug = p.underglow === null ? null : (p.underglow ?? "mat_neon_cyan");
  for (const [n, x, z] of [["FL", -1.0, 1.15], ["FR", 1.0, 1.15], ["RL", -1.04, -1.05], ["RR", 1.04, -1.05]]) {
    const sx = Math.sign(x);
    b.sphere(PAINT, { c: [x, 0.5, z], r: [0.2, 0.15, 0.62], seg: 10, rings: 5 }, { tint });
    blk(b, DARK, [x * 0.82, 0.52, z], [0.24, 0.07, 0.3]);
    b.node(`thruster_${n}`, { pos: [x, 0.3, z] }, () => {
      b.cylinder(DARK, { x: 0, z: 0, y0: -0.05, y1: 0.12, r: 0.2, r1: 0.15, seg: 12, cap: "top" }, { ao: 1 });
      if (ug) b.lathe(ug, [[0.185, -0.055], [0.0, -0.055]], { seg: 12 }, { ao: 1 });
    });
    void sx;
  }
  b.with({ pos: [0, 0.98, -1.9], rot: [-0.1, 0, 0] }, () => blk(b, PAINT, [0, 0, 0], [1.5, 0.035, 0.34], { tint }));
  blkSym(b, PAINT, [0.74, 1.05, -1.9], [0.035, 0.14, 0.34], { tint });
  blkSym(b, DARK, [0.62, 0.66, 1.2], [0.14, 0.1, 0.5]);
  // light blades
  blk(b, HEAD, [0, 0.56, 2.23], [0.5, 0.04, 0.05]);
  blkSym(b, HEAD, [0.42, 0.62, 1.98], [0.3, 0.035, 0.1]);
  blk(b, TAIL, [0, 0.8, -2.18], [0.5, 0.06, 0.05]);
  blkSym(b, TAIL, [0.5, 0.86, -1.98], [0.5, 0.05, 0.08]);
  if (ug) blk(b, ug, [0, 0.35, 0], [1.0, 0.02, 3.4], { ao: 1 });
  lightAnchors(b, "head", 0.42, 0.6, 2.2, "#f2f8ff", 1, 22);
  lightAnchors(b, "tail", 0.5, 0.86, -2.0, "#ff1020", 0.6, 8);
  b.anchor("light.underglow", [0, 0.25, 0], { color: "#00f0ff", intensity: 1, range: 6 });
  b.anchor("seat_driver", [-0.32, 0.9, 0.25]);
  b.anchor("exhaust", [0, 0.8, -2.2]);
  b.collider({ c: [0, 0.8, 0], h: [1.25, 0.6, 2.25] });
}

export const assets = [
  {
    id: "veh_sedan_a", category: "vehicle", tags: ["vehicle", "vehicle_parkable"], budget: 3000,
    variants: [
      { suffix: "", params: { color: "#b8bcc4" } },
      { suffix: "_red", seed: 11, params: { color: "#b3202a" } },
      { suffix: "_blue", seed: 12, params: { color: "#23446e", underglow: "mat_neon_cyan" } },
    ],
    build: sedan,
  },
  {
    id: "veh_taxi_a", category: "vehicle", tags: ["vehicle", "vehicle_parkable", "vehicle_taxi"], budget: 3000,
    params: {},
    build: taxi,
  },
  {
    id: "veh_police_a", category: "vehicle", tags: ["vehicle", "vehicle_parkable", "vehicle_police"], budget: 3000,
    params: {},
    build: police,
  },
  {
    id: "veh_hatch_a", category: "vehicle", tags: ["vehicle", "vehicle_parkable"], budget: 3000,
    variants: [
      { suffix: "", params: { color: "#d8d2c4" } },
      { suffix: "_teal", seed: 21, params: { color: "#1f7a78", underglow: "mat_neon_magenta" } },
      { suffix: "_orange", seed: 22, params: { color: "#d2641c" } },
    ],
    build: hatch,
  },
  {
    id: "veh_coupe_sport", category: "vehicle", tags: ["vehicle", "vehicle_parkable"], budget: 3000,
    variants: [
      { suffix: "", params: { color: "#1d1f26", underglow: "mat_neon_magenta" } },
      { suffix: "_yellow", seed: 31, params: { color: "#e0b81a", underglow: "mat_neon_cyan" } },
      { suffix: "_white", seed: 32, params: { color: "#e6e8ee", underglow: null } },
    ],
    build: coupe,
  },
  {
    id: "veh_suv_a", category: "vehicle", tags: ["vehicle", "vehicle_parkable"], budget: 3000,
    variants: [
      { suffix: "", params: { color: "#3a4150" } },
      { suffix: "_green", seed: 41, params: { color: "#2b5a3c" } },
    ],
    build: suv,
  },
  {
    id: "veh_van_delivery", category: "vehicle", tags: ["vehicle", "vehicle_parkable"], budget: 3000,
    variants: [
      { suffix: "", params: { color: "#d5d9de" } },
      { suffix: "_orange", seed: 51, params: { color: "#d9731f" } },
    ],
    build: van,
  },
  {
    id: "veh_pickup_a", category: "vehicle", tags: ["vehicle", "vehicle_parkable"], budget: 3000,
    variants: [
      { suffix: "", params: { color: "#6b4a2f" } },
      { suffix: "_grey", seed: 61, params: { color: "#5c626b" } },
    ],
    build: pickup,
  },
  {
    id: "veh_truck_box", category: "vehicle", tags: ["vehicle", "vehicle_parkable", "vehicle_large"], budget: 3000,
    params: {},
    build: boxTruck,
  },
  {
    id: "veh_bus_city", category: "vehicle", tags: ["vehicle", "vehicle_large"], budget: 3000,
    params: {},
    build: bus,
  },
  {
    id: "veh_motorcycle_a", category: "vehicle", tags: ["vehicle", "vehicle_parkable", "vehicle_bike"], budget: 3000,
    variants: [
      { suffix: "", params: { color: "#a3202b" } },
      { suffix: "_cyan", seed: 71, params: { color: "#17718a", underglow: "mat_neon_cyan" } },
    ],
    build: motorcycle,
  },
  {
    id: "veh_corp_armored", category: "vehicle", tags: ["vehicle", "vehicle_corp"], budget: 3000,
    params: {},
    build: armored,
  },
  {
    id: "veh_hover_coupe", category: "vehicle", tags: ["vehicle", "vehicle_hover"], budget: 3000,
    variants: [
      { suffix: "", params: { color: "#e9ecf2", underglow: "mat_neon_cyan" } },
      { suffix: "_pink", seed: 81, params: { color: "#2a1a38", underglow: "mat_neon_magenta" } },
    ],
    build: hover,
  },
];
