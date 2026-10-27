// Industrial recipes: warehouse with loading docks, factory with chimney, container stack, substation.
import { FLOOR_H, SHOP_H, BAY_W } from "./modules.mjs";
import { TAU, v3 } from "./math.mjs";
import * as signs from "./signs.mjs";
import {
  BUILDING_AO, FABRIC, blade, boxF, tris, frame, shell, ac, pipe, cable, door, ledge, hvac, waterTank, dish, antenna, bulkhead,
  collide, light, shuffle, at, paint, heightOf, bays, fireEscape,
} from "./blow_kit.mjs";

const base = { category: "building", budget: 1500 };

const CONTAINER_TINTS = [
  [0.75, 0.22, 0.18], [0.2, 0.42, 0.65], [0.85, 0.62, 0.18], [0.25, 0.5, 0.38], [0.62, 0.62, 0.66], [0.55, 0.3, 0.2], [0.8, 0.8, 0.82],
];

export const industrial = [
  // ------------------------------------------------------------------------------------------
  {
    ...base,
    id: "bld_ind_warehouse",
    tags: ["building", "zone:industrial"],
    lot: { w: [24, 42], d: [21, 42], floors: [1, 3] },
    params: { w: 33, d: 27, floors: 2 },
    variants: [
      { suffix: "_wide", seed: 5, params: { w: 42, d: 30, floors: 3 } },
      { suffix: "_b", seed: 22, params: { w: 24, d: 21, floors: 1 } },
    ],
    build(b, r, { w, d, floors }) {
      b.ao = BUILDING_AO;
      const apron = 2.4;
      const ext = { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 - apron };
      const { H, g } = shell(b, r, ext, {
        floors: floors + 1, shop: true, ground: "mat_wall_concrete_panel", upper: "mat_wall_metal_cladding",
        sides: { s: "mat_wall_metal_cladding", e: "mat_wall_metal_cladding", w: "mat_wall_metal_cladding" }, parapet: 0.6,
      });
      collide(b, ext, H);
      // office block in the front-left corner of the apron side
      const off = { x0: -w / 2, x1: -w / 2 + 6, z0: ext.z1 - 0.01, z1: d / 2 - 0.1 };
      const oh = shell(b, r, off, { floors: 2, shop: false, upper: "mat_facade_windows_lit", parapet: 0.5, tint: [1, 0.95, 0.9] });
      collide(b, off, oh.H);
      frame(b, ext, "n", (len) => {
        // dock platform, doors with bumpers and hazard lights, canopy
        boxF(b, "mat_wall_concrete_dark", [-len / 2 + 6.2, 0, 0], [len / 2, 1.2, apron - 0.3], "newt");
        const nd = Math.max(2, Math.floor((len - 10) / 6));
        for (let i = 0; i < nd; i++) {
          const x = -len / 2 + 6.2 + 3 + i * ((len - 6.2 - 6) / Math.max(1, nd - 1));
          b.quad("mat_metal_painted_dark", [x + 1.7, 1.2, 0.03], [x - 1.7, 1.2, 0.03], [x - 1.7, 4.4, 0.03], [x + 1.7, 4.4, 0.03], { uv: "unit" });
          boxF(b, "mat_prop_rubber", [x - 1.5, 0.7, apron - 0.55], [x + 1.5, 1.2, apron - 0.3], "n");
          b.quad("mat_neon_amber", [x + 0.15, 4.7, 0.04], [x - 0.15, 4.7, 0.04], [x - 0.15, 5.0, 0.04], [x + 0.15, 5.0, 0.04], { uv: "unit" });
        }
        const cx0 = -len / 2 + 6.2;
        boxF(b, "mat_metal_painted_dark", [cx0, 5.3, 0], [len / 2, 5.5, apron - 0.15], "newtb");
        for (let x = cx0 + 0.5; x <= len / 2 + 0.01; x += 6) boxF(b, "mat_metal_painted_dark", [x - 0.1, 1.2, apron - 0.4], [x + 0.1, 5.3, apron - 0.2], "sentw");
        at(b, (cx0 + len / 2) / 2, 5.8, 0, () => signs.wallSign(b, r, { w: Math.min(10, (len - 7) * 0.7), h: 1.7, style: "board", text: r.pick(["LOGISTICS", "FREIGHT", "CARGO", "STORAGE"]) }));
        at(b, cx0, g + 2.6, 0, () => signs.neonStrip(b, r, { len: len / 2 - cx0 - 0.5, axis: "x", color: "mat_neon_red" }));
      });
      frame(b, off, "n", (len) => {
        door(b, 0, 1.8, 2.5, "mat_neon_cyan");
        at(b, len / 2 - 0.4, 3.6, 0, () => blade(b, r, { w: 0.7, h: 2.2, proj: 0.3 }, 0.4));
      });
      for (const side of ["e", "w", "s"]) {
        frame(b, ext, side, (len) => {
          for (let i = 0; i < 2; i++) ac(b, r.range(-len / 2 + 3, len / 2 - 3), 5.5 + r.range(0, 1.5), 1.0);
          pipe(b, r.range(-len / 3, len / 3), 0, H - 0.5, 0.12, "mat_metal_galvanized");
        });
      }
      // roof: vents, skylights, a small tank, stacks
      for (let i = 0; i < 3; i++) hvac(b, -w / 3 + i * (w / 3), H, -d / 5, 2.4, 1.3, 2.2);
      for (let i = 0; i < 3; i++) {
        const x = -w / 4 + i * (w / 4);
        b.quad("mat_glass_dark", [x + 1.5, H + 0.02, -d / 2 + 3], [x - 1.5, H + 0.02, -d / 2 + 3], [x - 1.5, H + 0.02, -d / 2 + 8], [x + 1.5, H + 0.02, -d / 2 + 8], {});
      }
      for (const x of [w / 3, w / 2.4]) {
        b.cylinder("mat_metal_galvanized", { x, z: ext.z1 - 4, y0: H, y1: H + 2.2, r: 0.3, seg: 6, cap: false });
        b.cylinder("mat_metal_painted_dark", { x, z: ext.z1 - 4, y0: H + 2.2, y1: H + 2.6, r: 0.55, r1: 0.1, seg: 6, cap: false });
      }
      waterTank(b, -w / 4, H, ext.z1 - 4, 1.0, 1.4);
      antenna(b, w / 3, H, -d / 3, 5);
      light(b, "docks", [0, 5, d / 2 - 0.5], "#ffb000", 1, 16);
      light(b, "office", [off.x0 + 3, 4, d / 2], "#00f0ff", 0.7, 12);
    },
  },
  // ------------------------------------------------------------------------------------------
  {
    ...base,
    id: "bld_ind_factory",
    tags: ["building", "zone:industrial"],
    lot: { w: [24, 42], d: [24, 42], floors: [2, 4] },
    params: { w: 33, d: 27, floors: 3 },
    variants: [
      { suffix: "_wide", seed: 8, params: { w: 42, d: 30, floors: 4 } },
      { suffix: "_b", seed: 18, params: { w: 24, d: 24, floors: 2 } },
    ],
    build(b, r, { w, d, floors }) {
      b.ao = BUILDING_AO;
      const front = 2.6;
      const w1 = Math.max(12, Math.round((w * 0.5) / 3) * 3);
      const w2 = w >= 33 ? 9 : 6;
      const xh = -w / 2 + w1;
      const hall = { x0: -w / 2, x1: xh, z0: -d / 2, z1: d / 2 - front };
      const boil = { x0: xh, x1: xh + w2, z0: -d / 2, z1: d / 2 - front - 2 };
      const { H } = shell(b, r, hall, { floors, shop: true, ground: "mat_wall_concrete_panel", upper: "mat_wall_brick_dirty", parapet: 0.5, sides: { s: "mat_wall_brick_dirty", w: "mat_wall_brick_dirty" } });
      const bh = shell(b, r, boil, { floors: floors + 2, shop: true, ground: "mat_wall_concrete_dark", upper: "mat_wall_metal_cladding", parapet: 0.5, sides: { s: "mat_wall_metal_cladding", e: "mat_wall_metal_cladding" }, tint: [0.9, 0.9, 0.95] });
      collide(b, hall, H);
      collide(b, boil, bh.H);
      // sawtooth skylights on the hall roof
      const teeth = Math.max(2, Math.floor(w1 / 4.5));
      for (let i = 0; i < teeth; i++) {
        const xa = hall.x0 + 0.8 + i * ((w1 - 1.6) / teeth), xb = xa + (w1 - 1.6) / teeth, hh = 1.7;
        const zA = hall.z0 + 0.8, zB = hall.z1 - 0.8;
        b.quad("mat_glass_dark", [xa, H, zA], [xa, H, zB], [xa, H + hh, zB], [xa, H + hh, zA], { double: true });
        b.quad("mat_roof_tar", [xb, H, zB], [xb, H, zA], [xa, H + hh, zA], [xa, H + hh, zB], { double: true });
        b.tri("mat_roof_tar", [xa, H, zB], [xb, H, zB], [xa, H + hh, zB]);
        b.tri("mat_roof_tar", [xa, H, zA], [xa, H + hh, zA], [xb, H, zA]);
      }
      // chimney behind the boiler house
      const cx = xh + w2 / 2, cz = -d / 2 + 4;
      const ch = bh.H + 14 + floors * 3;
      b.cylinder("mat_wall_brick_dirty", { x: cx, z: cz, y0: 0, y1: ch, r: 1.5, r1: 0.9, seg: 8, cap: "top" });
      b.cylinder("mat_neon_red", { x: cx, z: cz, y0: ch - 4, y1: ch - 3.2, r: 0.99, r1: 0.95, seg: 8, cap: false });
      b.quad("mat_neon_red", [cx + 0.2, ch + 0.02, cz + 0.2], [cx - 0.2, ch + 0.02, cz + 0.2], [cx - 0.2, ch + 0.5, cz + 0.2], [cx + 0.2, ch + 0.5, cz + 0.2], { double: true });
      collide(b, { x0: cx - 1.5, x1: cx + 1.5, z0: cz - 1.5, z1: cz + 1.5 }, ch);
      // front yard: tanks and a pipe rack
      const yardX0 = xh + w2 + 0.8, yardX1 = w / 2 - 0.6;
      const tr = Math.min(2.2, (yardX1 - yardX0) / 2 - 0.1);
      const nt = Math.max(1, Math.floor((yardX1 - yardX0) / (tr * 2 + 0.4)));
      for (let i = 0; i < nt; i++) {
        const tx = yardX0 + tr + i * (tr * 2 + 0.4), tz = d / 2 - 3.2;
        b.cylinder("mat_metal_plate_worn", { x: tx, z: tz, y0: 0, y1: 6.5, r: tr, seg: 8, cap: "top" });
        b.cylinder("mat_metal_rust", { x: tx, z: tz, y0: 6.5, y1: 7.2, r: tr * 0.9, r1: tr * 0.2, seg: 8, cap: false });
        b.cylinder("mat_neon_amber", { x: tx, z: tz, y0: 3.0, y1: 3.2, r: tr + 0.02, seg: 8, cap: false });
        collide(b, { x0: tx - tr, x1: tx + tr, z0: tz - tr, z1: tz + tr }, 7);
      }
      for (let k = 0; k < 3; k++) {
        const y = 5.2 + k * 0.55, z = hall.z1 + 1.0 + k * 0.4;
        b.tube("mat_metal_rust", { pts: [[-w / 2 + 1, y, z], [w / 2 - 1, y, z]], r: 0.14, seg: 6, cap: true });
      }
      for (let x = -w / 2 + 3; x < w / 2; x += 6) boxF(b, "mat_metal_painted_dark", [x - 0.15, 0, hall.z1 + 0.8], [x + 0.15, 6.9, hall.z1 + 1.1], "sentw");
      // stair tower, side pipes, hall front details
      frame(b, hall, "n", (len) => {
        door(b, -len / 4, 3.2, 3.0, "mat_neon_amber");
        at(b, len / 2 - 3, 4.8 + 0.2, 0, () => signs.wallSign(b, r, { w: 5.5, h: 1.5, style: "board", text: r.pick(["FOUNDRY", "WORKS", "CHEM", "STEEL"]) }));
        at(b, -len / 2 + 0.6, 0.0 + 4.0, 0, () => signs.bladeSign(b, r, { w: 0.7, h: 2.0, proj: 0.3 }));
        for (let i = 0; i < 4; i++) ac(b, r.range(-len / 2 + 1, len / 2 - 1), 5.5 + r.int(0, floors - 2) * FLOOR_H, 1.0);
      });
      frame(b, boil, "n", (len) => {
        at(b, 0, 4.8 + 0.1, 0, () => signs.wallSign(b, r, { w: Math.max(3, len - 1), h: 1.0, style: "bar" }));
        for (let x = -len / 2 + 1; x <= len / 2; x += 2) pipe(b, x, 0, bh.H - 1, 0.1);
      });
      frame(b, hall, "w", (len) => {
        pipe(b, -len / 3, 0, H, 0.15);
        pipe(b, len / 4, 0, H - 1, 0.1, "mat_metal_galvanized");
        for (let i = 0; i < 2; i++) ac(b, r.range(-len / 2 + 3, len / 2 - 3), 5.5, 1.1);
      });
      // exhaust stacks and a roof fan on the boiler house
      for (const dx of [-1.6, 1.6]) {
        b.cylinder("mat_metal_galvanized", { x: boil.x0 + w2 / 2 + dx, z: boil.z1 - 2, y0: bh.H, y1: bh.H + 3, r: 0.35, seg: 6, cap: false });
        b.cylinder("mat_metal_painted_dark", { x: boil.x0 + w2 / 2 + dx, z: boil.z1 - 2, y0: bh.H + 3, y1: bh.H + 3.5, r: 0.6, r1: 0.1, seg: 6, cap: false });
      }
      hvac(b, hall.x0 + 4, H, hall.z0 + 4, 3, 1.4, 2.4);
      light(b, "chimney", [cx, ch + 0.3, cz], "#ff2a3c", 0.8, 18);
      light(b, "yard", [yardX0 + 2, 4, d / 2 - 2], "#ffb000", 0.9, 14);
    },
  },
  // ------------------------------------------------------------------------------------------
  {
    ...base,
    id: "bld_ind_container_stack",
    tags: ["building", "zone:industrial"],
    lot: { w: [24, 42], d: [21, 42], floors: [1, 4] },
    params: { w: 30, d: 24, floors: 3 },
    variants: [
      { suffix: "_wide", seed: 12, params: { w: 42, d: 27, floors: 4 } },
      { suffix: "_b", seed: 29, params: { w: 24, d: 21, floors: 2 } },
    ],
    build(b, r, { w, d, floors }) {
      b.ao = BUILDING_AO;
      const tiers = floors + 1;
      const ch = 2.6, cd = 2.5;
      const frontZ1 = d / 2 - 1.3, backZ0 = -d / 2 + 0.1;
      const rows = [
        { z0: frontZ1 - cd, z1: frontZ1, tiers },
        { z0: backZ0, z1: backZ0 + cd, tiers: Math.max(1, tiers - 1) },
      ];
      // yard floor
      b.quad("mat_roof_tar", [-w / 2, 0.02, -d / 2], [w / 2, 0.02, -d / 2], [w / 2, 0.02, d / 2], [-w / 2, 0.02, d / 2], {});
      const placed = []; // {x0,x1,y0,tier,row} for stair / sign placement
      let tMax = 0;
      rows.forEach((row, ri) => {
        let prev = [[-w / 2, w / 2]];
        for (let t = 0; t < row.tiers; t++) {
          const cur = [];
          let x = -w / 2;
          while (x < w / 2 - 5.9) {
            const rem = w / 2 - x;
            const L = rem >= 12 && r() < 0.75 ? 12 : 6;
            const supported = prev.some(([a, c]) => a <= x + L / 2 && c >= x + L / 2);
            if (supported && (t === 0 || r() > 0.2)) {
              const y0 = t * ch, tint = r.pick(CONTAINER_TINTS);
              boxF(b, "mat_metal_container", [x, y0, row.z0], [x + L, y0 + ch, row.z1], "sentwt", { tint });
              if (ri === 0 && r() < 0.35) b.quad("mat_light_warm", [x + L / 2 + 1.0, y0 + 0.7, row.z1 + 0.02], [x + L / 2 - 1.0, y0 + 0.7, row.z1 + 0.02], [x + L / 2 - 1.0, y0 + 1.6, row.z1 + 0.02], [x + L / 2 + 1.0, y0 + 1.6, row.z1 + 0.02], { uv: "unit" });
              cur.push([x, x + L]);
              placed.push({ x0: x, x1: x + L, y0, t, ri });
              tMax = Math.max(tMax, t + 1);
            }
            x += L;
          }
          prev = cur;
        }
      });
      const H = tMax * ch;
      collide(b, { x0: -w / 2, x1: w / 2, z0: frontZ1 - cd, z1: frontZ1 }, H);
      collide(b, { x0: -w / 2, x1: w / 2, z0: backZ0, z1: backZ0 + cd }, Math.max(ch, (tiers - 1) * ch));
      const fr = { x0: -w / 2, x1: w / 2, z0: frontZ1 - cd, z1: frontZ1 };
      frame(b, fr, "n", (len) => {
        // an external stair + landings up the front stack
        fireEscape(b, r.chance(0.5) ? -len / 2 + 2 : len / 2 - 4.4, 0.0, Math.min(tiers, 4), 2.2);
        for (let i = 0; i < 4; i++) ac(b, r.range(-len / 2 + 1, len / 2 - 1), r.int(0, 1) * ch + 1.4, 0.8);
        // strung cable lights across the yard front
        cable(b, [-len / 2 + 1, 3.4, 0.9], [len / 2 - 1, 3.4, 0.9], 0.6);
        for (let i = 0; i < 5; i++) b.quad("mat_light_warm", [-len / 2 + 3 + i * (len - 6) / 4 + 0.2, 3.1, 0.9], [-len / 2 + 3 + i * (len - 6) / 4 - 0.2, 3.1, 0.9], [-len / 2 + 3 + i * (len - 6) / 4 - 0.2, 3.4, 0.9], [-len / 2 + 3 + i * (len - 6) / 4 + 0.2, 3.4, 0.9], { double: true });
        at(b, 0, Math.min(2, tiers - 1) * ch + 0.2, 0, () => signs.wallSign(b, r, { w: Math.min(9, len * 0.4), h: 1.4, style: "board", text: r.pick(["CARGO", "DEPOT", "BOXED", "SCRAP"]) }));
        at(b, len / 2 - 0.6, ch + 1.0, 0, () => signs.bladeSign(b, r, { w: 0.7, h: 2.0, proj: 0.3 }));
        at(b, -len / 2 + 0.05, 0.2, 0, () => signs.neonStrip(b, r, { len: H - 0.4, axis: "y" }));
      });
      // roof clutter on the top container
      const top = placed.filter((p) => p.ri === 0 && p.t === tMax - 1)[0];
      if (top) {
        antenna(b, top.x0 + 2, H, fr.z0 + 1.2, 5);
        hvac(b, top.x1 - 2.2, H, (fr.z0 + fr.z1) / 2, 1.8, 0.9, 1.4);
        dish(b, top.x0 + 4, H, (fr.z0 + fr.z1) / 2, r.range(0, TAU), 0.9);
      }
      // generator / pallets in the yard
      boxF(b, "mat_metal_plate_worn", [w / 2 - 5, 0, -d / 2 + 3.4], [w / 2 - 2, 1.6, -d / 2 + 5.2], "sentw");
      boxF(b, "mat_prop_rubber", [-w / 2 + 2, 0, -1], [-w / 2 + 4.5, 0.9, 1], "sentw");
      light(b, "yard", [0, 3.4, d / 2 - 2], "#ffd9a0", 0.9, 16);
      light(b, "stack", [0, H + 1, frontZ1], "#ff2bd6", 0.6, 14);
    },
  },
  // ------------------------------------------------------------------------------------------
  {
    ...base,
    id: "bld_ind_substation",
    tags: ["building", "zone:industrial"],
    lot: { w: [21, 42], d: [21, 42], floors: [1, 2] },
    params: { w: 27, d: 24, floors: 1 },
    variants: [
      { suffix: "_wide", seed: 3, params: { w: 42, d: 27, floors: 2 } },
      { suffix: "_b", seed: 16, params: { w: 21, d: 21, floors: 1 } },
    ],
    build(b, r, { w, d, floors }) {
      b.ao = BUILDING_AO;
      const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
      b.quad("mat_roof_tar", [x0, 0.02, z0], [x1, 0.02, z0], [x1, 0.02, z1], [x0, 0.02, z1], { tint: [0.7, 0.7, 0.72] });
      // control building at the back
      const cb = { x0: x0 + 2, x1: x0 + 2 + Math.min(12, Math.round((w * 0.4) / 3) * 3), z0: z0 + 0.8, z1: z0 + 0.8 + 6 };
      const ch = shell(b, r, cb, { floors: floors + 1, shop: false, upper: "mat_wall_concrete_panel", parapet: 0.5 });
      collide(b, cb, ch.H);
      frame(b, cb, "n", (len) => {
        door(b, -len / 4, 1.6, 2.4, "mat_neon_red");
        at(b, len / 4, 0.0 + 2.9, 0, () => signs.wallSign(b, r, { w: 4, h: 0.9, style: "board", text: "HV" }));
        ac(b, len / 2 - 1.2, 1.6, 0.9);
      });
      hvac(b, cb.x0 + 2.5, ch.H, cb.z0 + 3, 2.2, 1.0, 1.8);
      // transformers
      const nT = w >= 33 ? 3 : 2;
      for (let i = 0; i < nT; i++) {
        const cx = x1 - 4.5 - i * 6.5, cz = z0 + 6;
        boxF(b, "mat_metal_painted_dark", [cx - 2.0, 0.3, cz - 1.6], [cx + 2.0, 3.6, cz + 1.6], "sentwt");
        boxF(b, "mat_metal_galvanized", [cx - 2.0, 0.0, cz - 1.6], [cx + 2.0, 0.3, cz + 1.6], "sentw");
        for (let k = 0; k < 3; k++) boxF(b, "mat_metal_galvanized", [cx - 2.4, 0.8, cz - 1.2 + k * 1.0], [cx - 2.0, 3.0, cz - 0.8 + k * 1.0], "newt");
        for (let k = 0; k < 3; k++) {
          const bx = cx - 1.2 + k * 1.2;
          b.lathe("mat_metal_rust", [[0.22, 3.6], [0.22, 4.1], [0.32, 4.15], [0.32, 4.5], [0.2, 4.55], [0.2, 5.0]], { x: bx, z: cz, seg: 6 }, {});
        }
        collide(b, { x0: cx - 2.4, x1: cx + 2.0, z0: cz - 1.6, z1: cz + 1.6 }, 5);
      }
      // gantry with insulator strings
      const gz = z0 + 11.5;
      for (const x of [x0 + 3, x1 - 3]) boxF(b, "mat_metal_galvanized", [x - 0.2, 0, gz - 0.2], [x + 0.2, 8.5, gz + 0.2], "sentw");
      boxF(b, "mat_metal_galvanized", [x0 + 3, 8.0, gz - 0.15], [x1 - 3, 8.4, gz + 0.15], "sentwt");
      for (let x = x0 + 6; x < x1 - 5; x += 3.5) b.cylinder("mat_metal_rust", { x, z: gz, y0: 6.4, y1: 8.0, r: 0.09, seg: 4, cap: false });
      cable(b, [x0 + 3, 8.2, gz], [x1 - 3, 8.2, gz + 0.2], 0.5, 3, 0.03);
      cable(b, [x1 - 4.5, 5.0, z0 + 6], [x1 - 6, 8.2, gz], 0.6, 3, 0.03);
      // fence: posts + mesh panels on three sides, gate on the front
      const fh = 2.4, gate = 5;
      const post = (x, z) => boxF(b, "mat_metal_galvanized", [x - 0.08, 0, z - 0.08], [x + 0.08, fh + 0.2, z + 0.08], "sentw");
      const panel = (xa, za, xb, zb) => b.wall("mat_metal_galvanized", [xa, za], [xb, zb], 0.1, fh, { double: true, tint: [0.75, 0.78, 0.82] });
      const fx0 = x0 + 0.2, fx1 = x1 - 0.2, fz0 = z0 + 0.2, fz1 = z1 - 0.3;
      for (let x = fx0; x <= fx1 + 0.01; x += 6) { post(Math.min(x, fx1), fz0); }
      for (let z = fz0; z <= fz1 + 0.01; z += 6) { post(fx0, Math.min(z, fz1)); post(fx1, Math.min(z, fz1)); }
      panel(fx1, fz0, fx0, fz0);
      panel(fx0, fz0, fx0, fz1);
      panel(fx1, fz1, fx1, fz0);
      const gl = -gate / 2, gr = gate / 2;
      panel(fx0, fz1, gl, fz1);
      panel(gr, fz1, fx1, fz1);
      for (const x of [gl, gr, fx0, fx1]) post(x, fz1);
      boxF(b, "mat_metal_painted_dark", [gl, 0.1, fz1 - 0.05], [gr, fh, fz1 + 0.05], "nt"); // sliding gate
      // warning lights and signs
      for (const [lx, lz] of [[fx0, fz0], [fx1, fz0], [fx0, fz1], [fx1, fz1]]) {
        b.quad("mat_neon_red", [lx + 0.12, fh + 0.3, lz], [lx - 0.12, fh + 0.3, lz], [lx - 0.12, fh + 0.6, lz], [lx + 0.12, fh + 0.6, lz], { double: true });
      }
      frame(b, { x0, x1, z0, z1 }, "n", (len) => {
        at(b, -gate / 2 - 3.2, 1.0, 0.1, () => signs.wallSign(b, r, { w: 2.6, h: 1.4, style: "icon", icon: "bolt", color: "mat_neon_amber" }));
        at(b, gate / 2 + 3.2, 1.0, 0.1, () => signs.wallSign(b, r, { w: 2.6, h: 1.4, style: "board", text: "DANGER", color: "mat_neon_red" }));
        at(b, -len / 2 + 0.3, 0.2, 0.15, () => signs.neonStrip(b, r, { len: 2.2, axis: "y", color: "mat_neon_red" }));
      });
      antenna(b, cb.x1 - 1, ch.H, cb.z0 + 2, 6);
      light(b, "gate", [0, 2.5, z1 - 0.5], "#ff2a3c", 0.8, 14);
      light(b, "gantry", [0, 8.5, gz], "#00f0ff", 0.6, 14);
      collide(b, { x0: gl, x1: gr, z0: fz1 - 0.1, z1: fz1 + 0.1 }, fh);
    },
  },
];
