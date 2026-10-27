// CPU shaded preview of a finished material, so recipes can be judged without a GPU:
// directional light + a fake night-city environment reflection, tiled N x N to expose seams.
import { srgbToLinear, linearToSrgb } from "./color.mjs";

const norm3 = ([x, y, z]) => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Fake environment: dark hazy sky with a few neon sources above the horizon (z is "up" for the slab).
const SOURCES = [
  { az: 0.6, color: [1.0, 0.1, 0.55] },
  { az: 2.2, color: [0.0, 0.8, 1.0] },
  { az: -1.2, color: [1.0, 0.45, 0.08] },
  { az: -2.5, color: [0.7, 0.85, 1.0] },
];
function env(r) {
  const el = Math.max(0, r[2]);
  const az = Math.atan2(r[1], r[0]);
  const haze = Math.pow(1 - el, 2);
  let out = [0.012 + haze * 0.05, 0.016 + haze * 0.035, 0.04 + haze * 0.09];
  const band = Math.max(0, 1 - Math.abs(el - 0.4) / 0.35);
  for (const s of SOURCES) {
    let d = Math.abs(az - s.az);
    if (d > Math.PI) d = 2 * Math.PI - d;
    const k = Math.max(0, 1 - d / 0.35) * band * 3.5;
    out = [out[0] + s.color[0] * k, out[1] + s.color[1] * k, out[2] + s.color[2] * k];
  }
  return out;
}

/**
 * maps: { w, h, albedo: Uint8 RGBA, normal: Uint8 RGBA|null, orm: Uint8 RGBA|null, emissive: Uint8 RGBA|null,
 *         params }. Returns { w, h, data: Uint8Array RGBA } of (w*tiles) x (h*tiles), capped to maxSide.
 */
export function shadePreview(maps, { tiles = 2, maxSide = 1536 } = {}) {
  const { w, h, albedo, normal, orm, emissive, params = {} } = maps;
  const factor = Math.max(1, Math.ceil((Math.max(w, h) * tiles) / maxSide));
  const ow = Math.floor((w * tiles) / factor);
  const oh = Math.floor((h * tiles) / factor);
  const out = new Uint8Array(ow * oh * 4);
  const L = norm3([-0.55, 0.5, 0.65]);
  const base = params.baseColor ?? [1, 1, 1];
  const rf = params.roughness ?? 1;
  const mf = params.metallic ?? 1;
  const ei = params.emissiveIntensity ?? 1;
  const ec = params.emissiveColor ?? [1, 1, 1];
  const lin = new Float32Array(256);
  for (let i = 0; i < 256; i++) lin[i] = srgbToLinear(i / 255);
  for (let oy = 0; oy < oh; oy++) {
    for (let ox = 0; ox < ow; ox++) {
      const sx = Math.floor(ox * factor) % w;
      const sy = Math.floor(oy * factor) % h;
      const i = (sy * w + sx) * 4;
      const alb = [lin[albedo[i]] * base[0], lin[albedo[i + 1]] * base[1], lin[albedo[i + 2]] * base[2]];
      let n = [0, 0, 1];
      if (normal) n = norm3([(normal[i] / 255) * 2 - 1, (normal[i + 1] / 255) * 2 - 1, (normal[i + 2] / 255) * 2 - 1]);
      const ao = orm ? orm[i] / 255 : 1;
      const rough = Math.max(0.04, (orm ? orm[i + 1] / 255 : 1) * rf);
      const metal = (orm ? orm[i + 2] / 255 : 1) * mf;
      // Camera hovering above the middle of the image, so flat mirrors reflect different directions across it.
      const V = norm3([-((ox + 0.5) / ow - 0.5) * 3, ((oy + 0.5) / oh - 0.5) * 3, 1]);
      const H = norm3([L[0] + V[0], L[1] + V[1], L[2] + V[2]]);
      const nl = Math.max(0, dot(n, L));
      const nh = Math.max(0, dot(n, H));
      const a2 = Math.pow(rough, 4);
      const d = a2 / (Math.PI * Math.pow(nh * nh * (a2 - 1) + 1, 2));
      const vh = Math.max(0, dot(V, H));
      const fres = Math.pow(1 - vh, 5);
      const o = (oy * ow + ox) * 4;
      const ndv = dot(n, V);
      const rv = norm3([2 * ndv * n[0] - V[0], 2 * ndv * n[1] - V[1], 2 * ndv * n[2] - V[2]]);
      const e = env(rv);
      const envF = Math.pow(1 - Math.max(0, ndv), 5);
      const gloss = Math.pow(1 - rough, 2);
      for (let c = 0; c < 3; c++) {
        const f0 = 0.04 + (alb[c] - 0.04) * metal;
        const spec = (d * (f0 + (1 - f0) * fres)) / (4 * Math.max(0.05, vh * vh)) * nl;
        const diff = alb[c] * (1 - metal) * (nl * 1.6 + 0.08) * (0.4 + 0.6 * ao);
        const refl = e[c] * (f0 + (1 - f0) * envF) * gloss * (0.5 + 0.5 * ao) * 2.2;
        let col = diff + spec * 1.6 + refl;
        if (emissive) col += lin[emissive[i + c]] * ei * ec[c];
        col = col / (1 + col); // soft tone map
        out[o + c] = Math.max(0, Math.min(255, Math.round(linearToSrgb(col) * 255)));
      }
      out[o + 3] = 255;
    }
  }
  return { w: ow, h: oh, data: out };
}
