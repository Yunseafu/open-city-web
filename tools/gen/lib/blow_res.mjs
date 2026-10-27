// Residential recipes: tenement, shack stack, tank-roof apartments, courtyard block, gallery slab.
import { FLOOR_H, SHOP_H, BAY_W } from "./modules.mjs";
import { TAU } from "./math.mjs";
import * as signs from "./signs.mjs";
import {
  FACADES, FABRIC, BUILDING_AO, blade, boxF, tris, frame, shell, ac, balcony, awning, pipe, cable, laundry,
  fireEscape, door, ledge, hvac, waterTank, dish, antenna, bulkhead, collide, light, shuffle, bayXs, at, paint, heightOf,
} from "./blow_kit.mjs";

const base = { category: "building", budget: 1500 };

export const residential = [
  // ------------------------------------------------------------------------------------------
  {
    ...base,
    id: "bld_res_tenement",
    tags: ["building", "zone:residential"],
    lot: { w: [21, 42], d: [21, 42], floors: [5, 9] },
    params: { w: 21, d: 21, floors: 7 },
    variants: [
      { suffix: "_wide", seed: 5, params: { w: 42, d: 21, floors: 9 } },
      { suffix: "_b", seed: 12, params: { w: 27, d: 24, floors: 6 } },
    ],
    build(b, r, { w, d, floors }) {
      b.ao = BUILDING_AO;
      const dep = 1.1;
      const ext = { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 - dep };
      // tall ones step back on the top floor (inset one bay at the back and on one side)
      const step = floors >= 7;
      const fac = r.pick(FACADES);
      let { H, g } = shell(b, r, ext, { floors: step ? floors - 1 : floors, shop: true, upper: fac });
      let roofExt = ext;
      if (step) {
        roofExt = { x0: ext.x0 + (r.chance(0.5) ? 3 : 0), x1: ext.x1 - (r.chance(0.5) ? 3 : 0), z0: ext.z0 + 3, z1: ext.z1 };
        H = shell(b, r, roofExt, { floors: 1, shop: false, y0: H, upper: fac }).H;
      }
      const rcx = (roofExt.x0 + roofExt.x1) / 2, rcz = (roofExt.z0 + roofExt.z1) / 2;
      const rw = roofExt.x1 - roofExt.x0, rd = roofExt.z1 - roofExt.z0;
      collide(b, { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 }, H);
      frame(b, ext, "s", (len) => {
        for (let i = 0; i < 6; i++) ac(b, r.range(-len / 2 + 1.5, len / 2 - 1.5), SHOP_H + r.int(0, floors - 2) * FLOOR_H + 1.2, 0.9);
        pipe(b, r.range(-len / 3, len / 3), 0, H, 0.1);
        pipe(b, r.range(-len / 3, len / 3) + 2, 0, H - 2, 0.07, "mat_metal_galvanized");
      });
      frame(b, ext, "n", (len) => {
        // balconies: random cells, capped by triangle count
        const cells = [];
        for (let f = 1; f < (step ? floors - 1 : floors); f++) for (const x of bayXs(len)) cells.push([f, x]);
        let placed = 0;
        for (const [f, x] of shuffle(r, cells)) {
          if (placed >= 26 || tris(b) > 560) break;
          if (r() > 0.55) continue;
          const y = SHOP_H + (f - 1) * FLOOR_H;
          balcony(b, x, y, 2.4, dep, "mat_metal_painted_dark");
          if (r() < 0.5) ac(b, x + r.pick([-0.5, 0.5]), y + 0.2, 0.3);
          placed++;
        }
        // laundry between a few balconies
        for (let i = 0; i < 3; i++) {
          const f = r.int(2, Math.max(2, floors - 1));
          const x = r.range(-len / 2 + 2, len / 2 - 2);
          laundry(b, r, x - 1.2, x + 1.2, SHOP_H + (f - 1) * FLOOR_H + 2.3, dep - 0.05, 3);
        }
        for (const x of [-len / 2 + 0.35, len / 2 - 0.35]) pipe(b, x, 0, H);
        // ground floor: shop door, awning, signs
        door(b, r.range(-len / 4, len / 4), 1.8, 2.5, r.pick(["mat_light_warm", "mat_neon_cyan"]));
        awning(b, -len / 2 + 5, 3.1, 5, dep - 0.05, r.pick(FABRIC));
        at(b, len / 2 - 4.5, SHOP_H + 0.1, 0, () => signs.wallSign(b, r, { w: 4, h: 1.2 }));
        at(b, -len / 2 + 0.9, SHOP_H - 0.6, 0, () => blade(b, r, { w: 0.8, h: 2.6, proj: 0.9 }, dep + 0.3));
        at(b, len / 2 - 0.05, g + 0.5, 0, () => signs.neonStrip(b, r, { len: H - g - 1, axis: "y" }));
      });
      for (const side of ["e", "w"]) {
        frame(b, ext, side, (len) => {
          for (let i = 0; i < 4; i++) ac(b, r.range(-len / 2 + 2, len / 2 - 2), SHOP_H + r.int(0, floors - 2) * FLOOR_H + 1.2);
          pipe(b, r.range(-len / 2 + 1, len / 2 - 1), 0, H - 1);
        });
      }
      // roof
      bulkhead(b, rcx - rw / 5, H, rcz - rd / 4, 3, 2.6, 3);
      waterTank(b, rcx + rw / 4, H, rcz, 1.2, 2.0);
      dish(b, rcx - rw / 3, H, rcz + rd / 5, r.range(0, TAU));
      dish(b, rcx - rw / 4, H, rcz - rd / 5 - 1, r.range(0, TAU), 0.8);
      antenna(b, rcx + rw / 3, H, rcz - rd / 3, 5);
      antenna(b, rcx - rw / 2 + 1.2, H, rcz + rd / 4, 4);
      hvac(b, rcx, H, rcz + rd / 4, 2.2, 1.0, 1.6);
      cable(b, [rcx - rw / 2 + 1.2, H + 4, rcz + rd / 4], [rcx + rw / 3, H + 5, rcz - rd / 3], 1.0);
      light(b, "shop", [0, 3, d / 2 + 0.5], "#ff2bd6", 1, 14);
      light(b, "roof", [rcx + rw / 3, H + 5, rcz - rd / 3], "#ff2a3c", 0.6, 10);
    },
  },
  // ------------------------------------------------------------------------------------------
  {
    ...base,
    id: "bld_res_shack_stack",
    tags: ["building", "zone:residential"],
    lot: { w: [21, 42], d: [21, 42], floors: [4, 8] },
    params: { w: 24, d: 21, floors: 6 },
    variants: [
      { suffix: "_wide", seed: 3, params: { w: 42, d: 24, floors: 8 } },
      { suffix: "_b", seed: 9, params: { w: 21, d: 27, floors: 5 } },
    ],
    build(b, r, { w, d, floors }) {
      b.ao = BUILDING_AO;
      const dep = 1.2;
      const ext = { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 - dep };
      const baseF = Math.max(2, floors - 2);
      const { H } = shell(b, r, ext, { floors: baseF, shop: true, upper: "mat_facade_windows_dark", sides: { s: "mat_wall_brick_dirty", w: "mat_wall_brick_dirty", e: "mat_wall_brick_dirty" } });
      // stacked shacks on the roof, 2 tiers, positions random but inside the footprint
      const mats = ["mat_metal_rust", "mat_wall_metal_cladding", "mat_metal_galvanized", "mat_metal_plate_worn"];
      const shacks = [];
      const n1 = r.int(2, 3);
      let top = H + 0.9;
      for (let i = 0; i < n1; i++) {
        const sx = r.range(5, Math.min(11, w / 2)), sz = r.range(5, Math.min(10, d - 5));
        const x = -w / 2 + 0.8 + (i / n1) * (w - 1.6) + r.range(0, 1.2);
        const x0 = Math.min(x, w / 2 - 0.8 - sx), z0 = r.range(-d / 2 + 1, d / 2 - dep - 0.3 - sz);
        shacks.push({ x0, x1: x0 + sx, z0, z1: z0 + sz, y0: top, h: r.range(2.8, 3.4) });
      }
      for (const s of shacks) {
        const m = r.pick(mats), t = paint(r);
        boxF(b, m, [s.x0, s.y0, s.z0], [s.x1, s.y0 + s.h, s.z1], "sentwt", { tint: t });
        const dx = s.x0 + (s.x1 - s.x0) * 0.5;
        b.quad("mat_light_warm", [dx + 0.8, s.y0 + 1.0, s.z1 + 0.02], [dx - 0.8, s.y0 + 1.0, s.z1 + 0.02], [dx - 0.8, s.y0 + 2.0, s.z1 + 0.02], [dx + 0.8, s.y0 + 2.0, s.z1 + 0.02], { uv: "unit" });
        // tier 2: a smaller shack on top of a random one
        if (r.chance(0.7)) {
          const sx2 = (s.x1 - s.x0) * r.range(0.45, 0.7), sz2 = (s.z1 - s.z0) * r.range(0.5, 0.8);
          const x0 = s.x0 + r.range(0, s.x1 - s.x0 - sx2), z0 = s.z0 + r.range(0, s.z1 - s.z0 - sz2);
          boxF(b, r.pick(mats), [x0, s.y0 + s.h, z0], [x0 + sx2, s.y0 + s.h + 2.6, z0 + sz2], "sentwt", { tint: paint(r) });
          antenna(b, x0 + sx2 / 2, s.y0 + s.h + 2.6, z0 + sz2 / 2, r.range(3, 6));
        }
        // stilts: shack posts to the roof
        boxF(b, "mat_metal_rust", [s.x0 + 0.2, H, s.z0 + 0.2], [s.x0 + 0.4, s.y0, s.z0 + 0.4], "sentw");
        boxF(b, "mat_metal_rust", [s.x1 - 0.4, H, s.z1 - 0.4], [s.x1 - 0.2, s.y0, s.z1 - 0.2], "sentw");
      }
      collide(b, { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 }, H + 7);
      frame(b, ext, "n", (len) => {
        const xs = r.chance(0.5) ? [-len / 2 + 2, len / 2 - 5] : [-len / 2 + 5, len / 2 - 2.6];
        for (const x of xs) fireEscape(b, x - 1.1, SHOP_H, baseF - 1, 2.2);
        for (let i = 0; i < 6; i++) ac(b, r.range(-len / 2 + 1, len / 2 - 1), SHOP_H + r.int(0, baseF - 2) * FLOOR_H + 1.3, 0.9);
        door(b, 0, 1.6, 2.4, "mat_neon_amber");
        awning(b, 0, 3.0, 4.2, dep - 0.05, r.pick(FABRIC));
        at(b, -len / 2 + 1.0, SHOP_H - 0.6, 0, () => blade(b, r, { w: 0.8, h: 2.8, proj: 1.0 }, dep + 0.3));
        at(b, len / 2 - 1.0, SHOP_H - 0.6, 0, () => blade(b, r, { w: 0.8, h: 2.4, proj: 1.0 }, dep + 0.3));
        at(b, len / 2 - 6, 0.6, 0, () => signs.neonStrip(b, r, { len: 3.6, axis: "x" }));
        for (let i = 0; i < 2; i++) laundry(b, r, r.range(-len / 3, 0), r.range(1, len / 3), SHOP_H + (i + 1) * FLOOR_H + 2.4, 1.0, 3);
        at(b, 0, H, 0, () => signs.neonStrip(b, r, { len: 0.1, axis: "x" }));
      });
      for (const side of ["e", "w"]) {
        frame(b, ext, side, (len) => {
          pipe(b, r.range(-len / 3, len / 3), 0, H, 0.1);
          ac(b, r.range(-len / 3, len / 3), SHOP_H + 1.2, 0.9);
        });
      }
      waterTank(b, r.range(-w / 3, w / 3), top, 0, 0.9, 1.5);
      dish(b, -w / 3, H, -d / 3, 1, 0.9);
      dish(b, w / 3, H, -d / 3, 3);
      for (const s of shacks.slice(0, 2)) cable(b, [s.x0, s.y0 + s.h - 0.2, s.z1], [s.x0 - 1.5, H + 0.8, s.z1 + 0.6], 0.8);
      light(b, "shack", [0, 2.5, d / 2], "#ffb000", 0.9, 14);
      light(b, "roof", [0, H + 4, 0], "#00f0ff", 0.6, 12);
    },
  },
  // ------------------------------------------------------------------------------------------
  {
    ...base,
    id: "bld_res_apartment_tanks",
    tags: ["building", "zone:residential"],
    lot: { w: [21, 42], d: [21, 42], floors: [6, 9] },
    params: { w: 27, d: 21, floors: 8 },
    variants: [
      { suffix: "_wide", seed: 4, params: { w: 42, d: 21, floors: 9 } },
      { suffix: "_b", seed: 21, params: { w: 21, d: 21, floors: 6 } },
    ],
    build(b, r, { w, d, floors }) {
      b.ao = BUILDING_AO;
      const dep = 1.0;
      const ext = { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 - dep };
      const { H, g } = shell(b, r, ext, { floors, shop: true, upper: r.pick(FACADES), sides: { e: "mat_wall_concrete_panel", w: "mat_wall_concrete_panel", s: "mat_wall_concrete_panel" } });
      collide(b, ext, H);
      frame(b, ext, "n", (len) => {
        for (let x = -len / 2; x <= len / 2 + 0.01; x += 6) {
          const cx = Math.min(Math.max(x, -len / 2 + 0.2), len / 2 - 0.2);
          boxF(b, "mat_wall_concrete_panel", [cx - 0.2, g, 0], [cx + 0.2, H + 0.9, 0.28], "newt");
        }
        ledge(b, -len / 2, len / 2, g, 0.3, 0.28);
        ledge(b, -len / 2, len / 2, g + 3 * FLOOR_H, 0.2, 0.25);
        if (floors > 7) ledge(b, -len / 2, len / 2, g + 6 * FLOOR_H, 0.2, 0.25);
        for (let i = 0; i < 9; i++) ac(b, r.range(-len / 2 + 1, len / 2 - 1), g + 1.2 + r.int(0, floors - 2) * FLOOR_H, 0.6);
        pipe(b, -len / 2 + 3, 0, H, 0.08);
        door(b, 0, 2.2, 2.6, "mat_neon_cyan");
        boxF(b, "mat_metal_painted_dark", [-2.2, 3.3, 0], [2.2, 3.5, 1.2], "newtb"); // entrance canopy
        at(b, -len / 2 + 4.5, g + 0.15, 0, () => signs.wallSign(b, r, { w: 4.5, h: 1.2 }));
        at(b, len / 2 - 0.6, g - 0.7, 0, () => blade(b, r, { w: 0.8, h: 2.8, proj: 0.9 }, dep + 0.3));
        at(b, -len / 2 + 0.05, g, 0, () => signs.neonStrip(b, r, { len: H - g, axis: "y" }));
      });
      for (const side of ["e", "w", "s"]) {
        frame(b, ext, side, (len) => {
          for (let i = 0; i < 3; i++) ac(b, r.range(-len / 2 + 2, len / 2 - 2), g + 1.2 + r.int(0, floors - 2) * FLOOR_H, 0.8);
          if (side !== "s") pipe(b, r.range(-len / 3, len / 3), 0, H);
        });
      }
      bulkhead(b, -w / 4, H, -d / 4, 3.6, 2.8, 3.2);
      const nTanks = r.int(2, 3);
      for (let i = 0; i < nTanks; i++) waterTank(b, -w / 2 + 4 + (i * (w - 8)) / Math.max(1, nTanks - 1) * 0.8 + 2, H, d / 5 - 1, 1.1 + r() * 0.3, 1.8);
      for (let i = 0; i < 4; i++) dish(b, -w / 2 + 2 + i * 1.6 + r() * 0.4, H, -d / 2 + 1.5 + r() * 0.5, r.range(0, TAU), r.range(0.7, 1.1));
      antenna(b, w / 3, H, -d / 4, 6);
      antenna(b, w / 4, H, d / 4, 4);
      hvac(b, w / 4, H, 0, 2.6, 1.2, 1.8);
      light(b, "front", [0, 4, d / 2 + 0.3], "#00f0ff", 0.9, 14);
    },
  },
  // ------------------------------------------------------------------------------------------
  {
    ...base,
    id: "bld_res_courtyard",
    tags: ["building", "zone:residential"],
    lot: { w: [24, 42], d: [24, 42], floors: [5, 8] },
    params: { w: 27, d: 27, floors: 6 },
    variants: [
      { suffix: "_wide", seed: 7, params: { w: 42, d: 36, floors: 7 } },
      { suffix: "_b", seed: 15, params: { w: 33, d: 24, floors: 5 } },
    ],
    build(b, r, { w, d, floors }) {
      b.ao = BUILDING_AO;
      const t = 6;
      const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
      const ix0 = x0 + t, ix1 = x1 - t, iz0 = z0 + t, iz1 = z1 - t;
      const g = SHOP_H, H = heightOf(floors, true), top = H + 0.9;
      const fac = r.pick(FACADES), tint = paint(r);
      const o = (v = 0) => ({ uOff: BAY_W * r.int(0, 3), vOff: v, tint });
      const vUp = -SHOP_H + (r.chance(0.5) ? FLOOR_H : 0);
      // outer ring
      const gate = 6, gh = 4.4; // archway through the front wing
      b.wall("mat_facade_shopfront", [x1, z1], [gate / 2, z1], 0, g, o());
      b.wall("mat_facade_shopfront", [-gate / 2, z1], [x0, z1], 0, g, o());
      b.wall("mat_facade_shopfront", [gate / 2, z1], [-gate / 2, z1], gh, g, o());
      b.wall(fac, [x1, z1], [x0, z1], g, top, o(vUp));
      b.wall("mat_wall_concrete_dark", [x1, z0], [x1, z1], 0, g, o());
      b.wall(fac, [x1, z0], [x1, z1], g, top, o(vUp));
      b.wall("mat_wall_concrete_dark", [x0, z1], [x0, z0], 0, g, o());
      b.wall(fac, [x0, z1], [x0, z0], g, top, o(vUp));
      b.wall("mat_wall_concrete_dark", [x0, z0], [x1, z0], 0, g, o());
      b.wall(fac, [x0, z0], [x1, z0], g, top, o(vUp));
      // gateway reveal: side walls and soffit
      b.wall("mat_wall_concrete_dark", [gate / 2, iz1], [gate / 2, z1], 0, gh, o());
      b.wall("mat_wall_concrete_dark", [-gate / 2, z1], [-gate / 2, iz1], 0, gh, o());
      b.quad("mat_wall_concrete_dark", [gate / 2, gh, iz1], [-gate / 2, gh, iz1], [-gate / 2, gh, z1], [gate / 2, gh, z1], { uv: "meters" });
      // inner ring facing the yard
      for (const [a, c] of [[[ix0, iz1], [ix1, iz1]], [[ix1, iz1], [ix1, iz0]], [[ix1, iz0], [ix0, iz0]], [[ix0, iz0], [ix0, iz1]]]) {
        b.wall("mat_wall_concrete_dark", a, c, 0, g, o());
        b.wall(fac, a, c, g, top, o(vUp));
      }
      // yard floor and roof ring
      b.quad("mat_ground_sidewalk_tiles", [ix0, 0.02, iz0], [ix1, 0.02, iz0], [ix1, 0.02, iz1], [ix0, 0.02, iz1], {});
      const roof = (a0, a1, c0, c1) => b.quad("mat_roof_tar", [a0, H, c0], [a1, H, c0], [a1, H, c1], [a0, H, c1], {});
      roof(x0, x1, iz1, z1); roof(x0, x1, z0, iz0); roof(x0, ix0, iz0, iz1); roof(ix1, x1, iz0, iz1);
      const pm = "mat_wall_concrete_dark";
      boxF(b, pm, [x0, H, z1 - 0.3], [x1, top, z1], "st", { tint });
      boxF(b, pm, [x0, H, z0], [x1, top, z0 + 0.3], "nt", { tint });
      boxF(b, pm, [x1 - 0.3, H, z0 + 0.3], [x1, top, z1 - 0.3], "wt", { tint });
      boxF(b, pm, [x0, H, z0 + 0.3], [x0 + 0.3, top, z1 - 0.3], "et", { tint });
      // gallery slabs on the inner east / west walls, one per floor
      for (let f = 1; f < floors; f++) {
        const y = SHOP_H + (f - 1) * FLOOR_H;
        boxF(b, "mat_wall_concrete_dark", [ix1 - 1.2, y, iz0], [ix1, y + 0.15, iz1], "wtb");
        boxF(b, "mat_metal_painted_dark", [ix1 - 1.2, y + 0.15, iz0], [ix1 - 1.15, y + 1.05, iz1], "w");
        if (f % 2 === 0) {
          boxF(b, "mat_wall_concrete_dark", [ix0, y, iz0], [ix0 + 1.2, y + 0.15, iz1], "etb");
          boxF(b, "mat_metal_painted_dark", [ix0 + 1.15, y + 0.15, iz0], [ix0 + 1.2, y + 1.05, iz1], "e");
        }
      }
      // yard dressing: a tree, string cables with lamps and laundry
      b.cylinder("mat_wall_concrete_dark", { x: 0, z: 0, y0: 0.02, y1: 2.2, r: 0.18, seg: 5, cap: false });
      b.sphere("mat_foliage_leaf", { c: [0, 3.4, 0], r: [1.7, 1.5, 1.7], seg: 7, rings: 4 });
      for (let i = 0; i < 3; i++) {
        const y = 9 + i * 3.6, zz = r.range(iz0 + 2, iz1 - 2);
        cable(b, [ix0, y, zz], [ix1, y, zz], 0.7);
        const lx = r.range(-2, 2);
        b.quad("mat_light_warm", [lx + 0.25, y - 0.7, zz], [lx - 0.25, y - 0.7, zz], [lx - 0.25, y - 0.3, zz], [lx + 0.25, y - 0.3, zz], { double: true });
      }
      laundry(b, r, ix0 + 0.5, ix1 - 0.5, 7.5, iz0 + 2.5, 4);
      collide(b, { x0, x1, z0, z1: iz0 }, H);
      collide(b, { x0, x1, z0: iz1, z1 }, H);
      collide(b, { x0, x1: ix0, z0: iz0, z1: iz1 }, H);
      collide(b, { x0: ix1, x1, z0: iz0, z1: iz1 }, H);
      // front details
      const ext = { x0, x1, z0, z1 };
      frame(b, ext, "n", (len) => {
        for (const x of [-len / 2 + 3, len / 2 - 3]) {
          door(b, x, 1.8, 2.5, "mat_neon_magenta");
        }
        awning(b, len / 2 - 8, 3.1, 4, 0.25, r.pick(FABRIC));
        awning(b, -len / 2 + 8, 3.1, 4, 0.25, r.pick(FABRIC));
        for (let i = 0; i < 6; i++) ac(b, r.range(-len / 2 + 1, len / 2 - 1), SHOP_H + r.int(0, floors - 2) * FLOOR_H + 1.2, 0.7);
        at(b, 0, gh + 0.1, 0, () => signs.wallSign(b, r, { w: gate, h: 0.9 }));
        at(b, len / 2 - 0.4, SHOP_H - 0.5, 0, () => blade(b, r, { w: 0.8, h: 2.4, proj: 0.3 }));
        at(b, -len / 2 + 0.05, SHOP_H, 0, () => signs.neonStrip(b, r, { len: H - SHOP_H, axis: "y" }));
      });
      waterTank(b, ix0 + 3, H, iz1 + 3, 1.0, 1.6);
      dish(b, ix1 - 3, H, iz1 + 2.5, r.range(0, TAU));
      dish(b, x0 + 2.5, H, z0 + 2.5, r.range(0, TAU));
      antenna(b, x1 - 2, H, z0 + 2, 4);
      bulkhead(b, ix1 + 3, H, iz0 - 3, 3, 2.6, 3);
      light(b, "gate", [0, 4.5, z1 - 1], "#ff2bd6", 0.8, 12);
      light(b, "yard", [0, 8, 0], "#ffd9a0", 0.7, 16);
    },
  },
  // ------------------------------------------------------------------------------------------
  {
    ...base,
    id: "bld_res_gallery_slab",
    tags: ["building", "zone:residential"],
    lot: { w: [27, 42], d: [21, 24], floors: [6, 9] },
    params: { w: 36, d: 21, floors: 8 },
    variants: [{ suffix: "_b", seed: 6, params: { w: 30, d: 24, floors: 7 } }],
    build(b, r, { w, d, floors }) {
      b.ao = BUILDING_AO;
      const dep = 1.6;
      const ext = { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 - dep };
      const { H, g } = shell(b, r, ext, { floors, shop: true, upper: "mat_facade_windows_dark" });
      collide(b, { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 }, H);
      const rail = "mat_metal_painted_dark";
      frame(b, ext, "n", (len) => {
        for (let f = 1; f < floors; f++) {
          const y = SHOP_H + (f - 1) * FLOOR_H;
          boxF(b, "mat_wall_concrete_dark", [-len / 2, y, 0], [len / 2, y + 0.18, dep], "newtb");
          boxF(b, rail, [-len / 2, y + 0.18, dep - 0.06], [len / 2, y + 1.1, dep], "nt");
          // lit doorways along the gallery
          if (f % 2 === 1) for (const x of bayXs(len).filter((_, i) => i % 3 === 1)) b.quad("mat_light_warm", [x + 0.4, y + 0.3, 0.02], [x - 0.4, y + 0.3, 0.02], [x - 0.4, y + 2.1, 0.02], [x + 0.4, y + 2.1, 0.02], { uv: "unit" });
        }
        // stair towers at both ends
        for (const x of [-len / 2 + 1.5, len / 2 - 1.5]) {
          boxF(b, "mat_wall_concrete_panel", [x - 1.5, 0, 0], [x + 1.5, H + 1.0, dep], "newt");
        }
        for (let i = 0; i < 6; i++) ac(b, r.range(-len / 2 + 4, len / 2 - 4), SHOP_H + r.int(1, floors - 1) * FLOOR_H + 0.4, 0.5);
        door(b, 0, 2.2, 2.6, "mat_neon_green");
        at(b, -len / 2 + 6, g + 0.15, 0, () => signs.wallSign(b, r, { w: 5, h: 1.2 }));
        at(b, len / 2 - 6, 0.7, 0, () => signs.neonStrip(b, r, { len: 4, axis: "x" }));
      });
      frame(b, { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 }, "n", (len) => {
        at(b, len / 2 - 0.1, g, 0, () => signs.neonStrip(b, r, { len: H - g, axis: "y" }));
      });
      for (let i = 0; i < 3; i++) hvac(b, -w / 3 + i * (w / 3), H, -d / 4, 2.6, 1.1, 1.8);
      waterTank(b, w / 3, H, 0, 1.2, 2);
      for (let i = 0; i < 3; i++) dish(b, -w / 2 + 2 + i * 1.4, H, d / 4 - 1, r.range(0, TAU));
      antenna(b, 0, H, d / 4, 5);
      light(b, "gallery", [0, 6, d / 2], "#39ff6a", 0.8, 16);
    },
  },
];
