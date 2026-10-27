// Building facades for the modular tower geometry: bay 3.0 m, storey 3.6 m, shop storey 4.8 m.
// All four tiles wrap in both directions, with the seam hidden in a pier / mullion / slab edge.
// Windows are placed from metres (ctx.pxPerM), so every layout stays correct at any --scale.
//
// Colour lives in the EMISSIVE map (lit windows, shop interiors); albedo stays dark and muted and
// glass is a low-roughness dielectric so the environment map carries the reflections.
import { Field, blur, mix } from "../lib/field.mjs";
import { fbm, perlin, white } from "../lib/noise.mjs";
import { rect, line } from "../lib/draw.mjs";
import { Rgb } from "../lib/color.mjs";
import { cavityAO } from "../lib/maps.mjs";
import { rng } from "../lib/rng.mjs";

const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Drawing helpers that take metres. */
function metres(ctx) {
  const [sx, sy] = ctx.pxPerM;
  return {
    sx,
    sy,
    rect: (f, x0, y0, x1, y1, v, o) => rect(f, x0 * sx, y0 * sy, x1 * sx, y1 * sy, v, o),
    line: (f, x0, y0, x1, y1, t, v, o) => line(f, x0 * sx, y0 * sy, x1 * sx, y1 * sy, t * sx, v, o),
  };
}

/** Exactly `lit` + `faint` windows are on, the rest off, in a deterministic shuffled order. */
function pickStates(r, n, lit, faint) {
  const a = Array.from({ length: n }, (_, i) => (i < lit ? "lit" : i < lit + faint ? "faint" : "dark"));
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickWeighted(r, list) {
  let total = 0;
  for (const e of list) total += e.w;
  let t = r() * total;
  for (const e of list) {
    t -= e.w;
    if (t <= 0) return e.v;
  }
  return list[list.length - 1].v;
}

// Emitted light colours (sRGB 0..1), scaled by params.emissiveIntensity in the material.
const WINDOW_LIGHTS = [
  { v: [1.0, 0.86, 0.62], w: 40 }, // warm white
  { v: [1.0, 0.62, 0.24], w: 20 }, // sodium
  { v: [0.55, 0.92, 1.0], w: 22 }, // cool cyan
  { v: [1.0, 0.28, 0.78], w: 8 }, // magenta
  { v: [0.42, 0.55, 1.0], w: 10 }, // tv blue
];
const NEON = [
  [0.25, 0.9, 1.0],
  [1.0, 0.2, 0.7],
  [1.0, 0.62, 0.2],
  [0.85, 0.95, 1.0],
  [0.55, 0.4, 1.0],
  [0.3, 1.0, 0.5],
];

/** Grimy concrete: lum multiplier (~1) and a small-scale height grain. */
function concrete(ctx, seed) {
  const { w, h } = ctx;
  const [bx, by] = ctx.cycles(2.6);
  const blotch = fbm(w, h, { fx: bx, fy: by, octaves: 5, seed: ctx.sub(seed) });
  const [mx, my] = ctx.cycles(0.4);
  const mid = fbm(w, h, { fx: mx, fy: my, octaves: 3, seed: ctx.sub(seed + 1) });
  const fine = white(w, h, ctx.sub(seed + 2));
  // Weathering runs vertically: high horizontal frequency, low vertical.
  const vert = fbm(w, h, { fx: Math.round(ctx.sizeM[0] / 0.16), fy: 3, octaves: 3, seed: ctx.sub(seed + 3) });
  const lum = new Field(w, h);
  const grain = new Field(w, h);
  for (let i = 0; i < lum.data.length; i++) {
    lum.data[i] = 1 + (blotch.data[i] - 0.5) * 0.7 + (mid.data[i] - 0.5) * 0.3 + (fine.data[i] - 0.5) * 0.09 + (vert.data[i] - 0.5) * 0.45;
    grain.data[i] = (mid.data[i] - 0.5) * 0.035 + (fine.data[i] - 0.5) * 0.012;
  }
  return { lum, grain, mid, blotch };
}

/**
 * Rain streaks running down from sources [{x0, x1, y}] (metres). Returns a Field in 0..1 that is
 * strongest right under the source and fades with length.
 */
function rainStreaks(ctx, M, sources, seed, { density = 0.07, minLen = 0.3, maxLen = 1.3 } = {}) {
  const f = new Field(ctx.w, ctx.h);
  const r = rng(ctx.sub(seed));
  for (const s of sources) {
    const n = Math.max(1, Math.round((s.x1 - s.x0) / density));
    for (let k = 0; k < n; k++) {
      const x = lerp(s.x0, s.x1, r());
      const len = minLen + r() * (maxLen - minLen);
      const thick = (1.2 + r() * 3.2) / M.sx;
      const a = 0.25 + r() * 0.6;
      const steps = 8;
      for (let j = 0; j < steps; j++) {
        const fade = 1 - j / steps;
        M.line(f, x, s.y + (len * j) / steps, x, s.y + (len * (j + 1)) / steps, thick * (0.5 + 0.5 * fade), a * fade, { mode: "max" });
      }
    }
  }
  return blur(f, 1, 1);
}

/** Small emissive dot with a faint halo (router / standby LEDs). */
function led(emis, ctx, cx, cy, rad, color, halo) {
  const { w, h } = ctx;
  const reach = Math.ceil(halo + 2);
  for (let y = Math.floor(cy - reach); y <= Math.ceil(cy + reach); y++) {
    for (let x = Math.floor(cx - reach); x <= Math.ceil(cx + reach); x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const k = clamp(1 - (d - rad)) * 0.95 + Math.exp(-(d * d) / (halo * halo)) * 0.12;
      const i = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) emis.data[i + c] = Math.min(1, emis.data[i + c] + color[c] * k);
    }
  }
}

