// Street furniture: street lights, traffic lights, utility poles and sidewalk props.
// Origin = ground, front = +Z. Lamp arms and mast arms extend toward +Z (over the road).
import { TAU } from "../lib/math.mjs";
import { strut, disc, halo, pole, cylX, cylZ, panelZ, panelX, panelY } from "../lib/props_util.mjs";

const DARK = "mat_metal_painted_dark";
const GALV = "mat_metal_galvanized";

/** Cobra-head luminaire from three rings, lens underneath. `y` = centre height of the head. */
function cobraHead(b, y, z0, z1, w, lens) {
  const ring = (zw, zy) => [
    [-zw, 0], [-zw * 0.7, 0.1 * zy], [zw * 0.7, 0.1 * zy], [zw, 0], [zw * 0.7, -0.07 * zy], [-zw * 0.7, -0.07 * zy],
  ];
  const zm = z0 + (z1 - z0) * 0.55;
  const mk = (z, hw, s) => ring(hw, s).map(([x, yy]) => [x, y + yy * 1.6, z]);
  b.loft(DARK, [mk(z0, w * 0.45, 0.8), mk(zm, w, 1.5), mk(z1, w * 0.55, 0.9)], { capStart: true, capEnd: true });
  // lens: slightly below the underside
  const lw = w * 0.62;
  panelY(b, lens, 0, y - 0.172, zm, lw * 2, 0.56);
}

export const assets = [
  // ---------------------------------------------------------------- streetlights
  {
    id: "prop_streetlight_a",
    category: "prop",
    tags: ["streetlight"],
    budget: 500,
    build(b) {
      b.ao = { y0: 0, y1: 1.6, lo: 0.55, hi: 1 };
      pole(b, DARK, 0, 0, 0, 0.8, 0.2, 0.15, 8);
      pole(b, DARK, 0, 0, 0.8, 7.5, 0.12, 0.07, 8);
      b.lathe(GALV, [[0.17, 0.8], [0.17, 0.88], [0.12, 0.95]], { seg: 8 }); // collar
      b.box(GALV, [-0.07, 0.3, 0.1], [0.07, 0.6, 0.15], { skip: ["b", "s", "n", "e", "w"].filter((f) => f !== "n") }); // hand-hole plate
      b.tube(DARK, { pts: [[0, 6.9, 0], [0, 7.45, 0.12], [0, 7.8, 0.65], [0, 7.88, 1.45]], r: 0.055, seg: 5 });
      cobraHead(b, 7.82, 1.2, 2.15, 0.2, "mat_light_warm");
      b.collider({ c: [0, 3.75, 0], h: [0.14, 3.75, 0.14] });
      b.anchor("light.lamp", [0, 7.7, 1.7], { color: "#ffb04a", intensity: 1, range: 18 });
    },
  },
  {
    id: "prop_streetlight_b",
    category: "prop",
    tags: ["streetlight"],
    budget: 500,
    build(b) {
      b.ao = { y0: 0, y1: 1.6, lo: 0.55, hi: 1 };
      b.box(DARK, [-0.26, 0, -0.26], [0.26, 0.9, 0.26], { skip: ["b"] });
      b.box(GALV, [-0.16, 0.25, 0.26], [0.16, 0.7, 0.29], { skip: ["b", "s", "e", "w", "t"] });
      pole(b, DARK, 0, 0, 0.9, 9.2, 0.17, 0.09, 8);
      // double arm: toward the road (+Z) and toward the sidewalk (-Z)
      for (const dir of [1, -1]) {
        strut(b, DARK, [0, 8.4, 0], [0, 9.15, 1.9 * dir], 0.1);
        b.boxC(DARK, [0, 9.14, 2.3 * dir], [0.42, 0.14, 0.95]);
        panelY(b, "mat_neon_white", 0, 9.065, 2.3 * dir, 0.34, 0.8);
      }
      // banner arm with a neon banner on the road side
      strut(b, DARK, [0, 6.2, 0.1], [0, 6.2, 0.75], 0.07);
      b.box("mat_metal_painted_dark", [-0.03, 3.7, 0.7], [0.03, 6.25, 0.78], { skip: ["b"] });
      panelZ(b, "mat_neon_magenta", 0, 4.95, 0.79, 0.8, 2.1, false, { double: true });
      // camera dome
      b.sphere("mat_metal_painted_dark", { c: [0, 5.0, 0.2], r: 0.15, seg: 6, rings: 3 });
      b.collider({ c: [0, 4.6, 0], h: [0.2, 4.6, 0.2] });
      b.anchor("light.lamp", [0, 8.95, 2.3], { color: "#e8f4ff", intensity: 1.2, range: 20 });
      b.anchor("light.lamp2", [0, 8.95, -2.3], { color: "#e8f4ff", intensity: 0.8, range: 14 });
    },
  },
  {
    id: "prop_streetlight_neon",
    category: "prop",
    tags: ["streetlight"],
    budget: 500,
    build(b) {
      b.ao = { y0: 0, y1: 1.5, lo: 0.55, hi: 1 };
      b.box(DARK, [-0.22, 0, -0.22], [0.22, 0.6, 0.22], { skip: ["b"] });
      b.box(DARK, [-0.11, 0.6, -0.11], [0.11, 7.4, 0.11], { skip: ["b"] });
      // vertical neon tubes on the front and back
      b.box("mat_neon_cyan", [-0.025, 1.4, 0.11], [0.025, 6.6, 0.16], { skip: ["b", "s"] });
      b.box("mat_neon_magenta", [-0.025, 1.4, -0.16], [0.025, 6.6, -0.11], { skip: ["b", "n"] });
      // halo rings
      halo(b, "mat_neon_magenta", 2.2, 0.34, 0.09, 10);
      halo(b, "mat_neon_cyan", 4.0, 0.34, 0.09, 10);
      halo(b, "mat_neon_magenta", 5.8, 0.34, 0.09, 10);
      // arm toward the road with a glowing LED bar
      strut(b, DARK, [0, 7.2, 0], [0, 7.55, 1.6], 0.09);
      b.boxC(DARK, [0, 7.55, 1.75], [0.3, 0.1, 1.1]);
      panelY(b, "mat_neon_cyan", 0, 7.495, 1.75, 0.22, 1.0);
      // saucer cap on top
      b.lathe(DARK, [[0.02, 7.65], [0.3, 7.5], [0.32, 7.4], [0.11, 7.4]], { seg: 8 });
      b.collider({ c: [0, 3.7, 0], h: [0.15, 3.7, 0.15] });
      b.anchor("light.lamp", [0, 7.4, 1.75], { color: "#00f0ff", intensity: 1.2, range: 16 });
      b.anchor("light.glow", [0, 4.0, 0.5], { color: "#ff2bd6", intensity: 0.5, range: 8 });
    },
  },

  // ---------------------------------------------------------------- traffic lights
  // Mast arm extends toward +Z over the road. The signal heads face +X (toward traffic that
  // approaches from +X); rotate the whole prop with rotY to aim them. `state` picks the lit lamp.
  {
    id: "prop_trafficlight_a",
    category: "prop",
    tags: ["trafficlight"],
    budget: 500,
    params: { state: "red" },
    variants: [
      { suffix: "" },
      { suffix: "_green", seed: 2, params: { state: "green" } },
      { suffix: "_amber", seed: 3, params: { state: "amber" } },
    ],
    build(b, r, { state = "red" } = {}) {
      b.ao = { y0: 0, y1: 1.5, lo: 0.55, hi: 1 };
      b.box(DARK, [-0.2, 0, -0.2], [0.2, 0.5, 0.2], { skip: ["b"] });
      pole(b, DARK, 0, 0, 0.5, 6.2, 0.14, 0.1, 8);
      b.tube(DARK, { pts: [[0, 5.5, 0], [0, 6.0, 0.15], [0, 6.2, 0.9], [0, 6.25, 3.4], [0, 6.25, 5.2]], r: 0.075, seg: 6 });
      signalHead(b, 0, 5.55, 4.7, state);
      signalHead(b, 0, 5.55, 2.4, state);
      // pedestrian signal on the pole
      b.box(DARK, [0.12, 2.5, -0.17], [0.46, 3.1, 0.17], { skip: ["b"] });
      disc(b, state === "red" ? "mat_neon_red" : "mat_neon_green", [0.465, 2.95, 0], 0.11, [1, 0, 0], 6);
      disc(b, "mat_prop_plastic", [0.465, 2.65, 0], 0.11, [1, 0, 0], 6);
      // push-button box
      b.box("mat_prop_paint_yellow", [0.12, 1.1, -0.08], [0.28, 1.4, 0.08], { skip: ["b"] });
      b.collider({ c: [0, 3.1, 0], h: [0.16, 3.1, 0.16] });
    },
  },
  {
    id: "prop_trafficlight_b",
    category: "prop",
    tags: ["trafficlight"],
    budget: 500,
    params: { state: "green" },
    variants: [{ suffix: "" }, { suffix: "_red", seed: 2, params: { state: "red" } }],
    build(b, r, { state = "green" } = {}) {
      b.ao = { y0: 0, y1: 1.5, lo: 0.55, hi: 1 };
      // square steel pole with a controller cabinet and a straight mast arm
      b.box(DARK, [-0.14, 0, -0.14], [0.14, 5.6, 0.14], { skip: ["b"] });
      b.box("mat_metal_galvanized", [-0.3, 0, 0.14], [0.3, 1.3, 0.5], { skip: ["b"] });
      b.box(DARK, [-0.25, 0.1, 0.5], [0.25, 1.2, 0.53], { skip: ["b", "s", "e", "w", "t"] });
      panelZ(b, "mat_prop_screen_blue", 0, 0.975, 0.535, 0.28, 0.15);
      strut(b, DARK, [0, 5.2, 0], [0, 5.75, 4.6], 0.12);
      strut(b, DARK, [0, 5.05, 0.1], [0, 5.5, 2.5], 0.07);
      signalHead(b, 0, 5.25, 4.3, state, true);
      signalHead(b, 0, 5.2, 1.9, state, true);
      // crossing-time countdown on the pole
      b.box(DARK, [0.14, 2.3, -0.15], [0.3, 2.9, 0.15], { skip: ["b"] });
      panelX(b, "mat_neon_amber", 0.305, 2.65, 0, 0.2, 0.3);
      b.collider({ c: [0, 2.8, 0.1], h: [0.3, 2.8, 0.4] });
    },
  },
];

