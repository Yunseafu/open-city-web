// Metals and dark glass: worn plate, painted steel, galvanized sheet, rust, wall cladding, smoky glass.
// Metals store reflectance colour in albedo and metallic 1 only where the surface is bare;
// painted / rusted areas are dielectrics (metallic 0). Roughness carries most of the look.
import { Field, add, blur, clamp01, contrast, gradientMagnitude, invert, map, mix, mul, smoothstep } from "../lib/field.mjs";
import { fbm, perlin, white, worley } from "../lib/noise.mjs";
import { disc, line, rect } from "../lib/draw.mjs";
import { Rgb, fromChannels, hex, mixRgb, ramp, scaleRgb } from "../lib/color.mjs";
import { cavityAO } from "../lib/maps.mjs";
import { hash2, rng } from "../lib/rng.mjs";

const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const centred = (f) => map(f, (v) => v - 0.5);
/** fbm output hugs 0.5; stretch it so thresholds pick sensible coverage. */
const st = (f, gain = 2.3) => clamp01(contrast(f, gain));

/**
 * Cellular pattern with one jittered point per cell. Per pixel: id / id2 (random per cell), dx / dy
 * (offset to the nearest point in cell units), f1 and edge (= f2 - f1, 0 on cell borders). Tileable.
 */
function cells(w, h, fx, fy, seed, jitter = 0.9) {
  const px = new Float32Array(fx * fy);
  const py = new Float32Array(fx * fy);
  const id = new Float32Array(fx * fy);
  const id2 = new Float32Array(fx * fy);
  for (let j = 0; j < fy; j++) {
    for (let i = 0; i < fx; i++) {
      const k = j * fx + i;
      px[k] = 0.5 + (hash2(i, j, seed) - 0.5) * jitter;
      py[k] = 0.5 + (hash2(i, j, seed + 7919) - 0.5) * jitter;
      id[k] = hash2(i, j, seed + 15485863);
      id2[k] = hash2(i, j, seed + 32452843);
    }
  }
  const cw = w / fx;
  const ch = h / fy;
  const out = { id: new Field(w, h), id2: new Field(w, h), dx: new Field(w, h), dy: new Field(w, h), f1: new Field(w, h), edge: new Field(w, h) };
  for (let y = 0; y < h; y++) {
    const cj = Math.floor(y / ch);
    for (let x = 0; x < w; x++) {
      const ci = Math.floor(x / cw);
      let d1 = Infinity;
      let d2 = Infinity;
      let best = 0;
      let bx = 0;
      let by = 0;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          const i = ci + di;
          const j = cj + dj;
          const k = (((j % fy) + fy) % fy) * fx + (((i % fx) + fx) % fx);
          const ox = (i + px[k]) * cw - x;
          const oy = (j + py[k]) * ch - y;
          const d = ox * ox + oy * oy;
          if (d < d1) {
            d2 = d1;
            d1 = d;
            best = k;
            bx = ox;
            by = oy;
          } else if (d < d2) {
            d2 = d;
          }
        }
      }
      const o = y * w + x;
      const norm = 1 / Math.sqrt(cw * ch);
      out.id.data[o] = id[best];
      out.id2.data[o] = id2[best];
      out.dx.data[o] = -bx / cw;
      out.dy.data[o] = -by / ch;
      out.f1.data[o] = Math.sqrt(d1) * norm;
      out.edge.data[o] = (Math.sqrt(d2) - Math.sqrt(d1)) * norm;
    }
  }
  return out;
}

/** Random thin scratches around a dominant angle (radians); value = brightness of the scratch. */
function scratches(w, h, r, { count, minLen, maxLen, thick, angle = 0, spread = Math.PI, value = 1 }) {
  const f = new Field(w, h);
  for (let i = 0; i < count; i++) {
    const x = r() * w;
    const y = r() * h;
    const a = angle + (r() - 0.5) * spread;
    const len = minLen + r() * (maxLen - minLen);
    const bend = (r() - 0.5) * 0.4;
    const mx = x + Math.cos(a + bend) * len * 0.5;
    const my = y + Math.sin(a + bend) * len * 0.5;
    const t = thick * (0.6 + r() * 0.8);
    const v = value * (0.35 + 0.65 * r());
    line(f, x, y, mx, my, t, v, { mode: "max" });
    line(f, mx, my, x + Math.cos(a) * len, y + Math.sin(a) * len, t, v, { mode: "max" });
  }
  return f;
}