/** Run fn(u, v, out) over the pixels of a rect (u, v in 0..1 across it) and store out as RGB. */
function paintRect(emis, ctx, g, fn) {
  const { w, h } = ctx;
  const x0 = Math.max(0, Math.floor(g.x0));
  const x1 = Math.min(w, Math.ceil(g.x1));
  const y0 = Math.max(0, Math.floor(g.y0));
  const y1 = Math.min(h, Math.ceil(g.y1));
  const gw = g.x1 - g.x0;
  const gh = g.y1 - g.y0;
  const out = [0, 0, 0];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      fn((x + 0.5 - g.x0) / gw, (y + 0.5 - g.y0) / gh, out);
      const i = (y * w + x) * 3;
      emis.data[i] = clamp(out[0]);
      emis.data[i + 1] = clamp(out[1]);
      emis.data[i + 2] = clamp(out[2]);
    }
  }
}

/** Fill a pixel rect with a colour (no AA), scaled by k. */
function fillRgb(emis, ctx, x0, y0, x1, y1, color, k = 1) {
  const { w, h } = ctx;
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(h, Math.ceil(y1)); y++) {
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(w, Math.ceil(x1)); x++) {
      const i = (y * w + x) * 3;
      for (let c = 0; c < 3; c++) emis.data[i + c] = clamp(color[c] * k);
    }
  }
}

/** Interior of a lit apartment window: ceiling lamp falloff plus blinds / curtains / a person / a TV. */
function apartmentLight(win, gwM, ghM) {
  const [cr, cg, cb] = win.color;
  return (u, v, out) => {
    // Ceiling-lit room: bright at the top, darker towards the floor and the side walls.
    let m = (0.4 + 0.7 * Math.pow(1 - v, 1.3)) * (1 - 0.35 * Math.pow(Math.abs(u - 0.5) * 2, 2));
    if (v > 0.93) m *= 0.5;
    const dx = (u - win.lampU) * gwM;
    const dy = v * ghM;
    m += 0.9 * Math.exp(-(dx * dx + dy * dy) / 0.15);
    let c = [cr, cg, cb];
    switch (win.style) {
      case "blinds":
        if (v < win.cov) m *= Math.floor((v * ghM) / 0.03) & 1 ? 0.16 : 0.34;
        else if (v < win.cov + 0.025) m *= 0.1;
        break;
      case "curtain": {
        const e = Math.min(u, 1 - u);
        if (e < win.curtain) m *= 0.08 + 0.14 * (0.5 + 0.5 * Math.sin(u * win.fold));
        break;
      }
      case "person": {
        const px = (u - win.px) * gwM;
        const head = 1 - Math.hypot(px, (v - 0.46) * ghM) / 0.115;
        const body = 1 - Math.hypot(px / 0.26, ((v - 0.86) * ghM) / 0.62);
        m *= 1 - 0.96 * clamp(Math.max(head, body) * 8);
        break;
      }
      case "tv":
        m *= 0.32;
        if (u > 0.3 && u < 0.7 && v > 0.45 && v < 0.72) {
          m = 1.2;
          c = [0.4, 0.62, 1.0];
        }
        break;
      default:
    }
    // Furniture (sofa / cabinet) in front of the light.
    if (win.furn && u > win.furn.u0 && u < win.furn.u1) m *= 1 - 0.8 * sstep(win.furn.top, win.furn.top + 0.02, v);
    const e = Math.min(u, 1 - u, v, 1 - v);
    m *= win.brightness * (0.75 + 0.25 * sstep(0, 0.08, e));
    out[0] = c[0] * m;
    out[1] = c[1] * m;
    out[2] = c[2] * m;
  };
}

// ---------------------------------------------------------------------------------------------
// Windowed concrete tower, 4 bays x 2 storeys. `o.lit` / `o.faint` windows out of 8 are on.