/** One vertical three-lamp signal head hanging at (x, ytop) on the mast arm at z; faces +X. */
function signalHead(b, x, ytop, z, state, compact = false) {
  const h = compact ? 0.95 : 1.05;
  const w = 0.34;
  b.box(DARK, [x - 0.14, ytop - h, z - w / 2], [x + 0.14, ytop, z + w / 2], { skip: [] });
  b.box(DARK, [x - 0.02, ytop, z - 0.03], [x + 0.02, ytop + 0.18, z + 0.03], { skip: ["b"] }); // hanger
  const lamps = [["mat_neon_red", "red"], ["mat_neon_amber", "amber"], ["mat_neon_green", "green"]];
  lamps.forEach(([mat, name], i) => {
    const y = ytop - 0.2 - i * 0.28;
    const lit = state === name;
    disc(b, lit ? mat : "mat_prop_plastic", [x + 0.15, y, z], 0.1, [1, 0, 0], 6);
    // visor hood over the lamp
    b.box(DARK, [x + 0.14, y + 0.1, z - 0.13], [x + 0.28, y + 0.12, z + 0.13], { skip: ["b"] });
  });
  // back plate
  b.box(DARK, [x - 0.17, ytop - h - 0.03, z - w / 2 - 0.05], [x - 0.14, ytop + 0.03, z + w / 2 + 0.05], { skip: ["b"] });
}


// ---------------------------------------------------------------- utility poles
const WOOD = "mat_prop_wood";
const INSUL = "mat_prop_paint_green";

