// Alley clutter, road barriers and plaza pieces. Origin = ground, front = +Z.
// Wall-mounted pieces (pipes, AC units, fire escape, drain pipes) have their back at z = 0.
import { TAU } from "../lib/math.mjs";
import { strut, disc, halo, pole, cylX, cylZ, panelZ, panelX, panelY } from "../lib/props_util.mjs";

const DARK = "mat_metal_painted_dark";
const GALV = "mat_metal_galvanized";
const RUST = "mat_metal_rust";
const WOOD = "mat_prop_wood";
const CONC = "mat_wall_concrete_panel";

export const assets = [
  // ================================================================ alley
  {
    id: "prop_dumpster_a",
    category: "prop",
    tags: ["alley"],
    budget: 300,
    build(b, r) {
      b.ao = { y0: 0, y1: 0.6, lo: 0.55, hi: 1 };
      const G = "mat_prop_paint_green";
      // tapered tub: narrower at the bottom
      b.loft(G, [[[-0.78, 0.22, -0.4], [0.78, 0.22, -0.4], [0.78, 0.22, 0.4], [-0.78, 0.22, 0.4]], [[-0.92, 1.1, -0.5], [0.92, 1.1, -0.5], [0.92, 1.1, 0.5], [-0.92, 1.1, 0.5]]], { capStart: true });
      for (const x of [-0.5, 0, 0.5]) b.box(DARK, [x - 0.03, 0.25, 0.37], [x + 0.03, 1.05, 0.52], { skip: ["b"] }); // ribs, front
      b.box(DARK, [-0.95, 1.08, -0.52], [0.95, 1.14, 0.52], { skip: ["b", "t"] }); // rim
      // two lids, one propped open
      b.box(DARK, [-0.93, 1.14, -0.5], [0.0, 1.2, 0.5], { skip: ["b"] });
      b.with({ pos: [0.93, 1.14, -0.5], rot: [0, 0, 0.9] }, () => b.box(DARK, [-0.93, 0, 0], [0, 0.06, 1.0], { skip: ["b"] }));
      // rust and grime patches, wheels, fork pockets
      b.box(RUST, [0.2, 0.3, 0.5], [0.8, 0.5, 0.53], { skip: ["b", "s", "e", "w"].concat(["t"]) });
      for (const [x, z] of [[-0.75, -0.4], [0.75, -0.4], [-0.75, 0.4], [0.75, 0.4]]) b.box("mat_prop_rubber", [x - 0.05, 0, z - 0.04], [x + 0.05, 0.2, z + 0.04], { skip: ["b"] });
      b.box(DARK, [-0.95, 0.4, -0.12], [-0.9, 0.6, 0.12], { skip: ["b"] });
      b.collider({ c: [0, 0.6, 0], h: [0.95, 0.6, 0.52] });
    },
  },
  {
    id: "prop_crates_a",
    category: "prop",
    tags: ["alley"],
    budget: 300,
    build(b, r) {
      b.ao = { y0: 0, y1: 0.5, lo: 0.55, hi: 1 };
      const crate = (x, y, z, s, rot) =>
        b.with({ pos: [x, y, z], rotY: rot }, () => {
          b.box(WOOD, [-s / 2, 0, -s / 2], [s / 2, s, s / 2], { skip: ["b"] });
          for (const yy of [0.1 * s, 0.8 * s]) b.box("mat_prop_paint_yellow", [-s / 2 - 0.01, yy, -s / 2 - 0.01], [s / 2 + 0.01, yy + 0.1 * s, s / 2 + 0.01], { skip: ["b", "t"] });
        });
      crate(-0.5, 0, 0, 0.7, r.range(-0.15, 0.15));
      crate(0.35, 0, 0.1, 0.6, r.range(-0.3, 0.3));
      crate(-0.4, 0.7, 0.02, 0.6, r.range(-0.2, 0.2));
      crate(0.3, 0.6, 0.12, 0.5, r.range(-0.4, 0.4));
      crate(0.05, 0, 0.75, 0.45, r.range(-0.5, 0.5));
      b.collider({ c: [-0.1, 0.65, 0.1], h: [0.85, 0.65, 0.55] });
    },
  },
  {
    id: "prop_barrels_a",
    category: "prop",
    tags: ["alley"],
    budget: 300,
    build(b, r) {
      b.ao = { y0: 0, y1: 0.5, lo: 0.55, hi: 1 };
      const mats = ["mat_prop_paint_red", RUST, "mat_prop_paint_green", GALV];
      const barrel = (x, z, i, glow) => {
        const m = mats[i % mats.length];
        b.cylinder(m, { x, z, y0: 0, y1: 0.9, r: 0.27, r1: 0.27, seg: 8, cap: "top" });
        for (const y of [0.14, 0.62]) b.lathe(DARK, [[0.282, y], [0.282, y + 0.08]], { x, z, seg: 8 });
        if (glow) b.cylinder("mat_neon_green", { x, z, y0: 0.9, y1: 0.905, r: 0.2, seg: 8, cap: "top" });
      };
      barrel(-0.35, 0, 0, false);
      barrel(0.3, 0.05, 1, false);
      barrel(-0.05, 0.62, 2, true);
      b.with({ pos: [0.75, 0.27, 0.75], rot: [Math.PI / 2, 0, 0], rotY: 0.3 }, () => b.cylinder(RUST, { x: 0, z: 0, y0: -0.45, y1: 0.45, r: 0.27, seg: 8, cap: "both" }));
      b.collider({ c: [0.15, 0.45, 0.3], h: [0.95, 0.45, 0.7] });
      b.anchor("light.glow", [-0.05, 1.0, 0.62], { color: "#39ff6a", intensity: 0.4, range: 4 });
    },
  },
  {
    id: "prop_pipes_a",
    category: "prop",
    tags: ["alley"],
    budget: 400,
    build(b) {
      b.ao = { y0: 0, y1: 1.0, lo: 0.7, hi: 1 };
      const Z = 0.12;
      cylX(b, GALV, -1.5, 1.5, 2.3, Z, 0.07, 0.07, 6);
      cylX(b, RUST, -1.5, 0.6, 2.62, Z, 0.045, 0.045, 5);
      cylX(b, DARK, -1.5, 1.5, 1.9, Z, 0.05, 0.05, 5);
      // down-turn with elbow
      b.sphere(GALV, { c: [1.5, 2.3, Z], r: 0.085, seg: 6, rings: 3 });
      b.cylinder(GALV, { x: 1.5, z: Z, y0: 0.1, y1: 2.3, r: 0.07, seg: 6, cap: "bottom" });
      // brackets
      for (const x of [-1.2, -0.4, 0.4, 1.2]) {
        b.box(DARK, [x - 0.03, 1.85, -0.0], [x + 0.03, 2.38, 0.06], { skip: ["b"] });
      }
      // flanges, valve wheel
      for (const x of [-0.8, 0.8]) b.box(DARK, [x - 0.04, 2.22, Z - 0.1], [x + 0.04, 2.38, Z + 0.1], { skip: ["b"] });
      b.box(DARK, [-0.03, 2.37, Z - 0.03], [0.03, 2.55, Z + 0.03], { skip: ["b"] });
      b.with({ pos: [0, 2.58, Z], rot: [0, 0, 0] }, () => b.lathe("mat_prop_paint_red", [[0.13, 0], [0.13, 0.03]], { seg: 8 }));
      // glowing gauge
      disc(b, "mat_neon_amber", [-1.0, 2.0, Z + 0.06], 0.045, [0, 0, 1], 6);
      b.collider({ c: [0, 2.2, 0.12], h: [1.55, 0.5, 0.15] }, "soft");
    },
  },
  {
    id: "prop_acunits_a",
    category: "prop",
    tags: ["alley"],
    budget: 400,
    build(b, r) {
      b.ao = { y0: 1.0, y1: 3.0, lo: 0.7, hi: 1 };
      const unit = (x, y, w, h, z0 = 0.2) => {
        b.box(GALV, [x - w / 2, y, z0], [x + w / 2, y + h, z0 + 0.38], { skip: ["b"] });
        disc(b, DARK, [x - w * 0.12, y + h / 2, z0 + 0.385], Math.min(w, h) * 0.38, [0, 0, 1], 8);
        disc(b, "mat_prop_rubber", [x - w * 0.12, y + h / 2, z0 + 0.39], Math.min(w, h) * 0.12, [0, 0, 1], 6);
        for (let i = 0; i < 4; i++) b.box(DARK, [x + w * 0.28, y + 0.08 + i * (h - 0.2) / 4, z0 + 0.38], [x + w * 0.46, y + 0.1 + i * (h - 0.2) / 4, z0 + 0.4], { skip: ["b"] });
        strut(b, DARK, [x - w * 0.4, y, z0], [x - w * 0.4, y - 0.25, 0], 0.04, 0.03);
        strut(b, DARK, [x + w * 0.4, y, z0], [x + w * 0.4, y - 0.25, 0], 0.04, 0.03);
      };
      unit(-0.7, 2.2, 0.9, 0.62);
      unit(0.45, 2.0, 0.8, 0.58);
      unit(-0.05, 1.3, 0.85, 0.6);
      b.tube(DARK, { pts: [[0.7, 2.25, 0.2], [0.9, 2.1, 0.12], [0.9, 1.0, 0.1], [0.9, 0.0, 0.1]], r: 0.03, seg: 4 });
      b.tube(RUST, { pts: [[-0.3, 1.4, 0.3], [-0.2, 0.9, 0.35], [0.1, 0.0, 0.3]], r: 0.025, seg: 3 });
      b.collider({ c: [0, 1.9, 0.35], h: [1.15, 0.9, 0.3] }, "soft");
    },
  },
  {
    id: "prop_trashbags_a",
    category: "prop",
    tags: ["alley"],
    budget: 300,
    build(b, r) {
      b.ao = { y0: 0, y1: 0.5, lo: 0.6, hi: 1 };
      const bag = (x, y, z, s) => {
        b.sphere("mat_prop_bag", { c: [x, y + 0.2 * s, z], r: [0.32 * s, 0.24 * s, 0.28 * s], seg: 6, rings: 4 });
        b.cylinder("mat_prop_bag", { x, z, y0: y + 0.4 * s, y1: y + 0.55 * s, r: 0.06 * s, r1: 0.02 * s, seg: 4, cap: "top" });
      };
      bag(-0.45, 0, 0, 1.1);
      bag(0.25, 0, 0.1, 1.0);
      bag(-0.1, 0, 0.55, 0.9);
      bag(-0.2, 0.35, 0.05, 0.9);
      bag(0.55, 0, 0.6, 0.8);
      bag(0.05, 0, -0.4, 0.8);
      b.collider({ c: [0.05, 0.3, 0.1], h: [0.8, 0.3, 0.8] }, "soft");
    },
  },
  {
    id: "prop_pallets_a",
    category: "prop",
    tags: ["alley"],
    budget: 400,
    build(b, r) {
      b.ao = { y0: 0, y1: 0.4, lo: 0.55, hi: 1 };
      const pallet = (y, rot, dx = 0, dz = 0) =>
        b.with({ pos: [dx, y, dz], rotY: rot }, () => {
          for (const x of [-0.5, 0, 0.5]) b.box(WOOD, [x - 0.05, 0, -0.55], [x + 0.05, 0.1, 0.55], { skip: ["b"] }); // stringers along z
          for (const z of [-0.5, 0, 0.5]) b.box(WOOD, [-0.6, 0.1, z - 0.07], [0.6, 0.13, z + 0.07], { skip: ["b"] });
        });
      pallet(0, r.range(-0.1, 0.1));
      pallet(0.13, r.range(-0.2, 0.2), 0.05, 0);
      pallet(0.26, r.range(-0.3, 0.3), -0.05, 0.03);
      // one leaning on the wall
      b.with({ pos: [1.35, 0.55, 0.05], rot: [0, 0, 0] }, () => {
        b.box(WOOD, [-0.05, -0.55, -0.55], [0.05, 0.55, -0.45], { skip: ["b"] });
        b.box(WOOD, [-0.05, -0.55, 0.45], [0.05, 0.55, 0.55], { skip: ["b"] });
        for (const y of [-0.4, 0, 0.4]) b.box(WOOD, [-0.08, y - 0.07, -0.6], [0.0, y + 0.07, 0.6], { skip: ["b"] });
      });
      b.collider({ c: [0.55, 0.3, 0.05], h: [0.95, 0.3, 0.6] }, "soft");
    },
  },
  {
    id: "prop_drainpipes_a",
    category: "prop",
    tags: ["alley"],
    budget: 300,
    build(b) {
      b.ao = { y0: 0, y1: 1.2, lo: 0.65, hi: 1 };
      const pipe = (x, h) => {
        b.cylinder(GALV, { x, z: 0.08, y0: 0.15, y1: h, r: 0.055, seg: 6, cap: "top" });
        for (const y of [0.5, 1.6, 2.8, 3.9].filter((y) => y < h - 0.2)) b.box(DARK, [x - 0.07, y, 0.0], [x + 0.07, y + 0.06, 0.1], { skip: ["b"] });
        // elbow toward the ground
        b.tube(GALV, { pts: [[x, 0.3, 0.08], [x, 0.18, 0.12], [x + 0.1, 0.1, 0.2], [x + 0.3, 0.08, 0.3]], r: 0.055, seg: 6 });
      };
      pipe(-0.5, 4.6);
      pipe(0.35, 4.2);
      // hopper at the top of the tall pipe
      b.loft(GALV, [[[-0.7, 4.25, 0.0], [-0.3, 4.25, 0.0], [-0.3, 4.25, 0.3], [-0.7, 4.25, 0.3]], [[-0.8, 4.65, 0.0], [-0.2, 4.65, 0.0], [-0.2, 4.65, 0.4], [-0.8, 4.65, 0.4]]], {});
      b.box(RUST, [-0.1, 2.0, 0.0], [0.7, 2.4, 0.18], { skip: ["b"] }); // junction box
      panelZ(b, "mat_neon_red", 0.3, 2.3, 0.185, 0.07, 0.04);
      b.collider({ c: [-0.1, 2.3, 0.1], h: [0.7, 2.3, 0.12] }, "soft");
    },
  },
  {
    id: "prop_fireescape_a",
    category: "prop",
    tags: ["alley"],
    budget: 500,
    build(b) {
      b.ao = { y0: 0, y1: 3, lo: 0.65, hi: 1 };
      const Y = 3.2;
      // landing 2.6 x 1.1 on brackets
      b.box(RUST, [-1.3, Y - 0.06, 0.0], [1.3, Y, 1.1], { skip: ["b"] });
      for (let i = 0; i < 6; i++) b.box(DARK, [-1.25 + i * 0.5, Y - 0.05, 0.02], [-1.22 + i * 0.5, Y + 0.005, 1.08], { skip: ["b"] }); // grate bars
      for (const x of [-1.1, 1.1]) strut(b, RUST, [x, Y - 0.06, 0.9], [x, Y - 0.9, 0.0], 0.06, 0.05);
      // railing
      for (const [x, z] of [[-1.3, 1.1], [-0.43, 1.1], [0.43, 1.1], [1.3, 1.1], [-1.3, 0.45], [1.3, 0.45]]) b.box(RUST, [x - 0.025, Y, z - 0.025], [x + 0.025, Y + 1.05, z + 0.025], { skip: ["b"] });
      b.box(RUST, [-1.3, Y + 1.0, 1.08], [1.3, Y + 1.06, 1.12], { skip: ["b"] });
      b.box(RUST, [-1.3, Y + 0.5, 1.08], [1.3, Y + 0.54, 1.12], { skip: ["b"] });
      b.box(RUST, [-1.3, Y + 1.0, 0.0], [-1.26, Y + 1.06, 1.12], { skip: ["b"] });
      b.box(RUST, [1.26, Y + 1.0, 0.0], [1.3, Y + 1.06, 1.12], { skip: ["b"] });
      // drop ladder: two rails and rungs
      const x0 = -0.9, x1 = -0.5;
      strut(b, RUST, [x0, Y + 0.02, 1.05], [x0, 0.9, 1.25], 0.04, 0.03);
      strut(b, RUST, [x1, Y + 0.02, 1.05], [x1, 0.9, 1.25], 0.04, 0.03);
      for (let i = 0; i < 8; i++) {
        const t = i / 7;
        b.box(RUST, [x0, Y - 0.2 - t * (Y - 1.3), 1.05 + t * 0.18], [x1, Y - 0.17 - t * (Y - 1.3), 1.1 + t * 0.18], { skip: ["b"] });
      }
      // ladder opening hatch and wall anchor plates
      for (const x of [-1.0, 0.0, 1.0]) b.box(DARK, [x - 0.08, Y - 0.15, 0.0], [x + 0.08, Y + 0.05, 0.05], { skip: ["b"] });
      b.collider({ c: [0, Y - 0.03, 0.55], h: [1.3, 0.03, 0.55] }, "platform");
    },
  },
  {
    id: "prop_steamvent_a",
    category: "prop",
    tags: ["alley"],
    budget: 200,
    build(b) {
      b.ao = { y0: 0, y1: 0.3, lo: 0.6, hi: 1 };
      b.cylinder("mat_metal_plate_worn", { x: 0, z: 0, y0: 0, y1: 0.06, r: 0.55, seg: 10, cap: "top" });
      for (let i = -2; i <= 2; i++) b.box(DARK, [-0.4, 0.06, i * 0.15 - 0.03], [0.4, 0.08, i * 0.15 + 0.03], { skip: ["b"] });
      for (let i = -2; i <= 2; i++) b.box("mat_neon_amber", [-0.38, 0.055, i * 0.15 - 0.065], [0.38, 0.06, i * 0.15 - 0.035], { skip: ["b"] });
      // little stack with a cap
      b.cylinder(RUST, { x: 0.8, z: 0.2, y0: 0, y1: 1.2, r: 0.12, seg: 6, cap: "none" });
      b.lathe(DARK, [[0.12, 1.2], [0.2, 1.3], [0.0, 1.42]], { x: 0.8, z: 0.2, seg: 6 });
      b.collider({ c: [0.8, 0.7, 0.2], h: [0.13, 0.7, 0.13] });
      b.anchor("light.vent", [0, 0.1, 0], { color: "#ffb000", intensity: 0.5, range: 4 });
    },
  },

  // ================================================================ barriers
  {
    id: "prop_barrier_jersey_a",
    category: "prop",
    tags: ["barrier"],
    budget: 200,
    variants: [{ suffix: "" }, { suffix: "_lit", seed: 4, params: { lit: true } }],
    build(b, r, { lit = false } = {}) {
      b.ao = { y0: 0, y1: 0.5, lo: 0.65, hi: 1 };
      const prof = [[-0.3, 0], [0.3, 0], [0.3, 0.1], [0.12, 0.42], [0.075, 0.8], [-0.075, 0.8], [-0.12, 0.42], [-0.3, 0.1]];
      const ring = (z) => prof.map(([x, y]) => [x, y, z]);
      b.loft(CONC, [ring(-1.2), ring(1.2)], { capStart: true, capEnd: true });
      // reflective chevrons on the road-facing side
      for (const x of [-0.8, 0.0, 0.8]) b.box("mat_prop_paint_orange", [-0.09, 0.45, x - 0.15], [0.09, 0.7, x + 0.15], { skip: ["b", "t", "w", "e"] });
      b.box(CONC, [-0.13, 0.8, -1.1], [0.13, 0.84, -0.9], { skip: ["b"] }); // lifting loop plate
      if (lit) {
        b.box(DARK, [-0.04, 0.8, -0.04], [0.04, 0.88, 0.04], { skip: ["b"] });
        b.sphere("mat_neon_amber", { c: [0, 0.95, 0], r: 0.08, seg: 6, rings: 3 });
        b.anchor("light.blinker", [0, 0.95, 0], { color: "#ffb000", intensity: 0.4, range: 4 });
      }
      b.collider({ c: [0, 0.4, 0], h: [0.3, 0.4, 1.2] });
    },
  },
  {
    id: "prop_fence_chainlink_a",
    category: "prop",
    tags: ["barrier"],
    budget: 400,
    build(b) {
      b.ao = { y0: 0, y1: 0.5, lo: 0.7, hi: 1 };
      for (const x of [-1.5, 1.5]) b.cylinder(GALV, { x, z: 0, y0: 0, y1: 2.0, r: 0.045, seg: 6, cap: "top" });
      cylX(b, GALV, -1.5, 1.5, 1.96, 0, 0.025, 0.025, 5);
      cylX(b, GALV, -1.5, 1.5, 0.08, 0, 0.02, 0.02, 4, "both");
      // wire diamonds as two families of diagonals
      const n = 7;
      for (let i = 0; i < n; i++) {
        const x0 = -1.5 + (3 / n) * i, x1 = x0 + 3 / n;
        strut(b, GALV, [x0 + 0.03, 0.1, 0.0], [Math.min(x1, 1.47), 1.94, 0.0], 0.012, 0.012, { caps: false });
        strut(b, GALV, [x1 - 0.03, 0.1, 0.0], [Math.max(x0, -1.47), 1.94, 0.0], 0.012, 0.012, { caps: false });
      }
      // barbed-wire arm on top
      strut(b, GALV, [-1.5, 2.0, 0.0], [-1.5, 2.25, 0.2], 0.03, 0.03);
      strut(b, GALV, [1.5, 2.0, 0.0], [1.5, 2.25, 0.2], 0.03, 0.03);
      cylX(b, DARK, -1.5, 1.5, 2.25, 0.2, 0.012, 0.012, 3, "both");
      // a torn corner sign
      panelZ(b, "mat_neon_red", 0.4, 1.4, 0.015, 0.5, 0.3);
      panelZ(b, "mat_neon_red", 0.4, 1.4, -0.015, 0.5, 0.3, true);
      b.collider({ c: [0, 1.0, 0], h: [1.5, 1.0, 0.05] });
    },
  },
  {
    id: "prop_cone_a",
    category: "prop",
    tags: ["barrier"],
    budget: 200,
    build(b) {
      b.ao = { y0: 0, y1: 0.2, lo: 0.7, hi: 1 };
      b.box(DARK, [-0.18, 0, -0.18], [0.18, 0.03, 0.18], { skip: ["b"] });
      b.lathe("mat_prop_paint_orange", [[0.13, 0.03], [0.04, 0.68], [0.03, 0.7]], { seg: 8 });
      b.lathe("mat_road_marking_white", [[0.1, 0.27], [0.085, 0.37], [0.1, 0.27]].slice(0, 2), { seg: 8, crease: 100 });
      b.lathe("mat_road_marking_white", [[0.075, 0.46], [0.062, 0.54]], { seg: 8, crease: 100 });
      b.collider({ c: [0, 0.35, 0], h: [0.15, 0.35, 0.15] }, "soft");
    },
  },
  {
    id: "prop_barrier_police_a",
    category: "prop",
    tags: ["barrier"],
    budget: 400,
    build(b) {
      b.ao = { y0: 0, y1: 0.5, lo: 0.65, hi: 1 };
      // A-frame legs
      for (const x of [-0.95, 0.95]) {
        strut(b, DARK, [x, 1.0, -0.02], [x, 0.0, -0.45], 0.06, 0.05);
        strut(b, DARK, [x, 1.0, 0.02], [x, 0.0, 0.45], 0.06, 0.05);
      }
      // striped board
      b.box("mat_road_marking_white", [-1.1, 0.62, -0.03], [1.1, 1.0, 0.03], { skip: ["b"] });
      for (let i = 0; i < 5; i++) {
        const x = -1.0 + i * 0.4;
        b.quad("mat_prop_paint_orange", [x + 0.2, 0.62, 0.035], [x, 0.62, 0.035], [x + 0.1, 1.0, 0.035], [x + 0.3, 1.0, 0.035], { uv: "unit" });
        b.quad("mat_prop_paint_orange", [x, 0.62, -0.035], [x + 0.2, 0.62, -0.035], [x + 0.3, 1.0, -0.035], [x + 0.1, 1.0, -0.035], { uv: "unit" });
      }
      b.box(DARK, [-1.12, 0.6, -0.04], [1.12, 0.64, 0.04], { skip: ["b"] });
      b.box(DARK, [-1.12, 0.98, -0.04], [1.12, 1.02, 0.04], { skip: ["b"] });
      // twin amber beacons and a neon strip
      for (const x of [-0.8, 0.8]) {
        b.cylinder(DARK, { x, z: 0, y0: 1.02, y1: 1.1, r: 0.06, seg: 6, cap: "top" });
        b.sphere("mat_neon_amber", { c: [x, 1.16, 0], r: 0.09, seg: 6, rings: 3 });
        b.anchor(`light.beacon${x > 0 ? "R" : "L"}`, [x, 1.16, 0], { color: "#ffb000", intensity: 0.5, range: 5 });
      }
      panelZ(b, "mat_neon_red", 0, 0.45, 0.0, 1.2, 0.05, false, { double: true });
      b.collider({ c: [0, 0.5, 0], h: [1.1, 0.5, 0.45] }, "soft");
    },
  },
  {
    id: "prop_hoarding_a",
    category: "prop",
    tags: ["barrier"],
    budget: 600,
    build(b, r) {
      b.ao = { y0: 0, y1: 1.0, lo: 0.65, hi: 1 };
      const OR = "mat_prop_paint_orange";
      // plywood panel wall with posts
      b.box(WOOD, [-1.5, 0.05, 0.0], [1.5, 2.4, 0.07], { skip: ["b"] });
      for (let i = 0; i < 3; i++) b.box(DARK, [-1.5 + i * 1.0 + 0.97, 0.05, 0.07], [-1.5 + i * 1.0 + 1.03, 2.4, 0.1], { skip: ["b"] });
      for (const x of [-1.5, 0, 1.5]) b.box(DARK, [x - 0.06, 0, -0.06], [x + 0.06, 2.6, 0.12], { skip: ["b"] });
      b.box(DARK, [-1.56, 2.4, -0.06], [1.56, 2.46, 0.14], { skip: ["b"] });
      // hazard band and lit warning plate
      for (let i = 0; i < 10; i++) {
        const x = -1.45 + i * 0.3;
        b.quad(i % 2 ? "mat_prop_rubber" : OR, [x + 0.3, 0.5, 0.075], [x, 0.5, 0.075], [x + 0.1, 0.8, 0.075], [x + 0.4, 0.8, 0.075], { uv: "unit" });
      }
      panelZ(b, "mat_neon_amber", 0.6, 1.7, 0.08, 0.8, 0.4);
      panelZ(b, "mat_neon_red", -0.7, 1.7, 0.08, 0.5, 0.18);
      // scaffold bay behind: standards, ledgers, a diagonal brace and a plank deck
      const zS = -0.9;
      for (const x of [-1.3, 1.3]) for (const z of [zS, -0.1]) b.cylinder(GALV, { x, z, y0: 0, y1: 3.0, r: 0.025, seg: 5, cap: "top" });
      for (const y of [0.4, 1.5, 2.6]) {
        cylX(b, GALV, -1.3, 1.3, y, zS, 0.022, 0.022, 4, "both");
        cylX(b, GALV, -1.3, 1.3, y, -0.1, 0.022, 0.022, 4, "both");
        for (const x of [-1.3, 1.3]) cylZ(b, GALV, x, y, zS, -0.1, 0.022, 0.022, 4, "both");
      }
      b.box(WOOD, [-1.35, 1.5, zS - 0.05], [1.35, 1.54, -0.05], { skip: ["b"] });
      strut(b, GALV, [-1.3, 0.4, zS], [1.3, 2.6, zS], 0.03, 0.025);
      // ladder up to the deck
      strut(b, GALV, [0.9, 0.0, -0.4], [0.9, 1.5, zS], 0.04, 0.03);
      strut(b, GALV, [1.15, 0.0, -0.4], [1.15, 1.5, zS], 0.04, 0.03);
      b.collider({ c: [0, 1.3, -0.4], h: [1.5, 1.3, 0.55] });
      b.anchor("light.warning", [0.6, 1.7, 0.4], { color: "#ffb000", intensity: 0.5, range: 5 });
    },
  },
  {
    id: "prop_barrier_gate_a",
    category: "prop",
    tags: ["barrier"],
    budget: 300,
    build(b) {
      b.ao = { y0: 0, y1: 0.8, lo: 0.65, hi: 1 };
      // post housing at x = -2, boom lying along +X, tip rest at x = +2.2
      b.box("mat_prop_paint_yellow", [-2.2, 0, -0.2], [-1.8, 1.0, 0.2], { skip: ["b"] });
      b.box(DARK, [-2.2, 1.0, -0.22], [-1.78, 1.06, 0.22], { skip: ["b"] });
      panelZ(b, "mat_neon_red", -2.0, 0.65, 0.205, 0.2, 0.08);
      panelZ(b, "mat_neon_green", -2.0, 0.45, 0.205, 0.2, 0.08);
      b.box(DARK, [-1.8, 0.88, -0.05], [-1.7, 0.96, 0.05], { skip: ["b"] });
      for (let i = 0; i < 8; i++) {
        const x = -1.7 + i * 0.5;
        b.box(i % 2 ? "mat_road_marking_white" : "mat_prop_paint_red", [x, 0.85, -0.04], [x + 0.5, 0.97, 0.04], { skip: ["b"] });
      }
      b.box(DARK, [2.1, 0, -0.1], [2.3, 0.85, 0.1], { skip: ["b"] });
      b.box(DARK, [2.05, 0.8, -0.12], [2.35, 0.86, 0.12], { skip: ["b"] });
      b.sphere("mat_neon_red", { c: [-2.0, 1.15, 0], r: 0.1, seg: 6, rings: 3 });
      b.collider({ c: [-2.0, 0.5, 0], h: [0.2, 0.5, 0.2] });
      b.collider({ c: [0.0, 0.91, 0], h: [1.95, 0.06, 0.05] });
      b.anchor("light.beacon", [-2.0, 1.15, 0], { color: "#ff2a3c", intensity: 0.4, range: 5 });
    },
  },

  // ================================================================ plaza
  {
    id: "prop_planter_box_a",
    category: "prop",
    tags: ["plaza"],
    budget: 300,
    build(b, r) {
      b.ao = { y0: 0, y1: 0.7, lo: 0.6, hi: 1 };
      b.box(CONC, [-1.2, 0, -0.35], [1.2, 0.65, 0.35], { skip: ["b", "t"] });
      b.box("mat_wall_concrete_dark", [-1.26, 0.65, -0.41], [1.26, 0.72, 0.41], { skip: ["b"] });
      b.poly("mat_wall_concrete_dark", [[-1.1, -0.28], [1.1, -0.28], [1.1, 0.28], [-1.1, 0.28]], 0.73);
      for (let i = 0; i < 5; i++) {
        const x = -0.95 + i * 0.475;
        b.sphere("mat_foliage_leaf", { c: [x, 0.95 + r.range(0, 0.15), r.range(-0.1, 0.1)], r: [0.3, 0.28 + r.range(0, 0.1), 0.28], seg: 6, rings: 3 });
      }
      b.box("mat_neon_green", [-1.15, 0.3, 0.35], [1.15, 0.33, 0.365], { skip: ["b"] });
      b.collider({ c: [0, 0.5, 0], h: [1.26, 0.5, 0.41] });
    },
  },
  {
    id: "prop_holokiosk_a",
    category: "prop",
    tags: ["plaza"],
    budget: 500,
    build(b) {
      b.ao = { y0: 0, y1: 0.8, lo: 0.6, hi: 1 };
      b.cylinder(DARK, { x: 0, z: 0, y0: 0, y1: 0.12, r: 0.55, r1: 0.5, seg: 8, cap: "top" });
      b.cylinder(DARK, { x: 0, z: 0, y0: 0.12, y1: 1.15, r: 0.38, r1: 0.34, seg: 8, cap: "none" });
      // emissive screen wrapping the front half
      b.lathe("mat_prop_screen_blue", [[0.372, 0.45], [0.352, 1.0]], { seg: 8, crease: 100 });
      b.lathe("mat_neon_cyan", [[0.352, 1.0], [0.352, 1.03]], { seg: 8, crease: 100 });
      b.lathe("mat_neon_magenta", [[0.375, 0.42], [0.375, 0.45]], { seg: 8, crease: 100 });
      b.lathe(DARK, [[0.34, 1.15], [0.42, 1.2], [0.4, 1.28], [0.1, 1.28]], { seg: 8 });
      // projector lens and hologram: stacked rings + a floating diamond
      b.cylinder("mat_neon_cyan", { x: 0, z: 0, y0: 1.28, y1: 1.3, r: 0.18, seg: 8, cap: "top" });
      halo(b, "mat_neon_cyan", 1.55, 0.3, 0.04, 10);
      halo(b, "mat_neon_cyan", 1.85, 0.4, 0.04, 10);
      halo(b, "mat_neon_cyan", 2.15, 0.3, 0.04, 10);
      b.sphere("mat_neon_magenta", { c: [0, 1.85, 0], r: [0.17, 0.3, 0.17], seg: 4, rings: 2 });
      b.collider({ c: [0, 0.65, 0], h: [0.55, 0.65, 0.55] });
      b.anchor("light.holo", [0, 1.85, 0], { color: "#00f0ff", intensity: 1.0, range: 9 });
    },
  },
  {
    id: "prop_monument_a",
    category: "prop",
    tags: ["plaza"],
    budget: 600,
    build(b) {
      b.ao = { y0: 0, y1: 1.0, lo: 0.6, hi: 1 };
      const S = "mat_wall_concrete_panel";
      b.box(S, [-1.2, 0, -1.2], [1.2, 0.3, 1.2], { skip: ["b"] });
      b.box(S, [-0.9, 0.3, -0.9], [0.9, 0.6, 0.9], { skip: ["b"] });
      b.box("mat_wall_concrete_dark", [-0.55, 0.6, -0.55], [0.55, 1.9, 0.55], { skip: ["b"] });
      b.box(S, [-0.65, 1.9, -0.65], [0.65, 2.0, 0.65], { skip: ["b"] });
      panelZ(b, "mat_neon_amber", 0, 1.1, 0.555, 0.6, 0.18);
      for (const x of [-0.2, 0, 0.2]) panelZ(b, "mat_neon_amber", x, 0.8, 0.555, 0.12, 0.03);
      // standing figure, abstract and angular, one arm raised holding a glowing orb
      const M = "mat_metal_plate_worn";
      b.loft(M, [[[-0.17, 2.0, -0.1], [0.17, 2.0, -0.1], [0.17, 2.0, 0.1], [-0.17, 2.0, 0.1]], [[-0.22, 2.8, -0.12], [0.22, 2.8, -0.12], [0.22, 2.8, 0.12], [-0.22, 2.8, 0.12]], [[-0.13, 3.3, -0.09], [0.13, 3.3, -0.09], [0.13, 3.3, 0.09], [-0.13, 3.3, 0.09]]], { capEnd: true });
      b.sphere(M, { c: [0, 3.5, 0], r: [0.12, 0.15, 0.13], seg: 6, rings: 4 });
      strut(b, M, [0.2, 3.2, 0], [0.55, 3.55, 0.05], 0.1, 0.09);
      strut(b, M, [0.55, 3.55, 0.05], [0.65, 4.0, 0.05], 0.09, 0.08);
      strut(b, M, [-0.2, 3.15, 0], [-0.3, 2.5, 0.1], 0.1, 0.09);
      b.sphere("mat_neon_cyan", { c: [0.65, 4.2, 0.05], r: 0.2, seg: 7, rings: 4 });
      b.collider({ c: [0, 1.0, 0], h: [1.2, 1.0, 1.2] });
      b.anchor("light.orb", [0.65, 4.2, 0.05], { color: "#00f0ff", intensity: 1.0, range: 12 });
    },
  },
  {
    id: "prop_lantern_post_a",
    category: "prop",
    tags: ["plaza"],
    budget: 300,
    build(b) {
      b.ao = { y0: 0, y1: 1.0, lo: 0.6, hi: 1 };
      b.cylinder(DARK, { x: 0, z: 0, y0: 0, y1: 0.4, r: 0.17, r1: 0.12, seg: 8, cap: "top" });
      b.cylinder(DARK, { x: 0, z: 0, y0: 0.4, y1: 3.2, r: 0.06, r1: 0.05, seg: 8, cap: "top" });
      b.lathe(DARK, [[0.12, 3.2], [0.2, 3.28], [0.16, 3.34]], { seg: 8 });
      b.sphere("mat_light_warm", { c: [0, 3.6, 0], r: [0.22, 0.26, 0.22], seg: 8, rings: 5 });
      b.lathe(DARK, [[0.26, 3.82], [0.1, 3.95], [0.02, 4.02]], { seg: 8 });
      halo(b, "mat_neon_magenta", 1.2, 0.09, 0.05, 8);
      b.collider({ c: [0, 2.0, 0], h: [0.15, 2.0, 0.15] });
      b.anchor("light.lamp", [0, 3.6, 0], { color: "#ffd9a0", intensity: 0.9, range: 12 });
    },
  },
];