function windowTower(ctx, o) {
  const { w, h } = ctx;
  const M = metres(ctx);
  const [W, H] = ctx.sizeM;
  const r = rng(ctx.sub(o.seed));
  const BAYS = 4;
  const STOREYS = 2;
  const WIN_W = 1.8;
  const WIN_H = 2.0;
  const wall = concrete(ctx, o.seed + 10);

  const height = new Field(w, h);
  for (let i = 0; i < height.data.length; i++) height.data[i] = 0.6 + wall.grain.data[i];
  const frameM = new Field(w, h);
  const glassM = new Field(w, h);
  const panel = Field.filled(w, h, 1);
  const joint = new Field(w, h);
  const slab = new Field(w, h);
  const glassCol = [Field.filled(w, h, 0.024), Field.filled(w, h, 0.03), Field.filled(w, h, 0.04)];

  // Precast panel tone per bay and storey, joints at bay borders (the middle of each pier).
  for (let s = 0; s < STOREYS; s++) {
    for (let i = 0; i < BAYS; i++) {
      M.rect(panel, i * 3, s * 3.6, i * 3 + 3, (s + 1) * 3.6, 0.91 + r() * 0.18);
    }
  }
  for (let i = 0; i < BAYS; i++) {
    M.rect(joint, i * 3 - 0.007, 0, i * 3 + 0.007, H, 1);
    M.rect(height, i * 3 - 0.007, 0, i * 3 + 0.007, H, 0.5);
  }
  // Slab edges (floor lines) stand slightly proud.
  for (let s = 0; s < STOREYS; s++) {
    const y = s * 3.6;
    M.rect(slab, 0, y - 0.25, W, y + 0.25, 1);
    M.rect(height, 0, y - 0.25, W, y + 0.25, 0.7);
    M.rect(joint, 0, y - 0.255, W, y - 0.245, 1);
    M.rect(joint, 0, y + 0.245, W, y + 0.255, 1);
  }

  const states = pickStates(r, BAYS * STOREYS, o.lit, o.faint);
  const sources = [];
  const wins = [];
  for (let s = 0; s < STOREYS; s++) {
    for (let i = 0; i < BAYS; i++) {
      const cx = 1.5 + 3 * i;
      const top = s * 3.6 + 0.65;
      const x0 = cx - WIN_W / 2;
      const x1 = cx + WIN_W / 2;
      const y1 = top + WIN_H;
      // Recessed opening, frame plane, glass plane, projecting sill and lintel.
      M.rect(height, x0 - 0.1, top - 0.1, x1 + 0.1, y1, 0.42, { soft: 1.5 });
      M.rect(height, x0, top, x1, y1, 0.34, { soft: 1 });
      M.rect(height, x0 + 0.06, top + 0.06, x1 - 0.06, y1 - 0.06, 0.2, { soft: 1 });
      M.rect(height, x0 - 0.12, y1, x1 + 0.12, y1 + 0.09, 0.8, { soft: 1 });
      M.rect(height, x0 - 0.12, y1 + 0.09, x1 + 0.12, y1 + 0.105, 0.5);
      M.rect(height, x0 - 0.1, top - 0.14, x1 + 0.1, top - 0.1, 0.72);

      M.rect(frameM, x0, top, x1, y1, 1);
      M.rect(frameM, x0 + 0.06, top + 0.06, x1 - 0.06, y1 - 0.06, 0);
      M.rect(glassM, x0 + 0.06, top + 0.06, x1 - 0.06, y1 - 0.06, 1);
      const mull = Math.floor(r() * 3); // 0 none, 1 centre bar, 2 centre bar + fanlight transom
      if (mull >= 1) {
        M.rect(frameM, cx - 0.025, top, cx + 0.025, y1, 1);
        M.rect(glassM, cx - 0.025, top, cx + 0.025, y1, 0);
      }
      if (mull === 2) {
        M.rect(frameM, x0, top + 0.55, x1, top + 0.6, 1);
        M.rect(glassM, x0, top + 0.55, x1, top + 0.6, 0);
      }
      const tint = [
        [0.022, 0.03, 0.04],
        [0.03, 0.032, 0.034],
        [0.02, 0.036, 0.046],
      ][Math.floor(r() * 3)];
      for (let c = 0; c < 3; c++) M.rect(glassCol[c], x0, top, x1, y1, tint[c]);

      sources.push({ x0: x0 - 0.1, x1: x1 + 0.1, y: y1 + 0.105 });
      wins.push({
        state: states[s * BAYS + i],
        g: { x0: (x0 + 0.06) * M.sx, y0: (top + 0.06) * M.sy, x1: (x1 - 0.06) * M.sx, y1: (y1 - 0.06) * M.sy },
        gwM: WIN_W - 0.12,
        ghM: WIN_H - 0.12,
        color: pickWeighted(r, WINDOW_LIGHTS),
        style: pickWeighted(r, [
          { v: "plain", w: 30 },
          { v: "blinds", w: 25 },
          { v: "curtain", w: 20 },
          { v: "person", w: 15 },
          { v: "tv", w: 10 },
        ]),
        cov: 0.25 + r() * 0.65,
        curtain: 0.12 + r() * 0.2,
        fold: 30 + r() * 30,
        px: 0.25 + r() * 0.5,
        lampU: 0.2 + r() * 0.6,
        brightness: 0.5 + r() * 0.45,
        furn: r() < 0.6 ? (() => { const u0 = r() * 0.5; return { u0, u1: u0 + 0.2 + r() * 0.35, top: 0.68 + r() * 0.14 }; })() : null,
        ledAt: r() < 0.4 ? { u: 0.08 + r() * 0.84, v: 0.78 + r() * 0.16, c: [[0.2, 1.0, 0.3], [1.0, 0.15, 0.1], [0.3, 0.5, 1.0]][Math.floor(r() * 3)] } : null,
      });
    }
  }

  // Emissive: lit windows get an interior, faint ones a dim standby glow, dark ones maybe a LED.
  const emis = new Rgb(w, h);
  for (const win of wins) {
    if (win.state === "lit") {
      paintRect(emis, ctx, win.g, apartmentLight(win, win.gwM, win.ghM));
    } else if (win.state === "faint") {
      const col = [0.42, 0.55, 1.0];
      paintRect(emis, ctx, win.g, (u, v, out) => {
        const k = 0.05 + 0.07 * Math.exp(-((u - 0.5) ** 2 + (v - 0.7) ** 2) * 6);
        out[0] = col[0] * k;
        out[1] = col[1] * k;
        out[2] = col[2] * k;
      });
    }
    if (win.state !== "lit" && win.ledAt) {
      const { g } = win;
      led(emis, ctx, g.x0 + win.ledAt.u * (g.x1 - g.x0), g.y0 + win.ledAt.v * (g.y1 - g.y0), 1.6 * ctx.w / 2048, win.ledAt.c, 5 * ctx.w / 2048);
    }
  }
  for (let i = 0; i < w * h; i++) {
    const k = glassM.data[i];
    emis.data[i * 3] *= k;
    emis.data[i * 3 + 1] *= k;
    emis.data[i * 3 + 2] *= k;
  }

  // Wet / dirty glass: dirt streaks and smudges raise roughness locally.
  const [dx, dy] = ctx.cycles(0.6);
  const smudge = fbm(w, h, { fx: dx, fy: dy, octaves: 3, seed: ctx.sub(o.seed + 30) });
  const streak = rainStreaks(ctx, M, sources, o.seed + 31);

  const alb = new Rgb(w, h);
  const rough = new Field(w, h);
  const metal = new Field(w, h);
  const [tr, tg, tb] = o.tone;
  for (let i = 0; i < w * h; i++) {
    const f = frameM.data[i];
    const g = glassM.data[i];
    const st = streak.data[i];
    let wl = wall.lum.data[i] * panel.data[i] * (1 - 0.42 * st) * (1 - 0.5 * joint.data[i]) * (1 - 0.22 * slab.data[i]);
    wl = Math.max(0, wl);
    let rr = tr * wl;
    let gg = tg * wl;
    let bb = tb * wl;
    rr += (0.07 - rr) * f;
    gg += (0.072 - gg) * f;
    bb += (0.08 - bb) * f;
    rr += (glassCol[0].data[i] - rr) * g;
    gg += (glassCol[1].data[i] - gg) * g;
    bb += (glassCol[2].data[i] - bb) * g;
    alb.data[i * 3] = rr;
    alb.data[i * 3 + 1] = gg;
    alb.data[i * 3 + 2] = bb;
    let ro = 0.86 + (wall.mid.data[i] - 0.5) * 0.12;
    ro = lerp(ro, 0.55, st * 0.8);
    ro = lerp(ro, 0.4, f);
    ro = lerp(ro, 0.09 + 0.12 * sstep(0.55, 0.78, smudge.data[i]) + 0.05 * st, g);
    rough.data[i] = ro;
    metal.data[i] = f * 0.85;
  }
  const cav = cavityAO(height, { radiusPx: Math.round(0.1 * M.sx), strength: 2.2 });
  const ao = mix(cav, 1, glassM); // never occlude glass reflections
  return { albedo: alb, height, roughness: rough, metallic: metal, ao, emissive: emis };
}

