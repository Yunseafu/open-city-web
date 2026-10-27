// Wall and roof surfaces: precast panels, board-formed concrete, dirty brick, tar roof.
import { Field, add, blur, map, mul, smoothstep } from "../lib/field.mjs";
import { fbm, ridged, white, worley } from "../lib/noise.mjs";
import { rect } from "../lib/draw.mjs";
import { Rgb, fromChannels, ramp } from "../lib/color.mjs";
import { hash2, rng } from "../lib/rng.mjs";

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const sstep = (e0, e1, v) => {
  const t = clamp((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
const mix1 = (a, b, t) => a + (b - a) * t;
const mod = (a, n) => ((a % n) + n) % n;

/** fbm with a physical feature size in metres; key picks the sub-seed. */
const noise = (ctx, key, featureM, octaves = 4) => {
  const [fx, fy] = ctx.cycles(featureM);
  return fbm(ctx.w, ctx.h, { fx, fy, octaves, seed: ctx.sub(key) });
};

/** Soft pixel grain centred on 0 (std ~0.1): white noise through a 3x3 blur so mips do not sparkle. */
const grain = (ctx, key) => map(blur(white(ctx.w, ctx.h, ctx.sub(key)), 1, 1), (v) => v - 0.5);

/** Tiny dark pits (air holes, pores): rare Worley cells, soft edged. cellM = cell size, frac = share of cells kept. */
function pitMask(ctx, key, cellM, radius, frac) {
  const [cx, cy] = ctx.cycles(cellM);
  const cells = worley(ctx.w, ctx.h, cx, cy, ctx.sub(key), 1);
  return Field.from(ctx.w, ctx.h, (x, y) => {
    const i = y * ctx.w + x;
    return cells.id.data[i] > 1 - frac ? sstep(0, 0.12, radius - cells.f1.data[i]) : 0;
  });
}

// ---------------------------------------------------------------------------------------------
// Precast concrete cladding: 2 m x 1 m panels (2 columns x 4 rows per 4 m tile), recessed seams,
// cone-tie holes on a 0.5 m grid, rust runs under the ties, rain streaks, efflorescence under seams.

const PANEL = {
  id: "mat_wall_concrete_panel",
  tileSizeM: 4,
  size: [1024, 1024],
  relief: { depthM: 0.03, strength: 1 },
  params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, envIntensity: 0.9 },
  note: "precast concrete panels 2 x 1 m, tie-bolt holes, rain streaks and efflorescence (V grows down the wall)",
  build(ctx) {
    const { w, h } = ctx;
    const pm = ctx.pxPerM[0];
    const COLS = 2;
    const ROWS = 4;
    const pw = w / COLS;
    const ph = h / ROWS;
    const seamHalf = 0.5 * 0.014 * pm;
    const holeR = 0.5 * 0.026 * pm;
    const holeW = pw / 4; // ties every 0.5 m
    const holeH = ph / 2;

    const broad = noise(ctx, 1, 1.2);
    const mid = noise(ctx, 2, 0.3);
    const fine = noise(ctx, 3, 0.04, 3);
    const g = grain(ctx, 4);
    // Rain streaks: narrow in U, long in V.
    const rainA = smoothstep(fbm(w, h, { fx: 90, fy: 2, octaves: 3, seed: ctx.sub(5) }), 0.48, 0.72);
    const rainB = smoothstep(fbm(w, h, { fx: 14, fy: 1, octaves: 2, seed: ctx.sub(6) }), 0.42, 0.7);
    const crust = smoothstep(fbm(w, h, { fx: 70, fy: 36, octaves: 3, seed: ctx.sub(7) }), 0.5, 0.7);
    const pits = pitMask(ctx, 8, 0.035, 0.1, 0.12);

    const panelTone = [];
    const panelRough = [];
    for (let n = 0; n < COLS * ROWS; n++) {
      panelTone.push((hash2(n, 0, ctx.sub(9)) - 0.5) * 0.09);
      panelRough.push((hash2(n, 1, ctx.sub(9)) - 0.5) * 0.06);
    }

    const edge = new Float32Array(w * h); // px to the nearest panel edge
    const hole = new Float32Array(w * h); // 1 inside a tie hole
    const holeRim = new Float32Array(w * h);
    const rust = new Float32Array(w * h);
    const fromTop = new Float32Array(w * h); // px below the seam above
    const idx = new Int32Array(w * h);
    for (let y = 0; y < h; y++) {
      const v = y % ph;
      const dv = Math.min(v + 0.5, ph - v - 0.5);
      // Tie rows sit at 1/4 and 3/4 of the panel height.
      const ty = mod(y - ph / 4, holeH);
      const hy = Math.floor(mod(y - ph / 4, h) / holeH);
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const u = x % pw;
        const du = Math.min(u + 0.5, pw - u - 0.5);
        edge[i] = Math.min(du, dv);
        idx[i] = Math.floor(y / ph) * COLS + Math.floor(x / pw);
        fromTop[i] = v + 0.5;
        const lx = mod(x - holeW / 2, holeW) - holeW / 2;
        const ly = ty < holeH / 2 ? ty : ty - holeH; // signed offset from the nearest tie row
        const d = Math.hypot(lx, ly);
        hole[i] = sstep(holeR + 0.7, holeR - 0.5, d);
        holeRim[i] = sstep(holeR + 2.5, holeR + 0.5, d) * (1 - hole[i]);
        // Rust run below the tie: lyDown = distance below the tie centre, up to half the tie pitch.
        const lyDown = ty; // y - (tie row above), 0..holeH
        const hx = Math.floor(mod(x, w) / holeW);
        const s = hash2(hx, hy, ctx.sub(10));
        const len = (0.1 + s * 0.35) * pm;
        const wid = (0.006 + s * 0.008) * pm * (1 + (rainA.data[i] - 0.5));
        const fall = 1 - sstep(0, len, lyDown);
        rust[i] = s > 0.3 ? sstep(wid + 1, wid * 0.3, Math.abs(lx)) * fall * (0.4 + 0.6 * s) : 0;
      }
    }

    const seam = (i) => 1 - sstep(seamHalf - 0.7, seamHalf + 0.8, edge[i]);
    const bevel = (i) => sstep(seamHalf, seamHalf + 0.012 * pm, edge[i]);

    const lum = new Field(w, h);
    const rgbOut = new Rgb(w, h);
    const height = new Field(w, h);
    const roughness = new Field(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const p = idx[i];
        const sm = seam(i);
        const bv = bevel(i);
        const streak = clamp(rainA.data[i] * (0.4 + 0.9 * rainB.data[i]));
        // Efflorescence: pale crust right under each seam, broken up by noise.
        const efflo = sstep(0.16 * pm, 0, fromTop[i]) * crust.data[i];

        let l = 0.4 + panelTone[p] + (broad.data[i] - 0.5) * 0.14 + (mid.data[i] - 0.5) * 0.08 + (fine.data[i] - 0.5) * 0.07 + g.data[i] * 0.2;
        l *= 1 - streak * 0.5;
        l *= 1 - (1 - bv) * 0.2; // dirt gathers at the chamfers
        l *= 1 - pits.data[i] * 0.3;
        l = mix1(l, 0.66, efflo * 0.55);
        l = mix1(l, 0.07, sm * 0.85);
        l = mix1(l, 0.05, hole[i] * 0.9);
        l = mix1(l, l * 0.7, holeRim[i]);
        l = clamp(l, 0.03, 0.85);
        // Colour: cool grey, brown-ish in the streaks, rusty orange under the ties.
        const rs = rust[i];
        const wet = streak * 0.015;
        rgbOut.data[i * 3] = clamp(l + 0.004 + wet + rs * 0.2 * (1 - sm), 0.03, 0.85);
        rgbOut.data[i * 3 + 1] = clamp(l + 0.004 + wet * 0.6 + rs * 0.06 * (1 - sm) - rs * 0.04, 0.03, 0.85);
        rgbOut.data[i * 3 + 2] = clamp(l + 0.01 - rs * 0.09, 0.03, 0.85);

        let hv = 0.8 + (fine.data[i] - 0.5) * 0.08 + (mid.data[i] - 0.5) * 0.04 + g.data[i] * 0.08;
        hv = mix1(0.12, hv - 0.1 * (1 - bv), 1 - sm);
        hv -= hole[i] * 0.55 + pits.data[i] * 0.2;
        height.data[i] = clamp(hv);

        let rr = 0.9 + panelRough[p] + (fine.data[i] - 0.5) * 0.08 + g.data[i] * 0.1;
        rr -= streak * 0.1;
        rr += efflo * 0.05;
        roughness.data[i] = clamp(rr, 0.78, 0.95);
        lum.data[i] = l;
      }
    }
    return { albedo: rgbOut, height, roughness, metallic: 0 };
  },
};

