// Commercial recipes: shop row, noodle bar, convenience store with forecourt, market hall.
import { FLOOR_H, SHOP_H, BAY_W } from "./modules.mjs";
import { TAU } from "./math.mjs";
import { MATERIALS } from "./materials.mjs";
import * as signs from "./signs.mjs";
import {
  FACADES, FABRIC, BUILDING_AO, blade, boxF, tris, frame, shell, ac, balcony, awning, pipe, cable, laundry, door, ledge,
  hvac, waterTank, dish, antenna, bulkhead, collide, light, shuffle, bayXs, at, paint, heightOf, bays,
} from "./blow_kit.mjs";

const base = { category: "building", budget: 1500 };
// materials owned by the props work: fall back if they are ever renamed
const WOOD = MATERIALS.mat_prop_wood ? "mat_prop_wood" : "mat_wall_concrete_dark";
const SCREEN = MATERIALS.mat_prop_screen_blue ? "mat_prop_screen_blue" : "mat_neon_cyan";

/** Paper lantern (6-sided, emissive) hanging from (x, y, z). */
function hangLantern(b, x, y, z, color, s = 1) {
  b.with({ pos: [x, y, z] }, () => b.lathe(color, [[0.1 * s, 0], [0.22 * s, 0.17 * s], [0.1 * s, 0.38 * s]], { seg: 6 }));
}

