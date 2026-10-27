#!/usr/bin/env node
// Compress a raw GLB/glTF map chunk for streaming:
//   edge-collapse simplification (normals and UVs preserved) + meshopt + KTX2/Basis textures.
// Requires `gltfpack` and `toktx` (KTX-Software) on PATH.
//
// Usage: node tools/build-chunk.mjs <input.glb> <output.glb> [--lod 0|1|2]
import { spawnSync } from "node:child_process";

const [input, output, ...rest] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: build-chunk.mjs <input.glb> <output.glb> [--lod 0|1|2]");
  process.exit(1);
}

const lodIdx = rest.indexOf("--lod");
const lod = lodIdx >= 0 ? Number(rest[lodIdx + 1]) : 0;
// Fraction of triangles kept per LOD: LOD0 keeps high precision, far LODs collapse hard.
const keep = [0.9, 0.4, 0.12][lod] ?? 0.9;

const args = [
  "-i", input,
  "-o", output,
  "-si", String(keep), // simplification ratio (edge collapse)
  "-cc",               // meshopt compression, better ratio
  "-tc",               // KTX2 / Basis textures via toktx
  "-vp", "16",         // 16-bit quantised positions
  "-vtf",              // float UVs (metre-scale UVs; quantised UVs need a texture transform)
  "-vn", "8",          // 8-bit normals
  "-mm",               // merge meshes with the same material (static batching)
  "-kn",               // keep named nodes, so gameplay props can be found
  "-km",               // keep material names: they are the key into the runtime material library
  "-ke",               // keep extras (anchors, material hints)
  "-kv",               // keep UVs / colours even on untextured materials
];

const res = spawnSync("gltfpack", args, { stdio: "inherit" });
if (res.error) {
  console.error("gltfpack not found. Install from https://github.com/zeux/meshoptimizer/releases");
  process.exit(1);
}
process.exit(res.status ?? 1);
