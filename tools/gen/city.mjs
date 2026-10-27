// City layout: one GLB per 128 m chunk.
//
// Grid (chunk-local metres, see lib/modules.mjs): road corridors are centred on 0, 64 and 128
// along both axes. Each is 14 m of asphalt with a 3 m sidewalk on both sides. What is left
// between corridors is a 44 m block (50 m with its sidewalk ring) at x/z in [7,57] and [71,121].
// Blocks never straddle a chunk border, so chunks stream independently. Roads at the border are
// drawn as two halves, one per chunk.
//
// Everything is baked into a single flatten builder (static batching by material) and written
// with a sidecar JSON holding anchors (lights, spawns) and colliders for physics.
import fs from "node:fs";
import path from "node:path";
import { ModelBuilder } from "./lib/builder.mjs";
import { writeGlb } from "./lib/export.mjs";
import { pack } from "./lib/pack.mjs";
import { makeRng, hash } from "./lib/math.mjs";
import { CHUNK, PITCH, ROAD_W, SIDEWALK_W, CURB_H, BLOCK_W, FLOOR_H, SHOP_H, BAY_W } from "./lib/modules.mjs";
import * as signs from "./lib/signs.mjs";
import { spriteRect } from "./lib/atlas.mjs";
import { loadAssets } from "./registry.mjs";

const HALF_ROAD = ROAD_W / 2;
const BLOCK_SPAN = BLOCK_W + 2 * SIDEWALK_W; // 50: block including its sidewalk ring
const N = 0, E = Math.PI / 2, S = Math.PI, W = -Math.PI / 2; // compass headings: front (+Z) faces north / east / south / west

// Tunables
const STREETLIGHT_SPACING = 32;
const SMALL_PROP_SPACING = 11;
const PARKED_CAR_CHANCE = 0.14;
// Cars are the heaviest street items (~1500 tris each): optional furniture stops once a chunk reaches this.
const SOFT_CHUNK_TRIS = 44000;

// ---------------------------------------------------------------------------------------------
// Fallback building, used when no recipe matches (keeps the city buildable while recipes grow).
const fallbackBuilding = {
  id: "bld_fallback",
  lot: { w: [21, 42], d: [21, 42], floors: [3, 30] },
  build(b, r, { w, d, floors }) {
    const h = SHOP_H + (floors - 1) * FLOOR_H;
    b.ao = { y0: 0, y1: 8, lo: 0.55, hi: 1 };
    const lit = r.chance(0.6) ? "mat_facade_windows_lit" : "mat_facade_windows_dark";
    // shopfront storey, then window storeys whose floor lines sit at 4.8 + 3.6k (hence vOff)
    b.box("mat_facade_shopfront", [-w / 2, 0, -d / 2], [w / 2, SHOP_H, d / 2], { skip: ["b", "t"] });
    b.box(lit, [-w / 2, SHOP_H, -d / 2], [w / 2, h, d / 2], { skip: ["b"], mats: { t: "mat_roof_tar" }, vOff: -SHOP_H });
    b.box("mat_wall_concrete_dark", [-w / 2 - 0.3, h - 0.6, -d / 2 - 0.3], [w / 2 + 0.3, h + 0.5, d / 2 + 0.3], { skip: ["b"] });
    b.with({ pos: [0, SHOP_H + 0.6, d / 2 + 0.05] }, () => signs.wallSign(b, r, { w: Math.min(w * 0.6, 9), h: 1.2 }));
    b.collider({ c: [0, h / 2, 0], h: [w / 2, h / 2, d / 2] });
  },
};

// ---------------------------------------------------------------------------------------------

function zoneAt(wx, wz, r) {
  const d = Math.hypot(wx, wz) / PITCH; // distance from the downtown core, in blocks
  const u = r();
  if (d < 2.2) return u < 0.82 ? "downtown" : "mid";
  if (d < 3.6) return u < 0.35 ? "downtown" : u < 0.75 ? "mid" : "commercial";
  if (wz < -2.5 * PITCH && wx > -2 * PITCH) return u < 0.55 ? "industrial" : u < 0.8 ? "commercial" : "residential";
  return u < 0.15 ? "mid" : u < 0.45 ? "commercial" : "residential";
}

function pickFloors(r, range, zone) {
  const [lo, hi] = range;
  const t = zone === "downtown" ? Math.pow(r(), 0.6) : r();
  return Math.round(lo + t * (hi - lo));
}