// ---------------------------------------------------------------------------------------------
// Glass curtain wall: 1.5 m panes, spandrel band at each floor line.

function curtainWall(ctx) {
  const { w, h } = ctx;
  const M = metres(ctx);
  const [W, H] = ctx.sizeM;
  const r = rng(ctx.sub(101));
  const COLS = 8;
  const PW = 1.5;
  const STOREY = 3.6;
  const VIS = 2.7;
  const STOREYS = 2;

  const height = new Field(w, h);
  const [nx, ny] = ctx.cycles(1.2);
  const wavy = fbm(w, h, { fx: nx, fy: ny, octaves: 3, seed: ctx.sub(102) });
  for (let i = 0; i < height.data.length; i++) height.data[i] = 0.5 + (wavy.data[i] - 0.5) * 0.02;
  const frameM = new Field(w, h);
  const glassM = new Field(w, h);
  const spandM = new Field(w, h);

  for (let s = 0; s < STOREYS; s++) {
    const top = s * STOREY;
    M.rect(spandM, 0, top + VIS, W, top + STOREY, 1);
    M.rect(height, 0, top + VIS, W, top + STOREY, 0.6);
    M.rect(glassM, 0, top, W, top + VIS, 1);
  }
  const bar = (x0, y0, x1, y1) => {
    M.rect(frameM, x0, y0, x1, y1, 1);
    M.rect(height, x0, y0, x1, y1, 0.85, { soft: 1 });
  };
  for (let k = 0; k < COLS; k++) bar(k * PW - 0.035, 0, k * PW + 0.035, H);
  for (let s = 0; s < STOREYS; s++) {
    bar(0, s * STOREY - 0.045, W, s * STOREY + 0.045);
    bar(0, s * STOREY + VIS - 0.03, W, s * STOREY + VIS + 0.03);
  }
  for (let i = 0; i < w * h; i++) glassM.data[i] *= 1 - frameM.data[i];

  // Per-pane state.
  const panes = [];
  const lit = pickStates(r, COLS * STOREYS, Math.round(0.2 * COLS * STOREYS), 0);
  const TINTS = [
    [0.03, 0.075, 0.085], // blue-green
    [0.045, 0.05, 0.055], // graphite
    [0.025, 0.045, 0.095], // deep blue
    [0.02, 0.07, 0.07], // teal
  ];
  for (let s = 0; s < STOREYS; s++) {
    for (let k = 0; k < COLS; k++) {
      const coated = r() < 0.3;
      panes.push({
        g: { x0: (k * PW + 0.035) * M.sx, y0: (s * STOREY + 0.045) * M.sy, x1: ((k + 1) * PW - 0.035) * M.sx, y1: (s * STOREY + VIS - 0.03) * M.sy },
        tint: TINTS[Math.floor(r() * TINTS.length)],
        coated,
        lit: lit[s * COLS + k] === "lit",
        color: r() < 0.6 ? [0.8, 0.9, 1.0] : [1.0, 0.8, 0.55],
        parts: Array.from({ length: Math.floor(r() * 3) }, () => {
          const u0 = r() * 0.7;
          return { u0, u1: u0 + 0.15 + r() * 0.25, v0: 0.5 + r() * 0.3 };
        }),
        screens: Array.from({ length: Math.floor(r() * 3) }, () => ({ u: 0.1 + r() * 0.75, v: 0.52 + r() * 0.12, c: r() < 0.5 ? [0.4, 0.9, 1.0] : [0.9, 0.95, 1.0] })),
        bright: 0.7 + r() * 0.3,
      });
    }
  }

  const glassRough = new Field(w, h);
  const glassMetal = new Field(w, h);
  const glassCol = new Rgb(w, h);
  const emis = new Rgb(w, h);
  const noise = white(w, h, ctx.sub(103));
  for (const p of panes) {
    const gw = p.g.x1 - p.g.x0;
    const gh = p.g.y1 - p.g.y0;
    const x0 = Math.floor(p.g.x0) - 2;
    const x1 = Math.ceil(p.g.x1) + 2;
    const y0 = Math.floor(p.g.y0) - 2;
    const y1 = Math.ceil(p.g.y1) + 2;
    for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) {
        const i = y * w + x;
        const v = clamp((y + 0.5 - p.g.y0) / gh);
        // Sky reflection gradient: lighter towards the top of each pane.
        const k = (1.3 - 0.45 * v) * (0.95 + 0.1 * noise.data[i]);
        const t = p.coated ? [0.2, 0.3, 0.32] : p.tint;
        glassCol.data[i * 3] = t[0] * (p.coated ? 0.85 + 0.3 * (1 - v) : k);
        glassCol.data[i * 3 + 1] = t[1] * (p.coated ? 0.85 + 0.3 * (1 - v) : k);
        glassCol.data[i * 3 + 2] = t[2] * (p.coated ? 0.85 + 0.3 * (1 - v) : k);
        glassMetal.data[i] = p.coated ? 0.85 : 0;
        glassRough.data[i] = p.coated ? 0.09 : 0.07;
      }
    }
    if (p.lit) {
      const gwM = gw / ctx.pxPerM[0];
      const ghM = gh / ctx.pxPerM[1];
      paintRect(emis, ctx, p.g, (u, v, out) => {
        // Dim back wall, ceiling light panels in a row at the top, partitions and monitors in front.
        let m = 0.14 + 0.22 * Math.pow(1 - v, 2);
        const pu = (u * gwM) % 0.75;
        if (v > 0.03 && v < 0.12 && pu > 0.08 && pu < 0.68) m = 1.0;
        else if (v >= 0.12 && v < 0.2 && pu > 0.08 && pu < 0.68) m += 0.25 * (1 - (v - 0.12) / 0.08);
        for (const q of p.parts) if (u > q.u0 && u < q.u1 && v > q.v0) m *= 0.22;
        let c = p.color;
        for (const sc of p.screens) {
          if (Math.abs((u - sc.u) * gwM) < 0.2 && Math.abs((v - sc.v) * ghM) < 0.12) {
            m = 0.95;
            c = sc.c;
          }
        }
        m *= p.bright;
        out[0] = c[0] * m;
        out[1] = c[1] * m;
        out[2] = c[2] * m;
      });
    }
  }
  // Rain streaks start at the top of every pane and dirty the glass.
  const sources = [];
  for (let s = 0; s < STOREYS; s++) for (let k = 0; k < COLS; k++) sources.push({ x0: k * PW + 0.05, x1: (k + 1) * PW - 0.05, y: s * STOREY + 0.05 });
  const streak = rainStreaks(ctx, M, sources, 104, { density: 0.12, minLen: 0.5, maxLen: 2.4 });
  const brushed = perlin(w, h, 6, Math.min(Math.round(H / 0.02), h / 2), ctx.sub(105));
  const [sx2, sy2] = ctx.cycles(0.9);
  const spandTone = fbm(w, h, { fx: sx2, fy: sy2, octaves: 3, seed: ctx.sub(106) });

  const alb = new Rgb(w, h);
  const rough = new Field(w, h);
  const metal = new Field(w, h);
  for (let i = 0; i < w * h; i++) {
    const f = frameM.data[i];
    const sp = spandM.data[i];
    const g = glassM.data[i];
    const st = streak.data[i];
    const sk = 0.8 + 0.4 * spandTone.data[i];
    const bl = 0.85 + 0.3 * brushed.data[i];
    // Base is the spandrel panel; frame and glass blend on top.
    let rr = 0.05 * sk * bl;
    let gg = 0.055 * sk * bl;
    let bb = 0.065 * sk * bl;
    rr += (0.08 - rr) * f;
    gg += (0.085 - gg) * f;
    bb += (0.09 - bb) * f;
    const gc = glassCol.data;
    rr += (gc[i * 3] + 0.025 * st - rr) * g;
    gg += (gc[i * 3 + 1] + 0.025 * st - gg) * g;
    bb += (gc[i * 3 + 2] + 0.03 * st - bb) * g;
    alb.data[i * 3] = rr;
    alb.data[i * 3 + 1] = gg;
    alb.data[i * 3 + 2] = bb;
    let ro = 0.4 + 0.12 * brushed.data[i]; // spandrel
    ro = lerp(ro, 0.35, f);
    ro = lerp(ro, glassRough.data[i] + 0.22 * st, g);
    rough.data[i] = ro;
    let me = 0.55 * sp;
    me = lerp(me, 0.9, f);
    me = lerp(me, glassMetal.data[i], g);
    metal.data[i] = me;
    const k = g;
    emis.data[i * 3] *= k;
    emis.data[i * 3 + 1] *= k;
    emis.data[i * 3 + 2] *= k;
  }
  const cav = cavityAO(height, { radiusPx: Math.round(0.05 * M.sx), strength: 1.5 });
  const ao = mix(cav, 1, glassM);
  return { albedo: alb, height, roughness: rough, metallic: metal, ao, emissive: emis };
}