assets.push(
  {
    id: "prop_utilitypole_a",
    category: "prop",
    tags: ["street_pole"],
    budget: 500,
    build(b) {
      b.ao = { y0: 0, y1: 2, lo: 0.6, hi: 1 };
      pole(b, WOOD, 0, 0, 0, 9.6, 0.17, 0.11, 8);
      for (const [y, half] of [[8.5, 1.15], [9.2, 0.85]]) {
        b.box(WOOD, [-half, y, -0.07], [half, y + 0.16, 0.07], { skip: ["b"] });
        for (const x of [-half + 0.15, 0, half - 0.15]) b.box(INSUL, [x - 0.035, y + 0.16, -0.035], [x + 0.035, y + 0.4, 0.035], { skip: ["b"] });
      }
      strut(b, WOOD, [-0.9, 8.5, 0.0], [-0.12, 7.8, 0.0], 0.06, 0.05);
      strut(b, WOOD, [0.9, 8.5, 0.0], [0.12, 7.8, 0.0], 0.06, 0.05);
      // pole-top transformer on a bracket, plus its warning label
      b.box(DARK, [-0.12, 7.4, 0.1], [0.12, 7.45, 0.45], { skip: ["b"] });
      b.cylinder("mat_metal_galvanized", { x: 0, z: 0.5, y0: 6.85, y1: 7.75, r: 0.3, seg: 10, cap: "top" });
      b.lathe(DARK, [[0.3, 7.75], [0.22, 7.84], [0.06, 7.88]], { x: 0, z: 0.5, seg: 10 });
      panelZ(b, "mat_neon_amber", 0, 7.3, 0.805, 0.14, 0.1);
      // climbing steps on the +Z side
      for (let i = 0; i < 4; i++) b.box(DARK, [-0.1, 2.0 + i * 0.5, 0.11], [0.1, 2.04 + i * 0.5, 0.2], { skip: ["b"] });
      // service number plate
      panelZ(b, "mat_metal_galvanized", 0, 3.4, 0.17, 0.2, 0.14);
      b.collider({ c: [0, 4.8, 0], h: [0.2, 4.8, 0.2] });
    },
  },
  {
    id: "prop_utilitypole_b",
    category: "prop",
    tags: ["street_pole"],
    budget: 500,
    build(b) {
      b.ao = { y0: 0, y1: 2, lo: 0.6, hi: 1 };
      // concrete pole, wide steel crossarm, telecom cabinet and an aviation beacon
      pole(b, "mat_wall_concrete_dark", 0, 0, 0, 10.5, 0.2, 0.12, 8);
      b.box(GALV, [-1.6, 9.7, -0.08], [1.6, 9.85, 0.08], { skip: ["b"] });
      for (const x of [-1.5, -0.75, 0, 0.75, 1.5]) b.box(INSUL, [x - 0.035, 9.85, -0.035], [x + 0.035, 10.12, 0.035], { skip: ["b"] });
      strut(b, GALV, [-1.4, 9.7, 0], [-0.15, 9.0, 0], 0.07, 0.05);
      strut(b, GALV, [1.4, 9.7, 0], [0.15, 9.0, 0], 0.07, 0.05);
      b.box(DARK, [-0.4, 3.1, 0.2], [0.4, 4.6, 0.6], { skip: ["b"] });
      b.box(GALV, [-0.34, 3.17, 0.6], [0.34, 4.53, 0.64], { skip: ["b", "s", "e", "w", "t"] });
      panelZ(b, "mat_neon_green", 0.2, 4.2, 0.65, 0.08, 0.05);
      panelZ(b, "mat_neon_amber", 0.0, 4.2, 0.65, 0.08, 0.05);
      b.tube(DARK, { pts: [[0, 3.1, 0.35], [0, 2.9, 0.3], [0, 2.0, 0.22], [0, 0.0, 0.2]], r: 0.04, seg: 4 });
      b.tube(DARK, { pts: [[0, 4.6, 0.35], [0, 6.0, 0.2], [0, 8.6, 0.16], [0, 9.7, 0.1]], r: 0.04, seg: 4 });
      b.cylinder(DARK, { x: 0, z: 0, y0: 10.5, y1: 11.2, r: 0.03, seg: 4, cap: "top" });
      b.sphere("mat_neon_red", { c: [0, 11.25, 0], r: 0.09, seg: 6, rings: 3 });
      b.collider({ c: [0, 5.25, 0], h: [0.22, 5.25, 0.22] });
      b.anchor("light.beacon", [0, 11.25, 0], { color: "#ff2a3c", intensity: 0.6, range: 10 });
    },
  },
  {
    id: "prop_utilitypole_c",
    category: "prop",
    tags: ["street_pole"],
    budget: 500,
    build(b) {
      b.ao = { y0: 0, y1: 2, lo: 0.6, hi: 1 };
      // cluttered city pole: three arms, two transformers, junction box, neon blade, loose cable loops
      pole(b, WOOD, 0, 0, 0, 10.2, 0.18, 0.12, 8);
      for (const [y, half] of [[8.0, 1.0], [8.9, 1.2], [9.6, 0.8]]) {
        b.box(WOOD, [-half, y, -0.07], [half, y + 0.15, 0.07], { skip: ["b"] });
        for (const x of [-half + 0.12, half - 0.12]) b.box(INSUL, [x - 0.03, y + 0.15, -0.03], [x + 0.03, y + 0.35, 0.03], { skip: ["b"] });
      }
      for (const [x, y] of [[-0.3, 6.6], [0.34, 7.1]]) {
        b.cylinder("mat_metal_galvanized", { x, z: 0.34, y0: y, y1: y + 0.75, r: 0.24, seg: 8, cap: "top" });
        b.box(DARK, [x - 0.1, y + 0.3, 0.1], [x + 0.1, y + 0.34, 0.34], { skip: ["b"] });
      }
      b.box(DARK, [-0.3, 3.6, 0.16], [0.3, 4.4, 0.4], { skip: ["b"] });
      panelZ(b, "mat_neon_red", 0, 4.1, 0.405, 0.12, 0.06);
      // neon blade sign sticking out toward +Z
      b.box(DARK, [-0.03, 5.4, 0.15], [0.03, 5.46, 1.0], { skip: ["b"] });
      b.box(DARK, [-0.05, 4.5, 0.95], [0.05, 5.5, 1.05], { skip: ["b"] });
      for (const sx of [-1, 1]) panelX(b, "mat_neon_magenta", 0.06 * sx, 5.0, 1.0, 0.7, 0.8, sx < 0);
      // loose cable loops
      b.tube(DARK, { pts: [[-1.0, 8.1, 0.1], [-1.1, 7.2, 0.3], [-0.6, 6.6, 0.25], [0, 6.9, 0.2], [0.1, 7.6, 0.15], [0.9, 8.1, 0.1]], r: 0.025, seg: 3 });
      b.tube(DARK, { pts: [[1.2, 9.0, 0.1], [1.2, 8.0, 0.25], [0.7, 6.4, 0.3], [0.2, 5.6, 0.2]], r: 0.025, seg: 3 });
      b.collider({ c: [0, 5.1, 0], h: [0.2, 5.1, 0.2] });
      b.anchor("light.blade", [0, 5.0, 1.2], { color: "#ff2bd6", intensity: 0.6, range: 7 });
    },
  },
);