/** Clip an axis-aligned rect to the chunk; null when nothing is left. */
function clip(x0, z0, x1, z1) {
  const a = Math.max(0, x0), b = Math.max(0, z0), c = Math.min(CHUNK, x1), d = Math.min(CHUNK, z1);
  return c - a > 1e-6 && d - b > 1e-6 ? [a, b, c, d] : null;
}

/**
 * Flat horizontal rect on the ground plane (faces up). `along: "z"` rotates the UVs so that u runs
 * along z (the long direction of lines on roads that run north-south); the texture work wants wear
 * on markings and curbs to run along u.
 */
function flatRect(b, mat, x0, z0, x1, z1, y, o = {}) {
  const r = clip(x0, z0, x1, z1);
  if (!r) return;
  const uv = o.along === "z" ? [[r[1], r[0]], [r[1], r[2]], [r[3], r[2]], [r[3], r[0]]] : o.uv;
  b.quad(mat, [r[0], y, r[1]], [r[2], y, r[1]], [r[2], y, r[3]], [r[0], y, r[3]], { ...o, uv });
}

/**
 * Atlas decal lying on the ground: `w` across, `len` along `heading`. The sprite is painted
 * with its top pointing in the heading direction (so a driver heading that way reads it upright).
 */
function decal(b, sprite, cx, cz, w, len, heading, y = 0.045) {
  const f = [Math.sin(heading), Math.cos(heading)], r = [Math.cos(heading), -Math.sin(heading)];
  const P = (a, l) => [cx + r[0] * a * w / 2 + f[0] * l * len / 2, y, cz + r[1] * a * w / 2 + f[1] * l * len / 2];
  const pts = [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)];
  if (pts.some((p) => p[0] < 0 || p[0] > CHUNK || p[2] < 0 || p[2] > CHUNK)) return; // keep decals whole inside the chunk
  b.quad("mat_atlas_decal", pts[0], pts[1], pts[2], pts[3], { uv: spriteRect("mat_atlas_decal", sprite) });
}

const corridorCentres = [0, PITCH, 2 * PITCH];
const blockRanges = [
  [HALF_ROAD, PITCH - HALF_ROAD],
  [PITCH + HALF_ROAD, 2 * PITCH - HALF_ROAD],
];

// ---------------------------------------------------------------------------------------------
// roads

