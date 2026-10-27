import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import "@babylonjs/loaders/glTF";
import { MeshoptCompression } from "@babylonjs/core/Meshes/Compression/meshoptCompression";

import { ChunkManager } from "./world/ChunkManager";
import { BUDGET_MB, MemoryMonitor } from "./util/MemoryMonitor";
import { TIERS } from "./util/Quality";

// Self-hosted decoder (public/decoders/meshopt_decoder.js, from the meshoptimizer package).
MeshoptCompression.Configuration.decoder.url = `${import.meta.env.BASE_URL}decoders/meshopt_decoder.js`;

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

let tierIndex = 1;
const chunks = new ChunkManager(scene);
const applyTier = () => {
  const tier = TIERS[tierIndex];
  chunks.loadRadius = tier.loadRadius;
  engine.setHardwareScalingLevel(tier.renderScale);
};
applyTier();

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
