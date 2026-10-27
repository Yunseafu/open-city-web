// Dev-only model viewer: /viewer.html
//
//   ?view=gallery            every model in public/models/index.json, laid out on a grid (default)
//     &cat=prop|building|..    only that category        &id=a,b   only those ids
//   ?view=chunk&chunk=0_0    one generated chunk from public/chunks
//   &light=night|day  &wire=1  &uvtest=1 (checker with an "F" at every tile size, to check UV orientation)
//   &anim=walk   play that animation clip on every model that has it (default: none, bind pose)
//   &cam=alpha,beta,radius[,tx,ty,tz]   camera override (degrees / metres)
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";

import { MaterialLibrary } from "./materials/MaterialLibrary";
import { configureDecoders } from "./materials/decoders";
import { createCyberEnvironment, CyberPostFx } from "./materials/CyberEnvironment";
import { TIERS } from "./util/Quality";

configureDecoders();

interface ModelEntry {
  id: string;
  category: string;
  tris: number;
  verts: number;
  bounds: { min: number[]; max: number[] };
}

const q = new URLSearchParams(location.search);
const view = q.get("view") ?? "gallery";
const night = (q.get("light") ?? "night") === "night";
// ?tex=0 shows the GLB fallback factors only (no texture library, no cyber environment / bloom).
const useTex = q.get("tex") !== "0";

const canvas = document.getElementById("view") as HTMLCanvasElement;
const info = document.getElementById("info") as HTMLDivElement;
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, powerPreference: "high-performance" });
const scene = new Scene(engine);
scene.clearColor = night ? new Color4(0.02, 0.025, 0.05, 1) : new Color4(0.55, 0.65, 0.78, 1);

const hemi = new HemisphericLight("hemi", new Vector3(0.2, 1, 0.1), scene);
hemi.intensity = night ? 0.55 : 0.9;
hemi.groundColor = night ? new Color3(0.05, 0.04, 0.09) : new Color3(0.3, 0.3, 0.32);
const sun = new DirectionalLight("sun", new Vector3(-0.4, -1, -0.5), scene);
sun.intensity = night ? 0.35 : 1.4;
sun.diffuse = night ? new Color3(0.5, 0.6, 1) : new Color3(1, 0.95, 0.85);
const materials = useTex ? new MaterialLibrary(scene) : null;
if (materials) {
  createCyberEnvironment(scene);
  if (night) hemi.intensity *= 0.6;
  else {
    // inspection light: the cyber environment alone is too dark to judge a model by
    hemi.intensity = 1.8;
    sun.intensity = 2.6;
  }
  await materials.load();
} else if (night) {
  new GlowLayer("glow", scene, { blurKernelSize: 24 }).intensity = 0.9;
}

const cam = new ArcRotateCamera("cam", -Math.PI / 2, 1.1, 20, Vector3.Zero(), scene);
cam.attachControl(canvas, true);
cam.minZ = 0.05;
cam.maxZ = 4000;
cam.wheelPrecision = 2;
cam.lowerRadiusLimit = 0.5;

// Night view uses the full tier (bloom on); ?tier=low|mid|high picks another one.
const tier = TIERS.find((t) => t.name === q.get("tier")) ?? TIERS[0];
if (materials) {
  materials.applyTier(tier);
  if (night) new CyberPostFx(scene, cam, tier);
}

const root = new TransformNode("content", scene);

const labels: { el: HTMLDivElement; at: Vector3; size: number; shown: boolean }[] = [];
/** `size` is the model's largest extent in metres: labels of models smaller than ~24 px on screen are hidden. */
function labelPlane(text: string, sub: string, at: Vector3, size: number): void {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;transform:translate(-50%,-100%);font:11px/1.3 monospace;color:#7ff;background:rgba(0,0,0,.55);padding:2px 5px;pointer-events:none;white-space:nowrap;display:none";
  el.textContent = `${text}  ${sub}`;
  document.body.appendChild(el);
  labels.push({ el, at, size, shown: false });
}