// ---------------------------------------------------------------------------------------------
// Dark board-formed concrete: 0.15 m boards, 1.5 m long with staggered butt joints, wood-grain imprint,
// soot blotches and run-off streaks. All stains are tile-safe (no vertical gradient).

const DARK = {
  id: "mat_wall_concrete_dark",
  tileSizeM: 3,
  size: [1024, 1024],
  relief: { depthM: 0.02, strength: 1 },
  params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, envIntensity: 0.9 },
  note: "dark board-formed concrete, 20 boards per 3 m, soot and damp streaks",
  build(ctx) {
    const { w, h } = ctx;
    const pm = ctx.pxPerM[0];
    const ROWS = 20;
    const bh = h / ROWS;
    const bl = w / 2; // board length = half the tile

    const broad = noise(ctx, 1, 1.0);
    const mid = noise(ctx, 2, 0.25);
    const fine = noise(ctx, 3, 0.03, 3);
    const g = grain(ctx, 4);
    const soot = smoothstep(noise(ctx, 5, 0.7), 0.45, 0.78);
    const drip = smoothstep(fbm(w, h, { fx: 60, fy: 2, octaves: 3, seed: ctx.sub(6) }), 0.55, 0.8);
    const damp = smoothstep(fbm(w, h, { fx: 26, fy: 3, octaves: 2, seed: ctx.sub(7) }), 0.62, 0.8);
    const efflo = smoothstep(fbm(w, h, { fx: 110, fy: 3, octaves: 2, seed: ctx.sub(8) }), 0.66, 0.8);
    // Grain imprint: long in U (along the boards), fine across.
    const grainLong = fbm(w, h, { fx: 3, fy: 150, octaves: 3, seed: ctx.sub(9) });
    const grainFine = fbm(w, h, { fx: 6, fy: 240, octaves: 2, seed: ctx.sub(10) });
    const pits = pitMask(ctx, 11, 0.04, 0.1, 0.1);

    const off = Array.from({ length: ROWS }, (_, r) => hash2(r, 0, ctx.sub(12)) * w);
    const boardTone = (r, k) => (hash2(r, 1 + mod(k, 2), ctx.sub(13)) - 0.5) * 0.08;
    const boardLift = (r, k) => (hash2(r, 3 + mod(k, 2), ctx.sub(14)) - 0.5) * 0.1;
    const boardShift = (r, k) => Math.floor(hash2(r, 5 + mod(k, 2), ctx.sub(15)) * w);

    const albedo = new Rgb(w, h);
    const height = new Field(w, h);
    const roughness = new Field(w, h);
    const rowLine = 0.9;
    for (let y = 0; y < h; y++) {
      // Rows start half a board down so the tile edge falls mid-board.
      const ys = y + bh / 2;
      const r = Math.floor(ys / bh) % ROWS;
      const ly = ys - Math.floor(ys / bh) * bh;
      const de = Math.min(ly + 0.5, bh - ly - 0.5);
      const rowSeam = 1 - sstep(0.4, 0.4 + 0.004 * pm + rowLine, de);
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const m = mod(x - off[r], w);
        const k = Math.floor(m / bl);
        const dj = Math.min(m % bl, bl - (m % bl));
        const butt = 1 - sstep(0.4, 0.4 + 0.003 * pm + 1, dj);
        const sh = boardShift(r, k);
        const gl = grainLong.data[y * w + mod(x + sh, w)];
        const gf = grainFine.data[y * w + mod(x + sh, w)];
        const seamV = Math.max(rowSeam, butt);

        let l = 0.2 + boardTone(r, k) + (broad.data[i] - 0.5) * 0.1 + (mid.data[i] - 0.5) * 0.06 + (gl - 0.5) * 0.06 + (gf - 0.5) * 0.02 + g.data[i] * 0.15;
        l *= 1 - soot.data[i] * 0.4;
        l *= 1 - drip.data[i] * 0.16;
        l *= 1 - pits.data[i] * 0.3;
        l = mix1(l, l + 0.08, efflo.data[i] * 0.6); // pale lime run-off
        l *= 1 - seamV * 0.22;
        l = clamp(l, 0.05, 0.85);
        albedo.data[i * 3] = clamp(l + 0.003, 0.03, 0.85);
        albedo.data[i * 3 + 1] = l;
        albedo.data[i * 3 + 2] = clamp(l + 0.005 + damp.data[i] * 0.006, 0.03, 0.85);

        let hv = 0.65 + boardLift(r, k) + (gl - 0.5) * 0.22 + (gf - 0.5) * 0.06 + (fine.data[i] - 0.5) * 0.06 + g.data[i] * 0.06;
        hv += seamV * 0.14; // fins where grout squeezed between boards
        hv -= pits.data[i] * 0.2;
        height.data[i] = clamp(hv);

        let rr = 0.86 + (fine.data[i] - 0.5) * 0.1 + g.data[i] * 0.1 - (gl - 0.5) * 0.06;
        rr -= damp.data[i] * 0.22; // damp streaks read glossier under neon
        rr -= drip.data[i] * 0.04;
        roughness.data[i] = clamp(rr, 0.5, 0.95);
      }
    }
    return { albedo, height, roughness, metallic: 0 };
  },
};