function drawRoads(b, r) {
  // asphalt: x-corridors (running along x, constant z) fill only between the z-corridors' intersections
  for (const c of corridorCentres) {
    // along z at x = c: full length
    flatRect(b, "mat_road_asphalt_wet", c - HALF_ROAD, 0, c + HALF_ROAD, CHUNK, 0, { uv: "meters" });
  }
  for (const c of corridorCentres) {
    for (const [x0, x1] of blockRanges) {
      flatRect(b, "mat_road_asphalt_wet", x0, c - HALF_ROAD, x1, c + HALF_ROAD, 0, { uv: "meters" });
    }
  }
  // dry repair patches break up the wet sheen
  for (let i = 0; i < 6; i++) {
    const alongX = r.chance(0.5);
    const c = r.pick(corridorCentres);
    const u = r.range(10, CHUNK - 10);
    const off = r.range(-HALF_ROAD + 2, HALF_ROAD - 2);
    const [pw, pl] = [r.range(1.5, 3), r.range(2, 5)];
    if (alongX) flatRect(b, "mat_road_asphalt", u, c + off, u + pl, c + off + pw, 0.02);
    else flatRect(b, "mat_road_asphalt", c + off, u, c + off + pw, u + pl, 0.02);
  }

  // markings
  const Y = 0.035;
  const dash = (axis, c, lane, mat, w) => {
    // dashes along the corridor, only on the segments between intersections
    for (const [s0, s1] of blockRanges) {
      for (let p = s0 + 1.5; p + 3 <= s1 - 1.5; p += 9) {
        if (axis === "z") flatRect(b, mat, c + lane - w / 2, p, c + lane + w / 2, p + 3, Y, { along: "z" });
        else flatRect(b, mat, p, c + lane - w / 2, p + 3, c + lane + w / 2, Y);
      }
    }
  };
  const solid = (axis, c, lane, mat, w) => {
    for (const [s0, s1] of blockRanges) {
      if (axis === "z") flatRect(b, mat, c + lane - w / 2, s0 + 0.5, c + lane + w / 2, s1 - 0.5, Y, { along: "z" });
      else flatRect(b, mat, s0 + 0.5, c + lane - w / 2, s1 - 0.5, c + lane + w / 2, Y);
    }
  };
  for (const axis of ["x", "z"]) {
    for (const c of corridorCentres) {
      const avenue = c === 0 || c === 2 * PITCH; // chunk-border corridors are the avenues
      if (avenue) {
        solid(axis, c, -0.18, "mat_road_marking_yellow", 0.12);
        solid(axis, c, 0.18, "mat_road_marking_yellow", 0.12);
      } else {
        dash(axis, c, 0, "mat_road_marking_white", 0.15);
      }
      for (const lane of [-3.5, 3.5]) dash(axis, c, lane, "mat_road_marking_white", 0.15);
      for (const edge of [-HALF_ROAD + 0.35, HALF_ROAD - 0.35]) solid(axis, c, edge, "mat_road_marking_white", 0.12);
    }
  }
  // crosswalks on all four approaches of every intersection
  for (const cx of corridorCentres) {
    for (const cz of corridorCentres) {
      for (const dir of [-1, 1]) {
        // approach along x (crosswalk spans z)
        const x0 = dir < 0 ? cx - HALF_ROAD - 4.5 : cx + HALF_ROAD + 1.5;
        for (let i = 0; i < 12; i++) {
          const z0 = cz - HALF_ROAD + 0.9 + i * 1.1;
          flatRect(b, "mat_road_crosswalk", x0, z0, x0 + 3, z0 + 0.55, Y);
        }
        // approach along z (crosswalk spans x)
        const z0 = dir < 0 ? cz - HALF_ROAD - 4.5 : cz + HALF_ROAD + 1.5;
        for (let i = 0; i < 12; i++) {
          const x0b = cx - HALF_ROAD + 0.9 + i * 1.1;
          flatRect(b, "mat_road_crosswalk", x0b, z0, x0b + 0.55, z0 + 3, Y, { along: "z" });
        }
      }
    }
  }
  // stop lines, lane arrows, oil stains, manholes
  for (const axis of ["x", "z"]) {
    for (const c of corridorCentres) {
      for (const [s0, s1] of blockRanges) {
        // traffic keeps right: along x, eastbound uses the south half (z < c); along z, northbound uses the east half (x > c)
        const flows = axis === "x"
          ? [{ h: E, lat: [-1.75, -5.25], end: s1, dir: 1 }, { h: W, lat: [1.75, 5.25], end: s0, dir: -1 }]
          : [{ h: N, lat: [1.75, 5.25], end: s1, dir: 1 }, { h: S, lat: [-1.75, -5.25], end: s0, dir: -1 }];
        for (const fl of flows) {
          const stop = fl.end - fl.dir * 5.8; // stop line sits just before the crosswalk
          const [lo, hi] = [Math.min(...fl.lat) - 1.75, Math.max(...fl.lat) + 1.75];
          if (axis === "x") flatRect(b, "mat_road_marking_white", Math.min(stop, stop + fl.dir * 0.4), c + lo, Math.max(stop, stop + fl.dir * 0.4), c + hi, Y);
          else flatRect(b, "mat_road_marking_white", c + lo, Math.min(stop, stop + fl.dir * 0.4), c + hi, Math.max(stop, stop + fl.dir * 0.4), Y, { along: "z" });
          const at = fl.end - fl.dir * 12;
          fl.lat.forEach((lat, i) => {
            const sprite = i === 0 ? r.pick(["arrow_left", "arrow_left_straight"]) : r.pick(["arrow_straight", "arrow_straight", "arrow_right"]);
            const [x, z] = axis === "x" ? [at, c + lat] : [c + lat, at];
            decal(b, sprite, x, z, 1.3, 3.9, fl.h);
          });
        }
      }
    }
  }
  for (let i = 0; i < 6; i++) {
    const alongX = r.chance(0.5);
    const c = r.pick(corridorCentres);
    const u = r.range(14, CHUNK - 14);
    const v = c + r.range(-5, 5);
    const [x, z] = alongX ? [u, v] : [v, u];
    if (corridorCentres.some((cc) => Math.abs((alongX ? u : v) - cc) < HALF_ROAD + 1)) continue; // not inside an intersection
    const sprite = r.pick(["manhole_cover", "manhole_cover", "stain_oil", "drain_grate"]);
    decal(b, sprite, x, z, sprite === "stain_oil" ? 2.6 : 1.1, sprite === "stain_oil" ? 2.6 : 1.1, r.range(0, Math.PI * 2), 0.04);
  }
}