// ---------------------------------------------------------------------------------------------
// Shop storey: fascia, glazing or roller shutter per bay, bulkhead, concrete slab at the seam.

const FASCIA = [0.25, 1.0];
const GLAZE = [1.15, 4.1];
const BULK = [4.1, 4.55];

/** Back-wall contents of a lit shop, painted into emis over the glass rect g. */
function shopInterior(emis, ctx, g, kind, color, r) {
  const gwM = (g.x1 - g.x0) / ctx.pxPerM[0];
  const ghM = (g.y1 - g.y0) / ctx.pxPerM[1];
  const glow = kind === "shelves" ? [0.85, 0.95, 1.0] : color;
  paintRect(emis, ctx, g, (u, v, out) => {
    let m = 0.26 + 0.36 * Math.exp(-((u - 0.5) ** 2 * 3.5 + (v - 0.45) ** 2 * 2.5)) + 0.5 * Math.exp(-v * 9);
    if (v > 0.8) m *= 0.14;
    let c = glow;
    // Ceiling light tubes.
    if (v > 0.025 && v < 0.05 && u > 0.05 && u < 0.95) {
      m = 1.1;
      c = [1, 1, 1];
    }
    out[0] = c[0] * m;
    out[1] = c[1] * m;
    out[2] = c[2] * m;
  });
  const px = (u) => g.x0 + u * (g.x1 - g.x0);
  const py = (v) => g.y0 + v * (g.y1 - g.y0);
  if (kind === "shelves" || kind === "bar") {
    const rows = kind === "shelves" ? [0.3, 0.44, 0.58, 0.72] : [0.38, 0.58];
    for (const rv of rows) {
      let u = 0.04;
      while (u < 0.94) {
        const iw = (0.1 + r() * 0.22) / gwM;
        const ih = (kind === "bar" ? 0.16 + r() * 0.1 : 0.12 + r() * 0.12) / ghM;
        const bottle = kind === "bar";
        const col = bottle ? NEON[Math.floor(r() * 3) + (r() < 0.3 ? 2 : 0)] : r() < 0.35 ? NEON[Math.floor(r() * NEON.length)] : [0.85, 0.9, 0.95];
        const wI = bottle ? Math.min(iw, 0.05 / gwM) : iw;
        fillRgb(emis, ctx, px(u), py(rv - ih), px(u + wI * 0.9), py(rv), col, 0.45 + r() * 0.5);
        u += wI + (0.015 + r() * 0.03);
      }
      fillRgb(emis, ctx, px(0.02), py(rv), px(0.98), py(rv + 0.014), [0.02, 0.02, 0.025], 1); // shelf board
    }
  } else {
    // Arcade: a grid of CRT screens with scanlines.
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        if (r() < 0.2) continue;
        const c = NEON[Math.floor(r() * NEON.length)];
        const x0 = px(0.06 + col * 0.23);
        const y0 = py(0.2 + row * 0.33);
        const x1 = px(0.06 + col * 0.23 + 0.17);
        const y1 = py(0.2 + row * 0.33 + 0.27);
        for (let y = Math.floor(y0); y < y1; y++) fillRgb(emis, ctx, x0, y, x1, y + 1, c, y & 2 ? 0.55 : 0.85);
      }
    }
  }
  // Counter edge in the main colour.
  fillRgb(emis, ctx, px(0.02), py(0.78), px(0.98), py(0.79), color, 0.9);
}

