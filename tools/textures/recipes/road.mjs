// Road surfaces: dry and wet asphalt (same base so decals and puddles line up), plus worn paint.
import { Field, add, blur, invert, map, mix, mul, smoothstep } from "../lib/field.mjs";
import { fbm, ridged, white, worley } from "../lib/noise.mjs";
import { rect } from "../lib/draw.mjs";
import { Rgb, fromChannels, hex, mixRgb, scaleRgb } from "../lib/color.mjs";
import { rng } from "../lib/rng.mjs";

/** Shared asphalt structure: stone aggregate in dark binder, blotchy wear, cracks, repair patches. */
function asphaltBase(ctx) {
  const { w, h } = ctx;
  const [bx, by] = ctx.cycles(2.2);
  const blotch = fbm(w, h, { fx: bx, fy: by, octaves: 5, seed: ctx.sub(1) });
  const [mx, my] = ctx.cycles(0.7);
  const mottle = fbm(w, h, { fx: mx, fy: my, octaves: 4, seed: ctx.sub(2) });

  // Aggregate: ~2.5 cm cells, a pebble per cell; some stay buried (id threshold).
  const [gx, gy] = ctx.cycles(0.025);
  const stones = worley(w, h, gx, gy, ctx.sub(3), 0.95);
  const body = map(stones.f1, (d) => Math.max(0, 1 - d / 0.5)); // 1 at the stone centre
  const exposed = map(stones.id, (v) => (v > 0.4 ? 1 : 0.15));
  const pebble = mul(smoothstep(body, 0.25, 0.7), exposed);
  const tone = map(stones.id, (v) => 0.16 + v * 0.26);

  // Repair patches: a few smooth rectangles with a visible step at the border.
  const r = rng(ctx.sub(4));
  const patch = new Field(w, h);
  for (let i = 0; i < 3; i++) {
    const pw = (0.7 + r() * 1.1) * ctx.pxPerM[0];
    const ph = (0.6 + r() * 1.0) * ctx.pxPerM[1];
    const x0 = r() * w;
    const y0 = r() * h;
    rect(patch, x0, y0, x0 + pw, y0 + ph, 1, { mode: "max", radius: 4 });
  }
  const patchSoft = blur(patch, 1, 1);

  // Cracks: thin dark creases following ridged noise, only in some regions.
  const [cx, cy] = ctx.cycles(1.6);
  const creases = ridged(w, h, { fx: cx, fy: cy, octaves: 4, seed: ctx.sub(5) });
  const crackZone = smoothstep(fbm(w, h, { fx: bx, fy: by, octaves: 3, seed: ctx.sub(6) }), 0.5, 0.65);
  const crack = mul(smoothstep(creases, 0.9, 0.985), crackZone);

  // Oil / rubber stains: broad dark smooth areas.
  const [sx, sy] = ctx.cycles(1.1);
  const stain = smoothstep(fbm(w, h, { fx: sx, fy: sy, octaves: 4, seed: ctx.sub(7) }), 0.6, 0.78);

  const fine = white(w, h, ctx.sub(8));
  const binder = add(0.085, mul(blotch, 0.06));
  let lum = mix(binder, tone, mul(pebble, 0.9));
  lum = add(lum, mul(map(fine, (v) => v - 0.5), 0.03));
  lum = mix(lum, mul(lum, 0.8), patchSoft); // patches are slightly darker/fresher
  lum = mul(lum, map(stain, (s) => 1 - s * 0.4));
  lum = mul(lum, map(crack, (c) => 1 - c * 0.85));
  lum = mul(lum, add(0.85, mul(mottle, 0.3)));

  // Slight cool/warm variation: binder leans blue-grey, stones lean warm.
  const warm = mix(0, 1, mul(pebble, tone));
  const albedo = fromChannels(
    add(lum, mul(warm, 0.02)),
    lum,
    add(lum, mul(map(warm, (v) => -v), 0.012)),
  );
  const tint = new Rgb(w, h);
  for (let i = 0; i < w * h; i++) {
    tint.data[i * 3] = albedo.data[i * 3] + 0.004;
    tint.data[i * 3 + 1] = albedo.data[i * 3 + 1] + 0.005;
    tint.data[i * 3 + 2] = albedo.data[i * 3 + 2] + 0.01;
  }

  // Height in 0..1: stones stand proud, cracks and patch borders sink.
  let height = add(mul(pebble, 0.55), mul(blotch, 0.1));
  height = add(height, mul(map(fine, (v) => v - 0.5), 0.06));
  height = add(height, mul(patchSoft, -0.0));
  height = add(height, map(crack, (c) => -c * 0.55));
  height = add(height, mul(map(blur(patch, 2, 2), (v) => v), 0.12));
  return { albedo: tint, height, stain, crack, patchSoft, blotch, mottle, ctx };
}