// ---------------------------------------------------------------------------------------------
// blocks: raised sidewalk slab with curbs

function drawBlockSlabs(b) {
  for (const [x0, x1] of blockRanges) {
    for (const [z0, z1] of blockRanges) {
      // curb faces: u along the curb, v = 0 at the top edge growing downward (see docs/materials.md)
      b.box("mat_ground_sidewalk_tiles", [x0, 0, z0], [x1, CURB_H, z1], { mats: { s: "mat_ground_curb", e: "mat_ground_curb", n: "mat_ground_curb", w: "mat_ground_curb" }, vOff: -CURB_H });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// lots

/**
 * Lots and alleys for a block. Lots: {cx, cz, ex, ez, facings}: centre and extents in chunk-local
 * metres plus the headings its front may face (sides that touch a sidewalk). Alleys: {axis, c, mid}.
 */
function subdivide(bx0, bz0, r) {
  const cx = bx0 + BLOCK_SPAN / 2, cz = bz0 + BLOCK_SPAN / 2;
  const kind = r();
  if (kind < 0.3) return { lots: [{ cx, cz, ex: 42, ez: 42, facings: [N, E, S, W] }], alleys: [] };
  if (kind < 0.55) {
    return {
      lots: [
        { cx: cx - 11.5, cz, ex: 21, ez: 42, facings: [W, N, S] },
        { cx: cx + 11.5, cz, ex: 21, ez: 42, facings: [E, N, S] },
      ],
      alleys: [{ axis: "z", c: cx, mid: cz }],
    };
  }
  if (kind < 0.7) {
    return {
      lots: [
        { cx, cz: cz - 11.5, ex: 42, ez: 21, facings: [S, E, W] },
        { cx, cz: cz + 11.5, ex: 42, ez: 21, facings: [N, E, W] },
      ],
      alleys: [{ axis: "x", c: cz, mid: cx }],
    };
  }
  return {
    lots: [
      { cx: cx - 11.5, cz: cz - 11.5, ex: 21, ez: 21, facings: [S, W] },
      { cx: cx + 11.5, cz: cz - 11.5, ex: 21, ez: 21, facings: [S, E] },
      { cx: cx - 11.5, cz: cz + 11.5, ex: 21, ez: 21, facings: [N, W] },
      { cx: cx + 11.5, cz: cz + 11.5, ex: 21, ez: 21, facings: [N, E] },
    ],
    alleys: [{ axis: "z", c: cx, mid: cz }, { axis: "x", c: cz, mid: cx }],
  };
}

function placeBuilding(b, ctx, lot, wx, wz, rng) {
  const zone = zoneAt(wx, wz, rng);
  const candidates = [];
  for (const a of ctx.buildings) {
    if (!a.tags.includes(`zone:${zone}`)) continue;
    for (const f of lot.facings) {
      const frontOnX = f === N || f === S;
      const w = frontOnX ? lot.ex : lot.ez, d = frontOnX ? lot.ez : lot.ex; // lot extents along the building's local x / z
      if (w >= a.lot.w[0] && d >= a.lot.d[0]) candidates.push({ a, heading: f, lotW: w, lotD: d });
    }
  }
  const pick = candidates.length ? rng.pick(candidates) : null;
  const asset = pick?.a ?? fallbackBuilding;
  const heading = pick?.heading ?? rng.pick(lot.facings);
  const frontOnX = heading === N || heading === S;
  const lotW = pick?.lotW ?? (frontOnX ? lot.ex : lot.ez), lotD = pick?.lotD ?? (frontOnX ? lot.ez : lot.ex);
  let w = snap3(Math.min(lotW, asset.lot.w[1])), d = snap3(Math.min(lotD, asset.lot.d[1]));
  // now and then use a smaller footprint than the lot, for variety
  if (rng.chance(0.2) && w - BAY_W >= asset.lot.w[0]) w -= BAY_W;
  const floors = pickFloors(rng, asset.lot.floors, zone);
  // shallow buildings sit at the front of a deep lot
  const shift = (lotD - d) / 2;
  const pos = [lot.cx + Math.sin(heading) * shift, CURB_H, lot.cz + Math.cos(heading) * shift];
  ctx.counts[asset.id] = (ctx.counts[asset.id] ?? 0) + 1;
  b.place(asset, { pos, rotY: heading }, rng.fork(1), { w, d, floors });
  return { zone, id: asset.id, floors, heading, w, d };
}

const snap3 = (v) => Math.floor(v / BAY_W + 1e-6) * BAY_W;

function placePlaza(b, ctx, lot, rng) {
  const props = ctx.byTag("plaza");
  if (!props.length) return;
  const n = rng.int(3, 6);
  for (let i = 0; i < n; i++) {
    const a = rng.pick(props);
    const x = lot.cx + rng.range(-lot.ex / 2 + 3, lot.ex / 2 - 3), z = lot.cz + rng.range(-lot.ez / 2 + 3, lot.ez / 2 - 3);
    b.place(a, { pos: [x, CURB_H, z], rotY: rng.pick([N, E, S, W]) }, rng.fork(i));
  }
}

function placeParkingLot(b, ctx, lot, rng) {
  const cars = ctx.byTag("vehicle_parkable");
  if (!cars.length) return;
  b.box("mat_road_asphalt", [lot.cx - lot.ex / 2, CURB_H, lot.cz - lot.ez / 2], [lot.cx + lot.ex / 2, CURB_H + 0.01, lot.cz + lot.ez / 2], { skip: ["b", "s", "e", "n", "w"] });
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      if (rng.chance(0.62) || b.triCount() > SOFT_CHUNK_TRIS) continue;
      const x = lot.cx - lot.ex / 2 + 3.5 + col * 3.6, z = lot.cz - lot.ez / 2 + 5 + row * 7.5;
      if (x > lot.cx + lot.ex / 2 - 2 || z > lot.cz + lot.ez / 2 - 3) continue;
      b.place(rng.pick(cars), { pos: [x, CURB_H, z], rotY: rng.chance(0.5) ? N : S }, rng.fork(row * 10 + col), { color: rng.pick(CAR_COLOURS) });
    }
  }
}

const CAR_COLOURS = ["#c0302a", "#2a5fc0", "#e8e8ea", "#17181c", "#6d7178", "#d9a521", "#2d8a6a", "#7a3fb8"];

// ---------------------------------------------------------------------------------------------
// street furniture along the sidewalk ring of each block

/** The four sides of a block as {along: [x0,z0]->[x1,z1] direction, facing toward the road, origin on the curb line}. */
function blockSides(bx0, bz0) {
  const x0 = bx0, x1 = bx0 + BLOCK_SPAN, z0 = bz0, z1 = bz0 + BLOCK_SPAN;
  return [
    { name: "S", a: [x0, z0], dir: [1, 0], inward: [0, 1], heading: S, len: BLOCK_SPAN },
    { name: "N", a: [x0, z1], dir: [1, 0], inward: [0, -1], heading: N, len: BLOCK_SPAN },
    { name: "W", a: [x0, z0], dir: [0, 1], inward: [1, 0], heading: W, len: BLOCK_SPAN },
    { name: "E", a: [x1, z0], dir: [0, 1], inward: [-1, 0], heading: E, len: BLOCK_SPAN },
  ];
}

function sidewalkPos(side, t, off) {
  // t metres along the side from its start, off metres inward from the curb line
  return [side.a[0] + side.dir[0] * t + side.inward[0] * off, side.a[1] + side.dir[1] * t + side.inward[1] * off];
}

function inChunk(x, z, m = 0.5) {
  return x > m && x < CHUNK - m && z > m && z < CHUNK - m;
}

function furnishBlock(b, ctx, bx0, bz0, rng) {
  const lights = ctx.byTag("streetlight");
  const small = ctx.byTag("sidewalk_small");
  const poles = ctx.byTag("street_pole");
  const barriers = ctx.byTag("barrier");
  const signals = ctx.byTag("trafficlight");
  const cars = ctx.byTag("vehicle_parkable");
  for (const side of blockSides(bx0, bz0)) {
    // street lights, alternating with utility poles now and then
    if (lights.length) {
      for (let t = 12; t < side.len - 8; t += STREETLIGHT_SPACING) {
        const [x, z] = sidewalkPos(side, t + rng.range(-1, 1), 0.7);
        if (!inChunk(x, z)) continue;
        const a = rng.chance(0.12) && poles.length ? rng.pick(poles) : rng.pick(lights);
        b.place(a, { pos: [x, CURB_H, z], rotY: side.heading }, rng.fork(Math.floor(t)));
      }
    }
    // small props
    if (small.length) {
      for (let t = 8; t < side.len - 6; t += SMALL_PROP_SPACING * rng.range(0.8, 1.6)) {
        if (rng.chance(0.4)) continue;
        const [x, z] = sidewalkPos(side, t, rng.range(1.0, 2.0));
        if (!inChunk(x, z)) continue;
        b.place(rng.pick(small), { pos: [x, CURB_H, z], rotY: side.heading + rng.range(-0.15, 0.15) }, rng.fork(Math.floor(t * 7)));
      }
    }
    // construction barriers now and then
    if (barriers.length && rng.chance(0.18)) {
      const t = rng.range(10, side.len - 10);
      const [x, z] = sidewalkPos(side, t, 0.4);
      if (inChunk(x, z)) b.place(rng.pick(barriers), { pos: [x, CURB_H, z], rotY: side.heading }, rng.fork(77));
    }
    // parked cars in the kerb lane (right-hand traffic: cars face the direction of travel in their lane)
    if (cars.length) {
      const faceHeading = side.name === "N" ? E : side.name === "S" ? W : side.name === "E" ? S : N;
      for (let t = 12; t < side.len - 10; t += 7) {
        if (!rng.chance(PARKED_CAR_CHANCE) || b.triCount() > SOFT_CHUNK_TRIS) continue;
        const [x, z] = sidewalkPos(side, t + rng.range(-0.5, 0.5), -1.55);
        if (!inChunk(x, z, 1)) continue;
        b.place(rng.pick(cars), { pos: [x, 0, z], rotY: faceHeading + rng.range(-0.04, 0.04) }, rng.fork(Math.floor(t * 3)), { color: rng.pick(CAR_COLOURS) });
      }
    }
  }
  // traffic lights on the four block corners
  if (signals.length) {
    const corners = [
      // pinwheel: each corner's mast arm reaches over a different road
      { p: [bx0 + 0.9, bz0 + 0.9], h: S },
      { p: [bx0 + BLOCK_SPAN - 0.9, bz0 + 0.9], h: E },
      { p: [bx0 + BLOCK_SPAN - 0.9, bz0 + BLOCK_SPAN - 0.9], h: N },
      { p: [bx0 + 0.9, bz0 + BLOCK_SPAN - 0.9], h: W },
    ];
    corners.forEach((c, i) => {
      if (inChunk(c.p[0], c.p[1])) b.place(rng.pick(signals), { pos: [c.p[0], CURB_H, c.p[1]], rotY: c.h }, rng.fork(900 + i));
    });
  }
}

/** Alley clutter between lots. */
function furnishAlleys(b, ctx, alleys, rng) {
  const props = ctx.byTag("alley");
  if (!props.length) return;
  for (const al of alleys) {
    const n = rng.int(2, 4);
    for (let i = 0; i < n; i++) {
      const t = al.mid + rng.range(-17, 17);
      const off = rng.range(-0.4, 0.4);
      const [x, z] = al.axis === "z" ? [al.c + off, t] : [t, al.c + off];
      b.place(rng.pick(props), { pos: [x, CURB_H, z], rotY: (al.axis === "z" ? rng.pick([E, W]) : rng.pick([N, S])) }, rng.fork(500 + i));
    }
  }
}

// ---------------------------------------------------------------------------------------------

export async function buildChunk(cx, cz, ctx) {
  const b = new ModelBuilder({ flatten: true });
  const rng = makeRng(hash(cx, cz, "chunk"));
  const wx0 = cx * CHUNK, wz0 = cz * CHUNK;
  const lotsInfo = [];

  const tally = {};
  const mark = (name, fn) => {
    const before = b.triCount();
    fn();
    tally[name] = (tally[name] ?? 0) + b.triCount() - before;
  };

  mark("roads", () => drawRoads(b, rng.fork(1)));
  mark("slabs", () => drawBlockSlabs(b));

  let bi = 0;
  for (const [x0] of blockRanges) {
    for (const [z0] of blockRanges) {
      const brng = makeRng(hash(cx, cz, bi++, "block"));
      const { lots, alleys } = subdivide(x0, z0, brng);
      for (const lot of lots) {
        const lrng = brng.fork(hash(lot.cx | 0, lot.cz | 0));
        const roll = lrng();
        const wx = wx0 + lot.cx, wz = wz0 + lot.cz;
        const dist = Math.hypot(wx, wz) / PITCH;
        if (roll < 0.07 && dist > 1.5) {
          mark("plaza", () => placePlaza(b, ctx, lot, lrng));
          lotsInfo.push({ cx: lot.cx, cz: lot.cz, kind: "plaza" });
        } else if (roll < 0.12 && dist > 2) {
          mark("parking", () => placeParkingLot(b, ctx, lot, lrng));
          lotsInfo.push({ cx: lot.cx, cz: lot.cz, kind: "parking" });
        } else {
          let info;
          mark("buildings", () => { info = placeBuilding(b, ctx, lot, wx, wz, lrng); });
          lotsInfo.push({ cx: lot.cx, cz: lot.cz, kind: "building", ...info });
        }
      }
      mark("alleys", () => furnishAlleys(b, ctx, alleys, brng.fork(5)));
      mark("furniture", () => furnishBlock(b, ctx, x0, z0, brng.fork(6)));
    }
  }
  return { b, lotsInfo, tally };
}

export async function genChunks({ root, rawDir, radius = 2, pack: doPack = true, ifMissing = false }) {
  const outDir = path.join(root, "public/chunks");
  if (ifMissing && fs.existsSync(path.join(outDir, "0_0.glb"))) return;
  fs.mkdirSync(outDir, { recursive: true });
  const assets = await loadAssets();
  const buildings = assets.filter((a) => a.category === "building" && a.lot && a.tags?.some((t) => t.startsWith("zone:")));
  for (const a of buildings) a.tags = a.tags ?? [];
  const ctx = {
    buildings,
    byTag: (tag) => assets.filter((a) => a.tags?.includes(tag)),
    counts: {},
  };
  console.log(`city: ${buildings.length} building recipes, ${assets.length} assets total`);
  let total = 0, worst = 0;
  const t0 = Date.now();
  for (let cx = -radius; cx <= radius; cx++) {
    for (let cz = -radius; cz <= radius; cz++) {
      const { b, lotsInfo, tally } = await buildChunk(cx, cz, ctx);
      const key = `${cx}_${cz}`;
      const raw = path.join(rawDir, `chunk_${key}.glb`);
      const stats = await writeGlb(b, raw, { name: `chunk_${key}`, extras: { chunk: [cx, cz] } });
      const out = path.join(outDir, `${key}.glb`);
      if (doPack) await pack(raw, out, { positionBits: 14 });
      else fs.copyFileSync(raw, out);
      const sidecar = {
        chunk: [cx, cz],
        size: CHUNK,
        tris: stats.tris,
        anchors: b.anchors.map((a) => ({ ...a, pos: a.pos.map((v) => Math.round(v * 100) / 100) })),
        colliders: b.colliders.map((c) => ({ ...c, c: c.c.map((v) => Math.round(v * 100) / 100), h: c.h.map((v) => Math.round(v * 100) / 100) })),
        lots: lotsInfo,
        // road network for traffic and navigation: corridor centre lines in chunk-local metres, with lane offsets
        roads: {
          width: ROAD_W,
          sidewalk: SIDEWALK_W,
          laneOffsets: [-5.25, -1.75, 1.75, 5.25],
          alongX: corridorCentres.map((c) => ({ z: c, x0: 0, x1: CHUNK })),
          alongZ: corridorCentres.map((c) => ({ x: c, z0: 0, z1: CHUNK })),
        },
        spawns: cx === 0 && cz === 0 ? [{ type: "player", pos: [72.5, CURB_H, 36], rotY: 0 }] : [],
      };
      fs.writeFileSync(path.join(outDir, `${key}.json`), JSON.stringify(sidecar));
      total += stats.tris;
      worst = Math.max(worst, stats.tris);
      const kb = (fs.statSync(out).size / 1024).toFixed(0);
      console.log(`chunk ${key.padEnd(6)} ${String(stats.tris).padStart(6)} tris  ${String(kb).padStart(5)} KB  ${b.colliders.length} colliders  ${b.anchors.length} anchors`);
      if (process.env.CITY_TALLY) console.log("       " + Object.entries(tally).map(([k, v]) => `${k} ${v}`).join("  "));
    }
  }
  console.log(`city: ${total} tris total, worst chunk ${worst}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  if (worst > 60000) {
    console.error(`a chunk is over the 60k triangle budget (${worst})`);
    process.exitCode = 1;
  }
}
