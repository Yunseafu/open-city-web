// gltfpack wrapper for generated assets: meshopt compression + 16-bit quantised attributes.
// Material and node names are the contract with the runtime, so named ones are kept.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const GLTFPACK = path.resolve(here, "../../../node_modules/gltfpack/cli.js");

/**
 * @param {string} input raw GLB
 * @param {string} output packed GLB
 * @param {{simplify?: number, positionBits?: number}} opts simplify = triangle ratio to keep (edge collapse)
 */
export function pack(input, output, { simplify = 1, positionBits = 14 } = {}) {
  const args = [
    GLTFPACK,
    "-i", input,
    "-o", output,
    "-cc",                         // meshopt compression, higher ratio
    "-kn", "-km", "-ke",           // keep named nodes, named materials and extras (anchors, material markers)
    "-kv",                         // keep UVs even though no texture is bound yet: the runtime material library adds them
    "-vp", String(positionBits),
    "-vtf",                        // float UVs: they are in metres, and quantised UVs need a texture transform that only exists on textured materials
    "-vn", "8",
    "-vc", "8",
  ];
  if (simplify < 1) args.push("-si", String(simplify));
  const res = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error(`gltfpack failed for ${input}\n${res.stdout}\n${res.stderr}`);
  }
}