/** Checker texture with an "F" and a corner arrow: reads wrong if u/v are mirrored or flipped. */
function uvTestTexture(): DynamicTexture {
  const tex = new DynamicTexture("uvtest", 256, scene, true);
  const c = tex.getContext() as CanvasRenderingContext2D;
  c.fillStyle = "#334";
  c.fillRect(0, 0, 256, 256);
  c.fillStyle = "#556";
  c.fillRect(0, 0, 128, 128);
  c.fillRect(128, 128, 128, 128);
  c.strokeStyle = "#f80";
  c.lineWidth = 6;
  c.strokeRect(3, 3, 250, 250);
  c.fillStyle = "#fff";
  c.font = "bold 190px sans-serif";
  c.fillText("F", 70, 200);
  c.fillStyle = "#0f8";
  c.fillRect(8, 8, 40, 14); // marks the image top-left
  tex.update(false); // invertY = false: glTF images have v = 0 at the top
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

function applyViewOptions(nodes: TransformNode[]): void {
  const uvtest = q.get("uvtest") === "1";
  const tex = uvtest ? uvTestTexture() : null;
  for (const n of nodes) {
    for (const mesh of n.getChildMeshes()) {
      const mat = mesh.material;
      if (!mat) continue;
      if (q.get("wire") === "1") mat.wireframe = true;
      if (tex && mat instanceof PBRMaterial) {
        const extras = (mat.metadata?.gltf?.extras ?? {}) as { tile?: number[] | null };
        if (extras.tile) {
          mat.albedoTexture = tex;
          mat.albedoColor = Color3.White();
          tex.uScale = 1 / extras.tile[0];
          tex.vScale = 1 / extras.tile[1];
        }
      }
    }
  }
}

async function loadGallery(): Promise<{ min: Vector3; max: Vector3 }> {
  const res = await fetch(`${import.meta.env.BASE_URL}models/index.json`);
  const all = ((await res.json()) as { models: ModelEntry[] }).models;
  const cat = q.get("cat");
  const ids = q.get("id")?.split(",");
  const models = all.filter((m) => (!cat || m.category === cat) && (!ids || ids.includes(m.id)));
  // Every model at once: rows about as wide as the layout is deep, so the default camera frames them all.
  const footprint = models.reduce((sum, m) => {
    const w = m.bounds.max[0] - m.bounds.min[0], d = m.bounds.max[2] - m.bounds.min[2];
    const gap = Math.max(1.5, Math.max(w, d) * 0.15);
    return sum + (w + gap) * (d + gap + 2);
  }, 0);
  const rowWidth = Number(q.get("row") ?? (cat === "building" ? 260 : cat ? 40 : Math.max(40, Math.sqrt(footprint) * 1.3)));
  let x = 0, z = 0, rowDepth = 0;
  const min = new Vector3(0, 0, 0), max = new Vector3(0, 0, 0);
  let tris = 0;
  const nodes: TransformNode[] = [];
  for (const m of models) {
    const w = m.bounds.max[0] - m.bounds.min[0], d = m.bounds.max[2] - m.bounds.min[2];
    const gap = Math.max(1.5, Math.max(w, d) * 0.15);
    if (x > 0 && x + w > rowWidth) {
      x = 0;
      z += rowDepth + gap + 2;
      rowDepth = 0;
    }
    const container = await LoadAssetContainerAsync(`${import.meta.env.BASE_URL}models/${m.id}.glb`, scene);
    container.addAllToScene();
    materials?.bindContainer(container);
    const wantAnim = q.get("anim");
    for (const g of container.animationGroups) {
      g.stop();
      if (g.name === wantAnim) g.start(true);
    }
    const holder = new TransformNode(m.id, scene);
    holder.parent = root;
    for (const r of container.rootNodes) r.parent = holder;
    // Place by bounds so the model's min corner sits at (x, z).
    holder.position.set(x - m.bounds.min[0], 0, z - m.bounds.min[2]);
    nodes.push(holder);
    labelPlane(m.id, `${m.tris} tris`, new Vector3(x + w / 2, m.bounds.max[1] + 0.3, z + d / 2), Math.max(w, d, m.bounds.max[1] - m.bounds.min[1]));
    max.x = Math.max(max.x, x + w);
    max.z = Math.max(max.z, z + d);
    max.y = Math.max(max.y, m.bounds.max[1]);
    x += w + gap;
    rowDepth = Math.max(rowDepth, d);
    tris += m.tris;
  }
  applyViewOptions(nodes);
  const ground = MeshBuilder.CreateGround("ground", { width: max.x + 40, height: max.z + 40 }, scene);
  ground.position.set(max.x / 2, -0.01, max.z / 2);
  const gm = new StandardMaterial("gm", scene);
  gm.diffuseColor = night ? new Color3(0.07, 0.075, 0.09) : new Color3(0.1, 0.105, 0.12);
  gm.specularColor = Color3.Black();
  ground.material = gm;
  ground.parent = root;
  info.textContent = `gallery: ${models.length} models, ${tris} tris`;
  return { min, max };
}

async function loadChunk(): Promise<{ min: Vector3; max: Vector3 }> {
  const key = q.get("chunk") ?? "0_0";
  const [cx, cz] = key.split("_").map(Number);
  const radius = Number(q.get("radius") ?? 0);
  const min = new Vector3(Infinity, 0, Infinity), max = new Vector3(-Infinity, 0, -Infinity);
  const holders: TransformNode[] = [];
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      const k = `${cx + dx}_${cz + dz}`;
      try {
        const container = await LoadAssetContainerAsync(`${import.meta.env.BASE_URL}chunks/${k}.glb`, scene);
        container.addAllToScene();
        materials?.bindContainer(container);
        const holder = new TransformNode(`chunk_${k}`, scene);
        holder.parent = root;
        for (const r of container.rootNodes) r.parent = holder;
        holder.position.set((cx + dx) * 128, 0, (cz + dz) * 128);
        holders.push(holder);
        min.x = Math.min(min.x, (cx + dx) * 128);
        min.z = Math.min(min.z, (cz + dz) * 128);
        max.x = Math.max(max.x, (cx + dx + 1) * 128);
        max.z = Math.max(max.z, (cz + dz + 1) * 128);
      } catch (e) {
        console.warn("chunk missing", k, e);
      }
    }
  }
  max.y = 60;
  applyViewOptions(holders);
  info.textContent = `chunk ${key} radius ${radius}`;
  return { min, max };
}

