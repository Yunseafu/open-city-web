import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import "@babylonjs/loaders/glTF";

import { ChunkManager } from "./world/ChunkManager";
import { MaterialLibrary } from "./materials/MaterialLibrary";
import { configureDecoders } from "./materials/decoders";
import { createCyberEnvironment, CyberPostFx } from "./materials/CyberEnvironment";
import { BUDGET_MB, MemoryMonitor } from "./util/MemoryMonitor";
import { TIERS } from "./util/Quality";

// Meshopt + KTX2 decoders are self-hosted in public/decoders (npm run decoders).
configureDecoders();

const canvas = document.getElementById("game") as HTMLCanvasElement;
const hud = document.getElementById("hud") as HTMLDivElement;

const engine = new Engine(canvas, false, { powerPreference: "high-performance" });
const scene = new Scene(engine);
scene.clearColor = new Color4(0.02, 0.02, 0.05, 1);
scene.fogMode = Scene.FOGMODE_EXP2;
scene.fogDensity = 0.004;
scene.fogColor = new Color3(0.03, 0.02, 0.08);

const light = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
light.intensity = 0.35;

const camera = new UniversalCamera("cam", new Vector3(64, 3, 64), scene);
camera.attachControl(canvas, true);
camera.keysUp = [87];
camera.keysDown = [83];
camera.keysLeft = [65];
camera.keysRight = [68];
camera.speed = 1.5;
camera.minZ = 0.1;
camera.maxZ = 1500;

createCyberEnvironment(scene);
const materials = new MaterialLibrary(scene);
await materials.load();

let tierIndex = 1;
const chunks = new ChunkManager(scene);
chunks.materials = materials;
const postFx = new CyberPostFx(scene, camera, TIERS[tierIndex]);
const applyTier = () => {
  const tier = TIERS[tierIndex];
  chunks.loadRadius = tier.loadRadius;
  engine.setHardwareScalingLevel(tier.renderScale);
  materials.applyTier(tier);
  postFx.apply(tier);
};
applyTier();

// ?cam=x,y,z,yawDeg,pitchDeg places the camera, for tools/preview/shot.mjs.
const cam = new URLSearchParams(location.search).get("cam")?.split(",").map(Number);
if (cam?.length === 5 && cam.every(Number.isFinite)) {
  camera.position.set(cam[0], cam[1], cam[2]);
  camera.rotation.set((cam[4] * Math.PI) / 180, (cam[3] * Math.PI) / 180, 0);
}

let last = { text: "" };
const monitor = new MemoryMonitor(scene, (s) => {
  // Over 85% of the budget: step down one quality tier.
  if (s.totalMB > BUDGET_MB.total * 0.85 && tierIndex < TIERS.length - 1) {
    tierIndex++;
    applyTier();
  }
  last = {
    text:
      `tier     ${TIERS[tierIndex].name}\n` +
      `chunks   ${chunks.loadedCount}\n` +
      `textures ${s.texturesMB.toFixed(0)}/${BUDGET_MB.textures} MB\n` +
      `geometry ${s.geometryMB.toFixed(0)}/${BUDGET_MB.geometry} MB\n` +
      `js heap  ${s.jsHeapMB.toFixed(0)}/${BUDGET_MB.jsHeap} MB\n` +
      `total    ${s.totalMB.toFixed(0)}/${BUDGET_MB.total} MB`,
  };
});
monitor.start();

engine.runRenderLoop(() => {
  chunks.update(camera.position);
  scene.render();
  hud.textContent = `${engine.getFps().toFixed(0)} fps\n${last.text}`;
});
window.addEventListener("resize", () => engine.resize());

// Signals tools/preview/shot.mjs: chunks streamed in and every requested texture settled.
const waitReady = async () => {
  while (chunks.loadedCount === 0) await new Promise((r) => setTimeout(r, 100));
  await materials.whenReady();
  scene.executeWhenReady(() => {
    const w = window as unknown as { __previewReady?: boolean; __previewInfo?: unknown };
    w.__previewInfo = { chunks: chunks.loadedCount, meshes: scene.meshes.length, materials: scene.materials.length, textures: scene.textures.length };
    w.__previewReady = true;
  });
};
void waitReady();