/** Rust / water streaks running down (+y) from the given pixel positions. */
function drips(f, r, points, { len, width, value = 1 }) {
  for (const [x, y] of points) {
    const L = len[0] + r() * (len[1] - len[0]);
    const steps = 10;
    for (let k = 0; k < steps; k++) {
      line(f, x + (r() - 0.5) * 0.6, y + (L * k) / steps, x, y + (L * (k + 1)) / steps, width * (1 - k / steps * 0.5), value * Math.pow(1 - k / steps, 1.4), { mode: "max" });
    }
  }
}

const BARE = hex("#8a8c90"); // bare steel reflectance (sRGB), a bit darker than polished
const RUST_DARK = hex("#2e170e");
const RUST_MID = hex("#5e2f15");
const RUST_LIGHT = hex("#8a4a1e");

export const recipes = [
  // ---------------------------------------------------------------- worn riveted plate
  {
    id: "mat_metal_plate_worn",
    tileSizeM: 2,
    size: [1024, 1024],
    relief: { depthM: 0.012, strength: 1 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, envIntensity: 1.1 },
    noSeamCheck: true, // plate borders sit on the tile border, so the wrap seam is a real plate joint
    note: "0.5 m welded steel plates, corner bolts, dark paint worn to bare steel at edges",
    build(ctx) {
      const { w, h } = ctx;
      const ppm = ctx.pxPerM[0];
      const r = rng(ctx.sub(1));
      const n = Math.round(ctx.sizeM[0] / 0.5); // plates per side
      const pw = w / n;
      const ph = h / n;

      // Per-pixel plate data: distance to the nearest seam (metres), seam-parallel coordinate, plate id.
      const dist = new Field(w, h);
      const along = new Field(w, h);
      const pid = new Field(w, h);
      for (let y = 0; y < h; y++) {
        const j = Math.floor(y / ph);
        const v = (y + 0.5) / ph - j;
        for (let x = 0; x < w; x++) {
          const i = Math.floor(x / pw);
          const u = (x + 0.5) / pw - i;
          const eu = Math.min(u, 1 - u);
          const ev = Math.min(v, 1 - v);
          const o = y * w + x;
          dist.data[o] = Math.min(eu, ev) * 0.5;
          along.data[o] = ev < eu ? x / w : y / h; // seam runs along x for horizontal seams
          pid.data[o] = hash2(i, j, ctx.sub(2));
        }
      }

      const [ax, ay] = ctx.cycles(0.45);
      const [bx, by] = ctx.cycles(0.05);
      const nA = st(fbm(w, h, { fx: ax, fy: ay, octaves: 5, seed: ctx.sub(3) }));
      const nB = st(fbm(w, h, { fx: bx, fy: by, octaves: 4, seed: ctx.sub(4) }));
      // Tall thin rain streaks (stretched noise), tile-safe.
      const streak = st(fbm(w, h, { fx: Math.round(ctx.sizeM[0] / 0.05), fy: 2, octaves: 3, seed: ctx.sub(9) }));

      // Weld bead on every plate joint: ridged, with fish-scale ripples along the seam.
      const rippleNoise = perlin(w, h, 24, 24, ctx.sub(5));
      const bead = Field.from(w, h, (x, y) => {
        const o = y * w + x;
        const d = dist.data[o];
        const ripple = 0.5 + 0.5 * Math.sin(along.data[o] * Math.PI * 2 * 256 + rippleNoise.data[o] * 5);
        const thick = 0.55 + 0.9 * rippleNoise.data[o];
        return Math.exp(-Math.pow(d / 0.0065, 2)) * (0.65 + 0.35 * ripple) * thick;
      });

      // Bolts: four per plate, hex-ish heads with a washer ring.
      const bolt = new Field(w, h);
      const ring = new Field(w, h);
      const boltPts = [];
      const inset = 0.05;
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          for (const [cx, cy] of [[inset, inset], [0.5 - inset, inset], [inset, 0.5 - inset], [0.5 - inset, 0.5 - inset]]) {
            const x = (i * 0.5 + cx) * ppm;
            const y = (j * 0.5 + cy) * ppm;
            if (r() < 0.06) continue; // a missing bolt
            disc(ring, x, y, ppm * 0.02, 1, { mode: "max", soft: 3 });
            disc(bolt, x, y, ppm * 0.0135, 1, { mode: "max" });
            boltPts.push([x, y]);
          }
        }
      }

      // Scratches mostly along one direction, as if dragged crates and boots.
      const scratch = scratches(w, h, rng(ctx.sub(6)), { count: 240, minLen: ppm * 0.05, maxLen: ppm * 0.4, thick: 1.1, angle: 0.35, spread: 0.9 });

      // Wear: edges, scratches, bolts, patchy by noise and per plate.
      const edgeWear = map(dist, (d) => ss(0.045, 0.004, d));
      const wearV = Field.from(w, h, (x, y) => {
        const o = y * w + x;
        return edgeWear.data[o] * 0.4 + (nB.data[o] - 0.5) * 0.75 + (nA.data[o] - 0.5) * 0.5 + scratch.data[o] * 0.55 + ring.data[o] * 0.12 + (pid.data[o] - 0.5) * 0.25;
      });
      const wear = map(blur(wearV, 1, 1), (v) => ss(0.47, 0.53, v));

      // Light surface rust on top of bare steel in damp spots, plus rust drips under bolts.
      const rustNoise = st(fbm(w, h, { fx: bx * 2, fy: by * 2, octaves: 4, seed: ctx.sub(7) }));
      const drip = new Field(w, h);
      drips(drip, rng(ctx.sub(8)), boltPts.filter(() => r() < 0.55), { len: [ppm * 0.06, ppm * 0.26], width: 3, value: 0.85 });
      const dripSoft = blur(drip, 1, 1);
      const rust = clamp01(add(mul(wear, map(rustNoise, (v) => ss(0.55, 0.75, v) * 0.8)), mul(dripSoft, 0.8)));

      // Grime gathers in seams, around bolts and in broad patches.
      const grime = clamp01(add(add(add(map(dist, (d) => ss(0.035, 0.006, d) * 0.65), mul(ring, 0.5)), mul(centred(nA), 0.5)), mul(streak, 0.15)));

      // Paint colour per plate: mostly blue-grey, some faded olive and oxide red.
      const palette = [hex("#202830"), hex("#272f37"), hex("#2b3427"), hex("#382a27")];
      const paint = new Rgb(w, h);
      for (let i = 0; i < w * h; i++) {
        const p = pid.data[i];
        const c = p < 0.4 ? palette[0] : p < 0.74 ? palette[1] : p < 0.9 ? palette[2] : palette[3];
        const k = (0.7 + 0.5 * nA.data[i] + (nB.data[i] - 0.5) * 0.3) * (0.82 + 0.3 * streak.data[i]);
        for (let ch = 0; ch < 3; ch++) paint.data[i * 3 + ch] = c[ch] * k;
      }
      let albedo = mixRgb(paint, BARE, wear);
      albedo = mixRgb(albedo, ramp(rustNoise, [[0.3, RUST_DARK], [0.6, RUST_MID], [1, RUST_LIGHT]]), rust);
      albedo = scaleRgb(albedo, map(grime, (g) => 1 - 0.55 * g));

      // Height: plate face, chamfered seam, weld bead, bolts; paint layer sits proud of bare steel.
      const height = Field.from(w, h, (x, y) => {
        const o = y * w + x;
        const face = 0.5 + (nB.data[o] - 0.5) * 0.06 + (1 - wear.data[o]) * 0.04;
        const chamfer = -0.14 * ss(0.014, 0.0, dist.data[o]);
        return face + chamfer + bead.data[o] * 0.4 + bolt.data[o] * 0.28 + ring.data[o] * 0.03 - scratch.data[o] * 0.05 - rust.data[o] * 0.05;
      });

      const metal = mul(wear, invert(rust));
      let roughness = add(0.5, add(mul(centred(nB), 0.25), mul(centred(streak), 0.12)));
      roughness = mix(roughness, add(0.36, mul(centred(nB), 0.18)), wear); // worn bare steel is smoother
      roughness = mix(roughness, 0.88, rust);
      roughness = mix(roughness, 0.82, mul(grime, 0.8));
      const ao = mul(cavityAO(height, { radiusPx: 7, strength: 3 }), map(grime, (g) => 1 - 0.35 * g));
      return { albedo, height, roughness, metallic: metal, ao };
    },
  },

  // ---------------------------------------------------------------- dark painted steel
  {
    id: "mat_metal_painted_dark",
    tileSizeM: 2,
    size: [512, 512],
    relief: { depthM: 0.003, strength: 1.5 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, envIntensity: 1.1 },
    note: "charcoal / blue-black painted panel: orange peel, hairline scratches, chips down to bare steel",
    build(ctx) {
      const { w, h } = ctx;
      const ppm = ctx.pxPerM[0];
      const r = rng(ctx.sub(1));
      const [ax, ay] = ctx.cycles(0.8);
      const nA = st(fbm(w, h, { fx: ax, fy: ay, octaves: 4, seed: ctx.sub(2) }));
      const [fx, fy] = ctx.cycles(0.03);
      const peel = st(fbm(w, h, { fx, fy, octaves: 3, seed: ctx.sub(3) }), 2.6);
      const [mx, my] = ctx.cycles(0.15);
      const mottle = st(fbm(w, h, { fx: mx, fy: my, octaves: 4, seed: ctx.sub(4) }));

      // Panel joints every 1 m (a shallow groove with a dark gap), tile-safe because 1 m divides the tile.
      const seam = new Field(w, h);
      for (let k = 0; k < 2; k++) {
        rect(seam, k * ppm - 1.2, -4, k * ppm + 1.2, h + 4, 1, { mode: "max" });
        rect(seam, -4, k * ppm - 1.2, w + 4, k * ppm + 1.2, 1, { mode: "max" });
      }
      const seamSoft = blur(seam, 1, 1);

      const scratch = scratches(w, h, rng(ctx.sub(5)), { count: 260, minLen: ppm * 0.03, maxLen: ppm * 0.3, thick: 1.2, angle: -0.5, spread: 1.4, value: 0.9 });

      // Chips: irregular small blobs, more of them near the joints.
      const chipBase = new Field(w, h);
      for (let i = 0; i < 230; i++) {
        const nearSeam = i < 70;
        const x = nearSeam ? (r() < 0.5 ? Math.round(r() * 2) * ppm + (r() - 0.5) * 22 : r() * w) : r() * w;
        const y = nearSeam ? (r() < 0.5 ? r() * h : Math.round(r() * 2) * ppm + (r() - 0.5) * 22) : r() * h;
        disc(chipBase, x, y, 0.8 + r() * r() * 2.8, 1, { mode: "max" });
      }
      const chipEdge = fbm(w, h, { fx: Math.min(fx * 3, w / 4), fy: Math.min(fy * 3, h / 4), octaves: 2, seed: ctx.sub(6) });
      const chip = map(blur(add(chipBase, mul(centred(chipEdge), 1.1)), 1, 1), (v) => ss(0.5, 0.62, v));
      const chipHalo = mul(map(blur(chip, 2, 2), (v) => ss(0.05, 0.4, v)), invert(chip)); // dark rust ring around a chip

      const grimeN = st(fbm(w, h, { fx: ax * 2, fy: ay * 2, octaves: 5, seed: ctx.sub(7) }));
      const grime = mul(smoothstep(grimeN, 0.55, 0.8), 0.6);

      const base = hex("#232a31");
      let paint = scaleRgb(Rgb.filled(w, h, base), add(0.7, add(mul(nA, 0.5), mul(centred(mottle), 0.3))));
      // Scratches expose a lighter primer coat.
      paint = mixRgb(paint, hex("#7a7e82"), mul(scratch, 0.6));
      paint = scaleRgb(paint, map(seamSoft, (s) => 1 - 0.5 * s));
      paint = scaleRgb(paint, map(grime, (g) => 1 - g * 0.5));
      const albedo = mixRgb(mixRgb(scaleRgb(paint, map(chipHalo, (v) => 1 - 0.5 * v)), hex("#3a2218"), mul(chipHalo, 0.5)), hex("#6e7075"), chip);

      const height = Field.from(w, h, (x, y) => {
        const o = y * w + x;
        return 0.55 + (peel.data[o] - 0.5) * 0.8 - seamSoft.data[o] * 0.4 - chip.data[o] * 0.15 - scratch.data[o] * 0.08;
      });
      let roughness = add(0.5, mul(centred(mottle), 0.2));
      roughness = add(roughness, mul(centred(peel), 0.08));
      roughness = mix(roughness, 0.7, grime);
      roughness = mix(roughness, 0.35, chip);
      return { albedo, height, roughness, metallic: chip };
    },
  },

  // ---------------------------------------------------------------- galvanized sheet
  {
    id: "mat_metal_galvanized",
    tileSizeM: 2,
    size: [512, 512],
    relief: { depthM: 0.004, strength: 3 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, envIntensity: 1.2 },
    note: "hot-dip galvanized sheet: faceted zinc spangle crystals, dull oxidised patches, scuffs",
    build(ctx) {
      const { w, h } = ctx;
      const ppm = ctx.pxPerM[0];
      const [sx, sy] = ctx.cycles(0.11);
      const sp = cells(w, h, sx, sy, ctx.sub(1), 1);
      const [ox, oy] = ctx.cycles(0.7);
      const patch = smoothstep(st(fbm(w, h, { fx: ox, fy: oy, octaves: 5, seed: ctx.sub(3) })), 0.55, 0.8);
      const [mx, my] = ctx.cycles(0.25);
      const mottle = st(fbm(w, h, { fx: mx, fy: my, octaves: 4, seed: ctx.sub(4) }));

      const scuff = scratches(w, h, rng(ctx.sub(5)), { count: 120, minLen: ppm * 0.04, maxLen: ppm * 0.35, thick: 1.1, angle: 0.2, spread: 1.6, value: 0.7 });
      const streak = smoothstep(st(fbm(w, h, { fx: Math.round(ctx.sizeM[0] / 0.04), fy: 2, octaves: 3, seed: ctx.sub(6) })), 0.55, 0.8);

      // Each crystal: own tone, a tilted facet, and a feathery dendrite star radiating from its centre.
      const zinc = [0.64, 0.66, 0.68];
      const albedo = new Rgb(w, h);
      const height = new Field(w, h);
      for (let i = 0; i < w * h; i++) {
        const theta = sp.id.data[i] * Math.PI * 2;
        const mag = 0.4 + 0.6 * sp.id2.data[i];
        const dx = sp.dx.data[i];
        const dy = sp.dy.data[i];
        const star = 0.5 + 0.5 * Math.cos(Math.atan2(dy, dx) * (5 + Math.floor(sp.id2.data[i] * 4)) + sp.id.data[i] * 6.28);
        const border = 1 - ss(0.0, 0.07, sp.edge.data[i]);
        let k = (0.8 + 0.32 * sp.id2.data[i]) * (1 + (star - 0.5) * 0.12 * ss(0.05, 0.5, sp.f1.data[i])) * (0.9 + 0.2 * mottle.data[i]);
        k *= 1 - 0.07 * border;
        k *= 1 - 0.2 * patch.data[i] - 0.14 * streak.data[i] - 0.22 * scuff.data[i];
        albedo.data[i * 3] = zinc[0] * k + patch.data[i] * 0.02;
        albedo.data[i * 3 + 1] = zinc[1] * k + patch.data[i] * 0.018;
        albedo.data[i * 3 + 2] = zinc[2] * k;
        height.data[i] = 0.5 + (dx * Math.cos(theta) + dy * Math.sin(theta)) * mag * 0.3 - border * 0.05 - scuff.data[i] * 0.04;
      }
      let roughness = add(0.4, add(mul(centred(sp.id), 0.12), mul(centred(mottle), 0.12)));
      roughness = mix(roughness, 0.72, patch);
      roughness = mix(roughness, 0.62, mul(streak, 0.7));
      roughness = add(roughness, mul(scuff, 0.14));
      return { albedo, height: blur(height, 1, 1), roughness, metallic: map(patch, (p) => 1 - 0.35 * p) };
    },
  },

  // ---------------------------------------------------------------- rust
  {
    id: "mat_metal_rust",
    tileSizeM: 2,
    size: [1024, 1024],
    relief: { depthM: 0.016, strength: 1.1 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, envIntensity: 1 },
    note: "heavy rust over dark scale: flaking grey-green paint, pitting, vertical streaks, scoured bare steel",
    build(ctx) {
      const { w, h } = ctx;
      const ppm = ctx.pxPerM[0];
      const [ax, ay] = ctx.cycles(0.9);
      const [bx, by] = ctx.cycles(0.12);
      const [cx, cy] = ctx.cycles(0.035);
      const nA = st(fbm(w, h, { fx: ax, fy: ay, octaves: 5, seed: ctx.sub(1) }));
      const nB = st(fbm(w, h, { fx: bx, fy: by, octaves: 5, seed: ctx.sub(2) }));
      const nC = st(fbm(w, h, { fx: cx, fy: cy, octaves: 3, seed: ctx.sub(3) }));
      const nD = st(fbm(w, h, { fx: ax * 2, fy: ay * 2, octaves: 4, seed: ctx.sub(8) }));

      // Layers from the top: paint remnants -> rust -> dark mill scale -> scoured bare steel.
      const paintV = add(mul(nA, 0.65), mul(nB, 0.35));
      const paint = blur(map(paintV, (v) => ss(0.6, 0.64, v)), 1, 1); // 1 = paint still there
      const paintRim = mul(smoothstep(paintV, 0.54, 0.6), invert(paint)); // lifting edge around flakes
      const rustAmt = smoothstep(add(mul(nB, 0.55), mul(nC, 0.45)), 0.22, 0.4);
      const pits = cells(w, h, ...ctx.cycles(0.06), ctx.sub(4), 1);
      pits.f1 = add(pits.f1, mul(centred(nC), 0.35)); // ragged pit outlines
      const pit = mul(mul(map(pits.f1, (d) => ss(0.42, 0.2, d)), map(pits.id, (v) => ss(0.78, 0.86, v))), invert(paint));
      const bareV = st(fbm(w, h, { fx: bx * 1.5, fy: by * 1.5, octaves: 4, seed: ctx.sub(5) }));
      const bare = blur(mul(smoothstep(bareV, 0.8, 0.86), invert(paint)), 3, 1);
      // Vertical streaks carry rust and water stains down the surface.
      const streak = smoothstep(st(fbm(w, h, { fx: Math.round(ctx.sizeM[0] / 0.035), fy: 2, octaves: 3, seed: ctx.sub(6) })), 0.5, 0.78);

      const r = rng(ctx.sub(7));
      const dripPts = [];
      for (let i = 0; i < 70; i++) dripPts.push([r() * w, r() * h]);
      const drip = new Field(w, h);
      drips(drip, r, dripPts, { len: [ppm * 0.15, ppm * 0.6], width: 2.5, value: 0.7 });
      const dripSoft = blur(drip, 1, 1);

      const rustCover = clamp01(add(add(mul(rustAmt, invert(paint)), mul(streak, 0.3)), mul(dripSoft, 0.7)));
      const rustTone = clamp01(add(add(add(mul(nD, 0.35), mul(nB, 0.4)), mul(streak, 0.25)), mul(pit, -0.35)));
      const rustCol = ramp(rustTone, [[0.0, RUST_DARK], [0.35, RUST_MID], [0.65, RUST_LIGHT], [1.0, hex("#9a6a38")]]);
      const scale = Rgb.filled(w, h, hex("#241a17")); // dark mill scale tinted brown
      const paintCol = scaleRgb(Rgb.filled(w, h, hex("#323d37")), add(add(0.65, mul(nA, 0.55)), mul(centred(nC), 0.2))); // faded grey-green

      let albedo = mixRgb(scale, rustCol, rustCover);
      albedo = mixRgb(albedo, paintCol, mul(paint, 0.97));
      albedo = scaleRgb(albedo, map(paintRim, (p) => 1 - 0.4 * p));
      albedo = mixRgb(albedo, BARE, bare);
      albedo = scaleRgb(albedo, map(pit, (p) => 1 - 0.45 * p));

      const height = Field.from(w, h, (x, y) => {
        const o = y * w + x;
        const layer = 0.28 + 0.2 * rustCover.data[o] + 0.3 * paint.data[o] - 0.1 * bare.data[o];
        return layer + paintRim.data[o] * 0.08 + (nC.data[o] - 0.5) * 0.14 + (nB.data[o] - 0.5) * 0.06 - pit.data[o] * 0.2;
      });
      let roughness = mix(0.9, 0.72, mul(streak, 0.4));
      roughness = mix(roughness, 0.5, paint);
      roughness = mix(roughness, 0.34, bare);
      roughness = add(roughness, mul(centred(nC), 0.14));
      roughness = mix(roughness, 0.97, pit);
      return { albedo, height, roughness, metallic: bare };
    },
  },

  // ---------------------------------------------------------------- trapezoid-rib wall cladding
  {
    id: "mat_wall_metal_cladding",
    tileSizeM: 2,
    size: [1024, 1024],
    relief: { depthM: 0.028, strength: 1 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, envIntensity: 1 },
    note: "vertical trapezoid-rib sheet cladding, grey-green paint, fastener rows with rust drips, worn crests",
    build(ctx) {
      const { w, h } = ctx;
      const ppm = ctx.pxPerM[0];
      const pitch = 0.2; // metres per rib
      const ribs = Math.round(ctx.sizeM[0] / pitch); // 10
      const r = rng(ctx.sub(1));

      // Trapezoid profile along x: valley centred on every rib boundary, flat crest in the middle.
      const profile = new Field(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const t = ((x + 0.5) / w) * ribs - Math.floor(((x + 0.5) / w) * ribs);
          profile.data[y * w + x] = ss(0.2, 0.32, t) * (1 - ss(0.68, 0.8, t));
        }
      }

      // Sheet laps: vertical joint every 1 m (in a valley), horizontal lap at the tile border.
      const lap = new Field(w, h);
      for (let k = 0; k < 2; k++) rect(lap, k * ppm - 1.5, -4, k * ppm + 1.5, h + 4, 1, { mode: "max" });
      rect(lap, -4, -1.8, w + 4, 1.8, 1, { mode: "max" });
      const lapSoft = blur(lap, 1, 1);

      // Fasteners on the crests, two rows per tile.
      const head = new Field(w, h);
      const washer = new Field(w, h);
      const fastPts = [];
      for (const rowM of [0.3, 1.3]) {
        for (let k = 0; k < ribs; k++) {
          if (r() < 0.08) continue;
          const x = (k + 0.5) * pitch * ppm;
          const y = rowM * ppm + (r() - 0.5) * 1.5;
          disc(washer, x, y, ppm * 0.017, 1, { mode: "max" });
          disc(head, x, y, ppm * 0.0105, 1, { mode: "max" });
          fastPts.push([x, y]);
        }
      }

      const [ax, ay] = ctx.cycles(0.6);
      const nA = st(fbm(w, h, { fx: ax, fy: ay, octaves: 5, seed: ctx.sub(2) }));
      const [bx, by] = ctx.cycles(0.05);
      const nB = st(fbm(w, h, { fx: bx, fy: by, octaves: 4, seed: ctx.sub(3) }));
      // Stretched noise: tall thin stains, tile-safe in both axes.
      const stainN = st(fbm(w, h, { fx: Math.round(ctx.sizeM[0] / 0.06), fy: 2, octaves: 3, seed: ctx.sub(4) }));
      const stain = smoothstep(stainN, 0.55, 0.8);

      const drip = new Field(w, h);
      drips(drip, rng(ctx.sub(5)), fastPts.filter(() => r() < 0.7), { len: [ppm * 0.1, ppm * 0.7], width: 3.2, value: 0.9 });
      const dripSoft = blur(drip, 1, 1);

      // Edge wear on the crest shoulders, where the paint is rubbed and chipped.
      const shoulder = map(gradientMagnitude(profile), (g) => Math.min(1, g * 90));
      const wearV = Field.from(w, h, (x, y) => {
        const o = y * w + x;
        return shoulder.data[o] * 0.22 + (nB.data[o] - 0.5) * 0.8 + (nA.data[o] - 0.5) * 0.4 + washer.data[o] * 0.1;
      });
      const wear = map(wearV, (v) => ss(0.34, 0.4, v));
      const rust = clamp01(add(mul(dripSoft, 0.85), mul(mul(wear, smoothstep(nA, 0.45, 0.68)), 0.8)));

      const paintBase = hex("#2c3933");
      let paint = scaleRgb(Rgb.filled(w, h, paintBase), add(0.78, add(mul(nA, 0.4), mul(centred(nB), 0.15))));
      paint = scaleRgb(paint, map(stain, (s) => 1 - 0.3 * s));
      paint = mixRgb(paint, hex("#3a3630"), mul(stain, 0.35)); // faint brown tint in the stains
      const galv = hex("#80848a");
      let albedo = mixRgb(paint, galv, wear);
      albedo = mixRgb(albedo, ramp(nB, [[0.2, RUST_DARK], [0.6, RUST_MID], [1, RUST_LIGHT]]), rust);
      albedo = mixRgb(albedo, hex("#9a9ca0"), mul(washer, 0.55)); // zinc washers
      albedo = scaleRgb(albedo, map(lapSoft, (l) => 1 - 0.45 * l));

      const height = Field.from(w, h, (x, y) => {
        const o = y * w + x;
        return 0.15 + 0.6 * profile.data[o] + head.data[o] * 0.1 + washer.data[o] * 0.04 - lapSoft.data[o] * 0.12 + (nB.data[o] - 0.5) * 0.02;
      });
      let roughness = add(0.5, mul(centred(nA), 0.2));
      roughness = mix(roughness, 0.6, mul(stain, 0.6));
      roughness = mix(roughness, 0.4, wear);
      roughness = mix(roughness, 0.85, rust);
      roughness = mix(roughness, 0.3, mul(head, 0.8));
      const ao = mul(map(profile, (p) => 0.62 + 0.38 * p), cavityAO(height, { radiusPx: 6, strength: 2 }));
      return { albedo, height, roughness, metallic: add(mul(wear, invert(rust)), mul(head, 0.8)), ao };
    },
  },

  // ---------------------------------------------------------------- smoky glass
  {
    id: "mat_glass_dark",
    tileSizeM: 1,
    size: [512, 512],
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, envIntensity: 1.5, alphaMode: "blend", doubleSided: true },
    note: "smoky dark window glass: clear where water ran, grimy smears elsewhere (alpha 0.5 clean .. 0.85 dirty)",
    build(ctx) {
      const { w, h } = ctx;
      const ppm = ctx.pxPerM[0];
      const r = rng(ctx.sub(1));
      const [ax, ay] = ctx.cycles(0.35);
      const blotch = fbm(w, h, { fx: ax, fy: ay, octaves: 5, seed: ctx.sub(2) });
      const [bx, by] = ctx.cycles(0.06);
      const fine = fbm(w, h, { fx: bx, fy: by, octaves: 3, seed: ctx.sub(3) });

      // Rain runs: tall thin clean streaks (stretched noise), plus a few wiper-like wide diagonal smears.
      const runN = fbm(w, h, { fx: Math.round(ctx.sizeM[0] / 0.025), fy: 2, octaves: 3, seed: ctx.sub(4) });
      const runs = smoothstep(runN, 0.5, 0.7);
      const smear = new Field(w, h);
      for (let i = 0; i < 7; i++) {
        const x = r() * w;
        const y = r() * h;
        const a = 0.3 + (r() - 0.5) * 0.3;
        const len = ppm * (0.3 + r() * 0.4);
        line(smear, x, y, x + Math.cos(a) * len, y + Math.sin(a) * len, ppm * (0.03 + r() * 0.05), 1, { mode: "max" });
      }
      const smearSoft = blur(smear, 3, 2);

      let dirt = clamp01(add(add(mul(smoothstep(blotch, 0.42, 0.75), 0.75), mul(centred(fine), 0.45)), mul(smearSoft, 0.35)));
      dirt = mul(dirt, map(runs, (v) => 1 - 0.85 * v));
      const scratch = scratches(w, h, rng(ctx.sub(5)), { count: 90, minLen: ppm * 0.03, maxLen: ppm * 0.25, thick: 0.8, angle: 0.7, spread: 2, value: 0.5 });

      const tint = hex("#0b1316"); // near-black blue-green
      const grime = hex("#2a2926");
      const albedo = mixRgb(mixRgb(Rgb.filled(w, h, tint), grime, mul(dirt, 0.8)), hex("#8c9296"), mul(scratch, 0.35));
      const alpha = clamp01(add(add(0.52, mul(dirt, 0.33)), mul(scratch, 0.15)));
      const roughness = clamp01(add(add(0.035, mul(dirt, 0.22)), mul(scratch, 0.1)));
      return { albedo, alpha, roughness, metallic: 0 };
    },
  },
];