// ---------------------------------------------------------------------------------------------
// Dirty brick, running bond. 13 bricks x 40 courses per 3 m tile (pitch 231 x 75 mm), so the tile
// holds a whole number of bricks both ways. A few spalled bricks and painted-over patches.

const BRICK_RAMP = [
  [0.0, [0.13, 0.11, 0.11]], // charcoal
  [0.4, [0.28, 0.13, 0.1]], // dark red
  [0.75, [0.36, 0.19, 0.13]], // rust
  [1.0, [0.23, 0.16, 0.13]], // brown
];

const BRICK = {
  id: "mat_wall_brick_dirty",
  tileSizeM: 3,
  size: [1024, 1024],
  relief: { depthM: 0.016, strength: 1 },
  params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, envIntensity: 0.9 },
  note: "dark brick, running bond (13 x 40 per tile), soot, spalls, painted-over patches",
  build(ctx) {
    const { w, h } = ctx;
    const pm = ctx.pxPerM[0];
    const N = 13;
    const R = 40;
    const bw = w / N;
    const ph = h / R;
    const jh = 0.5 * 0.01 * pm; // mortar half-thickness (10 mm joint)

    const broad = noise(ctx, 1, 1.0);
    const mid = noise(ctx, 2, 0.25);
    const fine = noise(ctx, 3, 0.03, 3);
    const g = grain(ctx, 4);
    const sootBlot = smoothstep(noise(ctx, 5, 0.8), 0.42, 0.75);
    const sootDrip = smoothstep(fbm(w, h, { fx: 50, fy: 2, octaves: 3, seed: ctx.sub(6) }), 0.52, 0.78);
    const spallNoise = noise(ctx, 7, 0.06, 3);
    const peel = smoothstep(noise(ctx, 8, 0.1, 3), 0.55, 0.68);
    const mortarNoise = noise(ctx, 9, 0.05, 2);

    // Painted-over patches: ragged rectangles, three paint colours.
    const PAINTS = [
      [0.2, 0.29, 0.29], // dull teal
      [0.55, 0.52, 0.44], // faded cream
      [0.19, 0.25, 0.37], // faded blue
    ];
    const patchF = PAINTS.map(() => new Field(w, h));
    const pr = rng(ctx.sub(10));
    PAINTS.forEach((_, k) => {
      const pw = (0.35 + pr() * 0.55) * pm;
      const phh = (0.3 + pr() * 0.5) * pm;
      const x0 = pr() * w;
      const y0 = pr() * h;
      rect(patchF[k], x0, y0, x0 + pw, y0 + phh, 1, { mode: "max", radius: 0.03 * pm });
    });
    const patchRaw = patchF.map((f) => blur(f, Math.round(0.02 * pm), 2));
    const raggedN = noise(ctx, 11, 0.07, 3);
    const patchMask = patchRaw.map((f) => Field.from(w, h, (x, y) => sstep(0.42, 0.58, f.data[y * w + x] + (raggedN.data[y * w + x] - 0.5) * 1.1) * (1 - peel.data[y * w + x] * 0.9)));

    const albedo = new Rgb(w, h);
    const height = new Field(w, h);
    const roughness = new Field(w, h);
    const tmp = [0, 0, 0];
    for (let y = 0; y < h; y++) {
      const r = Math.floor(y / ph);
      const ly = y - r * ph;
      const shift = r % 2 ? bw / 2 : 0;
      const dy = Math.min(ly + 0.5, ph - ly - 0.5);
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const bx = x + shift;
        const colf = bx / bw;
        const col = Math.floor(colf);
        const lx = bx - col * bw;
        const dx = Math.min(lx + 0.5, bw - lx - 0.5);
        const dEdge = Math.min(dx, dy);
        const face = sstep(jh - 0.7, jh + 0.8, dEdge); // 1 on the brick
        const round = sstep(jh, jh + 0.012 * pm, dEdge); // 1 on the flat of the face
        const bid = hash2(mod(col, N), r, ctx.sub(12));
        const bid2 = hash2(mod(col, N), r, ctx.sub(13));
        const spalled = bid2 < 0.05 ? 1 : 0;
        const spall = spalled * face * sstep(0.46, 0.58, spallNoise.data[i]) * sstep(jh + 0.01 * pm, jh + 0.03 * pm, dEdge);

        // Brick colour: ramp by id, then drift inside the brick.
        const t = clamp(bid + (mid.data[i] - 0.5) * 0.25);
        let k = 0;
        while (k < BRICK_RAMP.length - 2 && t > BRICK_RAMP[k + 1][0]) k++;
        const [p0, c0] = BRICK_RAMP[k];
        const [p1, c1] = BRICK_RAMP[k + 1];
        const tt = clamp((t - p0) / (p1 - p0));
        for (let c = 0; c < 3; c++) tmp[c] = mix1(c0[c], c1[c], tt) * (1 + (fine.data[i] - 0.5) * 0.25 + g.data[i] * 0.45);
        // Exposed brick core is lighter and orange.
        for (let c = 0; c < 3; c++) tmp[c] = mix1(tmp[c], [0.46, 0.27, 0.19][c], spall * 0.75);
        // Soot, darkest on the upper face edge of the brick course and in streaks.
        const soot = clamp(sootBlot.data[i] * 0.55 + sootDrip.data[i] * 0.35);
        for (let c = 0; c < 3; c++) tmp[c] *= 1 - soot * 0.6;
        // Edge rounding catches dirt.
        for (let c = 0; c < 3; c++) tmp[c] *= 0.78 + 0.22 * round;
        // Mortar: sandy grey, dirty, darker in the recess.
        const ml = 0.2 + (mortarNoise.data[i] - 0.5) * 0.08 + g.data[i] * 0.1;
        const mortar = [ml * 1.08, ml, ml * 0.9];
        for (let c = 0; c < 3; c++) {
          tmp[c] = mix1(mortar[c] * (1 - soot * 0.45), tmp[c], face);
        }
        // Paint over brick and mortar, thin enough that the joints still read (darkened).
        let paintAmt = 0;
        let pr3 = 0;
        let pg3 = 0;
        let pb3 = 0;
        for (let q = 0; q < PAINTS.length; q++) {
          const a = patchMask[q].data[i];
          if (a > paintAmt) {
            paintAmt = a;
            [pr3, pg3, pb3] = PAINTS[q];
          }
        }
        const dirtyPaint = (1 - soot * 0.5) * (0.62 + 0.3 * mid.data[i]);
        const joint = 0.82 + 0.18 * face;
        tmp[0] = mix1(tmp[0], pr3 * dirtyPaint * joint * (1 + g.data[i] * 0.3), paintAmt * 0.95);
        tmp[1] = mix1(tmp[1], pg3 * dirtyPaint * joint * (1 + g.data[i] * 0.3), paintAmt * 0.95);
        tmp[2] = mix1(tmp[2], pb3 * dirtyPaint * joint * (1 + g.data[i] * 0.3), paintAmt * 0.95);
        albedo.data[i * 3] = clamp(tmp[0], 0.03, 0.85);
        albedo.data[i * 3 + 1] = clamp(tmp[1], 0.03, 0.85);
        albedo.data[i * 3 + 2] = clamp(tmp[2], 0.03, 0.85);

        // Height: brick faces proud, mortar recessed, per-brick lift, spalls sunk.
        const lift = (bid - 0.5) * 0.06;
        let hv = mix1(0.3 + (mortarNoise.data[i] - 0.5) * 0.06, 0.78 + lift + (fine.data[i] - 0.5) * 0.08 + g.data[i] * 0.06 - (1 - round) * 0.1, face);
        hv -= spall * 0.28;
        height.data[i] = clamp(hv);

        let rr = mix1(0.96, 0.9 + (fine.data[i] - 0.5) * 0.08 + g.data[i] * 0.06, face);
        rr = mix1(rr, 0.62 + (mid.data[i] - 0.5) * 0.12, paintAmt);
        rr = mix1(rr, 0.96, spall);
        roughness.data[i] = clamp(rr, 0.5, 0.97);
      }
    }
    return { albedo, height, roughness, metallic: 0 };
  },
};