// ---------------------------------------------------------------- sidewalk props
// Customer-facing side = +Z. Origin = ground centre.
const PLASTIC = "mat_prop_plastic";
const SCREEN = "mat_prop_screen_blue";

assets.push(
  {
    id: "prop_bench_a",
    category: "prop",
    tags: ["sidewalk_small"],
    budget: 200,
    build(b) {
      b.ao = { y0: 0, y1: 0.5, lo: 0.6, hi: 1 };
      for (const sx of [-0.85, 0.85]) {
        b.box(DARK, [sx - 0.035, 0, 0.12], [sx + 0.035, 0.45, 0.2], { skip: ["b"] });
        b.box(DARK, [sx - 0.035, 0, -0.22], [sx + 0.035, 0.85, -0.14], { skip: ["b"] });
        b.box(DARK, [sx - 0.035, 0.42, -0.2], [sx + 0.035, 0.47, 0.2], { skip: ["b"] });
        b.box(DARK, [sx - 0.04, 0.6, -0.2], [sx + 0.04, 0.64, 0.12], { skip: ["b"] }); // armrest
      }
      for (let i = 0; i < 3; i++) b.box(WOOD, [-0.9, 0.47, -0.2 + i * 0.14], [0.9, 0.51, -0.1 + i * 0.14], { skip: ["b"] });
      for (let i = 0; i < 2; i++) b.box(WOOD, [-0.9, 0.58 + i * 0.13, -0.24], [0.9, 0.68 + i * 0.13, -0.2], { skip: ["b"] });
      b.box(DARK, [-0.02, 0.6, -0.2], [0.02, 0.64, 0.12], { skip: ["b"] }); // divider
      b.box("mat_neon_cyan", [-0.8, 0.33, 0.19], [0.8, 0.355, 0.215], { skip: ["b", "s"].concat(["w", "e"]) }); // under-seat glow strip
      b.collider({ c: [0, 0.42, 0], h: [0.92, 0.42, 0.25] });
    },
  },
  {
    id: "prop_hydrant_a",
    category: "prop",
    tags: ["sidewalk_small"],
    budget: 200,
    build(b) {
      b.ao = { y0: 0, y1: 0.5, lo: 0.65, hi: 1 };
      const P = "mat_prop_paint_red";
      b.lathe(P, [[0.15, 0], [0.15, 0.08], [0.1, 0.13], [0.1, 0.58], [0.14, 0.62], [0.14, 0.68], [0.09, 0.73], [0, 0.78]], { seg: 6, crease: 50 });
      cylX(b, P, -0.2, 0.2, 0.42, 0, 0.055, 0.055, 6, "both");
      cylZ(b, P, 0, 0.36, 0.0, 0.2, 0.075, 0.075, 6, "top");
      b.cylinder(GALV, { x: 0, z: 0, y0: 0.78, y1: 0.86, r: 0.04, seg: 5 });
      for (const sx of [-1, 1]) b.cylinder(GALV, { x: sx * 0.205, z: 0, y0: 0.34, y1: 0.5, r: 0.03, seg: 4, cap: "top" }); // cap nuts (sideways ones read as bolts)
      b.collider({ c: [0, 0.4, 0], h: [0.2, 0.4, 0.2] });
    },
  },
  {
    id: "prop_mailbox_a",
    category: "prop",
    tags: ["sidewalk_small"],
    budget: 200,
    build(b) {
      b.ao = { y0: 0, y1: 0.6, lo: 0.65, hi: 1 };
      const P = "mat_prop_paint_green";
      b.box(P, [-0.28, 0.2, -0.25], [0.28, 0.85, 0.25], { skip: ["b", "t"] });
      cylZ(b, P, 0, 0.85, -0.25, 0.25, 0.28, 0.28, 8, "both");
      b.box(DARK, [-0.22, 0, -0.18], [0.22, 0.22, 0.18], { skip: ["b"] });
      panelZ(b, DARK, 0, 0.62, 0.255, 0.34, 0.08);
      panelZ(b, "mat_road_marking_white", 0, 0.45, 0.255, 0.3, 0.1);
      b.box(DARK, [-0.12, 0.35, 0.25], [0.12, 0.38, 0.33], { skip: ["b"] }); // pull-down shelf
      panelZ(b, "mat_neon_cyan", 0, 1.08, 0.265, 0.2, 0.05);
      b.collider({ c: [0, 0.65, 0], h: [0.3, 0.65, 0.27] });
    },
  },
  {
    id: "prop_vending_a",
    category: "prop",
    tags: ["sidewalk_small"],
    budget: 300,
    build(b) {
      b.ao = { y0: 0, y1: 0.6, lo: 0.6, hi: 1 };
      b.box("mat_metal_painted_dark", [-0.47, 0, -0.38], [0.47, 1.85, 0.38], { skip: ["b"] });
      b.box("mat_prop_paint_red", [-0.47, 0.0, -0.38], [0.47, 0.12, 0.4], { skip: ["b"] });
      panelZ(b, SCREEN, -0.1, 1.15, 0.385, 0.62, 1.15);
      for (let i = 0; i < 4; i++) b.box(DARK, [-0.43, 0.82 + i * 0.28, 0.38], [0.2, 0.84 + i * 0.28, 0.4], { skip: ["b"] });
      for (let i = 0; i < 6; i++) panelZ(b, i % 2 ? "mat_neon_magenta" : "mat_neon_amber", -0.35 + (i % 3) * 0.2, 0.95 + Math.floor(i / 3) * 0.55, 0.395, 0.1, 0.18);
      b.box(DARK, [0.25, 0.8, 0.38], [0.44, 1.5, 0.41], { skip: ["b"] });
      panelZ(b, "mat_neon_green", 0.345, 1.35, 0.415, 0.1, 0.12);
      panelZ(b, "mat_neon_red", 0.345, 1.1, 0.415, 0.1, 0.05);
      b.box(DARK, [-0.3, 0.14, 0.38], [0.3, 0.42, 0.42], { skip: ["b"] }); // dispenser flap
      panelZ(b, "mat_neon_cyan", 0, 1.74, 0.385, 0.8, 0.09);
      b.collider({ c: [0, 0.92, 0], h: [0.47, 0.92, 0.4] });
      b.anchor("light.screen", [0, 1.15, 0.6], { color: "#2ab4ff", intensity: 0.5, range: 5 });
    },
  },
  {
    id: "prop_vending_b",
    category: "prop",
    tags: ["sidewalk_small"],
    budget: 300,
    build(b) {
      b.ao = { y0: 0, y1: 0.6, lo: 0.6, hi: 1 };
      b.box("mat_metal_painted_dark", [-0.4, 0, -0.3], [0.4, 1.8, 0.3], { skip: ["b"] });
      panelZ(b, "mat_light_warm", 0, 1.1, 0.305, 0.58, 1.0);
      for (let i = 0; i < 3; i++) b.box(DARK, [-0.3, 0.8 + i * 0.3, 0.3], [0.3, 0.82 + i * 0.3, 0.32], { skip: ["b"] });
      for (const sx of [-1, 1]) b.box("mat_neon_red", [sx * 0.37 - 0.015, 0.05, 0.3], [sx * 0.37 + 0.015, 1.75, 0.33], { skip: ["b"] });
      b.box("mat_neon_red", [-0.4, 1.75, 0.3], [0.4, 1.8, 0.34], { skip: ["b"] });
      b.box(DARK, [-0.43, 1.82, -0.33], [0.43, 1.9, 0.5], { skip: ["b"] }); // little roof
      panelZ(b, "mat_neon_amber", 0, 1.86, 0.505, 0.6, 0.05);
      b.box(DARK, [-0.3, 0.12, 0.3], [0.3, 0.4, 0.34], { skip: ["b"] });
      b.box(DARK, [0.4, 0.9, -0.1], [0.43, 1.3, 0.1], { skip: ["b"] });
      b.collider({ c: [0, 0.95, 0], h: [0.43, 0.95, 0.35] });
      b.anchor("light.screen", [0, 1.1, 0.6], { color: "#ffd9a0", intensity: 0.6, range: 5 });
    },
  },
  {
    id: "prop_newsstand_a",
    category: "prop",
    tags: ["sidewalk_small"],
    budget: 500,
    build(b) {
      b.ao = { y0: 0, y1: 0.8, lo: 0.6, hi: 1 };
      b.box("mat_metal_painted_dark", [-0.8, 0, -0.6], [0.8, 1.0, 0.45], { skip: ["b"] });
      b.box("mat_prop_wood", [-0.85, 1.0, -0.55], [0.85, 1.06, 0.58], { skip: ["b"] }); // counter overhang
      for (const [x, z] of [[-0.8, -0.6], [0.8, -0.6], [-0.8, 0.45], [0.8, 0.45]]) b.box(DARK, [x - 0.03, 1.06, z - 0.03], [x + 0.03, 2.25, z + 0.03], { skip: ["b"] });
      // slanted roof
      b.quad("mat_prop_paint_green", [-1.0, 2.25, 0.6], [1.0, 2.25, 0.6], [1.0, 2.4, -0.7], [-1.0, 2.4, -0.7], { double: true });
      b.box("mat_prop_paint_green", [-1.0, 2.2, 0.6], [1.0, 2.3, 0.66], { skip: ["b"] });
      // back shelves with magazines
      b.box(DARK, [-0.78, 1.06, -0.6], [0.78, 2.2, -0.57], { skip: ["b"] });
      const mags = ["mat_prop_paint_red", "mat_prop_paint_yellow", "mat_prop_paint_orange", "mat_neon_cyan", "mat_prop_paint_green"];
      for (let row = 0; row < 3; row++) {
        b.box(DARK, [-0.78, 1.32 + row * 0.3, -0.58], [0.78, 1.34 + row * 0.3, -0.38], { skip: ["b"] });
        for (let i = 0; i < 6; i++) panelZ(b, mags[(i + row) % mags.length], -0.65 + i * 0.26, 1.46 + row * 0.3, -0.37, 0.2, 0.24);
      }
      // front stand: two slanted display racks on the counter
      for (const sx of [-0.42, 0.42]) b.quad("mat_prop_paint_yellow", [sx - 0.3, 1.08, 0.5], [sx + 0.3, 1.08, 0.5], [sx + 0.3, 1.55, 0.2], [sx - 0.3, 1.55, 0.2], { double: true });
      panelZ(b, "mat_neon_amber", 0, 2.1, 0.665, 1.5, 0.12);
      b.box("mat_neon_magenta", [-0.95, 2.25, 0.62], [0.95, 2.27, 0.66], { skip: ["b"] });
      b.collider({ c: [0, 1.2, -0.1], h: [0.95, 1.2, 0.7] });
      b.anchor("light.sign", [0, 2.1, 0.9], { color: "#ffb000", intensity: 0.7, range: 6 });
    },
  },
  {
    id: "prop_bikerack_a",
    category: "prop",
    tags: ["sidewalk_small"],
    budget: 200,
    build(b) {
      b.ao = { y0: 0, y1: 0.4, lo: 0.65, hi: 1 };
      for (const x of [-0.5, 0, 0.5]) {
        b.tube(GALV, { pts: [[x, 0, -0.3], [x, 0.75, -0.3], [x, 0.9, 0], [x, 0.75, 0.3], [x, 0, 0.3]], r: 0.025, seg: 4 });
      }
      b.box(DARK, [-0.6, 0, -0.33], [0.6, 0.02, -0.27], { skip: ["b"] });
      b.box(DARK, [-0.6, 0, 0.27], [0.6, 0.02, 0.33], { skip: ["b"] });
      b.collider({ c: [0, 0.45, 0], h: [0.6, 0.45, 0.3] }, "soft");
    },
  },
  {
    id: "prop_parkingmeter_a",
    category: "prop",
    tags: ["sidewalk_small"],
    budget: 200,
    build(b) {
      b.ao = { y0: 0, y1: 0.5, lo: 0.65, hi: 1 };
      pole(b, GALV, 0, 0, 0, 1.15, 0.04, 0.035, 6);
      b.box(DARK, [-0.11, 1.15, -0.09], [0.11, 1.55, 0.09], { skip: ["b"] });
      b.box("mat_metal_galvanized", [-0.1, 1.55, -0.08], [0.1, 1.6, 0.08], { skip: ["b"] });
      panelZ(b, SCREEN, 0, 1.43, 0.092, 0.14, 0.08);
      panelZ(b, "mat_neon_green", 0.06, 1.3, 0.092, 0.04, 0.04);
      b.box(GALV, [-0.045, 1.2, 0.09], [0.045, 1.26, 0.1], { skip: ["b"] });
      b.quad("mat_glass_dark", [-0.09, 1.6, -0.08], [0.09, 1.6, -0.08], [0.09, 1.7, -0.06], [-0.09, 1.7, -0.06], { double: true });
      b.box("mat_prop_paint_green", [-0.1, 1.6, -0.08], [0.1, 1.64, 0.08], { skip: ["b"] }); // solar panel
      b.collider({ c: [0, 0.85, 0], h: [0.12, 0.85, 0.1] });
    },
  },
  {
    id: "prop_infobooth_a",
    category: "prop",
    tags: ["sidewalk_small"],
    budget: 500,
    build(b) {
      b.ao = { y0: 0, y1: 0.7, lo: 0.6, hi: 1 };
      b.box(DARK, [-0.5, 0, -0.5], [0.5, 0.06, 0.5], { skip: ["b"] });
      for (const [x, z] of [[-0.46, -0.46], [0.46, -0.46], [-0.46, 0.46], [0.46, 0.46]]) b.box(DARK, [x - 0.035, 0.06, z - 0.035], [x + 0.035, 2.3, z + 0.035], { skip: ["b"] });
      // roof with glowing edge
      b.box(DARK, [-0.56, 2.3, -0.56], [0.56, 2.38, 0.56], { skip: ["b"] });
      b.box("mat_neon_cyan", [-0.5, 2.25, 0.5], [0.5, 2.3, 0.54], { skip: ["b"] });
      b.box("mat_neon_cyan", [-0.54, 2.25, -0.5], [-0.5, 2.3, 0.5], { skip: ["b"] });
      b.box("mat_neon_cyan", [0.5, 2.25, -0.5], [0.54, 2.3, 0.5], { skip: ["b"] });
      // glass sides, back is a lit panel
      for (const sx of [-1, 1]) panelX(b, "mat_glass_dark", 0.455 * sx, 1.2, 0, 0.88, 2.0, sx < 0, { double: true });
      panelZ(b, SCREEN, 0, 1.35, -0.43, 0.8, 1.1);
      panelZ(b, "mat_prop_screen_blue", 0, 1.35, -0.43, 0.8, 1.1, true);
      b.box(DARK, [-0.3, 0.9, -0.43], [0.3, 1.0, -0.2], { skip: ["b"] }); // shelf
      b.box(DARK, [-0.12, 1.0, -0.4], [0.12, 1.12, -0.28], { skip: ["b"] }); // handset dock
      b.tube(DARK, { pts: [[0, 1.05, -0.3], [0.05, 0.85, -0.2], [0.1, 0.9, -0.1]], r: 0.012, seg: 3 });
      panelZ(b, "mat_neon_magenta", 0, 2.1, 0.485, 0.7, 0.1);
      b.collider({ c: [0, 1.2, 0], h: [0.5, 1.2, 0.5] });
      b.anchor("light.screen", [0, 1.3, 0.3], { color: "#2ab4ff", intensity: 0.7, range: 6 });
    },
  },
  {
    id: "prop_streetsign_a",
    category: "prop",
    tags: ["sidewalk_small"],
    budget: 200,
    build(b) {
      b.ao = { y0: 0, y1: 0.5, lo: 0.7, hi: 1 };
      pole(b, GALV, 0, 0, 0, 3.4, 0.045, 0.04, 6);
      const G = "mat_prop_paint_green";
      // two crossing name blades
      b.box(G, [-0.45, 3.0, -0.03], [0.45, 3.2, 0.03], { skip: ["b"] });
      b.box(G, [-0.03, 2.72, -0.45], [0.03, 2.92, 0.45], { skip: ["b"] });
      for (const z of [0.036, -0.036]) panelZ(b, "mat_road_marking_white", 0, 3.1, z, 0.78, 0.08, z < 0);
      for (const x of [0.036, -0.036]) panelX(b, "mat_road_marking_white", x, 2.82, 0, 0.78, 0.08, x < 0);
      // regulatory sign on the pole
      disc(b, "mat_road_marking_white", [0, 2.2, 0.06], 0.22, [0, 0, 1], 10);
      disc(b, "mat_prop_paint_red", [0, 2.2, 0.065], 0.18, [0, 0, 1], 10);
      b.box("mat_road_marking_white", [-0.14, 2.17, 0.07], [0.14, 2.23, 0.075], { skip: ["b"] });
      b.cylinder(DARK, { x: 0, z: 0, y0: 3.4, y1: 3.45, r: 0.06, seg: 6 });
      b.collider({ c: [0, 1.7, 0], h: [0.06, 1.7, 0.06] });
    },
  },
  {
    id: "prop_planter_tree_a",
    category: "prop",
    tags: ["sidewalk_small"],
    budget: 300,
    build(b) {
      b.ao = { y0: 0, y1: 0.6, lo: 0.6, hi: 1 };
      b.box("mat_wall_concrete_panel", [-0.6, 0, -0.6], [0.6, 0.55, 0.6], { skip: ["b", "t"] });
      b.box("mat_wall_concrete_dark", [-0.64, 0.55, -0.64], [0.64, 0.62, 0.64], { skip: ["b"] });
      b.poly("mat_wall_concrete_dark", [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]], 0.63);
      b.cylinder(WOOD, { x: 0, z: 0, y0: 0.62, y1: 2.2, r: 0.07, r1: 0.04, seg: 5, cap: "top" });
      b.tube(WOOD, { pts: [[0, 1.6, 0], [0.25, 1.95, 0.1], [0.5, 2.35, 0.1]], r: 0.03, seg: 4 });
      b.tube(WOOD, { pts: [[0, 1.8, 0], [-0.3, 2.1, -0.1], [-0.55, 2.4, -0.1]], r: 0.03, seg: 4 });
      b.sphere("mat_foliage_leaf", { c: [0, 2.7, 0], r: [0.75, 0.6, 0.75], seg: 7, rings: 4 });
      b.sphere("mat_foliage_leaf", { c: [0.55, 2.45, 0.1], r: [0.5, 0.42, 0.5], seg: 6, rings: 4 });
      b.sphere("mat_foliage_leaf", { c: [-0.5, 2.5, -0.1], r: [0.5, 0.42, 0.5], seg: 6, rings: 4 });
      b.boxC("mat_neon_green", [0, 0.28, 0.605], [0.7, 0.04, 0.01]);
      b.collider({ c: [0, 0.31, 0], h: [0.64, 0.31, 0.64] });
    },
  },
  {
    id: "prop_atm_a",
    category: "prop",
    tags: ["sidewalk_small"],
    budget: 300,
    build(b) {
      b.ao = { y0: 0, y1: 0.6, lo: 0.6, hi: 1 };
      b.box("mat_metal_painted_dark", [-0.45, 0, -0.3], [0.45, 2.1, 0.3], { skip: ["b"] });
      b.box("mat_metal_galvanized", [-0.5, 2.1, -0.35], [0.5, 2.25, 0.62], { skip: ["b"] }); // canopy
      panelZ(b, "mat_neon_amber", 0, 2.0, 0.305, 0.7, 0.14);
      panelZ(b, SCREEN, 0, 1.55, 0.305, 0.5, 0.35);
      b.box(DARK, [-0.25, 1.05, 0.3], [0.25, 1.28, 0.42], { skip: ["b"] }); // keypad shelf
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) panelZ(b, "mat_neon_white", -0.12 + i * 0.12, 1.2 + j * 0.0, 0.421, 0.08, 0.02);
      b.box(DARK, [-0.12, 1.28, 0.3], [0.12, 1.36, 0.36], { skip: ["b"] });
      panelZ(b, "mat_neon_green", -0.28, 1.15, 0.305, 0.12, 0.03);
      b.box(DARK, [-0.28, 0.75, 0.3], [0.28, 0.85, 0.36], { skip: ["b"] });
      panelZ(b, "mat_neon_cyan", 0, 0.8, 0.365, 0.4, 0.025);
      b.box("mat_prop_paint_red", [-0.45, 0.4, 0.3], [-0.2, 0.7, 0.33], { skip: ["b"] });
      b.collider({ c: [0, 1.1, 0], h: [0.5, 1.1, 0.35] });
      b.anchor("light.screen", [0, 1.5, 0.6], { color: "#ffb000", intensity: 0.6, range: 5 });
    },
  },
  {
    id: "prop_firealarm_a",
    category: "prop",
    tags: ["sidewalk_small"],
    budget: 200,
    build(b) {
      b.ao = { y0: 0, y1: 0.5, lo: 0.65, hi: 1 };
      pole(b, DARK, 0, 0, 0, 1.45, 0.05, 0.045, 6);
      b.box("mat_prop_paint_red", [-0.15, 1.15, -0.1], [0.15, 1.65, 0.1], { skip: ["b"] });
      b.box("mat_glass_dark", [-0.1, 1.3, 0.1], [0.1, 1.5, 0.115], { skip: ["b"] });
      panelZ(b, "mat_road_marking_white", 0, 1.57, 0.102, 0.2, 0.05);
      b.sphere("mat_neon_red", { c: [0, 1.76, 0], r: 0.1, seg: 6, rings: 3 });
      b.cylinder(DARK, { x: 0, z: 0, y0: 1.65, y1: 1.68, r: 0.1, seg: 6 });
      b.collider({ c: [0, 0.9, 0], h: [0.15, 0.9, 0.12] });
      b.anchor("light.beacon", [0, 1.78, 0], { color: "#ff2a3c", intensity: 0.4, range: 5 });
    },
  },
);