const bounds = view === "chunk" ? await loadChunk() : await loadGallery();
const centre = new Vector3((bounds.min.x + bounds.max.x) / 2, bounds.max.y / 3, (bounds.min.z + bounds.max.z) / 2);
const size = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z, 4);
const camParam = q.get("cam")?.split(",").map(Number);
cam.setTarget(camParam && camParam.length >= 6 ? new Vector3(camParam[3], camParam[4], camParam[5]) : centre);
cam.alpha = -Math.PI / 2;
cam.beta = 1.05;
cam.radius = Math.max(size * 0.9, 3);
if (camParam && camParam.length >= 3) {
  cam.alpha = (camParam[0] * Math.PI) / 180;
  cam.beta = (camParam[1] * Math.PI) / 180;
  cam.radius = camParam[2];
}

engine.runRenderLoop(() => {
  scene.render();
  const vp = cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
  const pxPerRad = innerHeight / (2 * Math.tan(cam.fov / 2));
  for (const l of labels) {
    const p = Vector3.Project(l.at, Matrix.IdentityReadOnly, scene.getTransformMatrix(), vp);
    const px = (l.size / Math.max(0.01, Vector3.Distance(cam.position, l.at))) * pxPerRad;
    const vis = p.z > 0 && p.z < 1 && px > 24;
    // Only touch the DOM for visible labels: hundreds of style writes per frame cost more than the models.
    if (vis !== l.shown) {
      l.el.style.display = vis ? "block" : "none";
      l.shown = vis;
    }
    if (!vis) continue;
    l.el.style.left = `${(p.x / engine.getRenderWidth()) * innerWidth}px`;
    l.el.style.top = `${(p.y / engine.getRenderHeight()) * innerHeight}px`;
  }
});
window.addEventListener("resize", () => engine.resize());
scene.executeWhenReady(() => {
  void (materials?.whenReady() ?? Promise.resolve()).then(() => {
    (window as unknown as { __viewerReady: boolean }).__viewerReady = true;
  });
});
