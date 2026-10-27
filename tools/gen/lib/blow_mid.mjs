// Mid-rise recipes: glass office with podium, concrete office on pilotis, open-deck parking garage.
import { FLOOR_H, SHOP_H, BAY_W } from "./modules.mjs";
import { TAU } from "./math.mjs";
import * as signs from "./signs.mjs";
import {
  FACADES, FABRIC, BUILDING_AO, blade, boxF, tris, frame, shell, ac, awning, pipe, cable, door, ledge, hvac, dish,
  antenna, bulkhead, collide, light, shuffle, bayXs, at, paint, heightOf, bays,
} from "./blow_kit.mjs";

const base = { category: "building", budget: 1500 };

export const mid = [
  // ------------------------------------------------------------------------------------------
  {
    ...base,
    id: "bld_mid_glass_office",
    tags: ["building", "zone:mid"],
    lot: { w: [21, 42], d: [21, 42], floors: [8, 14] },
    params: { w: 27, d: 24, floors: 11 },
    variants: [
      { suffix: "_wide", seed: 4, params: { w: 42, d: 27, floors: 14 } },
      { suffix: "_b", seed: 17, params: { w: 21, d: 21, floors: 9 } },
    ],
    build(b, r, { w, d, floors }) {
      b.ao = BUILDING_AO;
      const podF = 2;
      const colDepth = 3;
      const pod = { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 - colDepth };
      const { H: podH } = shell(b, r, pod, { floors: podF, shop: true, upper: "mat_facade_windows_dark", parapet: 0.6, sides: { s: "mat_wall_concrete_panel" } });
      // colonnade + canopy over the lobby
      const cy = 4.2;
      boxF(b, "mat_metal_painted_dark", [-w / 2, cy, pod.z1], [w / 2, cy + 0.3, d / 2], "newtb");
      b.quad("mat_light_warm", [w / 2 - 0.5, cy - 0.01, pod.z1 + 0.2], [-w / 2 + 0.5, cy - 0.01, pod.z1 + 0.2], [-w / 2 + 0.5, cy - 0.01, pod.z1 + 0.5], [w / 2 - 0.5, cy - 0.01, pod.z1 + 0.5], { uv: "unit" });
      for (let x = -w / 2 + 1.5; x < w / 2; x += 6) boxF(b, "mat_wall_concrete_panel", [x - 0.25, 0, d / 2 - 0.7], [x + 0.25, cy, d / 2 - 0.2], "sentw");
      // glass tower
      const tow = { x0: -w / 2 + 3, x1: w / 2 - 3, z0: -d / 2 + 3, z1: d / 2 - 6 };
      const tf = floors - podF;
      const { H } = shell(b, r, tow, { floors: tf, shop: false, y0: podH, upper: "mat_facade_curtainwall", parapet: 0.5, tint: [0.85, 0.95, 1.05] });
      // crown: one smaller glass level + rooftop plant
      const crown = { x0: tow.x0 + 3, x1: tow.x1 - 3, z0: tow.z0 + 3, z1: tow.z1 - 3 };
      const c = shell(b, r, crown, { floors: 1, shop: false, y0: H, upper: "mat_facade_curtainwall", parapet: 0.3, tint: [0.85, 0.95, 1.05] });
      collide(b, { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 - colDepth }, podH);
      collide(b, tow, H);
      // neon edge lines on the tower front corners and top
      frame(b, tow, "n", (len) => {
        for (const x of [-len / 2, len / 2]) at(b, x - 0.03, podH, 0.03, () => signs.neonStrip(b, r, { len: H - podH, axis: "y", color: "mat_neon_cyan" }));
        at(b, -len / 2, H + 0.5, 0.03, () => signs.neonStrip(b, r, { len, axis: "x", color: "mat_neon_cyan" }));
        // slim vertical fins on the glass front
        for (let i = 1; i < bays(len) / 2; i++) boxF(b, "mat_metal_painted_dark", [-len / 2 + i * 6 - 0.1, podH, 0], [-len / 2 + i * 6 + 0.1, H, 0.18], "newt");
      });
      frame(b, pod, "n", (len) => {
        door(b, 0, 3.2, 3.0, "mat_neon_cyan");
        for (const x of [-len / 2 + 4, len / 2 - 4]) at(b, x, 0, 0, () => door(b, 0, 1.8, 2.6, "mat_light_warm"));
        at(b, 0, 5.1, 0.05, () => signs.wallSign(b, r, { w: Math.min(12, len * 0.5), h: 1.6 }));
        at(b, len / 2 - 0.3, SHOP_H + 3.2, 0.05, () => signs.bladeSign(b, r, { w: 0.7, h: 3.0, proj: 0.28 }));
      });
      frame(b, { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 }, "e", (len) => {
        for (let i = 0; i < 3; i++) ac(b, r.range(-len / 2 + 2, len / 2 - 2), SHOP_H + 1.4 + i * 0.1, 0.8);
        pipe(b, r.range(-len / 3, len / 3), 0, podH);
      });
      // roof plant
      const ry = c.H;
      hvac(b, crown.x0 + 2.5, ry, crown.z0 + 2.2, 3, 1.4, 2.2);
      hvac(b, crown.x1 - 2.5, ry, crown.z0 + 2.2, 2.6, 1.2, 2);
      bulkhead(b, 0, ry, (crown.z0 + crown.z1) / 2, 3.4, 2.4, 3);
      antenna(b, crown.x0 + 1, ry, crown.z1 - 1, 8);
      antenna(b, crown.x1 - 1, ry, crown.z1 - 1, 6);
      // window-washing gantry on the main tower roof
      const gz = (tow.z0 + tow.z1) / 2;
      boxF(b, "mat_metal_painted_dark", [tow.x0 + 0.4, H, tow.z1 - 0.9], [tow.x1 - 0.4, H + 0.15, tow.z1 - 0.7], "newt");
      boxF(b, "mat_metal_plate_worn", [tow.x0 + 1.5, H + 0.15, tow.z1 - 1.3], [tow.x0 + 4, H + 1.4, tow.z1 - 0.3], "sentw");
      light(b, "lobby", [0, 4, d / 2 - 1], "#00f0ff", 1, 16);
      light(b, "crown", [0, c.H + 2, 0], "#00f0ff", 0.6, 22);
    },
  },
  // ------------------------------------------------------------------------------------------
  {
    ...base,
    id: "bld_mid_concrete_office",
    tags: ["building", "zone:mid"],
    lot: { w: [21, 42], d: [21, 42], floors: [6, 12] },
    params: { w: 30, d: 21, floors: 9 },
    variants: [
      { suffix: "_wide", seed: 8, params: { w: 42, d: 24, floors: 12 } },
      { suffix: "_b", seed: 31, params: { w: 21, d: 27, floors: 7 } },
    ],
    build(b, r, { w, d, floors }) {
      b.ao = BUILDING_AO;
      const plaza = 5; // covered plaza under the cantilevered upper floors
      const y0 = SHOP_H;
      const lower = { x0: -w / 2 + 3, x1: w / 2 - 3, z0: -d / 2, z1: d / 2 - plaza - 1 };
      shell(b, r, lower, { floors: 1, shop: true, roof: false, parapet: 0 });
      // upper volume overhangs the plaza
      const up = { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 - 0.3 };
      const { H } = shell(b, r, up, { floors: floors - 1, shop: false, y0, upper: "mat_facade_windows_dark", parapet: 0.8, tint: paint(r) });
      boxF(b, "mat_wall_concrete_dark", [up.x0, y0 - 0.35, up.z0], [up.x1, y0, up.z1], "b");
      for (const x of [-w / 2 + 1.5, -w / 6, w / 6, w / 2 - 1.5]) boxF(b, "mat_wall_concrete_panel", [x - 0.4, 0, d / 2 - 1.2], [x + 0.4, y0, d / 2 - 0.4], "sentw");
      b.quad("mat_light_warm", [w / 2 - 3, y0 - 0.36, d / 2 - 2], [-w / 2 + 3, y0 - 0.36, d / 2 - 2], [-w / 2 + 3, y0 - 0.36, d / 2 - 2.4], [w / 2 - 3, y0 - 0.36, d / 2 - 2.4], { uv: "unit" });
      collide(b, lower, y0);
      collide(b, up, H, y0);
      frame(b, up, "n", (len) => {
        // floor ribs
        for (let f = 1; f < floors - 1; f++) ledge(b, -len / 2, len / 2, y0 + f * FLOOR_H - 0.3, 0.3, 0.28, "mat_wall_concrete_panel");
        for (let i = 0; i < 5; i++) ac(b, r.range(-len / 2 + 1.5, len / 2 - 1.5), y0 + 0.4 + r.int(0, floors - 3) * FLOOR_H + 2.3, 0.7);
        at(b, len / 2 - 5, y0 + 0.4, 0, () => signs.wallSign(b, r, { w: 6, h: 1.4 }));
        at(b, -len / 2 + 0.05, y0, 0, () => signs.neonStrip(b, r, { len: H - y0, axis: "y" }));
      });
      frame(b, lower, "n", (len) => {
        door(b, 0, 3, 2.8, "mat_neon_amber");
        awning(b, len / 2 - 4, 3.4, 4, 0.25, r.pick(FABRIC));
      });
      for (const side of ["e", "w", "s"]) {
        frame(b, up, side, (len) => {
          pipe(b, r.range(-len / 3, len / 3), y0, H, 0.1);
          for (let i = 0; i < 2; i++) ac(b, r.range(-len / 2 + 2, len / 2 - 2), y0 + 1.5 + r.int(0, floors - 3) * FLOOR_H, 0.8);
        });
      }
      // roof: AC array, a stair core, antennas
      for (let i = 0; i < 4; i++) hvac(b, -w / 2 + 3 + i * Math.min(5.5, (w - 6) / 3), H, -d / 4, 3, 1.3, 2);
      bulkhead(b, w / 4, H, d / 6, 4, 3, 3.4);
      dish(b, -w / 4, H, d / 5, r.range(0, TAU), 1.2);
      antenna(b, -w / 3, H, d / 3, 6);
      light(b, "plaza", [0, 3.4, d / 2 - 3], "#ffb000", 1, 16);
    },
  },
  // ------------------------------------------------------------------------------------------
  {
    ...base,
    id: "bld_mid_parking_garage",
    tags: ["building", "zone:mid"],
    lot: { w: [21, 42], d: [21, 42], floors: [5, 9] },
    params: { w: 30, d: 24, floors: 7 },
    variants: [
      { suffix: "_wide", seed: 2, params: { w: 42, d: 21, floors: 9 } },
      { suffix: "_b", seed: 13, params: { w: 21, d: 21, floors: 5 } },
    ],
    build(b, r, { w, d, floors }) {
      b.ao = BUILDING_AO;
      const dh = 3.3, H = floors * dh;
      const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
      const band = "mat_wall_concrete_panel", dark = "mat_wall_concrete_dark";
      const t = paint(r);
      // ground slab, inner walls (dark) so the open decks read as deep
      b.quad(dark, [x0, 0.02, z0], [x1, 0.02, z0], [x1, 0.02, z1], [x0, 0.02, z1], { tint: [0.6, 0.6, 0.6] });
      b.wall(dark, [x1, z0], [x0, z0], 0, H, { tint: [0.45, 0.45, 0.5] });
      b.wall(dark, [x1, z1], [x1, z0], 0, H, { tint: [0.45, 0.45, 0.5] });
      b.wall(dark, [x0, z0], [x0, z1], 0, H, { tint: [0.45, 0.45, 0.5] });
      // decks: slab + 1.2 m edge band on the outer faces
      for (let f = 1; f <= floors; f++) {
        const y = f * dh - 0.3;
        b.quad(dark, [x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], { tint: [0.7, 0.7, 0.7] });
        b.quad(dark, [x1, y, z0], [x0, y, z0], [x0, y, z1], [x1, y, z1], { tint: [0.5, 0.5, 0.5] });
        const top = f === floors ? y + 0.3 + 0.2 : y + 1.4;
        const yb = f === 1 ? 0 : y;
        // outer band (front, east, west, back)
        const o = (u) => ({ uOff: u, tint: t });
        b.wall(band, [x1, z1], [x0, z1], y, top, o(0));
        b.wall(band, [x1, z0], [x1, z1], y, top, o(BAY_W));
        b.wall(band, [x0, z1], [x0, z0], y, top, o(0));
        b.wall(band, [x0, z0], [x1, z0], y, top, o(BAY_W));
        if (f % 2 === 1 && f < floors) {
          frame(b, { x0, x1, z0, z1 }, "n", (len) => at(b, -len / 2 + 0.05, y + 1.0, 0.03, () => signs.neonStrip(b, r, { len: len - 0.1, axis: "x", color: f % 4 === 1 ? "mat_neon_cyan" : "mat_neon_magenta" })));
        }
      }
      // columns on front and back lines
      const nC = Math.ceil(w / 6) + 1;
      for (let i = 0; i < nC; i++) {
        const x = x0 + 0.4 + (i / (nC - 1)) * (w - 0.8);
        for (const z of [z1 - 0.4, z0 + 0.4]) boxF(b, band, [x - 0.3, 0, z - 0.3], [x + 0.3, H - 0.1, z + 0.3], "sentw", { tint: t });
      }
      // ramp stripes on the east side
      for (let f = 0; f < floors - 1; f++) {
        const y = f * dh + 1.2, za = z0 + 1.5, zb = z1 - 1.5;
        const dir = f % 2 === 0;
        b.quad(band, [x1 + 0.03, y, dir ? za : zb], [x1 + 0.03, y + dh, dir ? zb : za], [x1 + 0.03, y + dh + 0.5, dir ? zb : za], [x1 + 0.03, y + 0.5, dir ? za : zb], { double: true, tint: [1.2, 1.2, 1.2] });
      }
      collide(b, { x0, x1, z0, z1 }, H + 0.5);
      // entrance: booth + barrier on the ground floor front
      frame(b, { x0, x1, z0, z1 }, "n", (len) => {
        boxF(b, "mat_metal_painted_dark", [-len / 4 - 0.8, 0, -1.3], [-len / 4 + 0.8, 2.5, -0.3], "newt");
        b.quad("mat_light_warm", [-len / 4 + 0.7, 1.2, -0.29], [-len / 4 - 0.7, 1.2, -0.29], [-len / 4 - 0.7, 2.2, -0.29], [-len / 4 + 0.7, 2.2, -0.29], { uv: "unit" });
        boxF(b, "mat_neon_red", [-len / 4 + 1, 1.0, -0.7], [-len / 4 + 4, 1.1, -0.6], "nt");
        at(b, 0, dh * 2 + 0.2, 0, () => signs.wallSign(b, r, { w: 4, h: 1.5, color: "mat_neon_cyan" }));
        at(b, len / 2 - 0.5, 4.5, 0, () => blade(b, r, { w: 0.8, h: 2.6, proj: 0.28, color: "mat_neon_cyan" }));
      });
      // roof deck: lamp posts, stair core, a sign
      for (const [lx, lz] of [[-w / 3, -d / 4], [w / 3, -d / 4], [-w / 3, d / 4], [w / 3, d / 4]]) {
        b.cylinder("mat_metal_painted_dark", { x: lx, z: lz, y0: H, y1: H + 4.5, r: 0.07, seg: 4, cap: false });
        b.quad("mat_light_warm", [lx + 0.4, H + 4.5, lz], [lx - 0.4, H + 4.5, lz], [lx - 0.4, H + 4.6, lz], [lx + 0.4, H + 4.6, lz], { double: true });
      }
      bulkhead(b, w / 2 - 3, H, -d / 2 + 3, 4, 3, 4);
      at(b, 0, H, d / 2 - 0.5, () => signs.roofSign(b, r, { w: Math.min(8, w * 0.35), h: 2.4, color: "mat_neon_cyan" }));
      light(b, "entrance", [-w / 4, 2.8, d / 2], "#ffd9a0", 0.8, 12);
      light(b, "roof_sign", [0, H + 3, d / 2 - 0.5], "#00f0ff", 0.7, 18);
    },
  },
];
