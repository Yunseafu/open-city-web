// Props that the models thread tints through COLOR_0 (container, awning) or textures lightly (wood).
import { Field, add, blur, invert, map, mix, mul, normalize, smoothstep } from "../lib/field.mjs";
import { fbm, perlin, white, worley } from "../lib/noise.mjs";
import { Rgb, fromChannels, mixRgb, ramp } from "../lib/color.mjs";
import { hash2 } from "../lib/rng.mjs";

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Trapezoid corrugation profile over t in [0, 1): flat valley, ramp, flat crest, ramp. */
const rib = (t) => sstep(0.12, 0.32, t) * (1 - sstep(0.62, 0.82, t));

export const recipes = [
  {
    id: "mat_metal_container",
    tileSizeM: 2,
    size: [1024, 1024],
    relief: { depthM: 0.03, strength: 1 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, envIntensity: 1 },
    note: "corrugated shipping-container steel, light neutral paint so COLOR_0 tints it; chipped to rust and bare steel at the crests",
    build(ctx) {
      const { w, h } = ctx;
      const RIBS = 20; // 0.1 m pitch
      const profile = Field.from(w, h, (x) => rib((x / w) * RIBS - Math.floor((x / w) * RIBS)));
      // Vertical streaks: long in V, fine in U.
      const streak = fbm(w, h, { fx: RIBS * 2, fy: 2, octaves: 3, seed: ctx.sub(1) });
      const blotch = fbm(w, h, { fx: 3, fy: 3, octaves: 4, seed: ctx.sub(2) });
      const dirt = smoothstep(add(mul(streak, 0.6), mul(blotch, 0.4)), 0.5, 0.78);

      // Paint chips: ragged holes, much more likely on the raised crests.
      const [cx, cy] = ctx.cycles(0.25);
      const cells = worley(w, h, cx, cy, ctx.sub(3), 1);
      const fine = fbm(w, h, { fx: 60, fy: 60, octaves: 3, seed: ctx.sub(4) });
      const chip = Field.from(w, h, (x, y) => {
        const i = y * w + x;
        const reach = 0.1 + profile.data[i] * 0.16;
        if (cells.id.data[i] < 0.55) return 0;
        return sstep(0, 0.04, reach + (fine.data[i] - 0.5) * 0.35 - cells.f1.data[i]);
      });
      const rust = mul(chip, smoothstep(blotch, 0.35, 0.6)); // chips that went to rust
      const bare = mul(chip, invert(rust)); // chips that show bright steel

      const paint = Field.from(w, h, (x, y) => {
        const i = y * w + x;
        return 0.74 * (1 - dirt.data[i] * 0.4) * (1 + (blotch.data[i] - 0.5) * 0.16);
      });
      const paintRgb = fromChannels(paint, mul(paint, 1.01), mul(paint, 1.03));
      const rustRgb = ramp(add(mul(fine, 0.7), mul(blotch, 0.3)), [
        [0, [0.18, 0.08, 0.05]],
        [0.6, [0.42, 0.2, 0.09]],
        [1, [0.55, 0.3, 0.12]],
      ]);
      const steel = Rgb.filled(w, h, [0.62, 0.63, 0.65]);
      let albedo = mixRgb(paintRgb, rustRgb, rust);
      albedo = mixRgb(albedo, steel, bare);

      const height = add(mul(profile, 0.8), mul(map(chip, (v) => -v), 0.06));
      const roughness = Field.from(w, h, (x, y) => {
        const i = y * w + x;
        const p = 0.52 + dirt.data[i] * 0.2 + (fine.data[i] - 0.5) * 0.1;
        return mix1(mix1(p, 0.85, rust.data[i]), 0.32, bare.data[i]);
      });
      return { albedo, height, roughness, metallic: bare };
    },
  },
  {
    id: "mat_fabric_awning",
    tileSizeM: 1,
    size: [512, 512],
    relief: { depthM: 0.006, strength: 1 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1 },
    note: "canvas awning, near-white so COLOR_0 tints it; plain weave with soft sag folds and grime",
    build(ctx) {
      const { w, h } = ctx;
      const P = 4; // px per thread
      const weave = Field.from(w, h, (x, y) => {
        const gx = Math.floor(x / P);
        const gy = Math.floor(y / P);
        const u = ((x % P) + 0.5) / P;
        const v = ((y % P) + 0.5) / P;
        // Over/under plain weave: the visible thread alternates between warp and weft.
        const warpOver = (gx + gy) % 2 === 0;
        const dome = warpOver ? Math.sin(Math.PI * u) : Math.sin(Math.PI * v);
        return 0.35 + 0.65 * dome;
      });
      const [fx, fy] = ctx.cycles(0.5);
      const folds = fbm(w, h, { fx: 2, fy: Math.max(2, fy / 2), octaves: 3, seed: ctx.sub(1) });
      const dirt = smoothstep(fbm(w, h, { fx: 4, fy: 4, octaves: 4, seed: ctx.sub(2) }), 0.5, 0.8);
      const thread = white(w / P, h / P, ctx.sub(3));
      const tone = Field.from(w, h, (x, y) => {
        const i = y * w + x;
        const t = thread.data[Math.floor(y / P) * (w / P) + Math.floor(x / P)];
        return 0.86 * (0.9 + 0.1 * weave.data[i]) * (1 - dirt.data[i] * 0.16) * (0.97 + t * 0.06) * (0.94 + folds.data[i] * 0.12);
      });
      const albedo = fromChannels(tone, mul(tone, 0.995), mul(tone, 0.98));
      const height = add(mul(weave, 0.5), mul(folds, 0.5));
      return { albedo, height, roughness: add(0.9, mul(dirt, 0.05)), metallic: 0 };
    },
  },
  {
    id: "mat_prop_wood",
    tileSizeM: 1,
    size: [512, 512],
    relief: { depthM: 0.01, strength: 1 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1 },
    note: "weathered dark planks 12.5 cm wide running along U, grooves, knots, grime",
    build(ctx) {
      const { w, h } = ctx;
      const PLANKS = 8;
      const ph = h / PLANKS;
      const grainBase = fbm(w, h, { fx: 3, fy: 56, octaves: 4, gain: 0.6, seed: ctx.sub(1) });
      const fine = fbm(w, h, { fx: 6, fy: 220, octaves: 2, seed: ctx.sub(2) });
      const weather = fbm(w, h, { fx: 5, fy: 4, octaves: 4, seed: ctx.sub(3) });
      const knots = [];
      for (let p = 0; p < PLANKS; p++) {
        if (hash2(p, 1, ctx.seed) > 0.4) knots.push({ x: hash2(p, 2, ctx.seed) * w, y: (p + 0.5) * ph, r: ph * (0.12 + hash2(p, 3, ctx.seed) * 0.1) });
      }
      const grooves = new Field(w, h);
      const plankTone = new Float32Array(h);
      const shift = new Float32Array(PLANKS);
      for (let p = 0; p < PLANKS; p++) shift[p] = hash2(p, 9, ctx.seed) * w;
      const grain = Field.from(w, h, (x, y) => {
        const p = Math.floor(y / ph) % PLANKS;
        return grainBase.at(x + Math.round(shift[p]), y);
      });
      const hgt = new Field(w, h);
      for (let y = 0; y < h; y++) {
        const p = Math.floor(y / ph);
        const t = (y - p * ph) / ph;
        const edge = Math.min(t, 1 - t) * ph; // px from the plank edge
        const groove = 1 - sstep(1, 3.5, edge);
        plankTone[y] = 0.82 + hash2(p, 5, ctx.seed) * 0.36;
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          grooves.data[i] = groove;
          let ring = 0;
          for (const k of knots) {
            const dx = Math.min(Math.abs(x - k.x), w - Math.abs(x - k.x));
            const d = Math.hypot(dx, (y - k.y) * 2.2) / k.r;
            if (d < 2.4) ring = Math.max(ring, (1 - d / 2.4) * (0.5 + 0.5 * Math.sin(d * 9)));
          }
          hgt.data[i] = ring;
        }
      }
      const tone = Field.from(w, h, (x, y) => {
        const i = y * w + x;
        const g = grain.data[i] * 0.7 + fine.data[i] * 0.3;
        return plankTone[y] * (0.62 + g * 0.55) * (1 - grooves.data[i] * 0.8) * (1 - hgt.data[i] * 0.25) * (0.85 + weather.data[i] * 0.3);
      });
      const albedo = ramp(map(tone, (v) => clamp(v, 0, 1.2) / 1.2), [
        [0, [0.04, 0.025, 0.018]],
        [0.5, [0.2, 0.13, 0.085]],
        [1, [0.36, 0.25, 0.17]],
      ]);
      const height = Field.from(w, h, (x, y) => {
        const i = y * w + x;
        return clamp(0.6 + (grain.data[i] - 0.5) * 0.35 + hgt.data[i] * 0.15 - grooves.data[i] * 0.55, 0, 1);
      });
      return { albedo, height, roughness: add(0.82, mul(map(weather, (v) => v - 0.5), 0.14)), metallic: 0 };
    },
  },
];

function mix1(a, b, t) {
  return a + (b - a) * t;
}
