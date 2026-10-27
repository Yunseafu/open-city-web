// Ground-level surfaces: worn road paint, sidewalk pavers, kerb stone.
import { Field, add, blur, invert, map, mix, mul, smoothstep, sub } from "../lib/field.mjs";
import { fbm, ridged, white, worley } from "../lib/noise.mjs";
import { disc, polyline, rect } from "../lib/draw.mjs";
import { Rgb, fromChannels, mixRgb, scaleRgb } from "../lib/color.mjs";
import { hash2, rng } from "../lib/rng.mjs";

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const sstep = (e0, e1, v) => {
  const t = clamp((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

/** fbm with a physical feature size in metres; key picks the sub-seed. */
const noise = (ctx, key, featureM, octaves = 4) => {
  const [fx, fy] = ctx.cycles(featureM);
  return fbm(ctx.w, ctx.h, { fx, fy, octaves, seed: ctx.sub(key) });
};

/** Soft pixel grain centred on 0 (std ~0.1): white noise through a 3x3 blur so mips do not sparkle. */
const grain = (ctx, key) => map(blur(white(ctx.w, ctx.h, ctx.sub(key)), 1, 1), (v) => v - 0.5);

/** Albedo from per-channel luminance with a small colour cast: [r, g, b] offsets added to a grey Field. */
const tinted = (lum, [dr, dg, db]) => fromChannels(add(lum, dr), add(lum, dg), add(lum, db));

// ---------------------------------------------------------------------------------------------
// Road paint. Thin quads over asphalt, so this is the paint skin only: opaque, abraded, chipped.
// Convention: UV U runs along the stripe, so tyre polish bands vary along U.

function paint({ id, color, wear, tyre, note }) {
  return {
    id,
    tileSizeM: 2,
    size: [512, 512],
    relief: { depthM: 0.004, strength: 1 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, envIntensity: 0.9, zOffset: -2 },
    note,
    build(ctx) {
      const { w, h } = ctx;
      const broad = noise(ctx, 1, 0.9);
      const mid = noise(ctx, 2, 0.3);
      const fine = noise(ctx, 3, 0.05, 3);
      const grime = noise(ctx, 4, 0.5);
      const g = grain(ctx, 5);
      // Tyre polish: soft irregular bands across the stripe (features long in V, short in U).
      const bands = fbm(w, h, { fx: 5, fy: 1, octaves: 3, seed: ctx.sub(6) });

      // Wear: high = paint abraded away to the asphalt below.
      const wearField = Field.from(w, h, (x, y) => {
        const i = y * w + x;
        return 0.5 + (broad.data[i] - 0.5) * 1.1 + (mid.data[i] - 0.5) * 0.8 + (fine.data[i] - 0.5) * 0.5 + (bands.data[i] - 0.5) * tyre;
      });
      // Wide transition: thinning paint fades to the asphalt instead of a hard edge.
      const thr = 0.72 - wear;
      let cover = map(wearField, (v) => 1 - sstep(thr, thr + 0.22, v));

      // Chips: a handful of small ragged holes where a stone or tyre lifted the paint.
      const [cx, cy] = ctx.cycles(0.28);
      const cells = worley(w, h, cx, cy, ctx.sub(7), 1);
      const chip = Field.from(w, h, (x, y) => {
        const i = y * w + x;
        if (cells.id.data[i] < 0.8) return 0;
        return sstep(0.0, 0.05, 0.17 + (fine.data[i] - 0.5) * 0.35 - cells.f1.data[i]);
      });
      cover = Field.from(w, h, (x, y) => Math.min(cover.data[y * w + x], 1 - chip.data[y * w + x]));

      // Asphalt showing through.
      const asphalt = tinted(add(0.125, add(mul(g, 0.35), mul(map(broad, (v) => v - 0.5), 0.05))), [0.0, 0.004, 0.012]);

      // Paint: tone drift, grime, tyre rubber smears.
      const dirt = smoothstep(grime, 0.45, 0.8);
      const rubber = mul(smoothstep(bands, 0.62, 0.88), tyre);
      const shade = Field.from(w, h, (x, y) => {
        const i = y * w + x;
        return (1 - dirt.data[i] * 0.32) * (1 - rubber.data[i] * 0.45) * (1 + (mid.data[i] - 0.5) * 0.12) * (1 + g.data[i] * 0.25);
      });
      const skin = scaleRgb(Rgb.filled(w, h, color), shade);
      const albedo = mixRgb(asphalt, skin, cover);
      for (let i = 0; i < albedo.data.length; i++) albedo.data[i] = clamp(albedo.data[i], 0.03, 0.85);

      // Paint is semi-gloss with glass beads; abraded parts and rubber are matte, polished bands shine a little.
      const roughness = Field.from(w, h, (x, y) => {
        const i = y * w + x;
        const paintR = 0.66 - bands.data[i] * tyre * 0.14 + g.data[i] * 0.2 + dirt.data[i] * 0.08 + rubber.data[i] * 0.1;
        return clamp(0.92 + (fine.data[i] - 0.5) * 0.06 + (paintR - 0.92) * cover.data[i], 0.5, 0.95);
      });

      // Paint skin stands ~1 mm proud of the asphalt.
      const height = Field.from(w, h, (x, y) => {
        const i = y * w + x;
        return clamp(cover.data[i] * 0.55 + 0.3 + (fine.data[i] - 0.5) * 0.12 + g.data[i] * 0.25);
      });
      return { albedo, height, roughness, metallic: 0 };
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Sidewalk: 0.5 m pavers in a straight grid.

const SIDEWALK = {
  id: "mat_ground_sidewalk_tiles",
  tileSizeM: 2,
  size: [1024, 1024],
  relief: { depthM: 0.02, strength: 1 },
  params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, envIntensity: 1.0 },
  note: "0.5 m concrete pavers, 4x4 per tile; damp patches, gum, hairline cracks",
  build(ctx) {
    const { w, h } = ctx;
    const N = 4; // pavers per side
    const cell = w / N;
    const pm = ctx.pxPerM[0];
    const jointHalf = 0.5 * 0.012 * pm; // 12 mm joint

    const broad = noise(ctx, 1, 1.0);
    const mid = noise(ctx, 2, 0.25);
    const fine = noise(ctx, 3, 0.03, 3);
    const damp = smoothstep(noise(ctx, 4, 0.7), 0.52, 0.68);
    const stain = smoothstep(noise(ctx, 5, 0.35), 0.58, 0.8);
    const g = grain(ctx, 6);

    // Per-paver data.
    const tone = [];
    const lift = [];
    const warm = [];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        tone.push((hash2(i, j, ctx.sub(10)) - 0.5) * 0.16);
        lift.push((hash2(i, j, ctx.sub(11)) - 0.5) * 0.08);
        warm.push(hash2(i, j, ctx.sub(12)) - 0.5);
      }
    }

    const edge = new Field(w, h); // distance in px to the nearest joint centreline
    const paver = new Field(w, h); // paver index as float
    for (let y = 0; y < h; y++) {
      const v = y % cell;
      const dv = Math.min(v + 0.5, cell - v - 0.5);
      for (let x = 0; x < w; x++) {
        const u = x % cell;
        const du = Math.min(u + 0.5, cell - u - 0.5);
        edge.data[y * w + x] = Math.min(du, dv);
        paver.data[y * w + x] = Math.floor(y / cell) * N + Math.floor(x / cell);
      }
    }
    const top = map(edge, (d) => sstep(jointHalf - 1, jointHalf + 1.5, d)); // 0 in the joint
    const chamfer = map(edge, (d) => sstep(jointHalf, jointHalf + 0.014 * pm, d)); // rounded arris

    // Hairline cracks (drawn) and corner chips (analytic, clipped to their own paver).
    const crackF = new Field(w, h);
    const chips = Array.from({ length: N * N }, () => []);
    const r = rng(ctx.sub(20));
    for (let n = 0; n < N * N; n++) {
      const px = (n % N) * cell;
      const py = Math.floor(n / N) * cell;
      if (r() < 0.45) {
        // random walk crack
        let x = px + cell * (0.15 + r() * 0.7);
        let y = py + cell * (0.15 + r() * 0.7);
        let a = r() * Math.PI * 2;
        const pts = [[x, y]];
        const len = 6 + Math.floor(r() * 8);
        for (let s = 0; s < len; s++) {
          a += (r() - 0.5) * 1.1;
          x += Math.cos(a) * 0.025 * pm;
          y += Math.sin(a) * 0.025 * pm;
          pts.push([x, y]);
        }
        polyline(crackF, pts, Math.max(1.2, 0.004 * pm), 1, { mode: "max", wrap: true });
      }
      if (r() < 0.5) {
        chips[n].push({ x: px + (r() < 0.5 ? 0 : cell), y: py + (r() < 0.5 ? 0 : cell), r: (0.02 + r() * 0.035) * pm });
      }
    }
    const crack = blur(crackF, 1, 1);
    const chip = Field.from(w, h, (x, y) => {
      const i = y * w + x;
      let c = 0;
      for (const k of chips[paver.data[i]]) {
        const d = Math.hypot(x + 0.5 - k.x, y + 0.5 - k.y);
        c = Math.max(c, sstep(0, 1, (k.r + (fine.data[i] - 0.5) * k.r * 0.9 - d) / (0.008 * pm)));
      }
      return c;
    });

    // Chewing gum: old grey-white blobs and fresh dark ones, a bit raised and glossy.
    const gumF = new Field(w, h);
    const gumTone = new Field(w, h);
    const gr = rng(ctx.sub(30));
    for (let n = 0; n < 22; n++) {
      const t = gr() < 0.55 ? 0.5 : 0.16; // old / fresh
      const gx = gr() * w;
      const gy = gr() * h;
      const rad = (0.007 + gr() * 0.006) * pm;
      disc(gumF, gx, gy, rad, 1, { mode: "max", soft: 0.004 * pm });
      disc(gumTone, gx, gy, rad, t, { soft: 0.004 * pm });
    }

    // Aggregate pits: tiny dark air holes, soft so they do not sparkle.
    const [pcx, pcy] = ctx.cycles(0.02);
    const pitCells = worley(w, h, pcx, pcy, ctx.sub(31), 1);
    const pits = Field.from(w, h, (x, y) => {
      const i = y * w + x;
      return pitCells.id.data[i] > 0.85 ? sstep(0.0, 0.12, 0.2 - pitCells.f1.data[i]) : 0;
    });
    const speck = noise(ctx, 32, 0.015, 2);

    // Albedo: concrete tone per paver, large blotches, damp darkening, stains; grout is dark and dirty.
    const lum = Field.from(w, h, (x, y) => {
      const i = y * w + x;
      const p = paver.data[i];
      let l = 0.36 + tone[p] + (broad.data[i] - 0.5) * 0.14 + (mid.data[i] - 0.5) * 0.08 + (fine.data[i] - 0.5) * 0.08 + (speck.data[i] - 0.5) * 0.1 + g.data[i] * 0.18;
      l *= 1 - stain.data[i] * 0.3;
      l *= 1 - pits.data[i] * 0.22;
      l *= 1 - damp.data[i] * 0.35;
      l *= 1 - chip.data[i] * 0.25;
      l *= 1 - crack.data[i] * 0.5;
      l *= 0.8 + 0.2 * chamfer.data[i]; // arris catches dirt from the joint
      l = mix1(0.085 + (mid.data[i] - 0.5) * 0.04, l, top.data[i]); // grout
      l = mix1(l, gumTone.data[i], gumF.data[i] * 0.9);
      return clamp(l, 0.03, 0.85);
    });
    const albedo = Field.from(w, h, () => 0);
    void albedo;
    const rgb = fromChannels(
      Field.from(w, h, (x, y) => lum.data[y * w + x] + warm[paver.data[y * w + x]] * 0.012 + 0.004),
      lum,
      Field.from(w, h, (x, y) => lum.data[y * w + x] - warm[paver.data[y * w + x]] * 0.012 + 0.008),
    );

    // Height: paver tops with lippage, recessed joints, rounded arris, chips and cracks sunk.
    const height = Field.from(w, h, (x, y) => {
      const i = y * w + x;
      const surf = 0.72 + lift[paver.data[i]] + (fine.data[i] - 0.5) * 0.06 + g.data[i] * 0.05;
      let v = mix1(0.12, surf - 0.12 * (1 - chamfer.data[i]), top.data[i]);
      v -= chip.data[i] * 0.22 + crack.data[i] * 0.2;
      v += gumF.data[i] * 0.04;
      return clamp(v);
    });

    // Roughness: dry concrete 0.85, damp 0.55, gum glossy, grout rough.
    const roughness = Field.from(w, h, (x, y) => {
      const i = y * w + x;
      let rr = 0.82 + (fine.data[i] - 0.5) * 0.12 + g.data[i] * 0.08;
      rr = mix1(rr, 0.52 + (mid.data[i] - 0.5) * 0.1, damp.data[i]);
      rr = mix1(0.93, rr, top.data[i]);
      rr = mix1(rr, 0.45, gumF.data[i]);
      return clamp(rr, 0.4, 0.95);
    });
    return { albedo: rgb, height, roughness, metallic: 0 };
  },
};

const mix1 = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------------------------
// Kerb. Tile is 2 m (along the kerb) x 0.5 m. Convention: U runs along the kerb, V = 0 at the top
// arris and grows down the face, so the chipped arris is the first ~4 cm of V (the tile wraps, so the
// last 4 cm below V = 0.5 are chipped too). Expansion joint every 1 m.

const KERB = {
  id: "mat_ground_curb",
  tileSizeM: [2, 0.5],
  size: [1024, 256],
  relief: { depthM: 0.03, strength: 1 },
  params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, envIntensity: 1.0 },
  note: "kerb face 2 x 0.5 m: V=0 is the top arris (chipped), joint every 1 m, tyre scuffs low on the face",
  build(ctx) {
    const { w, h } = ctx;
    const ppm = ctx.pxPerM[0]; // 512 px/m both ways
    const broad = noise(ctx, 1, 0.7);
    const mid = noise(ctx, 2, 0.2);
    const fine = noise(ctx, 3, 0.03, 3);
    const g = grain(ctx, 4);
    // Scuffs: long horizontal smears (fine in V, long in U).
    const scuff = smoothstep(fbm(w, h, { fx: 5, fy: 8, octaves: 3, seed: ctx.sub(5) }), 0.5, 0.72);
    // Vertical run-off streaks (long in V).
    const streak = smoothstep(fbm(w, h, { fx: 28, fy: 2, octaves: 2, seed: ctx.sub(8) }), 0.5, 0.75);
    const grime = smoothstep(noise(ctx, 6, 0.4), 0.45, 0.8);

    // Arris band: distance from the top edge with a noisy boundary = chipped look.
    const bandPx = 0.04 * ppm;
    const chipNoise = fbm(w, h, { fx: 40, fy: 10, octaves: 3, seed: ctx.sub(7) });
    const arris = Field.from(w, h, (x, y) => {
      const dv = Math.min(y + 0.5, h - y - 0.5);
      return sstep(0.35, 0.65, (bandPx - dv) / bandPx + (chipNoise.data[y * w + x] - 0.5) * 0.9);
    });

    // Joints at U = 0 and 1 m, ~8 mm wide, drawn with wrap so the seam sits in the middle of one.
    const joint = new Field(w, h);
    for (const jx of [0, w / 2]) rect(joint, jx - 2.5, -2, jx + 2.5, h + 2, 1, { mode: "max", wrap: true, soft: 1.5 });
    const jointDirt = blur(joint, 5, 2);

    const lum = Field.from(w, h, (x, y) => {
      const i = y * w + x;
      // Grime builds towards the bottom of the face (V grows downwards, wraps to the arris).
      const down = sstep(0.25, 0.5, y / h) * 0.5;
      let l = 0.42 + (broad.data[i] - 0.5) * 0.14 + (mid.data[i] - 0.5) * 0.08 + (fine.data[i] - 0.5) * 0.05 + g.data[i] * 0.12;
      l *= 1 - grime.data[i] * 0.25 - down * 0.2 * (0.5 + grime.data[i]);
      l *= 1 - scuff.data[i] * 0.6 * sstep(0.08, 0.25, y / h) * (1 - sstep(0.35, 0.5, y / h));
      l *= 1 - streak.data[i] * 0.22;
      l = l * (1 - arris.data[i] * 0.22) + arris.data[i] * 0.06; // fresher, lighter break
      l *= 1 - jointDirt.data[i] * 0.45;
      l = mix1(l, 0.08, joint.data[i] * 0.85);
      return clamp(l, 0.03, 0.85);
    });
    const albedo = fromChannels(add(lum, 0.004), lum, add(lum, 0.008));

    const height = Field.from(w, h, (x, y) => {
      const i = y * w + x;
      let v = 0.75 + (fine.data[i] - 0.5) * 0.1 + (mid.data[i] - 0.5) * 0.06 + g.data[i] * 0.06;
      v -= arris.data[i] * (0.25 + (chipNoise.data[i] - 0.5) * 0.3);
      v -= joint.data[i] * 0.6;
      return clamp(v);
    });
    const roughness = Field.from(w, h, (x, y) => {
      const i = y * w + x;
      let rr = 0.86 + (fine.data[i] - 0.5) * 0.1 + g.data[i] * 0.08;
      rr -= scuff.data[i] * 0.2; // rubber transfer is smoother
      rr = mix1(rr, 0.95, joint.data[i]);
      rr = mix1(rr, 0.8, arris.data[i]);
      return clamp(rr, 0.45, 0.95);
    });
    return { albedo, height, roughness, metallic: 0 };
  },
};

// Traffic paint colours, sRGB.
const WHITE = [0.8, 0.8, 0.77];
const YELLOW = [0.84, 0.63, 0.06];

export const recipes = [
  paint({ id: "mat_road_marking_white", color: WHITE, wear: 0.12, tyre: 0.5, note: "worn white thermoplastic; U runs along the stripe" }),
  paint({ id: "mat_road_marking_yellow", color: YELLOW, wear: 0.1, tyre: 0.45, note: "worn traffic-yellow thermoplastic; U runs along the stripe" }),
  paint({ id: "mat_road_crosswalk", color: WHITE, wear: 0.2, tyre: 0.95, note: "crosswalk bars: white paint with heavy tyre wear" }),
  SIDEWALK,
  KERB,
];