export const commercial = [
  // ------------------------------------------------------------------------------------------
  {
    ...base,
    id: "bld_com_shop_row",
    tags: ["building", "zone:commercial"],
    lot: { w: [21, 42], d: [21, 42], floors: [2, 4] },
    params: { w: 27, d: 21, floors: 3 },
    variants: [
      { suffix: "_wide", seed: 6, params: { w: 42, d: 21, floors: 4 } },
      { suffix: "_b", seed: 19, params: { w: 21, d: 24, floors: 2 } },
    ],
    build(b, r, { w, d, floors }) {
      b.ao = BUILDING_AO;
      const dep = 1.2;
      const ext = { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 - dep };
      const { H, g } = shell(b, r, ext, { floors, shop: true, upper: r.pick(FACADES), sides: { s: "mat_wall_brick_dirty" } });
      collide(b, { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 }, H);
      frame(b, ext, "n", (len) => {
        // split the frontage into shop units of 2-4 bays
        const nb = bays(len);
        const units = [];
        for (let left = nb; left > 0; ) {
          let k = Math.min(left, r.int(2, 4));
          if (left - k === 1) k = left;
          units.push(k);
          left -= k;
        }
        let x = -len / 2;
        units.forEach((k, ui) => {
          const uw = k * BAY_W, xc = x + uw / 2;
          boxF(b, "mat_wall_concrete_panel", [x - 0.15, 0, 0], [x + 0.15, g, 0.28], "newt");
          awning(b, xc, 3.2, uw - 0.5, dep - 0.05, r.pick(FABRIC), 0.5);
          at(b, xc, 3.75, 0, () => signs.wallSign(b, r, { w: Math.max(2.4, uw - 1.2), h: 0.85 }));
          door(b, xc + (ui % 2 ? -0.6 : 0.6) * (uw > 6 ? 1 : 0), 1.5, 2.4, r.pick(["mat_light_warm", "mat_neon_cyan", "mat_neon_amber"]));
          b.quad("mat_light_warm", [xc + uw / 2 - 0.8, 2.55, 0.03], [xc - uw / 2 + 0.8, 2.55, 0.03], [xc - uw / 2 + 0.8, 2.75, 0.03], [xc + uw / 2 - 0.8, 2.75, 0.03], { uv: "unit" });
          if (ui % 2 === 0) at(b, x + 0.2, g - 0.9, 0, () => blade(b, r, { w: 0.7, h: 2.2, proj: 1.0 }, dep + 0.3));
          x += uw;
        });
        boxF(b, "mat_wall_concrete_panel", [len / 2 - 0.15, 0, 0], [len / 2 + 0.15, g, 0.28], "newt");
        ledge(b, -len / 2, len / 2, g, 0.25, 0.28);
        for (let i = 0; i < 9; i++) ac(b, r.range(-len / 2 + 1, len / 2 - 1), g + 1.0 + r.int(0, floors - 2) * FLOOR_H, 0.7);
        for (let i = 0; i < 3; i++) {
          const f = r.int(1, Math.max(1, floors - 1)), xx = r.range(-len / 2 + 2, len / 2 - 3);
          balcony(b, xx, g + (f - 1) * FLOOR_H, 2.4, dep, "mat_metal_painted_dark");
        }
        pipe(b, -len / 2 + 0.4, 0, H);
      });
      frame(b, ext, "e", (len) => {
        for (let i = 0; i < 3; i++) ac(b, r.range(-len / 2 + 2, len / 2 - 2), g + 1.2 + r.int(0, floors - 2) * FLOOR_H, 0.8);
        pipe(b, r.range(-len / 3, len / 3), 0, H);
      });
      // roof: ad billboard on the front edge, tank, dishes
      at(b, r.range(-w / 6, w / 6), H + 0.0, ext.z1 - 0.8, () => signs.billboard(b, r, { w: Math.min(8, w * 0.35), h: 3 }));
      waterTank(b, -w / 3, H, -d / 5, 1.0, 1.6);
      hvac(b, w / 4, H, -d / 6, 2.6, 1.2, 1.8);
      dish(b, w / 3, H, -d / 3, r.range(0, TAU));
      antenna(b, -w / 4, H, d / 6, 4.5);
      light(b, "shops", [0, 3, d / 2], "#ff2bd6", 1, 16);
      light(b, "billboard", [0, H + 3, d / 2 - 1], "#00f0ff", 0.7, 16);
    },
  },
  // ------------------------------------------------------------------------------------------
  {
    ...base,
    id: "bld_com_noodle_bar",
    tags: ["building", "zone:commercial"],
    lot: { w: [21, 42], d: [21, 42], floors: [2, 3] },
    params: { w: 21, d: 21, floors: 3 },
    variants: [
      { suffix: "_wide", seed: 11, params: { w: 30, d: 21, floors: 2 } },
      { suffix: "_b", seed: 28, params: { w: 24, d: 24, floors: 3 } },
    ],
    build(b, r, { w, d, floors }) {
      b.ao = BUILDING_AO;
      const dep = 1.4;
      const ext = { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 - dep };
      const { H, g } = shell(b, r, ext, { floors, shop: true, upper: "mat_facade_windows_lit", sides: { s: "mat_wall_brick_dirty" }, tint: [1.0, 0.92, 0.85] });
      collide(b, { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 }, H);
      const hot = r.pick(["mat_neon_red", "mat_neon_magenta", "mat_neon_amber"]);
      frame(b, ext, "n", (len) => {
        // counter, awning and noren curtains at the door
        awning(b, 0, 3.0, Math.min(len - 6, 9), dep - 0.05, [0.85, 0.1, 0.12], 0.7);
        for (let i = -1; i <= 1; i++) {
          const x = i * 1.1;
          b.quad("mat_fabric_awning", [x - 0.5, 1.5, 0.35], [x + 0.5, 1.5, 0.35], [x + 0.5, 2.6, 0.35], [x - 0.5, 2.6, 0.35], { double: true, tint: [0.12, 0.04, 0.05] });
        }
        door(b, 0, 3.6, 2.7, hot);
        boxF(b, "mat_metal_painted_dark", [-len / 2 + 1, 0, 0.1], [-len / 2 + 4, 1.0, 0.9], "newt"); // counter / stall front
        // row of lanterns under the eave
        for (let i = 0; i < 6; i++) hangLantern(b, -len / 2 + 2.5 + (i * (len - 5)) / 5, 3.0, dep - 0.45, i % 2 ? hot : "mat_neon_amber", 1.0);
        // sign tangle: lintel sign, vertical blades stacked at the edges, neon frame around the door
        at(b, 0, g + 0.15, 0, () => signs.neonText(b, r, { text: r.pick(["RAMEN", "NOODLE", "IZAKAYA", "SUSHI"]), h: 0.95, color: hot, maxW: len - 4 }));
        at(b, -len / 2 + 0.5, g + 3.0, 0, () => blade(b, r, { w: 0.8, h: 3.0, proj: dep - 0.1, style: "kana" }, dep + 0.3));
        at(b, len / 2 - 0.5, g + 1.2, 0, () => blade(b, r, { w: 0.8, h: 2.6, proj: dep - 0.1, style: "latin" }, dep + 0.3));
        at(b, len / 2 - 2.2, g + 5.4 - 3.8, 0, () => blade(b, r, { w: 0.7, h: 2.0, proj: dep - 0.1 }, dep + 0.3));
        at(b, 0, 0.1, 0.2, () => signs.neonFrame(b, r, { w: 3.9, h: 3.0, t: 0.05, color: "mat_neon_cyan" }));
        for (let i = 0; i < 6; i++) ac(b, r.range(-len / 2 + 1.5, len / 2 - 1.5), g + 1.1 + r.int(0, floors - 2) * FLOOR_H, 0.7);
        pipe(b, len / 2 - 0.4, 0, H);
        // cables from the signs to the roof edge
        cable(b, [-len / 2 + 0.5, g + 3.0, 0.8], [-len / 2 + 5, H, 0.2], 0.6);
        cable(b, [len / 2 - 0.5, g + 2.0, 0.8], [len / 2 - 6, H, 0.2], 0.6);
        cable(b, [-len / 2 + 6, g + 0.5, 0.2], [len / 2 - 5, g + 0.4, 0.2], 0.8);
      });
      frame(b, ext, "e", (len) => {
        for (let i = 0; i < 2; i++) ac(b, r.range(-len / 2 + 2, len / 2 - 2), g + 1.2, 0.8);
        pipe(b, 0, 0, H - 1);
      });
      // roof: big sign, steam vents, plant
      at(b, 0, H, ext.z1 - 0.4, () => signs.roofSign(b, r, { w: Math.min(10, w * 0.5), h: 2.8, style: "word", text: r.pick(["RAMEN", "NOODLE", "SAKE BAR", "UDON"]), color: hot }));
      for (const x of [-w / 4, w / 4]) {
        b.cylinder("mat_metal_galvanized", { x, z: -d / 5, y0: H, y1: H + 1.4, r: 0.35, r1: 0.25, seg: 6, cap: false });
        b.cylinder("mat_metal_painted_dark", { x, z: -d / 5, y0: H + 1.4, y1: H + 1.9, r: 0.55, r1: 0.1, seg: 6, cap: false });
      }
      hvac(b, 0, H, -d / 4, 2.8, 1.2, 2);
      light(b, "door", [0, 2.5, d / 2], "#ff2a3c", 1, 14);
      light(b, "sign", [0, H + 2.5, d / 2 - 1], "#ff2bd6", 0.7, 16);
    },
  },
  // ------------------------------------------------------------------------------------------
  {
    ...base,
    id: "bld_com_convenience_corner",
    tags: ["building", "zone:commercial"],
    lot: { w: [21, 42], d: [21, 42], floors: [1, 2] },
    params: { w: 27, d: 24, floors: 1 },
    variants: [
      { suffix: "_wide", seed: 9, params: { w: 42, d: 27, floors: 2 } },
      { suffix: "_b", seed: 33, params: { w: 21, d: 21, floors: 1 } },
    ],
    build(b, r, { w, d, floors }) {
      b.ao = BUILDING_AO;
      const forecourt = Math.min(9, d - 12);
      const store = { x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 - forecourt };
      const { H, g } = shell(b, r, store, { floors, shop: true, upper: "mat_facade_windows_lit", parapet: 1.0, sides: { s: "mat_wall_brick_dirty", e: "mat_wall_concrete_panel", w: "mat_wall_concrete_panel" } });
      collide(b, store, H);
      const brand = r.pick(["mat_neon_green", "mat_neon_magenta", "mat_neon_cyan"]);
      // forecourt canopy on four columns
      const cy = 4.8;
      const cz0 = store.z1 + 0.6, cz1 = d / 2 - 0.2;
      boxF(b, "mat_metal_painted_dark", [-w / 2 + 1, cy, cz0], [w / 2 - 1, cy + 0.5, cz1], "newtb");
      const cols = [[-w / 2 + 3, cz1 - 1], [w / 2 - 3, cz1 - 1], [-w / 2 + 3, cz0 + 1.5], [w / 2 - 3, cz0 + 1.5]];
      for (const [x, z] of cols) boxF(b, "mat_wall_concrete_panel", [x - 0.3, 0, z - 0.3], [x + 0.3, cy, z + 0.3], "sentw");
      b.quad("mat_light_warm", [w / 2 - 2.5, cy - 0.01, cz1 - 0.8], [-w / 2 + 2.5, cy - 0.01, cz1 - 0.8], [-w / 2 + 2.5, cy - 0.01, cz1 - 2.2], [w / 2 - 2.5, cy - 0.01, cz1 - 2.2], { uv: "unit" });
      b.quad("mat_light_warm", [w / 2 - 2.5, cy - 0.01, cz0 + 0.8], [-w / 2 + 2.5, cy - 0.01, cz0 + 0.8], [-w / 2 + 2.5, cy - 0.01, cz0 + 2.2], [w / 2 - 2.5, cy - 0.01, cz0 + 2.2], { uv: "unit" });
      boxF(b, brand, [-w / 2 + 1, cy + 0.1, cz1], [w / 2 - 1, cy + 0.4, cz1 + 0.04], "n");
      collide(b, { x0: -w / 2 + 1, x1: w / 2 - 1, z0: cz0, z1: cz1 }, cy + 0.5, cy);
      // pumps on two islands
      for (const x of [-w / 4, 0, w / 4]) {
        boxF(b, "mat_wall_concrete_panel", [x - 1.0, 0, d / 2 - 5.5], [x + 1.0, 0.2, d / 2 - 3.5], "newt");
        boxF(b, "mat_metal_painted_dark", [x - 0.4, 0.2, d / 2 - 4.9], [x + 0.4, 1.7, d / 2 - 4.1], "newt");
        b.quad(SCREEN, [x + 0.3, 1.1, d / 2 - 4.09], [x - 0.3, 1.1, d / 2 - 4.09], [x - 0.3, 1.5, d / 2 - 4.09], [x + 0.3, 1.5, d / 2 - 4.09], { uv: "unit" });
      }
      frame(b, store, "n", (len) => {
        // lit storefront strip, door, freezer, ATM
        b.quad("mat_light_warm", [len / 2 - 1, 3.7, 0.03], [-len / 2 + 1, 3.7, 0.03], [-len / 2 + 1, 4.1, 0.03], [len / 2 - 1, 4.1, 0.03], { uv: "unit" });
        door(b, 0, 2.4, 2.6, brand);
        boxF(b, "mat_metal_galvanized", [len / 2 - 5, 0, 0], [len / 2 - 3, 1.9, 0.8], "newt");
        boxF(b, "mat_metal_painted_dark", [-len / 2 + 2, 0, 0], [-len / 2 + 3.2, 1.7, 0.6], "newt");
        b.quad(SCREEN, [-len / 2 + 3.0, 1.0, 0.61], [-len / 2 + 2.2, 1.0, 0.61], [-len / 2 + 2.2, 1.5, 0.61], [-len / 2 + 3.0, 1.5, 0.61], { uv: "unit" });
        at(b, 0, g + 0.1, 0, () => signs.wallSign(b, r, { w: Math.min(10, len * 0.5), h: 1.1, color: brand, style: "neon", text: r.pick(["24H", "OPEN", "MART"]) }));
        at(b, len / 2 - 0.6, 4.2, 0, () => signs.bladeSign(b, r, { w: 0.8, h: 2.0, proj: 0.28, color: brand }));
        for (let i = 0; i < 3; i++) ac(b, r.range(-len / 2 + 2, len / 2 - 2), g + 1.0 + (floors > 1 ? r.int(0, floors - 2) * FLOOR_H : 0), 0.8);
      });
      at(b, 0, cy + 0.5, cz1 - 0.4, () => signs.roofSign(b, r, { w: 7, h: 2.2, color: brand, style: "corp" }));
      hvac(b, -w / 4, H, -d / 6, 2.8, 1.2, 2);
      hvac(b, w / 4, H, -d / 6, 2.8, 1.2, 2);
      antenna(b, w / 3, H, -d / 3, 5);
      dish(b, -w / 3, H, -d / 4, r.range(0, TAU), 1.0);
      light(b, "store", [0, 3, store.z1 + 1], "#ffd9a0", 1, 16);
      light(b, "canopy", [0, cy - 0.3, d / 2 - 3], "#ffd9a0", 1, 16);
      light(b, "sign", [0, cy + 2, cz1], "#39ff6a", 0.7, 16);
    },
  },
  // ------------------------------------------------------------------------------------------
  {
    ...base,
    id: "bld_com_market_hall",
    tags: ["building", "zone:commercial"],
    lot: { w: [21, 42], d: [21, 42], floors: [1, 2] },
    params: { w: 27, d: 30, floors: 1 },
    variants: [
      { suffix: "_wide", seed: 14, params: { w: 42, d: 27, floors: 2 } },
      { suffix: "_b", seed: 25, params: { w: 21, d: 24, floors: 1 } },
    ],
    build(b, r, { w, d, floors }) {
      b.ao = BUILDING_AO;
      const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
      const sp = heightOf(floors, true); // springing height of the vault
      const rise = Math.min(w * 0.22, 6);
      const t = paint(r);
      const o = (u = 0) => ({ uOff: u, tint: t });
      // side and back walls up to the springing line, floor
      b.quad("mat_ground_sidewalk_tiles", [x0, 0.03, z0], [x1, 0.03, z0], [x1, 0.03, z1], [x0, 0.03, z1], {});
      b.wall("mat_wall_concrete_dark", [x1, z0], [x1, z1], 0, sp, o(0));
      b.wall("mat_wall_concrete_dark", [x0, z1], [x0, z0], 0, sp, o(BAY_W));
      b.wall("mat_wall_brick_dirty", [x0, z0], [x1, z0], 0, sp, o(0));
      // inner faces (dark) so the interior reads from the open front
      b.wall("mat_wall_concrete_dark", [x1, z1], [x1, z0], 0, sp, { tint: [0.5, 0.5, 0.55] });
      b.wall("mat_wall_concrete_dark", [x0, z0], [x0, z1], 0, sp, { tint: [0.5, 0.5, 0.55] });
      b.wall("mat_wall_concrete_dark", [x1, z0], [x0, z0], 0, sp, { tint: [0.5, 0.5, 0.55] });
      // barrel vault: arch rings joined by quads
      const n = 12;
      const ring = (z) => {
        const pts = [];
        for (let i = 0; i <= n; i++) {
          const a = Math.PI - (i / n) * Math.PI;
          pts.push([Math.cos(a) * (w / 2), sp + Math.sin(a) * rise, z]);
        }
        return pts;
      };
      b.loft("mat_wall_metal_cladding", [ring(z0), ring(z1)], { tint: [0.9, 0.95, 1.0] });
      // gables: back one solid, front one glazed with a neon arch
      const fan = (z, mat, dir) => {
        const P = [[0, sp, z]], N = [[0, 0, dir]], UV = [[0, 0]], idx = [];
        for (let i = 0; i <= n; i++) {
          const a = Math.PI - (i / n) * Math.PI;
          P.push([Math.cos(a) * (w / 2), sp + Math.sin(a) * rise, z]);
          N.push([0, 0, dir]);
          UV.push([Math.cos(a) * (w / 2), -(sp + Math.sin(a) * rise)]);
        }
        for (let i = 1; i <= n; i++) idx.push([0, i, i + 1]);
        b.mesh(mat, P, N, UV, idx, { tint: t });
      };
      fan(z0, "mat_wall_metal_cladding", -1);
      fan(z1, "mat_facade_curtainwall", 1);
      const arch = ring(z1 + 0.05).map((p) => [p[0] * 0.98, p[1] + 0.05, p[2]]);
      b.tube(r.pick(["mat_neon_magenta", "mat_neon_cyan"]), { pts: arch, r: 0.07, seg: 3, cap: false });
      // front: beam + columns
      boxF(b, "mat_metal_painted_dark", [x0, sp - 0.6, z1 - 0.4], [x1, sp, z1], "newt");
      for (let x = x0 + 3; x < x1; x += 6) boxF(b, "mat_metal_painted_dark", [x - 0.25, 0, z1 - 0.7], [x + 0.25, sp - 0.6, z1 - 0.2], "sentw");
      // trusses across the hall
      for (let z = z0 + 5; z < z1 - 3; z += 8) boxF(b, "mat_metal_painted_dark", [x0, sp - 0.4, z], [x1, sp, z + 0.3], "sntb");
      // market stalls inside
      const rows = Math.max(2, Math.floor((d - 8) / 6));
      for (let i = 0; i < rows && tris(b) < 1100; i++) {
        for (const side of [-1, 1]) {
          const z = z0 + 5 + i * 6, x = side * (w / 2 - 3.2);
          boxF(b, WOOD, [x - 1.6, 0, z - 0.9], [x + 1.6, 1.0, z + 0.9], "sentw");
          awning(b, 0, 2.4, 3.2, 0.0, r.pick(FABRIC), 0.4);
          b.with({ pos: [x, 0, z + 0.9] }, () => awning(b, 0, 2.4, 3.2, 0.9, r.pick(FABRIC), 0.5));
          b.quad("mat_light_warm", [x + 1.2, 2.2, z + 0.7], [x - 1.2, 2.2, z + 0.7], [x - 1.2, 2.3, z + 0.7], [x + 1.2, 2.3, z + 0.7], { double: true });
        }
      }
      // roof ridge lights and vents
      b.quad("mat_light_warm", [0.4, sp + rise + 0.02, z0 + 1], [-0.4, sp + rise + 0.02, z0 + 1], [-0.4, sp + rise + 0.02, z1 - 1], [0.4, sp + rise + 0.02, z1 - 1], { uv: "unit" });
      for (let z = z0 + 4; z < z1 - 3; z += 8) hvac(b, 0, sp + rise - 0.1, z, 1.6, 0.9, 1.6);
      collide(b, { x0, x1, z0, z1 }, sp + rise);
      frame(b, { x0, x1, z0, z1 }, "n", (len) => {
        at(b, 0, sp + 0.6, 0.05, () => signs.wallSign(b, r, { w: Math.min(12, len * 0.5), h: 1.5, style: "neon", text: r.pick(["MARKET", "BAZAAR", "FOOD HALL"]) }));
        at(b, len / 2 - 0.5, sp - 1.0, 0, () => blade(b, r, { w: 0.8, h: 2.2, proj: 0.28 }));
        at(b, -len / 2 + 0.5, sp - 1.0, 0, () => blade(b, r, { w: 0.8, h: 2.2, proj: 0.28 }));
      });
      antenna(b, w / 3, sp + rise * 0.55, -d / 4, 4);
      light(b, "hall", [0, sp - 1, 0], "#ffd9a0", 1.2, 20);
      light(b, "arch", [0, sp + rise, z1], "#ff2bd6", 0.7, 14);
    },
  },
];