// ---------------------------------------------------------------------------------------------
// Flat roof: bitumen membrane in 1 m rolls (lap seams with a glossy sealant bead), gravel ballast
// patches, ponding stains with a pale dust rim, blisters and alligator cracks.

const ROOF = {
  id: "mat_roof_tar",
  tileSizeM: 4,
  size: [1024, 1024],
  relief: { depthM: 0.03, strength: 1 },
  params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, envIntensity: 1.0 },
  note: "tar paper roof: 1 m rolls with lap seams, gravel patches, ponding stains",
  build(ctx) {
    const { w, h } = ctx;
    const pm = ctx.pxPerM[0];
    const ROLLS = 4;
    const rh = h / ROLLS;

    const broad = noise(ctx, 1, 1.4);
    const mid = noise(ctx, 2, 0.3);
    const fine = noise(ctx, 3, 0.03, 3);
    const g = grain(ctx, 4);
    const gravelZone = noise(ctx, 5, 1.3);
    const stainNoise = noise(ctx, 6, 1.7);
    const stainDetail = noise(ctx, 7, 0.2, 3);

    // Gravel: ~3 cm stones, packed almost edge to edge inside a patch.
    const [gx, gy] = ctx.cycles(0.03);
    const stones = worley(w, h, gx, gy, ctx.sub(8), 0.9);

    // Blisters: a few soft humps.
    const [bx, by] = ctx.cycles(0.5);
    const blisterCells = worley(w, h, bx, by, ctx.sub(10), 1);
    // Cracks (alligatoring) in the tar.
    const [cx, cy] = ctx.cycles(1.2);
    const creases = ridged(w, h, { fx: cx, fy: cy, octaves: 4, seed: ctx.sub(11) });
    const crackZone = smoothstep(noise(ctx, 12, 1.5), 0.5, 0.64);
    const crack = mul(smoothstep(creases, 0.9, 0.985), crackZone);

    const rollTone = Array.from({ length: ROLLS }, (_, r) => (hash2(r, 0, ctx.sub(13)) - 0.5) * 0.03);
    const albedo = new Rgb(w, h);
    const height = new Field(w, h);
    const roughness = new Field(w, h);
    for (let y = 0; y < h; y++) {
      // Rolls start half a roll down so the tile edge falls mid-roll.
      const ys = y + rh / 2;
      const r = Math.floor(ys / rh) % ROLLS;
      const ly = ys - Math.floor(ys / rh) * rh;
      // Lap seam sits at the top of each roll: raised 3 cm lap with a thin sealant bead beside it.
      const lap = sstep(0.03 * pm, 0.012 * pm, ly + 0.5);
      const bead = sstep(0.006 * pm, 0.002 * pm, Math.abs(ly + 0.5 - 0.035 * pm));
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const zone = gravelZone.data[i];
        // Patch density, thinning stone by stone at the edge (second random value from the cell id).
        const dens = sstep(0.47, 0.56, zone);
        const stone = dens >= 1 ? 1 : sstep(-0.05, 0.05, dens - ((stones.id.data[i] * 7.31) % 1));
        const sid = stones.id.data[i];
        const radius = 0.56 + (sid - 0.5) * 0.2;
        const body = clamp(1 - stones.f1.data[i] / radius);
        const dome = Math.sqrt(Math.max(0, 1 - (1 - body) * (1 - body)));
        const stoneMask = stone * sstep(0.0, 0.14, body);

        // Ponding stain: pale dust rim at the edge, dark algae-ish film inside.
        const sv = stainNoise.data[i] + (stainDetail.data[i] - 0.5) * 0.12;
        const inside = sstep(0.62, 0.7, sv);
        const rim = sstep(0.56, 0.62, sv) * (1 - sstep(0.62, 0.68, sv));

        // Membrane colour.
        let ml = 0.105 + rollTone[r] + (broad.data[i] - 0.5) * 0.06 + (mid.data[i] - 0.5) * 0.04 + g.data[i] * 0.1;
        ml *= 1 - crack.data[i] * 0.6;
        ml = mix1(ml, ml + 0.13, lap * 0.25);
        ml = mix1(ml, 0.05, bead * 0.8);
        // Gravel colour: grey stones with warm/cool variety, dark between stones.
        const sl = (0.2 + sid * 0.24) * (0.35 + 0.65 * clamp(body * 2.2)) * (1 + g.data[i] * 0.25);
        let l = mix1(ml, sl, stoneMask);
        const warm = (hash2(Math.floor(sid * 977), 1, ctx.sub(14)) - 0.5) * 0.04;
        let rr = l;
        let gg = l;
        let bb = l + 0.006;
        rr += warm * stoneMask;
        bb -= warm * stoneMask;
        // Stains.
        const dust = rim * 0.07;
        rr = mix1(rr, rr * 0.55, inside * 0.7);
        gg = mix1(gg, gg * 0.6 + 0.01, inside * 0.7);
        bb = mix1(bb, bb * 0.55, inside * 0.7);
        rr += dust * 0.9;
        gg += dust * 0.9;
        bb += dust * 0.8;
        albedo.data[i * 3] = clamp(rr, 0.03, 0.85);
        albedo.data[i * 3 + 1] = clamp(gg, 0.03, 0.85);
        albedo.data[i * 3 + 2] = clamp(bb, 0.03, 0.85);

        // Height.
        const blister = blisterCells.id.data[i] > 0.86 ? sstep(0.0, 0.5, 0.45 - blisterCells.f1.data[i]) * 0.14 : 0;
        let hv = 0.3 + (fine.data[i] - 0.5) * 0.06 + g.data[i] * 0.05 + blister + lap * 0.22 + bead * 0.08 - crack.data[i] * 0.2;
        hv = mix1(hv, 0.4 + dome * 0.5, stoneMask);
        height.data[i] = clamp(hv);

        // Roughness: tar 0.7, sealant bead glossy, ponding stains smoother, gravel rough.
        let rgh = 0.72 + (fine.data[i] - 0.5) * 0.12 + g.data[i] * 0.1;
        rgh = mix1(rgh, 0.38, bead);
        rgh = mix1(rgh, 0.88, stoneMask);
        rgh = mix1(rgh, 0.42 + (stainDetail.data[i] - 0.5) * 0.15, inside * 0.8);
        roughness.data[i] = clamp(rgh, 0.3, 0.95);
      }
    }
    return { albedo, height, roughness, metallic: 0 };
  },
};

export const recipes = [PANEL, DARK, BRICK, ROOF];