function shopfront(ctx) {
  const { w, h } = ctx;
  const M = metres(ctx);
  const [W, H] = ctx.sizeM;
  const r = rng(ctx.sub(201));
  const BAYS = 4;
  const wall = concrete(ctx, 210);

  const height = new Field(w, h);
  for (let i = 0; i < height.data.length; i++) height.data[i] = 0.6 + wall.grain.data[i];
  const frameM = new Field(w, h);
  const glassM = new Field(w, h);
  const slab = new Field(w, h);
  const fascia = new Field(w, h);
  const shutter = new Field(w, h);
  const bulkTile = new Field(w, h);
  const bulkMetal = new Field(w, h);
  const doorM = new Field(w, h);
  const shutterCol = [new Field(w, h), new Field(w, h), new Field(w, h)];

  // Concrete slab edge straddles the vertical seam (top 0..0.25 and bottom 4.55..4.8).
  M.rect(slab, 0, -0.25, W, 0.25, 1);
  M.rect(height, 0, -0.25, W, 0.25, 0.7);
  M.rect(fascia, 0, FASCIA[0], W, FASCIA[1], 1);
  M.rect(height, 0, FASCIA[0], W, FASCIA[1], 0.62);

  // Roles: one door bay, one roller shutter, two plain shop windows; three bays lit.
  const roles = pickStates(r, BAYS, 1, 1).map((s) => (s === "lit" ? "door" : s === "faint" ? "shutter" : "window"));
  const litBay = roles.map((role) => role !== "shutter");
  const dimBay = roles.findIndex((role) => role === "window");
  litBay[dimBay] = false;

  const SHUTTER_COLS = [
    [0.3, 0.31, 0.33],
    [0.17, 0.24, 0.2],
    [0.33, 0.14, 0.12],
    [0.22, 0.25, 0.32],
  ];
  const bays = [];
  for (let i = 0; i < BAYS; i++) {
    const x0 = i * 3 + 0.05;
    const x1 = i * 3 + 2.95;
    const role = roles[i];
    const rect4 = [x0, GLAZE[0], x1, GLAZE[1]];
    if (role === "shutter") {
      M.rect(shutter, ...rect4, 1);
      const c = SHUTTER_COLS[Math.floor(r() * SHUTTER_COLS.length)];
      for (let k = 0; k < 3; k++) M.rect(shutterCol[k], ...rect4, c[k]);
      M.rect(height, ...rect4, 0.45);
    } else {
      M.rect(glassM, ...rect4, 1);
      M.rect(height, ...rect4, role === "door" ? 0.12 : 0.28, { soft: 1 });
    }
    const kind = ["shelves", "bar", "arcade"][Math.floor(r() * 3)];
    bays.push({
      role,
      lit: litBay[i],
      kind,
      color: pickWeighted(r, [
        { v: NEON[0], w: 3 },
        { v: NEON[1], w: 3 },
        { v: NEON[2], w: 2 },
        { v: NEON[3], w: 2 },
        { v: NEON[4], w: 1 },
      ]),
      glassPx: { x0: x0 * M.sx, y0: GLAZE[0] * M.sy, x1: x1 * M.sx, y1: GLAZE[1] * M.sy },
      stripColor: pickWeighted(r, [
        { v: NEON[3], w: 5 },
        { v: NEON[1], w: 2 },
        { v: NEON[0], w: 2 },
        { v: NEON[2], w: 1 },
      ]),
      bulk: r() < 0.5 ? "tile" : "metal",
      x0,
      x1,
    });
    // Bulkhead below the glass.
    M.rect(bays[i].bulk === "tile" ? bulkTile : bulkMetal, x0 - 0.05, BULK[0], x1 + 0.05, BULK[1], 1);
  }

  // Frames: mullions on the bay borders (centred on the wrap seam for bay 0), header bar, sill bar.
  const bar = (a, b, c, d, hv = 0.85) => {
    M.rect(frameM, a, b, c, d, 1);
    M.rect(height, a, b, c, d, hv, { soft: 1 });
  };
  for (let i = 0; i < BAYS; i++) bar(i * 3 - 0.05, GLAZE[0] - 0.12, i * 3 + 0.05, BULK[1]); // pilasters keep bay changes away from the seam
  bar(0, GLAZE[0] - 0.12, W, GLAZE[0]);
  bar(0, GLAZE[1] - 0.05, W, GLAZE[1]);
  for (const b of bays) {
    if (b.role !== "door") continue;
    // Door leaf: 1.1 m wide with a heavier frame and a handle bar; the fixed lights stay glass.
    const cx = (b.x0 + b.x1) / 2;
    M.rect(frameM, cx - 0.55, GLAZE[0], cx + 0.55, GLAZE[1] - 0.05, 1);
    M.rect(frameM, cx - 0.48, GLAZE[0] + 0.07, cx + 0.48, GLAZE[1] - 0.12, 0);
    M.rect(doorM, cx - 0.55, GLAZE[0], cx + 0.55, GLAZE[1], 1);
    M.rect(height, cx - 0.55, GLAZE[0], cx + 0.55, GLAZE[1] - 0.05, 0.5, { soft: 1 });
    M.rect(height, cx - 0.48, GLAZE[0] + 0.07, cx + 0.48, GLAZE[1] - 0.12, 0.3, { soft: 1 });
    M.rect(frameM, cx + 0.3, 2.3, cx + 0.34, 3.0, 1);
    M.rect(glassM, cx - 0.55, GLAZE[0], cx + 0.55, GLAZE[1], 0);
    M.rect(glassM, cx - 0.48, GLAZE[0] + 0.07, cx + 0.48, GLAZE[1] - 0.12, 1);
    M.rect(glassM, cx + 0.3, 2.3, cx + 0.34, 3.0, 0);
  }
  for (let i = 0; i < w * h; i++) glassM.data[i] *= 1 - frameM.data[i];

  // Roller shutter detail: slat relief, dents, box at the top, bottom lip.
  const slatPx = 0.07 * M.sy;
  const dent = fbm(w, h, { fx: ctx.cycles(0.8)[0], fy: ctx.cycles(0.8)[1], octaves: 3, seed: ctx.sub(211) });
  const rust = fbm(w, h, { fx: ctx.cycles(0.25)[0], fy: ctx.cycles(0.25)[1], octaves: 4, seed: ctx.sub(212) });
  for (const b of bays) {
    if (b.role !== "shutter") continue;
    const y0 = Math.floor(GLAZE[0] * M.sy);
    const y1 = Math.ceil(GLAZE[1] * M.sy);
    for (let y = y0; y < y1; y++) {
      const slat = 0.5 + 0.5 * Math.cos(((y + 0.5) / slatPx) * Math.PI * 2);
      for (let x = Math.floor(b.x0 * M.sx); x < Math.ceil(b.x1 * M.sx); x++) {
        const i = y * w + x;
        height.data[i] = 0.42 + 0.14 * slat + (dent.data[i] - 0.5) * 0.12;
      }
    }
    M.rect(height, b.x0, GLAZE[0], b.x1, GLAZE[0] + 0.22, 0.72, { soft: 2 }); // shutter box
    M.rect(height, b.x0, GLAZE[1] - 0.12, b.x1, GLAZE[1], 0.8, { soft: 1 }); // bottom lip
    M.rect(height, b.x0, GLAZE[0], b.x0 + 0.08, GLAZE[1], 0.75, { soft: 1 }); // guide rails
    M.rect(height, b.x1 - 0.08, GLAZE[0], b.x1, GLAZE[1], 0.75, { soft: 1 });
  }

  // Lights: fascia strip, shop interiors.
  const emis = new Rgb(w, h);
  for (const b of bays) {
    const sx0 = (b.x0 + 0.15) * M.sx;
    const sx1 = (b.x1 - 0.15) * M.sx;
    const sy0 = 0.88 * M.sy;
    const strong = b.role !== "shutter" && b.lit;
    for (let y = Math.floor(sy0 - 10); y < sy0 + 12; y++) {
      const d = y + 0.5 - (sy0 + 0.02 * M.sy);
      const core = Math.abs(d) < 0.017 * M.sy ? 1 : 0;
      const spill = Math.exp(-((Math.abs(d) / (0.1 * M.sy)) ** 2)) * 0.18;
      const k = (core * (strong ? 0.55 : 0.2) + spill * (strong ? 1 : 0.3)) * (y + 0.5 < FASCIA[1] * M.sy ? 1 : 0);
      for (let x = Math.floor(sx0); x < sx1; x++) {
        const i = (y * w + x) * 3;
        for (let c = 0; c < 3; c++) emis.data[i + c] = clamp(b.stripColor[c] * k);
      }
    }
    if (b.role !== "shutter" && b.lit) shopInterior(emis, ctx, b.glassPx, b.kind, b.color, rng(ctx.sub(300 + Math.round(b.x0))));
    else if (b.role !== "shutter") {
      // Dark shop: only a night-light and a standby LED.
      led(emis, ctx, b.glassPx.x0 + (b.glassPx.x1 - b.glassPx.x0) * 0.8, b.glassPx.y0 + (b.glassPx.y1 - b.glassPx.y0) * 0.55, 1.6 * ctx.w / 2048, [0.2, 1, 0.3], 6 * ctx.w / 2048);
    }
  }
  for (let i = 0; i < w * h; i++) {
    // Interior light only shows through glass; the fascia strip is on the fascia, keep it.
    const keep = Math.max(glassM.data[i], fascia.data[i]);
    emis.data[i * 3] *= keep;
    emis.data[i * 3 + 1] *= keep;
    emis.data[i * 3 + 2] *= keep;
  }

  // Tile bulkhead: 0.15 m tiles with grout; metal bays are brushed kick plates.
  const tilePx = [0.15 * M.sx, 0.15 * M.sy];
  const tileTone = (tx, ty) => 0.85 + 0.3 * ((Math.imul(tx * 73856093 ^ ty * 19349663, 0x9e3779b1) >>> 8) / 16777216);
  const brushed = perlin(w, h, 3, Math.min(Math.round(H / 0.035), h / 2), ctx.sub(213));
  const sources = [];
  for (const b of bays) sources.push({ x0: b.x0 + 0.1, x1: b.x1 - 0.1, y: FASCIA[1] + 0.02 });
  const streak = rainStreaks(ctx, M, sources, 214, { density: 0.15, minLen: 0.3, maxLen: 1.0 });

  const alb = new Rgb(w, h);
  const rough = new Field(w, h);
  const metal = new Field(w, h);
  const [tr, tg, tb] = [0.3, 0.3, 0.32];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const f = frameM.data[i];
      const g = glassM.data[i];
      const sl = slab.data[i];
      const fa = fascia.data[i];
      const sh = shutter.data[i];
      const bt = bulkTile.data[i] * (1 - f); // pilasters stay on top of the bulkhead
      const bm = bulkMetal.data[i] * (1 - f);
      const st = streak.data[i];
      const wl = Math.max(0, wall.lum.data[i] * (1 - 0.4 * st) * (1 - 0.22 * sl));
      let rr = tr * wl;
      let gg = tg * wl;
      let bb = tb * wl;
      let ro = 0.86 + (wall.mid.data[i] - 0.5) * 0.12;
      ro = lerp(ro, 0.55, st * 0.7);
      let me = 0;
      // Fascia: dark composite panel.
      rr += (0.05 - rr) * fa;
      gg += (0.055 - gg) * fa;
      bb += (0.065 - bb) * fa;
      ro = lerp(ro, 0.45, fa);
      me = lerp(me, 0.4, fa);
      // Tile bulkhead.
      if (bt > 0.001) {
        const tx = Math.floor(x / tilePx[0]);
        const ty = Math.floor((y - BULK[0] * M.sy) / tilePx[1]);
        const fx = (x / tilePx[0]) % 1;
        const fy = ((y - BULK[0] * M.sy) / tilePx[1]) % 1;
        const grout = Math.min(fx, 1 - fx, fy, 1 - fy) < 0.045 ? 1 : 0;
        const tone = tileTone(tx, ty) * (1 - 0.5 * grout);
        rr += (0.06 * tone - rr) * bt;
        gg += (0.07 * tone - gg) * bt;
        bb += (0.08 * tone - bb) * bt;
        ro = lerp(ro, grout ? 0.8 : 0.2, bt);
        me = lerp(me, 0, bt);
        height.data[i] = lerp(height.data[i], grout ? 0.45 : 0.62, bt);
      }
      // Metal kick plate.
      const bl = 0.85 + 0.3 * brushed.data[i];
      rr += (0.5 * bl - rr) * bm;
      gg += (0.51 * bl - gg) * bm;
      bb += (0.53 * bl - bb) * bm;
      ro = lerp(ro, 0.35 + 0.15 * brushed.data[i], bm);
      me = lerp(me, 0.9, bm);
      height.data[i] = lerp(height.data[i], 0.62, bm * 0.5);
      // Shutter: painted steel, rusty and grimy towards the bottom.
      if (sh > 0.001) {
        const t = clamp((y / M.sy - GLAZE[0]) / (GLAZE[1] - GLAZE[0]));
        const grime = 1 - 0.35 * t * t - 0.3 * sstep(0.55, 0.8, rust.data[i]);
        const slatShade = 0.8 + 0.4 * ((height.data[i] - 0.42) / 0.14);
        const rustMix = sstep(0.62, 0.8, rust.data[i]) * (0.3 + 0.7 * t);
        rr += (lerp(shutterCol[0].data[i] * grime * slatShade, 0.28, rustMix * 0.5) - rr) * sh;
        gg += (lerp(shutterCol[1].data[i] * grime * slatShade, 0.12, rustMix * 0.5) - gg) * sh;
        bb += (lerp(shutterCol[2].data[i] * grime * slatShade, 0.06, rustMix * 0.5) - bb) * sh;
        ro = lerp(ro, 0.42 + 0.3 * rustMix + 0.1 * (dent.data[i] - 0.5), sh);
        me = lerp(me, 0.75 * (1 - rustMix * 0.6), sh);
      }
      // Frames: dark aluminium.
      rr += (0.065 - rr) * f;
      gg += (0.068 - gg) * f;
      bb += (0.075 - bb) * f;
      ro = lerp(ro, 0.4, f);
      me = lerp(me, 0.85, f);
      // Glass.
      rr += (0.022 - rr) * g;
      gg += (0.03 - gg) * g;
      bb += (0.04 - bb) * g;
      ro = lerp(ro, 0.08 + 0.1 * sstep(0.55, 0.8, dent.data[i]), g);
      me = lerp(me, 0, g);
      alb.data[i * 3] = rr;
      alb.data[i * 3 + 1] = gg;
      alb.data[i * 3 + 2] = bb;
      rough.data[i] = ro;
      metal.data[i] = me;
    }
  }
  const cav = cavityAO(height, { radiusPx: Math.round(0.08 * M.sx), strength: 2.2 });
  const ao = mix(cav, 1, glassM);
  return { albedo: alb, height, roughness: rough, metallic: metal, ao, emissive: emis };
}

