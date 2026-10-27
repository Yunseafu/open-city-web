import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { SpotLight } from "@babylonjs/core/Lights/spotLight";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { Constants } from "@babylonjs/core/Engines/constants";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { Plane } from "@babylonjs/core/Maths/math.plane";
import { MirrorTexture } from "@babylonjs/core/Materials/Textures/mirrorTexture";
import type { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import type { CubeTexture } from "@babylonjs/core/Materials/Textures/cubeTexture";
import { SSRRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssrRenderingPipeline";
import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";

import { MaterialLibrary } from "../materials/MaterialLibrary";
import { configureDecoders } from "../materials/decoders";
import { createCyberEnvironment, CyberPostFx } from "../materials/CyberEnvironment";
import { getSpriteRect, loadAtlasLayout, remapUV } from "../materials/atlas";
import type { SpriteRect } from "../materials/atlas";
import type { AtlasLayout } from "../materials/manifest";
import { TIERS } from "../util/Quality";

/**
 * Hand-built night street (14 m road, 3 m sidewalks, 26 m facades) that uses the material library
 * exactly the way GLB chunks will: UV0 in metres, v = -y on walls, u = x / v = -z on floors,
 * atlas sprites with their rect baked into UV0. All merged per material like `gltfpack -mm` does.
 *
 * Query: shot=down|road|facade|sign|aerial|billboard  camera preset | cam=x,y,z,tx,ty,tz  free camera
 *        tier=high|medium|low | mirror=0|1 planar mirror on the wet road (default: on for the high tier)
 *        tm=none|neutral|standard|aces  tone mapping | neon=<n>  emissive intensity of mat_neon_* | exp=<n> exposure
 *        bloom=0|1 | fog=<density> | base=/textures
 *        size=<px> blur=<kernel> mlevel=<n> mirror texture | ssr=1 screen-space reflections instead (ssrs=<strength> ssrt=<reflectivity threshold> ssrsteps=<n>)
 *        wr=<roughness> wn=<normal level> wior wenv whor=0 wocc=0  wet-lane material experiments
 */
configureDecoders();

const params = new URLSearchParams(location.search);
const canvas = document.getElementById("game") as HTMLCanvasElement;
const msg = document.getElementById("msg") as HTMLDivElement;

const engine = new Engine(canvas, false, { powerPreference: "high-performance", preserveDrawingBuffer: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(0.012, 0.008, 0.03, 1);
createCyberEnvironment(scene, 1.0);

const tier = TIERS.find((t) => t.name === params.get("tier")) ?? TIERS[0];
// Materials stay unfrozen: post effects (SSR needs the geometry buffer) change shader defines after load.
const library = new MaterialLibrary(scene, params.get("base") ?? "/textures", false);
library.applyTier(tier);
await library.load();

const toneName = params.get("tm") ?? "neutral";
const ip = scene.imageProcessingConfiguration;
if (toneName === "none") {
  ip.toneMappingEnabled = false;
} else {
  ip.toneMappingEnabled = true;
  ip.toneMappingType = {
    neutral: ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL,
    standard: ImageProcessingConfiguration.TONEMAPPING_STANDARD,
    aces: ImageProcessingConfiguration.TONEMAPPING_ACES,
  }[toneName] ?? ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL;
}
if (params.get("exp")) ip.exposure = Number(params.get("exp"));

scene.fogMode = Scene.FOGMODE_EXP2;
scene.fogDensity = Number(params.get("fog") ?? 0.011);
scene.fogColor = new Color3(0.035, 0.02, 0.07);

// ---------------------------------------------------------------------------------------------
// Materials

const neonScale = params.get("neon") ? Number(params.get("neon")) : null;
const missing = new Set<string>();

/** Library material for `id`, or null (reported once). Up to 10 lights may shade a surface here. */
function M(id: string): PBRMaterial | null {
  const mat = library.tryGet(id);
  if (!mat) {
    if (!missing.has(id)) console.info(`[street] material ${id} not in the manifest, skipping its geometry`);
    missing.add(id);
    return null;
  }
  mat.maxSimultaneousLights = 10;
  if (neonScale !== null && id.startsWith("mat_neon_")) mat.emissiveIntensity = neonScale;
  return mat;
}

// ---------------------------------------------------------------------------------------------
// Geometry: quads merged per material. Corners p[0..3] go round the face; the winding is chosen so
// the face looks along `want`, so callers never think about handedness.

type V3 = [number, number, number];
type V2 = [number, number];

class Merged {
  pos: number[] = [];
  uv: number[] = [];
  nrm: number[] = [];
  col: number[] = [];
  idx: number[] = [];

  quad(p: [V3, V3, V3, V3], uv: [V2, V2, V2, V2], want: V3, color: V3 = [1, 1, 1], colors?: [V3, V3, V3, V3]): void {
    const base = this.pos.length / 3;
    const flat = p.flat();
    let order = [0, 1, 2, 0, 2, 3];
    const probe: number[] = [];
    VertexData.ComputeNormals(flat, order, probe);
    if (probe[0] * want[0] + probe[1] * want[1] + probe[2] * want[2] < 0) order = [0, 2, 1, 0, 3, 2];
    this.pos.push(...flat);
    for (let i = 0; i < 4; i++) {
      this.uv.push(...uv[i]);
      this.nrm.push(...want);
      this.col.push(...(colors ? colors[i] : color), 1);
    }
    this.idx.push(...order.map((i) => base + i));
  }

  build(name: string, material: PBRMaterial): Mesh {
    const mesh = new Mesh(name, scene);
    const data = new VertexData();
    data.positions = this.pos;
    data.indices = this.idx;
    data.uvs = this.uv;
    data.normals = this.nrm;
    data.colors = this.col;
    data.applyToMesh(mesh);
    mesh.material = material;
    mesh.freezeWorldMatrix();
    return mesh;
  }
}

const merged = new Map<string, Merged>();
function A(id: string): Merged | null {
  if (!M(id)) return null;
  let m = merged.get(id);
  if (!m) merged.set(id, (m = new Merged()));
  return m;
}

// UV0 in metres for a point on a face with outward normal `dir`: u grows to the right of a viewer
// outside the face, v grows downward (v = -y); horizontal faces use u = x, v = -z. (docs/models.md)
function uvMetres(dir: "+x" | "-x" | "+z" | "-z" | "+y", p: V3, vOff = 0): V2 {
  switch (dir) {
    case "+x": return [p[2], vOff - p[1]];
    case "-x": return [-p[2], vOff - p[1]];
    case "+z": return [-p[0], vOff - p[1]];
    case "-z": return [p[0], vOff - p[1]];
    default: return [p[0], -p[2]];
  }
}
const NORMALS: Record<string, V3> = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+z": [0, 0, 1], "-z": [0, 0, -1], "+y": [0, 1, 0] };

/** Vertical rectangle in a plane of constant x or z. a..b is the horizontal extent in world z (x faces) or x (z faces). */
function wall(id: string, dir: "+x" | "-x" | "+z" | "-z", at: number, a: number, b: number, y0: number, y1: number, vOff = 0, color?: V3, bottomColor?: V3): void {
  const m = A(id);
  if (!m) return;
  const pt = (h: number, y: number): V3 => (dir === "+x" || dir === "-x" ? [at, y, h] : [h, y, at]);
  const p: [V3, V3, V3, V3] = [pt(a, y0), pt(b, y0), pt(b, y1), pt(a, y1)];
  const uv = p.map((q) => uvMetres(dir, q, vOff)) as [V2, V2, V2, V2];
  const colors = bottomColor ? ([bottomColor, bottomColor, color ?? [1, 1, 1], color ?? [1, 1, 1]] as [V3, V3, V3, V3]) : undefined;
  m.quad(p, uv, NORMALS[dir], color, colors);
}

/** Horizontal rectangle facing up at height y. */
function floor(id: string, x0: number, x1: number, z0: number, z1: number, y: number, uvOverride?: (p: V3) => V2): void {
  const m = A(id);
  if (!m) return;
  const p: [V3, V3, V3, V3] = [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]];
  m.quad(p, p.map((q) => (uvOverride ? uvOverride(q) : uvMetres("+y", q))) as [V2, V2, V2, V2], NORMALS["+y"]);
}

/** Axis-aligned box: sides use `side`, the top `top`. UVs in metres on every face. Optional vertex tint. */
function box(side: string, top: string | null, cx: number, y0: number, cz: number, sx: number, sy: number, sz: number, color?: V3): void {
  const x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, y1 = y0 + sy;
  wall(side, "-z", z0, x0, x1, y0, y1, 0, color);
  wall(side, "+z", z1, x0, x1, y0, y1, 0, color);
  wall(side, "-x", x0, z0, z1, y0, y1, 0, color);
  wall(side, "+x", x1, z0, z1, y0, y1, 0, color);
  floor(top ?? side, x0, x1, z0, z1, y1);
}

/** Atlas sprite quad: origin is the bottom-left corner seen by the viewer, `right`/`up` unit vectors, w x h metres. */
function sprite(id: string, layout: AtlasLayout | null, name: string, origin: V3, right: V3, up: V3, w: number, h: number): void {
  const m = A(id);
  if (!m || !layout) return;
  let rect: SpriteRect;
  try {
    rect = getSpriteRect(layout, name);
  } catch {
    const first = Object.keys(layout.sprites)[0];
    console.info(`[street] sprite '${name}' missing in ${id}, using '${first}'`);
    rect = getSpriteRect(layout, first);
  }
  const at = (r: number, u: number): V3 => [origin[0] + right[0] * r * w + up[0] * u * h, origin[1] + right[1] * r * w + up[1] * u * h, origin[2] + right[2] * r * w + up[2] * u * h];
  const toward: V3 = [right[1] * up[2] - right[2] * up[1], right[2] * up[0] - right[0] * up[2], right[0] * up[1] - right[1] * up[0]];
  // Quad faces the viewer; its normal is -(right x up) in Babylon's left-handed space.
  const want: V3 = [-toward[0], -toward[1], -toward[2]];
  m.quad(
    [at(0, 0), at(1, 0), at(1, 1), at(0, 1)],
    [remapUV(0, 1, rect), remapUV(1, 1, rect), remapUV(1, 0, rect), remapUV(0, 0, rect)],
    want,
  );
}

// ---------------------------------------------------------------------------------------------
// The street

const Z0 = -18;
const Z1 = 66;
const ROAD = 7; // half width
const CURB_H = 0.15;
const CURB_W = 0.2;
const SIDE = 10; // building line

// Layouts live next to the textures; the manifest entry names the layout file.
const layoutFor = (id: string): Promise<AtlasLayout | null> => {
  const name = library.def(id)?.atlas;
  if (!name) return Promise.resolve(null);
  return loadAtlasLayout(name, params.get("base") ?? "/textures").catch((err) => {
    console.info(`[street] no atlas layout for ${id}: ${String(err)}`);
    return null;
  });
};
const signs = await layoutFor("mat_atlas_signs");
const billboards = await layoutFor("mat_atlas_billboard");
if (!billboards) console.info("[street] no billboard atlas yet, the billboard falls back to a large sign sprite");

// Road: wet middle lanes, dry shoulders.
floor("mat_road_asphalt_wet", -5.25, 5.25, Z0, Z1, 0);
floor("mat_road_asphalt", -ROAD, -5.25, Z0, Z1, 0);
floor("mat_road_asphalt", 5.25, ROAD, Z0, Z1, 0);

// Paint, 3 mm above the asphalt (the materials carry a depth bias too). U runs along the stripe.
const along = (p: V3): V2 => [p[2], p[0]];
const PAINT_Y = 0.004;
for (let z = Z0; z < Z1; z += 9) {
  if (z > 24 && z < 36) continue; // crosswalk zone
  floor("mat_road_marking_yellow", -0.08, 0.08, z, Math.min(z + 3, Z1), PAINT_Y, along);
}
floor("mat_road_marking_white", -6.35, -6.2, Z0, Z1, PAINT_Y, along);
floor("mat_road_marking_white", 6.2, 6.35, Z0, Z1, PAINT_Y, along);
floor("mat_road_marking_white", -6.2, 6.2, 28.6, 28.9, PAINT_Y, (p) => [p[0], p[2]]); // stop line across the lanes
for (let x = -6.5; x <= 6.5; x += 1) floor("mat_road_crosswalk", x - 0.25, x + 0.25, 30, 34, PAINT_Y, along);

// Curbs: face looks at the road, U along the curb, V = 0 at the top edge growing downward (tile [2, 0.5]).
for (const s of [-1, 1] as const) {
  const m = A("mat_ground_curb");
  if (m) {
    const xr = s * ROAD;
    const face: [V3, V3, V3, V3] = [[xr, 0, Z0], [xr, 0, Z1], [xr, CURB_H, Z1], [xr, CURB_H, Z0]];
    m.quad(face, face.map((p) => [p[2], CURB_H - p[1]]) as [V2, V2, V2, V2], [-s, 0, 0]);
    const xo = s * (ROAD + CURB_W);
    const top: [V3, V3, V3, V3] = [[xr, CURB_H, Z0], [xo, CURB_H, Z0], [xo, CURB_H, Z1], [xr, CURB_H, Z1]];
    m.quad(top, top.map((p) => [p[2], -Math.abs(p[0] - xr)]) as [V2, V2, V2, V2], [0, 1, 0]);
  }
  floor("mat_ground_sidewalk_tiles", Math.min(s * (ROAD + CURB_W), s * SIDE), Math.max(s * (ROAD + CURB_W), s * SIDE), Z0, Z1, CURB_H);
}

// Facades. Bays start at u multiples of 3 (lot bounds are multiples of 3), the 4.8 m shop storey uses v = -y,
// storeys above use v = 4.8 - y so slab lines land on 4.8 + 3.6 k.
interface Lot { z0: number; z1: number; h: number; mat: string }
const west: Lot[] = [
  { z0: -18, z1: 3, h: 26.4, mat: "mat_facade_windows_lit" },
  { z0: 3, z1: 24, h: 26.4, mat: "mat_facade_curtainwall" },
  { z0: 24, z1: 45, h: 12, mat: "mat_facade_windows_dark" },
  { z0: 45, z1: 66, h: 26.4, mat: "mat_facade_windows_lit" },
];
const east: Lot[] = [
  { z0: -18, z1: 3, h: 22.8, mat: "mat_facade_windows_dark" },
  { z0: 3, z1: 24, h: 26.4, mat: "mat_facade_windows_lit" },
  { z0: 24, z1: 45, h: 22.8, mat: "mat_facade_curtainwall" },
  { z0: 45, z1: 66, h: 26.4, mat: "mat_facade_windows_dark" },
];
const DEPTH = 20;
for (const [lots, s] of [[west, -1], [east, 1]] as const) {
  const dir = s < 0 ? "+x" : "-x";
  const ground: V3 = [0.62, 0.6, 0.66]; // baked-AO style contact darkening at the base
  lots.forEach((lot, i) => {
    wall("mat_facade_shopfront", dir, s * SIDE, lot.z0, lot.z1, CURB_H, 4.8 + CURB_H, CURB_H, [1, 1, 1], ground);
    wall(lot.mat, dir, s * SIDE, lot.z0, lot.z1, 4.8 + CURB_H, lot.h + CURB_H, 4.8 + CURB_H);
    // Exposed side walls above lower neighbours: brick, with u = x.
    const prev = lots[i - 1];
    const next = lots[i + 1];
    const x0 = Math.min(s * SIDE, s * (SIDE + DEPTH));
    const x1 = Math.max(s * SIDE, s * (SIDE + DEPTH));
    if (prev && lot.h > prev.h) wall("mat_wall_brick_dirty", "-z", lot.z0, x0, x1, prev.h + CURB_H, lot.h + CURB_H);
    if (next && lot.h > next.h) wall("mat_wall_brick_dirty", "+z", lot.z1, x0, x1, next.h + CURB_H, lot.h + CURB_H);
    if (lot.h <= 12) floor("mat_roof_tar", x0, x1, lot.z0, lot.z1, lot.h + CURB_H);
  });
}
// Dead end: brick wall closing the street, with the billboard on it.
wall("mat_wall_brick_dirty", "-z", Z1, -SIDE, SIDE, CURB_H, 26.4 + CURB_H);

// ---------------------------------------------------------------------------------------------
// Props

const RIGHT_W: V3 = [0, 0, 1]; // facing +x (west facade): viewer's right is +z
const UP: V3 = [0, 1, 0];

// Shop signs. Blade signs project from the facade, two faces back to back; flat signs sit 3 cm off the wall.
function blade(x: number, y: number, z: number, name: string, w = 1.6): void {
  const dx = x < 0 ? -1 : 1; // which facade
  const x0 = dx * SIDE, x1 = dx * (SIDE - 1.3);
  // faces looking -z (right = +x) and +z (right = -x)
  const lo = Math.min(x0, x1);
  sprite("mat_atlas_signs", signs, name, [lo, y, z - 0.05], [1, 0, 0], UP, 1.3, w);
  sprite("mat_atlas_signs", signs, name, [lo + 1.3, y, z + 0.05], [-1, 0, 0], UP, 1.3, w);
  box("mat_metal_painted_dark", null, (x0 + x1) / 2, y + w - 0.05, z, 1.3, 0.08, 0.1); // bracket
  neonFrame(lo, y, z, 1.3, w);
}
function neonFrame(lo: number, y: number, z: number, w: number, h: number): void {
  // thin neon tubes along the lower and outer edge of a blade sign
  box("mat_neon_magenta", null, lo + w / 2, y - 0.06, z, w, 0.05, 0.08);
  box("mat_neon_cyan", null, lo + w / 2, y + h, z, w, 0.05, 0.08);
}
function flat(dir: -1 | 1, id: string, layout: AtlasLayout | null, name: string, y: number, z: number, w: number, h: number): void {
  const x = dir * (SIDE - 0.03);
  if (dir < 0) sprite(id, layout, name, [x, y, z - w / 2], RIGHT_W, UP, w, h);
  else sprite(id, layout, name, [x, y, z + w / 2], [0, 0, -1], UP, w, h);
}
blade(-SIDE, 3.1, 9, "ramen");
blade(-SIDE, 3.1, 21, "bar");
blade(SIDE, 3.1, 6, "open_24h");
blade(SIDE, 3.1, 30, "cyberware");
flat(-1, "mat_atlas_signs", signs, "hotel", 8.5, 15, 3, 3);
flat(-1, "mat_atlas_signs", signs, "wide_ramen", 5.4, 40, 4.5, 1.5);
flat(-1, "mat_atlas_signs", signs, "vertical_sign_2", 6.5, 27.5, 1, 3);
flat(1, "mat_atlas_signs", signs, "karaoke", 9, 14, 3, 3);
flat(1, "mat_atlas_signs", signs, "wide_hotel", 5.4, 20, 4.5, 1.5);
flat(1, "mat_atlas_signs", signs, "taxi", 6.2, 40, 2, 2);
flat(1, "mat_atlas_billboard", billboards, "ad_halcyon_tall", 9, 31.5, 3.5, 7);
flat(-1, "mat_atlas_billboard", billboards, "ad_novamed_wide", 14, 12, 8, 2);

// Neon fascia strips above the shopfronts.
const fascia: [number, string][] = [[-18, "cyan"], [-6, "magenta"], [6, "amber"], [18, "cyan"], [30, "purple"], [42, "magenta"], [54, "green"]];
for (const [z, c] of fascia) {
  box(`mat_neon_${c}`, null, -SIDE + 0.06, 4.55, z + 4.5, 0.06, 0.06, 9);
  box(`mat_neon_${c === "cyan" ? "magenta" : "cyan"}`, null, SIDE - 0.06, 4.55, z + 4.5, 0.06, 0.06, 9);
}

// Street lamps: square pole, arm over the road, warm head.
function lamp(side: -1 | 1, z: number): void {
  const x = side * 8.6;
  box("mat_metal_painted_dark", "mat_metal_painted_dark", x, CURB_H, z, 0.16, 6.6, 0.16);
  box("mat_metal_painted_dark", null, x - side * 0.8, CURB_H + 6.5, z, 1.7, 0.1, 0.1);
  box("mat_light_warm", "mat_light_warm", x - side * 1.6, CURB_H + 6.3, z, 0.6, 0.18, 0.3);
}
lamp(-1, 12);
lamp(1, 38);
lamp(-1, 50);
lamp(1, 0);

// Billboard on the dead-end wall: sprite panel in a metal frame with neon trim and brackets.
{
  const w = 14, h = 7, cy = 17, zWall = Z1 - 0.12;
  const id = billboards ? "mat_atlas_billboard" : "mat_atlas_signs";
  const layout = billboards ?? signs;
  const spriteName = billboards ? "ad_solaris_hero" : "neon_dragon";
  if (layout) sprite(id, layout, spriteName, [-w / 2, cy - h / 2, zWall], [1, 0, 0], UP, w, h);
  box("mat_metal_painted_dark", null, 0, cy + h / 2, zWall + 0.02, w + 0.6, 0.35, 0.3); // top bar
  box("mat_metal_painted_dark", null, 0, cy - h / 2 - 0.35, zWall + 0.02, w + 0.6, 0.35, 0.3); // bottom bar
  box("mat_metal_painted_dark", null, -w / 2 - 0.15, cy - h / 2, zWall + 0.02, 0.3, h, 0.3);
  box("mat_metal_painted_dark", null, w / 2 + 0.15, cy - h / 2, zWall + 0.02, 0.3, h, 0.3);
  box("mat_neon_magenta", null, 0, cy + h / 2 + 0.4, zWall - 0.05, w + 0.6, 0.07, 0.07);
  box("mat_neon_cyan", null, 0, cy - h / 2 - 0.5, zWall - 0.05, w + 0.6, 0.07, 0.07);
  for (const x of [-4, 4]) box("mat_metal_galvanized", null, x, cy - h / 2 - 3.2, zWall + 0.1, 0.3, 2.8, 0.3); // supports
  box("mat_metal_rust", null, -4, cy - h / 2 - 3.3, zWall + 0.1, 0.7, 0.2, 0.7);
  box("mat_metal_plate_worn", null, 0, cy - h / 2 - 3.3, zWall + 0.2, 10, 0.12, 1.2); // service catwalk
}

// Parked car on the east side (tint comes from vertex colour on the white paint material).
{
  const cx = 5.7, cz = 14;
  box("mat_veh_paint", "mat_veh_paint", cx, 0.35, cz, 1.8, 0.75, 4.4, [0.8, 0.08, 0.12]);
  box("mat_veh_glass", "mat_veh_paint", cx, 1.1, cz - 0.3, 1.6, 0.62, 2.4, [0.8, 0.08, 0.12]);
  box("mat_veh_light_tail", null, cx - 0.55, 0.75, cz - 2.2, 0.5, 0.14, 0.05);
  box("mat_veh_light_tail", null, cx + 0.55, 0.75, cz - 2.2, 0.5, 0.14, 0.05);
  box("mat_veh_light_head", null, cx - 0.55, 0.7, cz + 2.2, 0.4, 0.14, 0.05);
  box("mat_veh_light_head", null, cx + 0.55, 0.7, cz + 2.2, 0.4, 0.14, 0.05);
}
// Dumpster by the west facade.
box("mat_metal_rust", "mat_metal_plate_worn", -8.7, CURB_H, 36, 1.4, 1.3, 2.4);
box("mat_metal_plate_worn", "mat_metal_galvanized", -8.8, CURB_H, 31, 0.9, 0.9, 0.9); // crate

for (const [id, m] of merged) m.build(`street_${id}`, M(id)!);

// Wheels (cylinders: tyre material is textureless, so default UVs do not matter).
const tire = M("mat_veh_tire");
if (tire) {
  for (const [dx, dz] of [[-0.85, -1.4], [0.85, -1.4], [-0.85, 1.4], [0.85, 1.4]]) {
    const w = MeshBuilder.CreateCylinder("wheel", { diameter: 0.68, height: 0.24, tessellation: 20 }, scene);
    w.rotation.z = Math.PI / 2;
    w.position.set(5.7 + dx, 0.34, 14 + dz);
    w.material = tire;
    w.freezeWorldMatrix();
  }
}

// ---------------------------------------------------------------------------------------------
// Light: low ambient, pools from lamps, coloured fills at the neon, glow from the billboard.

const hemi = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
hemi.diffuse = new Color3(0.2, 0.15, 0.4);
hemi.groundColor = new Color3(0.06, 0.04, 0.1);
hemi.intensity = 0.32;

function point(name: string, pos: V3, color: V3, intensity: number): void {
  const l = new PointLight(name, new Vector3(...pos), scene);
  l.diffuse = new Color3(...color);
  l.specular = new Color3(...color);
  l.intensity = intensity;
}
function lampLight(name: string, pos: V3, intensity: number): void {
  const l = new SpotLight(name, new Vector3(...pos), new Vector3(0.12, -1, 0).normalize(), 2.0, 2, scene);
  l.diffuse = new Color3(1, 0.62, 0.28);
  l.specular = new Color3(1, 0.62, 0.28);
  l.intensity = intensity;
}
lampLight("lamp_w12", [-8.6 + 1.6, 6.5, 12], 700);
lampLight("lamp_e38", [8.6 - 1.6, 6.5, 38], 700);
point("blade_magenta", [-8.4, 4.2, 9], [1, 0.12, 0.65], 160);
point("blade_cyan", [8.4, 4.2, 6], [0.05, 0.85, 1], 160);
point("fascia_purple", [8.5, 5, 32], [0.55, 0.2, 1], 160);
point("board_magenta", [-4, 17, 62], [1, 0.1, 0.55], 700);
point("board_cyan", [4, 17, 62], [0.05, 0.8, 1], 700);
point("taillight", [5.7, 0.9, 11.6], [1, 0.04, 0.05], 12);
point("shop_warm", [-8.8, 3, 20], [1, 0.7, 0.35], 90);

// ---------------------------------------------------------------------------------------------
// Camera and post

const SHOTS: Record<string, { pos: V3; target: V3; fov: number }> = {
  down: { pos: [1.6, 1.7, -15], target: [-0.4, 6.5, 40], fov: 1.0 },
  road: { pos: [3.8, 1.15, 12], target: [-1.5, 0, 33], fov: 0.95 },
  facade: { pos: [8.6, 1.7, 6], target: [-10, 8.5, 13], fov: 1.1 },
  sign: { pos: [-3, 3.4, 1], target: [-9.4, 4.0, 12], fov: 0.85 },
  aerial: { pos: [24, 36, -14], target: [-12, 8, 38], fov: 1.05 },
  billboard: { pos: [0, 2.2, 28], target: [0, 15, 66], fov: 0.85 },
};
const shot = SHOTS[params.get("shot") ?? "down"] ?? SHOTS.down;
let pos = shot.pos;
let target = shot.target;
let fov = shot.fov;
const free = params.get("cam")?.split(",").map(Number);
if (free && free.length === 6) {
  pos = [free[0], free[1], free[2]];
  target = [free[3], free[4], free[5]];
}
const camera = new UniversalCamera("cam", new Vector3(...pos), scene);
camera.setTarget(new Vector3(...target));
camera.fov = fov;
camera.minZ = 0.1;
camera.maxZ = 400;
camera.attachControl(canvas, true);
camera.speed = 0.6;
camera.keysUp = [87];
camera.keysDown = [83];
camera.keysLeft = [65];
camera.keysRight = [68];

const useBloom = params.get("bloom") !== "0";
const fx = new CyberPostFx(scene, camera, { ...tier, bloom: useBloom && tier.bloom });
const useSsr = params.get("ssr") === "1" && useBloom && tier.bloom;
const useMirror = (params.get("mirror") ?? (tier.name === "high" ? "1" : "0")) === "1";
let ssr: SSRRenderingPipeline | null = null;
if (useSsr) {
  const hdr = engine.getCaps().textureHalfFloatRender;
  ssr = new SSRRenderingPipeline("ssr", scene, [camera], false, hdr ? Constants.TEXTURETYPE_HALF_FLOAT : Constants.TEXTURETYPE_UNSIGNED_BYTE);
  ssr.thickness = 0.35;
  ssr.step = 2;
  ssr.maxSteps = Number(params.get("ssrsteps") ?? 160);
  ssr.maxDistance = 150;
  ssr.selfCollisionNumSkip = 2;
  ssr.strength = Number(params.get("ssrs") ?? 1.1);
  ssr.reflectivityThreshold = Number(params.get("ssrt") ?? 0.04);
  ssr.blurDispersionStrength = 0.04;
  ssr.useFresnel = true;
  ssr.enableAutomaticThicknessComputation = false;
  ssr.attenuateScreenBorders = true;
  ssr.environmentTexture = scene.environmentTexture as CubeTexture;
  // The default rendering pipeline (bloom, tone mapping) runs after SSR on linear HDR colour.
  ssr.inputTextureColorIsInGammaSpace = false;
  ssr.generateOutputInGammaSpace = false;
}

// Wet lanes (preview only). The baked material is too rough/bumpy for any reflection to read, so a reflecting road (mirror/ssr)
// gets wr=0.45 (roughness multiplier) and wn=0.4 (normal level) unless overridden. Other knobs: wior index of refraction,
// wenv env intensity, whor=0 / wocc=0 horizon / radiance occlusion off.
{
  const wet = M("mat_road_asphalt_wet");
  if (wet) {
    const reflective = useMirror || useSsr;
    const wn = params.get("wn") ?? (reflective ? "0.4" : null);
    const wr = params.get("wr") ?? (reflective ? "0.45" : null);
    if (wn) wet.bumpTexture!.level = Number(wn);
    if (wr) wet.roughness = Number(wr);
    if (params.get("wior")) wet.indexOfRefraction = Number(params.get("wior"));
    if (params.get("wenv")) wet.environmentIntensity = Number(params.get("wenv"));
    if (params.get("whor") === "0") wet.useHorizonOcclusion = false;
    if (params.get("wocc") === "0") wet.useRadianceOcclusion = false;
  }
}

// Planar mirror on the wet lanes: re-renders the street upside down into a texture the road samples.
if (useMirror) {
  const wet = M("mat_road_asphalt_wet");
  if (wet) {
    const mirror = new MirrorTexture("road_mirror", Number(params.get("size") ?? 512), scene, true);
    mirror.mirrorPlane = new Plane(0, -1, 0, 0);
    mirror.renderList = scene.meshes.filter((m) => !m.name.startsWith("street_mat_road") && !m.name.startsWith("street_mat_ground"));
    mirror.adaptiveBlurKernel = Number(params.get("blur") ?? 6);
    mirror.level = Number(params.get("mlevel") ?? 0.8);
    wet.unfreeze();
    wet.reflectionTexture = mirror;
  }
}

msg.textContent = `street  tier ${tier.name}  tm ${toneName}  ssr ${ssr ? "on" : "off"}  mirror ${useMirror ? "on" : "off"}  neon x${neonScale ?? "manifest"}`;
const info: Record<string, unknown> = { merged: Object.fromEntries([...merged].map(([k, v]) => [k, v.idx.length / 6])), meshes: scene.meshes.length, lights: scene.lights.length, ssr: !!ssr, tone: toneName, missing: [...missing] };
(window as unknown as { __previewInfo: unknown }).__previewInfo = info;

engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());

await library.whenReady();
let frames = 0;
scene.onAfterRenderObservable.add(() => {
  frames++;
  if (frames === 6) (window as unknown as { __previewReady: boolean }).__previewReady = true;
});
void fx;
