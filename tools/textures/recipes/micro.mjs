// Small repeating micro-detail materials for characters and props: cloth weave, leather grain,
// moulded plastic, rubber. Tile sizes are 0.25-0.5 m, so the patterns are exaggerated a little
// (real thread pitch is far below a pixel) to stay readable at game distances without shimmering.
import { Field, add, blur, clamp01, contrast, map, mix, mul, smoothstep, warp } from "../lib/field.mjs";
import { fbm, white, worley } from "../lib/noise.mjs";
import { line } from "../lib/draw.mjs";
import { Rgb, mixRgb, scaleRgb } from "../lib/color.mjs";
import { hash2 } from "../lib/rng.mjs";

const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const centred = (f) => map(f, (v) => v - 0.5);
/** fbm output hugs 0.5; stretch it so thresholds pick sensible coverage. */
const st = (f, gain = 2.3) => clamp01(contrast(f, gain));
/** Cycles per tile for a feature size, clamped below Nyquist/2 so fbm never runs out of octaves. */
const cyc = (ctx, m) => ctx.cycles(m).map((c, i) => Math.min(c, (i === 0 ? ctx.w : ctx.h) / 4));
const grey = (w, h, v) => Rgb.filled(w, h, [v, v, v]);

export const recipes = [
  // ---------------------------------------------------------------- woven cloth
  {
    id: "mat_char_cloth",
    tileSizeM: 0.25,
    size: [256, 256],
    relief: { depthM: 0.0015, strength: 1.2 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1 },
    note: "2/2 twill weave, mid-grey so baseColor / vertex colour can tint it",
    build(ctx) {
      const { w, h } = ctx;
      const threads = 32; // per tile each way, 8 px per thread; divisible by the 4-thread twill repeat
      const cell = w / threads;
      const height = new Field(w, h);
      const tone = new Field(w, h);
      const prof = (t) => Math.pow(Math.sin(Math.PI * t), 0.65); // rounded thread cross-section
      for (let y = 0; y < h; y++) {
        const gy = y / cell;
        const j = Math.floor(gy);
        const b = gy - j;
        for (let x = 0; x < w; x++) {
          const gx = x / cell;
          const i = Math.floor(gx);
          const a = gx - i;
          const warpOver = ((i + j) & 3) < 2; // vertical (warp) threads are on top in half the cells
          let hv;
          let tn;
          if (warpOver) {
            hv = 0.2 + 0.7 * prof(a) * (0.35 + 0.65 * Math.pow(Math.sin(Math.PI * b), 0.6));
            tn = 0.94 + 0.12 * hash2(i, 0, ctx.sub(1));
          } else {
            hv = 0.2 + 0.7 * prof(b) * (0.35 + 0.65 * Math.pow(Math.sin(Math.PI * a), 0.6));
            tn = 0.94 + 0.12 * hash2(j, 1, ctx.sub(2));
          }
          // slubs: slow variation along each thread
          const slub = 0.94 + 0.12 * hash2(warpOver ? i : j, Math.floor(warpOver ? gy / 3 : gx / 3), ctx.sub(3));
          height.data[y * w + x] = hv;
          tone.data[y * w + x] = tn * slub * (0.55 + 0.45 * hv);
        }
      }
      const fibre = white(w, h, ctx.sub(4));
      const [lx, ly] = cyc(ctx, 0.06);
      const blotch = st(fbm(w, h, { fx: lx, fy: ly, octaves: 3, seed: ctx.sub(5) }));
      const hh = blur(add(height, mul(centred(fibre), 0.05)), 1, 1);
      const albedo = scaleRgb(grey(w, h, 0.42), add(add(0.78, mul(tone, 0.4)), mul(centred(blotch), 0.15)));
      return { albedo, height: hh, roughness: add(0.9, mul(centred(fibre), 0.05)), metallic: 0 };
    },
  },

  // ---------------------------------------------------------------- leather
  {
    id: "mat_char_leather",
    tileSizeM: 0.25,
    size: [256, 256],
    relief: { depthM: 0.0015, strength: 1.3 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1 },
    note: "fine pebbled leather grain, darker creases, uneven sheen",
    build(ctx) {
      const { w, h } = ctx;
      const [gx, gy] = cyc(ctx, 0.009);
      const coarse = worley(w, h, gx, gy, ctx.sub(1), 0.85);
      const [hx, hy] = cyc(ctx, 0.005);
      const fine = worley(w, h, Math.min(hx, w / 3), Math.min(hy, h / 3), ctx.sub(2), 0.9);
      // Wobble the cell outlines so the grain does not look like a pure Voronoi diagram.
      const [wx, wy] = cyc(ctx, 0.05);
      const wob1 = fbm(w, h, { fx: wx, fy: wy, octaves: 3, seed: ctx.sub(3) });
      const wob2 = fbm(w, h, { fx: wx, fy: wy, octaves: 3, seed: ctx.sub(4) });
      const edge = warp(coarse.edge, wob1, wob2, 2.5);
      const edge2 = warp(fine.edge, wob2, wob1, 1.5);
      const pebble = map(edge, (e) => Math.pow(ss(0.02, 0.4, e), 0.7));
      const pebble2 = map(edge2, (e) => ss(0.03, 0.35, e));
      const height = blur(add(add(mul(pebble, 0.75), mul(pebble2, 0.2)), mul(centred(coarse.id), 0.06)), 1, 1);
      const [lx, ly] = cyc(ctx, 0.08);
      const sheenN = st(fbm(w, h, { fx: lx, fy: ly, octaves: 4, seed: ctx.sub(5) }));
      const crease = map(pebble, (p) => 1 - p);

      const base = [0.22, 0.15, 0.12];
      const albedo = new Rgb(w, h);
      for (let i = 0; i < w * h; i++) {
        const k = (0.88 + 0.24 * coarse.id.data[i]) * (1 - 0.25 * crease.data[i]) * (0.9 + 0.2 * sheenN.data[i]);
        for (let c = 0; c < 3; c++) albedo.data[i * 3 + c] = base[c] * k;
      }
      // Creases are rougher and dull, pebble tops are worn smooth and a bit glossier.
      let roughness = add(0.5, mul(centred(sheenN), 0.16));
      roughness = mix(roughness, 0.68, mul(crease, 0.8));
      return { albedo, height, roughness, metallic: 0 };
    },
  },

  // ---------------------------------------------------------------- injection-moulded plastic
  {
    id: "mat_prop_plastic",
    tileSizeM: 0.5,
    size: [256, 256],
    relief: { depthM: 0.0008, strength: 1 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1 },
    note: "light-grey moulded plastic with fine orange-peel texture and faint flow marks; tint with baseColor",
    build(ctx) {
      const { w, h } = ctx;
      const [px, py] = cyc(ctx, 0.016);
      const peel = st(fbm(w, h, { fx: px, fy: py, octaves: 3, seed: ctx.sub(1) }), 2.6);
      const grain = blur(white(w, h, ctx.sub(2)), 1, 1);
      // Flow marks: soft streaks along one direction.
      const flow = st(fbm(w, h, { fx: 2, fy: Math.min(Math.round(ctx.sizeM[1] / 0.04), h / 4), octaves: 3, seed: ctx.sub(3) }));
      const [mx, my] = cyc(ctx, 0.25);
      const mottle = st(fbm(w, h, { fx: mx, fy: my, octaves: 3, seed: ctx.sub(4) }));
      const height = add(add(mul(peel, 0.7), mul(centred(grain), 0.4)), mul(flow, 0.1));
      const albedo = scaleRgb(grey(w, h, 0.55), add(add(0.94, mul(centred(mottle), 0.1)), mul(centred(flow), 0.04)));
      let roughness = add(0.42, mul(centred(peel), 0.1));
      roughness = add(roughness, add(mul(centred(mottle), 0.08), mul(centred(flow), 0.05)));
      return { albedo, height, roughness, metallic: 0 };
    },
  },

  // ---------------------------------------------------------------- rubber
  {
    id: "mat_prop_rubber",
    tileSizeM: 0.5,
    size: [256, 256],
    relief: { depthM: 0.001, strength: 1 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1 },
    note: "matte black rubber: fine grain, a moulding parting line, sparse pits, dusty patches",
    build(ctx) {
      const { w, h } = ctx;
      const ppm = ctx.pxPerM[0];
      const [gx, gy] = cyc(ctx, 0.012);
      const grain = st(fbm(w, h, { fx: gx, fy: gy, octaves: 3, seed: ctx.sub(1) }), 2.4);
      const speck = blur(white(w, h, ctx.sub(2)), 1, 1);
      const [dx, dy] = cyc(ctx, 0.08);
      const dust = smoothstep(st(fbm(w, h, { fx: dx, fy: dy, octaves: 5, seed: ctx.sub(3) })), 0.5, 0.85);

      // Parting line: a thin raised flash ridge across the tile (horizontal), plus a faint vertical one.
      const flash = new Field(w, h);
      line(flash, -4, h * 0.5, w + 4, h * 0.5, ppm * 0.004, 1, { mode: "max" });
      line(flash, w * 0.25, -4, w * 0.25, h + 4, ppm * 0.002, 0.6, { mode: "max" });
      const flashSoft = blur(flash, 1, 1);

      // Sparse pits: the tail of a cellular pattern.
      const [pxc, pyc] = cyc(ctx, 0.05);
      const cells = worley(w, h, pxc, pyc, ctx.sub(4), 1);
      const pit = mul(map(cells.f1, (d) => ss(0.22, 0.08, d)), map(cells.id, (v) => ss(0.85, 0.92, v)));

      const height = add(add(add(mul(grain, 0.45), mul(centred(speck), 0.3)), mul(flashSoft, 0.35)), mul(pit, -0.35));
      const albedo = scaleRgb(grey(w, h, 0.075), add(add(0.85, mul(centred(grain), 0.4)), mul(dust, 0.2)));
      const albedoDusty = mixRgb(albedo, [0.2, 0.2, 0.21], mul(dust, 0.12));
      const roughness = add(add(0.85, mul(centred(grain), 0.06)), mul(dust, 0.08));
      return { albedo: albedoDusty, height, roughness: clamp01(roughness), metallic: 0 };
    },
  },
];