export const recipes = [
  {
    id: "mat_road_asphalt",
    tileSizeM: 4,
    size: [1024, 1024],
    relief: { depthM: 0.012, strength: 1.2 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, envIntensity: 0.8 },
    note: "dry city asphalt: aggregate, cracks, repair patches, oil stains",
    build(ctx) {
      const b = asphaltBase(ctx);
      // Dry asphalt is rough; stains and polished mottling are a bit glossier.
      const roughness = add(0.9, add(mul(b.stain, -0.18), mul(map(b.mottle, (v) => v - 0.5), -0.12)));
      return { albedo: b.albedo, height: b.height, roughness, metallic: 0 };
    },
  },
  {
    id: "mat_road_asphalt_wet",
    tileSizeM: 4,
    size: [1024, 1024],
    relief: { depthM: 0.012, strength: 1.2 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, envIntensity: 1.5 },
    note: "rain-soaked asphalt: damp film everywhere, mirror puddles in the low spots (same layout as mat_road_asphalt)",
    build(ctx) {
      const b = asphaltBase(ctx);
      const { w, h } = ctx;
      // Puddles collect where the broad blotch noise is low; edges stay soft and irregular.
      const [px, py] = ctx.cycles(1.8);
      const lowFreq = fbm(w, h, { fx: px, fy: py, octaves: 4, seed: ctx.sub(21) });
      const detail = fbm(w, h, { fx: px * 4, fy: py * 4, octaves: 3, seed: ctx.sub(22) });
      const depthField = add(mul(lowFreq, 0.8), mul(detail, 0.2));
      const puddle = smoothstep(invert(depthField), 0.55, 0.62);
      const rim = mul(smoothstep(invert(depthField), 0.5, 0.56), invert(puddle)); // damp ring around puddles

      // Wet aggregate is darker and more saturated; puddles hide the surface under still water.
      const wetAlbedo = scaleRgb(b.albedo, 0.55);
      const waterTint = scaleRgb(Rgb.filled(w, h, hex("#0b0e12")), 1);
      const albedo = mixRgb(wetAlbedo, waterTint, mul(puddle, 0.85));

      // Water fills the surface relief: flatten height inside puddles.
      const height = mix(b.height, 0.25, mul(puddle, 0.97));
      // Damp film (0.28) with some variation, glassy water (0.045) in the puddles, rim in between.
      let roughness = add(0.3, mul(map(b.mottle, (v) => v - 0.5), 0.2));
      roughness = mix(roughness, 0.22, rim);
      roughness = mix(roughness, 0.045, puddle);
      // Subtle ripples/dirt inside the puddles keep reflections from looking CG-perfect.
      const ripple = fbm(w, h, { fx: px * 10, fy: py * 10, octaves: 2, seed: ctx.sub(23) });
      roughness = add(roughness, mul(mul(puddle, map(ripple, (v) => v - 0.5)), 0.04));
      return { albedo, height, roughness, metallic: 0 };
    },
  },
];
