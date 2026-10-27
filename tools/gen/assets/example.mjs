// Reference assets showing the builder API. Copy the style when adding new ones.
import { TAU } from "../lib/math.mjs";

export const assets = [
  {
    id: "prop_bollard_a",
    category: "prop",
    budget: 120,
    build(b) {
      // lathe: [radius, y] profile from bottom to top, 8 sides
      b.lathe("mat_metal_painted_dark", [[0.12, 0], [0.12, 0.85], [0.1, 0.9], [0.1, 0.95], [0, 0.95]], { seg: 8 });
      // reflective band, slightly proud of the post
      b.lathe("mat_neon_amber", [[0.125, 0.7], [0.125, 0.78]], { seg: 8 });
      b.collider({ c: [0, 0.475, 0], h: [0.12, 0.475, 0.12] });
    },
  },
  {
    id: "prop_trash_bin_a",
    category: "prop",
    budget: 220,
    build(b) {
      b.ao = { y0: 0, y1: 0.4, lo: 0.6, hi: 1 };
      b.cylinder("mat_metal_galvanized", { y0: 0, y1: 0.9, r: 0.28, r1: 0.3, seg: 10, cap: "bottom" });
      b.lathe("mat_metal_painted_dark", [[0.3, 0.9], [0.32, 0.92], [0.32, 0.97], [0.2, 1.02], [0.0, 1.02]], { seg: 10 });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + 0.4;
        b.with({ pos: [Math.cos(a) * 0.3, 0.45, Math.sin(a) * 0.3], rotY: -a }, () => {
          b.boxC("mat_metal_rust", [0, 0, 0], [0.03, 0.5, 0.05]);
        });
      }
      b.collider({ c: [0, 0.5, 0], h: [0.32, 0.5, 0.32] });
    },
  },
];
