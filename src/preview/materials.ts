import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Constants } from "@babylonjs/core/Engines/constants";
import "@babylonjs/loaders/glTF";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

import { MaterialLibrary } from "../materials/MaterialLibrary";
import { configureDecoders } from "../materials/decoders";
import { createCyberEnvironment, CyberPostFx } from "../materials/CyberEnvironment";
import type { MaterialDef } from "../materials/manifest";
import { TIERS } from "../util/Quality";
import { ChunkManager } from "../world/ChunkManager";

/**
 * Material gallery: every manifest entry as an upright 4x4 m tile plus a sphere on a wet street,
 * and a normal-map orientation self-test.
 *
 * Query: ids=a,b  show only these | full=1  one plane per material covering 2x2 repeats |
 *        key=<n>  neutral key light intensity | tier=high|medium|low | cam=alpha,beta,radius (deg, deg, m) | base=/textures  manifest location
 *        test=normal  normal-map orientation self-test | test=bind  MaterialLibrary binding and chunk unload checks
 */
configureDecoders();

const params = new URLSearchParams(location.search);
const canvas = document.getElementById("game") as HTMLCanvasElement;
const labels = document.getElementById("labels") as HTMLDivElement;
const msg = document.getElementById("msg") as HTMLDivElement;

// preserveDrawingBuffer: the normal self-test reads pixels back from the canvas.
const engine = new Engine(canvas, false, { powerPreference: "high-performance", preserveDrawingBuffer: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(0.02, 0.02, 0.05, 1);
createCyberEnvironment(scene);

const tier = TIERS.find((t) => t.name === params.get("tier")) ?? TIERS[0];
const library = new MaterialLibrary(scene, params.get("base") ?? "/textures");
library.applyTier(tier);
await library.load();

const camera = new ArcRotateCamera("cam", -Math.PI / 2, Math.PI / 2.3, 20, new Vector3(0, 1.5, 0), scene);
camera.attachControl(canvas, true);
camera.minZ = 0.1;
camera.wheelPrecision = 20;
camera.lowerRadiusLimit = 1;
new CyberPostFx(scene, camera, tier);

const hemi = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
hemi.intensity = 0.12;
const cyan = new PointLight("cyan", new Vector3(-8, 6, -8), scene);
cyan.diffuse = new Color3(0.2, 0.9, 1);
cyan.intensity = 90;
const magenta = new PointLight("magenta", new Vector3(8, 6, -8), scene);
magenta.diffuse = new Color3(1, 0.2, 0.7);
magenta.intensity = 90;

// Neutral key light so material colours read true next to the neon fill.
const key = new DirectionalLight("key", new Vector3(-0.35, -0.55, 1).normalize(), scene);
key.intensity = Number(params.get("key") ?? (params.get("full") === "1" ? 3 : 0.8)); // dark tiles need more light to judge seams

const info: Record<string, unknown> = { materials: 0 };
(window as unknown as { __previewInfo: unknown }).__previewInfo = info;

engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());

if (params.get("test") === "normal") {
  runNormalTest();
} else if (params.get("test") === "bind") {
  await runBindTest();
} else {
  buildGallery();
}

/** Tiling UVs in metres, v pointing down the image (glTF) so textures read upright on a vertical plane. */
function setPlaneUV(plane: Mesh, widthM: number, heightM: number, uvW: number, uvH: number): void {
  const pos = plane.getVerticesData(VertexBuffer.PositionKind)!;
  const uv: number[] = [];
  for (let i = 0; i < pos.length; i += 3) {
    uv.push((pos[i] / widthM + 0.5) * uvW, (0.5 - pos[i + 1] / heightM) * uvH);
  }
  plane.setVerticesData(VertexBuffer.UVKind, uv);
}

function scaleUV(mesh: Mesh, su: number, sv: number): void {
  const uv = mesh.getVerticesData(VertexBuffer.UVKind)!;
  for (let i = 0; i < uv.length; i += 2) {
    uv[i] *= su;
    uv[i + 1] *= sv;
  }
  mesh.setVerticesData(VertexBuffer.UVKind, uv);
}

function tileSize(def: MaterialDef): [number, number] {
  const t = def.tileSizeM;
  return Array.isArray(t) ? t : [t ?? 1, t ?? 1];
}

function buildGallery(): void {
  const wanted = params.get("ids")?.split(",");
  const ids = library.ids.filter((id) => !wanted || wanted.includes(id)).sort();
  info.materials = ids.length;
  if (ids.length === 0) {
    msg.textContent = library.ids.length === 0 ? "materials.json missing or empty: run `npm run textures`" : "no material matches ?ids=";
    return;
  }
  msg.textContent = `${ids.length} materials (tier ${tier.name})`;
  const full = params.get("full") === "1";

  // Overview: a wall of 4x4 m tiles (row-major, sorted by id) with a sphere beside each, standing on the street.
  // Full: one row, each plane covering 2x2 repeats of the real tile size, to judge seams and scale.
  const cols = full ? ids.length : Math.min(ids.length, Math.ceil(Math.sqrt(ids.length * 1.6)));
  const rows = Math.ceil(ids.length / cols);
  const cellW = 6.4;
  const cellH = 5.2;
  let xCursor = 0;
  let maxH = 4;
  const anchors: { world: Vector3; el: HTMLDivElement }[] = [];

  ids.forEach((id, i) => {
    const def = library.def(id)!;
    const mat = library.get(id);
    const [tw, th] = tileSize(def);
    const tiling = def.kind === "tiling";
    const wM = full && tiling ? tw * 2 : 4;
    const hM = full && tiling ? th * 2 : 4;
    maxH = Math.max(maxH, hM);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = full ? xCursor + wM / 2 : col * cellW;
    const cy = full ? hM / 2 : 2 + (rows - 1 - row) * cellH;
    if (full) xCursor += wM + 2;

    const plane = MeshBuilder.CreatePlane(`tile_${id}`, { width: wM, height: hM }, scene);
    plane.position.set(cx, cy, 0);
    if (tiling) setPlaneUV(plane, wM, hM, wM, hM);
    else setPlaneUV(plane, wM, hM, 1, 1);
    plane.material = mat;

    if (!full) {
      const sphere = MeshBuilder.CreateSphere(`ball_${id}`, { diameter: 1.6, segments: 48 }, scene);
      sphere.position.set(cx + 3.1, cy, -0.8);
      if (tiling) scaleUV(sphere, Math.PI * 1.6, Math.PI * 0.8);
      sphere.material = mat;
    }

    const el = document.createElement("div");
    el.className = "label";
    const tile = tiling ? ` tile ${Array.isArray(def.tileSizeM) ? def.tileSizeM.join("x") : def.tileSizeM}m` : "";
    el.textContent = `${id}\n${def.kind}${tile}`;
    labels.appendChild(el);
    anchors.push({ world: new Vector3(cx + (full ? 0 : 0.7), cy - hM / 2 - 0.05, 0), el });
  });

  const spanX = full ? xCursor : (cols - 1) * cellW + 6.4;
  const spanY = full ? maxH : (rows - 1) * cellH + 4;
  const centreX = full ? xCursor / 2 - 1 : ((cols - 1) * cellW) / 2 + 1.5;

  const floor = MeshBuilder.CreateGround("floor", { width: spanX + 80, height: 120 }, scene);
  floor.position.set(centreX, -0.01, -20);
  scaleUV(floor, spanX + 80, 120);
  floor.material = library.tryGet("mat_road_asphalt_wet") ?? flatFloor();

  // Lights sit in front of the wall, one per side, so the specular and normal detail read on every tile.
  cyan.position.set(centreX - spanX * 0.35, spanY * 0.8, -14);
  magenta.position.set(centreX + spanX * 0.35, spanY * 0.8, -14);

  // Camera frames the whole gallery from the front, slightly above.
  const fov = camera.fov;
  const aspect = engine.getAspectRatio(camera);
  const needW = (spanX + 2) / (2 * Math.tan(fov / 2) * aspect);
  const needH = (spanY + 3) / (2 * Math.tan(fov / 2));
  camera.target = new Vector3(centreX, spanY / 2, 0);
  camera.alpha = -Math.PI / 2;
  camera.beta = Math.PI / 2.1;
  camera.radius = Math.max(needW, needH, 8);
  const cam = params.get("cam")?.split(",").map(Number);
  if (cam?.length === 3 && cam.every(Number.isFinite)) {
    camera.alpha = (cam[0] * Math.PI) / 180;
    camera.beta = (cam[1] * Math.PI) / 180;
    camera.radius = cam[2];
  }
  camera.upperRadiusLimit = camera.radius * 3;

  const w = () => engine.getRenderWidth();
  const h = () => engine.getRenderHeight();
  scene.onAfterRenderObservable.add(() => {
    const transform = scene.getTransformMatrix();
    const viewport = camera.viewport.toGlobal(w(), h());
    for (const a of anchors) {
      const p = Vector3.Project(a.world, Matrix.IdentityReadOnly, transform, viewport);
      const visible = p.z > 0 && p.z < 1;
      a.el.style.display = visible ? "block" : "none";
      if (visible) {
        a.el.style.left = `${(p.x / w()) * 100}%`;
        a.el.style.top = `${(p.y / h()) * 100}%`;
      }
    }
  });
}

function flatFloor(): PBRMaterial {
  const m = new PBRMaterial("flat_floor", scene);
  m.albedoColor = new Color3(0.05, 0.05, 0.07);
  m.metallic = 0;
  m.roughness = 0.15;
  return m;
}

/**
 * Normal-map orientation self-test. A raised Gaussian blob is rendered twice under the same
 * light: once as a glTF-convention normal map on a flat quad (through the library's material
 * flags) and once as real displaced geometry. Mirroring what the glTF loader produces in
 * Babylon's left-handed scene (positions x,y kept, z negated), the quad faces the default camera
 * at -Z with image-up = +Y, image-right = +X. The light travels towards +X and +Z, so slopes
 * facing left (-X) are lit: both blobs must be brighter on the left half than on the right.
 */
function runNormalTest(): void {
  const N = 128;
  const sigma = 0.45;
  const amp = 0.5;
  // Height h(x, y) over [-1, 1]^2, x right, y up.
  const hx = (x: number, y: number) => amp * Math.exp(-(x * x + y * y) / (sigma * sigma));
  const grad = (x: number, y: number): [number, number] => {
    const h = hx(x, y);
    const k = -2 / (sigma * sigma);
    return [k * x * h, k * y * h];
  };

  // glTF normal map: rgb = n * 0.5 + 0.5, n = normalize(-dh/dx, -dh/dy_up, 1); row 0 is the top of the image.
  const data = new Uint8Array(N * N * 4);
  for (let row = 0; row < N; row++) {
    for (let col = 0; col < N; col++) {
      const x = ((col + 0.5) / N) * 2 - 1;
      const y = 1 - ((row + 0.5) / N) * 2;
      const [gx, gy] = grad(x, y);
      const len = Math.hypot(gx, gy, 1);
      const i = (row * N + col) * 4;
      data[i] = Math.round(((-gx / len) * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round(((-gy / len) * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const normalTex = RawTexture.CreateRGBATexture(data, N, N, scene, true, false, Constants.TEXTURE_TRILINEAR_SAMPLINGMODE);

  library.register("mat_test_flat", {
    kind: "flat",
    maps: {},
    params: { baseColor: [0.4, 0.4, 0.4], metallic: 0, roughness: 0.6 },
  });
  // clone keeps the invertNormalMap flags the library set.
  const mapped = library.get("mat_test_flat").clone("normal_test")!;
  mapped.bumpTexture = normalTex;
  mapped.bumpTexture.level = 1;
  const plain = library.get("mat_test_flat");

  const quad = (name: string, x0: number): Mesh => {
    const m = new Mesh(name, scene);
    const vd = new VertexData();
    vd.positions = [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0];
    vd.normals = [0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1];
    vd.uvs = [0, 1, 1, 1, 1, 0, 0, 0]; // (0,0) top-left, v down
    vd.indices = [0, 1, 2, 0, 2, 3]; // counter-clockwise seen from -Z, Babylon's front face
    vd.applyToMesh(m);
    m.position.set(x0, 1, 0);
    return m;
  };
  const left = quad("map_quad", -1.2);
  left.material = mapped;

  // Geometry reference: a grid displaced towards the viewer (-Z) with analytic normals.
  const G = 64;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= G; j++) {
    for (let i = 0; i <= G; i++) {
      const x = (i / G) * 2 - 1;
      const y = (j / G) * 2 - 1;
      const [gx, gy] = grad(x, y);
      const len = Math.hypot(gx, gy, 1);
      positions.push(x, y, -hx(x, y));
      normals.push(-gx / len, -gy / len, -1 / len);
    }
  }
  for (let j = 0; j < G; j++) {
    for (let i = 0; i < G; i++) {
      const a = j * (G + 1) + i;
      indices.push(a, a + 1, a + G + 2, a, a + G + 2, a + G + 1);
    }
  }
  const geo = new Mesh("geo_bump", scene);
  const gvd = new VertexData();
  gvd.positions = positions;
  gvd.normals = normals;
  gvd.indices = indices;
  gvd.applyToMesh(geo);
  geo.position.set(1.2, 1, 0);
  geo.material = plain;

  hemi.intensity = 0.05;
  cyan.setEnabled(false);
  magenta.setEnabled(false);
  key.setEnabled(false);
  const sun = new DirectionalLight("test_light", new Vector3(1, 0, 1).normalize(), scene);
  sun.intensity = 2.5;
  scene.environmentIntensity = 0.1;

  camera.target = new Vector3(0, 1, 0);
  camera.alpha = -Math.PI / 2;
  camera.beta = Math.PI / 2;
  camera.radius = 6;
  camera.detachControl();
  msg.textContent = "normal self-test: left = normal map on flat quad, right = real geometry; the light must brighten the same side on both";

  // Phase 1 (frame 10): light travels +X, slopes facing -X are lit, so left halves must be brighter.
  // Phase 2 (frame 20): light travels -Y, slopes facing +Y are lit, so top halves must be brighter.
  let frames = 0;
  const horizontal = { mapA: 0, mapB: 0, geoA: 0, geoB: 0 };
  scene.onAfterRenderObservable.add(() => {
    if (!scene.isReady()) return;
    frames++;
    if (frames !== 10 && frames !== 20) return;
    const w = engine.getRenderWidth();
    const h = engine.getRenderHeight();
    const probe = document.createElement("canvas");
    probe.width = w;
    probe.height = h;
    const ctx = probe.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(canvas, 0, 0, w, h);
    const lum = (center: Vector3, offset: Vector3) => {
      const p = Vector3.Project(center.add(offset), Matrix.IdentityReadOnly, scene.getTransformMatrix(), camera.viewport.toGlobal(w, h));
      const r = Math.max(4, Math.round(w * 0.02));
      const px = ctx.getImageData(Math.round(p.x) - r, Math.round(p.y) - r, 2 * r, 2 * r).data;
      let sum = 0;
      for (let i = 0; i < px.length; i += 4) sum += 0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2];
      return sum / (px.length / 4);
    };
    const d = 0.45; // metres either side of the blob centre, on the slope
    const measure = (a: Vector3, b: Vector3) => ({
      mapA: lum(left.position, a),
      mapB: lum(left.position, b),
      geoA: lum(geo.position, a),
      geoB: lum(geo.position, b),
    });
    if (frames === 10) {
      Object.assign(horizontal, measure(new Vector3(-d, 0, 0), new Vector3(d, 0, 0)));
      sun.direction = new Vector3(0, -1, 1).normalize();
      return;
    }
    const vertical = measure(new Vector3(0, d, 0), new Vector3(0, -d, 0));
    const pass = (m: typeof vertical) => m.mapA > m.mapB * 1.2 && m.geoA > m.geoB * 1.2;
    const ok = pass(horizontal) && pass(vertical);
    Object.assign(info, { normalTest: { horizontalLeftRight: horizontal, verticalTopBottom: vertical, ok } });
    msg.textContent +=
      `\nleft/right  map ${horizontal.mapA.toFixed(0)}/${horizontal.mapB.toFixed(0)}  geometry ${horizontal.geoA.toFixed(0)}/${horizontal.geoB.toFixed(0)}` +
      `\ntop/bottom  map ${vertical.mapA.toFixed(0)}/${vertical.mapB.toFixed(0)}  geometry ${vertical.geoA.toFixed(0)}/${vertical.geoB.toFixed(0)}` +
      `\n=> ${ok ? "PASS (raised, not inset)" : "FAIL (inverted?)"}`;
    ready();
  });
}

/**
 * MaterialLibrary.bindNodes and ChunkManager integration: mat_* materials are swapped for the shared
 * ones, unknown ids keep the GLB material and warn once, vertex alpha is cleared, and unloading
 * chunks leaves shared materials and textures alive.
 */
async function runBindTest(): Promise<void> {
  const results: Record<string, boolean> = {};
  const id = library.ids.find((i) => library.def(i)?.maps.albedo) ?? library.ids[0];
  if (!id) {
    msg.textContent = "bind test needs at least one material in the manifest";
    Object.assign(info, { bindTest: { ok: false, results } });
    ready();
    return;
  }

  const warnings: string[] = [];
  const realWarn = console.warn;
  console.warn = (...a: unknown[]) => warnings.push(a.join(" "));

  const glbMat = new PBRMaterial(id, scene);
  const unknownMat = new PBRMaterial("mat_does_not_exist", scene);
  const plainMat = new PBRMaterial("not_a_library_material", scene);
  const root = new TransformNode("bind_root", scene);
  const mk = (name: string, mat: PBRMaterial) => {
    const m = MeshBuilder.CreateBox(name, {}, scene);
    m.parent = root;
    m.material = mat;
    m.hasVertexAlpha = true; // what the glTF loader sets for vec4 COLOR_0
    return m;
  };
  const a = mk("a", glbMat);
  const b = mk("b", unknownMat);
  const c = mk("c", plainMat);
  const count = library.bindNodes([root]);
  library.bindNodes([root]);
  results.replaced = a.material === library.get(id) && count === 1;
  results.vertexAlphaCleared = !a.hasVertexAlpha;
  results.unknownKept = b.material === unknownMat;
  results.plainKept = c.material === plainMat;
  results.warnedOnce = warnings.filter((w) => w.includes("mat_does_not_exist")).length === 1;

  // Placeholder chunks use library materials; unloading them must not dispose those.
  const chunks = new ChunkManager(scene, "/__no_chunks__", 1);
  chunks.materials = library;
  chunks.update(new Vector3(10, 0, 10));
  for (let i = 0; i < 100 && chunks.loadedCount < 9; i++) await new Promise((r) => setTimeout(r, 50));
  results.chunksLoaded = chunks.loadedCount === 9;
  const shared = library.tryGet("mat_road_asphalt_wet");
  const tex = shared?.albedoTexture ?? null;
  chunks.loadRadius = 0;
  chunks.update(new Vector3(100000, 0, 100000));
  results.sharedMaterialSurvived = !shared || scene.materials.includes(shared);
  results.sharedTextureSurvived = !tex || scene.textures.includes(tex);
  results.fallbackMaterialsDisposed = !scene.materials.some((m) => m.name.startsWith("gm_") || m.name.startsWith("neon_"));

  // Tier switching creates and disposes the bloom pipeline without throwing or leaving a wrong clear colour.
  try {
    const before = scene.clearColor.clone();
    const fx = new CyberPostFx(scene, camera, TIERS[0]);
    fx.apply(TIERS[2]);
    results.postFxToggle = scene.clearColor.equals(before);
    fx.apply(TIERS[0]);
    fx.dispose();
  } catch {
    results.postFxToggle = false;
  }

  // COLOR_0 (vertex AO / tint) must still multiply the library material's albedo.
  library.register("mat_test_flat", { kind: "flat", maps: {}, params: { baseColor: [0.6, 0.6, 0.6], metallic: 0, roughness: 0.8 } });
  const flat = library.get("mat_test_flat");
  const coloured = (name: string, x: number, value: number) => {
    const m = MeshBuilder.CreatePlane(name, { size: 1.5 }, scene);
    m.position.set(x, 1.5, 0);
    m.material = flat;
    m.setVerticesData(VertexBuffer.ColorKind, new Array(4).fill([value, value, value, 1]).flat());
    return m;
  };
  const white = coloured("vc_white", -1, 1);
  const dark = coloured("vc_dark", 1, 0.2);
  camera.alpha = -Math.PI / 2;
  camera.beta = Math.PI / 2;
  camera.radius = 8;
  camera.target = new Vector3(0, 1.5, 0);
  for (let i = 0; i < 15; i++) await new Promise((r) => scene.onAfterRenderObservable.addOnce(() => r(null)));
  const w = engine.getRenderWidth();
  const h = engine.getRenderHeight();
  const probe = document.createElement("canvas");
  probe.width = w;
  probe.height = h;
  const ctx = probe.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(canvas, 0, 0, w, h);
  const lum = (m: Mesh) => {
    const p = Vector3.Project(m.position, Matrix.IdentityReadOnly, scene.getTransformMatrix(), camera.viewport.toGlobal(w, h));
    const d = ctx.getImageData(Math.round(p.x) - 4, Math.round(p.y) - 4, 8, 8).data;
    return (d[0] + d[1] + d[2]) / 3;
  };
  const [lw, ld] = [lum(white), lum(dark)];
  const linear = (v: number) => (v / 255) ** 2.2;
  results.vertexColorMultiplies = lw > 40 && linear(ld) < linear(lw) * 0.6; // 0.2 vertex colour, softened by ambient and specular
  Object.assign(info, { vertexColorLuminance: { white: lw, dark: ld } });

  console.warn = realWarn;
  const ok = Object.values(results).every(Boolean);
  Object.assign(info, { bindTest: { ok, results } });
  msg.textContent = `bind test: ${ok ? "PASS" : "FAIL"}\n${Object.entries(results).map(([k, v]) => `${v ? "ok  " : "FAIL"} ${k}`).join("\n")}`;
  ready();
}

function ready(): void {
  (window as unknown as { __previewReady: boolean }).__previewReady = true;
}

if (!params.get("test")) {
  void library.whenReady().then(() =>
    scene.executeWhenReady(() => {
      let frames = 0;
      const obs = scene.onAfterRenderObservable.add(() => {
        if (++frames < 5) return;
        scene.onAfterRenderObservable.remove(obs);
        ready();
      });
    }),
  );
}