export const recipes = [
  {
    id: "mat_facade_windows_lit",
    tileSizeM: [12, 7.2],
    size: [2048, 1024],
    seed: 1101,
    relief: { depthM: 0.25, strength: 1 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, emissiveColor: [1, 1, 1], emissiveIntensity: 2.5, envIntensity: 1.2 },
    note: "grimy concrete tower, 4 bays x 2 storeys, about half the windows lit (blinds, curtains, silhouettes, TVs)",
    build: (ctx) => windowTower(ctx, { seed: 11, tone: [0.25, 0.26, 0.28], lit: 4, faint: 0 }),
  },
  {
    id: "mat_facade_windows_dark",
    tileSizeM: [12, 7.2],
    size: [2048, 1024],
    seed: 1102,
    relief: { depthM: 0.25, strength: 1 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, emissiveColor: [1, 1, 1], emissiveIntensity: 2.5, envIntensity: 1.2 },
    note: "same grid as windows_lit, all dark except one standby glow and the odd LED; warmer, darker wall tone",
    build: (ctx) => windowTower(ctx, { seed: 23, tone: [0.23, 0.225, 0.215], lit: 0, faint: 1 }),
  },
  {
    id: "mat_facade_curtainwall",
    tileSizeM: [12, 7.2],
    size: [2048, 1024],
    seed: 1103,
    relief: { depthM: 0.12, strength: 1 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, emissiveColor: [1, 1, 1], emissiveIntensity: 2.2, envIntensity: 1.5 },
    note: "glass curtain wall: 1.5 m panes, spandrel band every 3.6 m, about 20% of the panes lit as offices",
    build: (ctx) => curtainWall(ctx),
  },
  {
    id: "mat_facade_shopfront",
    tileSizeM: [12, 4.8],
    size: [2048, 1024],
    seed: 1104,
    relief: { depthM: 0.25, strength: 1 },
    params: { baseColor: [1, 1, 1], metallic: 1, roughness: 1, emissiveColor: [1, 1, 1], emissiveIntensity: 2.5, envIntensity: 1.2 },
    note: "ground storey: fascia with LED strip, shop windows / door / roller shutter, bulkhead; concrete slab edge at the tile seam",
    build: (ctx) => shopfront(ctx),
  },
];