// ---------------------------------------------------------------- big sidewalk props
assets.push(
  {
    id: "prop_busstop_a",
    category: "prop",
    tags: ["sidewalk_small", "sidewalk_big"],
    budget: 900,
    build(b) {
      b.ao = { y0: 0, y1: 0.8, lo: 0.6, hi: 1 };
      const GLASS = "mat_glass_dark";
      // roof with glowing front edge and underside lights
      b.box(DARK, [-1.95, 2.5, -0.85], [1.95, 2.62, 0.85], { skip: ["b"] });
      b.box("mat_metal_galvanized", [-1.99, 2.62, -0.89], [1.99, 2.68, 0.89], { skip: ["b"] });
      panelZ(b, "mat_neon_cyan", 0, 2.56, 0.86, 3.9, 0.08);
      panelY(b, "mat_light_warm", -0.8, 2.495, 0.1, 0.9, 0.4);
      panelY(b, "mat_light_warm", 0.8, 2.495, 0.1, 0.9, 0.4);
      // posts
      for (const x of [-1.7, 1.7]) {
        b.box(DARK, [x - 0.05, 0, 0.6], [x + 0.05, 2.5, 0.7], { skip: ["b"] });
        b.box(DARK, [x - 0.05, 0, -0.7], [x + 0.05, 2.5, -0.6], { skip: ["b"] });
      }
      // back wall glass in a frame
      b.box(DARK, [-1.7, 0.12, -0.67], [1.7, 0.2, -0.62], { skip: ["b"] });
      b.box(DARK, [-1.7, 2.32, -0.67], [1.7, 2.4, -0.62], { skip: ["b"] });
      for (const x of [-0.57, 0.57]) b.box(DARK, [x - 0.03, 0.2, -0.67], [x + 0.03, 2.32, -0.62], { skip: ["b"] });
      for (const x of [-1.135, 0, 1.135]) panelZ(b, GLASS, x, 1.26, -0.645, 1.04, 2.1, false, { double: true });
      // right side glass
      panelX(b, GLASS, 1.7, 1.2, 0, 1.2, 2.2, false, { double: true });
      b.box(DARK, [1.66, 0.12, -0.6], [1.74, 0.2, 0.6], { skip: ["b"] });
      // left end: lit ad panel (both faces)
      b.box(DARK, [-1.9, 0.15, -0.6], [-1.72, 2.4, 0.6], { skip: ["b"] });
      panelX(b, "mat_prop_screen_blue", -1.905, 1.3, 0, 1.0, 1.9, true);
      panelX(b, "mat_neon_magenta", -1.905, 0.55, 0, 1.0, 0.18, true);
      // bench
      b.box(WOOD, [-1.1, 0.46, -0.5], [1.0, 0.5, -0.12], { skip: ["b"] });
      for (const x of [-1.05, 0.95]) b.box(DARK, [x - 0.03, 0, -0.5], [x + 0.03, 0.46, -0.12], { skip: ["b"] });
      // route pole with round sign and a timetable board
      pole(b, GALV, 2.25, 0.3, 0, 3.1, 0.04, 0.04, 6);
      disc(b, "mat_road_marking_white", [2.25, 3.0, 0.345], 0.28, [0, 0, 1], 10);
      disc(b, "mat_neon_cyan", [2.25, 3.0, 0.35], 0.2, [0, 0, 1], 10);
      b.box(DARK, [2.0, 1.55, 0.3], [2.5, 2.2, 0.35], { skip: ["b"] });
      panelZ(b, "mat_prop_screen_blue", 2.25, 1.87, 0.355, 0.42, 0.55);
      // bin
      b.cylinder("mat_metal_galvanized", { x: -2.35, z: 0.2, y0: 0, y1: 0.9, r: 0.26, r1: 0.28, seg: 8, cap: "top" });
      b.box(DARK, [-2.6, 0.9, -0.05], [-2.1, 0.95, 0.45], { skip: ["b"] });
      b.collider({ c: [0, 1.25, -0.4], h: [1.9, 1.25, 0.3] });
      b.collider({ c: [-1.8, 1.2, 0], h: [0.1, 1.2, 0.6] });
      b.anchor("light.shelter", [0, 2.4, 0.1], { color: "#ffd9a0", intensity: 0.8, range: 8 });
      b.anchor("light.ad", [-2.1, 1.3, 0], { color: "#2ab4ff", intensity: 0.5, range: 6 });
    },
  },
  {
    id: "prop_foodcart_a",
    category: "prop",
    tags: ["sidewalk_small", "sidewalk_big"],
    budget: 900,
    build(b, r) {
      b.ao = { y0: 0, y1: 0.7, lo: 0.6, hi: 1 };
      // cart body and counter
      b.box("mat_metal_painted_dark", [-1.1, 0.35, -0.5], [1.1, 1.0, 0.5], { skip: ["b"] });
      b.box("mat_prop_paint_red", [-1.1, 0.35, 0.5], [1.1, 0.5, 0.52], { skip: ["b"] });
      b.box(GALV, [-1.2, 1.0, -0.6], [1.2, 1.05, 0.7], { skip: ["b"] });
      for (const sx of [-1, 1]) {
        cylX(b, DARK, sx * 1.12 - 0.04, sx * 1.12 + 0.04, 0.3, -0.05, 0.3, 0.3, 10);
        cylX(b, GALV, sx * 1.12 - 0.05, sx * 1.12 + 0.05, 0.3, -0.05, 0.07, 0.07, 6);
        strut(b, DARK, [sx * 0.9, 0.6, -0.5], [sx * 0.9, 0.9, -1.2], 0.05);
      }
      // posts and sloped awning with a scalloped valance
      for (const [x, z] of [[-1.25, -0.6], [1.25, -0.6], [-1.25, 0.7], [1.25, 0.7]]) b.box(DARK, [x - 0.03, 1.05, z - 0.03], [x + 0.03, z > 0 ? 2.25 : 2.5, z + 0.03], { skip: ["b"] });
      b.quad("mat_prop_paint_red", [-1.45, 2.25, 0.95], [1.45, 2.25, 0.95], [1.45, 2.5, -0.8], [-1.45, 2.5, -0.8], { double: true });
      for (let i = 0; i < 7; i++) {
        const x0 = -1.45 + i * (2.9 / 7), x1 = x0 + 2.9 / 7;
        b.tri("mat_prop_paint_red", [x1, 2.25, 0.95], [x0, 2.25, 0.95], [(x0 + x1) / 2, 2.0, 0.95], { uv: [[0, 0], [1, 0], [0.5, 1]] });
        b.tri("mat_prop_paint_red", [x0, 2.25, 0.95], [x1, 2.25, 0.95], [(x0 + x1) / 2, 2.0, 0.95]);
      }
      // hanging lanterns
      for (let i = 0; i < 3; i++) {
        const x = -0.9 + i * 0.9;
        b.box(DARK, [x - 0.01, 1.95, 0.85], [x + 0.01, 2.2, 0.87], { skip: ["b"] });
        b.sphere(i === 1 ? "mat_neon_amber" : "mat_neon_red", { c: [x, 1.8, 0.86], r: [0.17, 0.21, 0.17], seg: 6, rings: 4 });
        b.anchor(`light.lantern${i}`, [x, 1.8, 0.86], { color: i === 1 ? "#ffb000" : "#ff2a3c", intensity: 0.6, range: 6 });
      }
      // pots and bowls on the counter
      b.cylinder("mat_metal_galvanized", { x: -0.6, z: -0.1, y0: 1.05, y1: 1.32, r: 0.23, seg: 8, cap: "none" });
      b.lathe(DARK, [[0.25, 1.3], [0.27, 1.34], [0.05, 1.36]], { x: -0.6, z: -0.1, seg: 8 });
      b.cylinder("mat_metal_galvanized", { x: 0.1, z: -0.1, y0: 1.05, y1: 1.28, r: 0.2, seg: 8, cap: "top" });
      b.cylinder("mat_char_leather", { x: 0.85, z: 0.15, y0: 1.05, y1: 1.2, r: 0.1, r1: 0.12, seg: 6, cap: "none" });
      b.cylinder("mat_light_warm", { x: 0.85, z: 0.15, y0: 1.2, y1: 1.205, r: 0.1, seg: 6, cap: "top" });
      // steam stack
      b.cylinder(DARK, { x: -0.6, z: -0.5, y0: 1.05, y1: 2.5, r: 0.05, seg: 5, cap: "top" });
      // neon sign above the counter
      b.box(DARK, [-0.8, 2.52, -0.82], [0.8, 2.98, -0.74], { skip: ["b"] });
      panelZ(b, "mat_neon_amber", 0, 2.75, -0.735, 1.4, 0.3);
      b.box("mat_neon_magenta", [-0.7, 2.55, -0.745], [0.7, 2.58, -0.735], { skip: ["b"] });
      panelZ(b, "mat_light_warm", 0.78, 1.55, 0.53, 0.45, 0.36);
      // stools
      for (const x of [-0.7, 0.0, 0.7]) {
        b.cylinder("mat_metal_painted_dark", { x, z: 1.35, y0: 0.5, y1: 0.55, r: 0.2, seg: 8, cap: "top" });
        for (let k = 0; k < 3; k++) {
          const a = (k / 3) * Math.PI * 2 + 0.5;
          strut(b, DARK, [x + Math.cos(a) * 0.1, 0.5, 1.35 + Math.sin(a) * 0.1], [x + Math.cos(a) * 0.17, 0, 1.35 + Math.sin(a) * 0.17], 0.03);
        }
      }
      b.collider({ c: [0, 0.8, 0], h: [1.25, 0.8, 0.65] });
      b.anchor("light.sign", [0, 2.75, -0.6], { color: "#ffb000", intensity: 0.8, range: 8 });
    },
  },
);
