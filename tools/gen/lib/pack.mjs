// gltfpack wrapper for generated assets: meshopt compression + 16-bit quantised attributes.
// Material and node names are the contract with the runtime, so named ones are kept.
//
// Runs the gltfpack Wasm library in-process instead of spawning its cli.js per model: on Windows the
// cli's process.exit() intermittently aborts Node with a libuv assertion (src\win\async.c), and one
// Wasm instance for the whole run is also faster than a node process per model.
import fs from "node:fs";
import { pack as gltfpack } from "gltfpack";

const iface = {
  read: (file) => fs.readFileSync(file),
  write: (file, data) => fs.writeFileSync(file, data),
};

/**
 * @param {string} input raw GLB
 * @param {string} output packed GLB
 * @param {{simplify?: number, positionBits?: number}} opts simplify = triangle ratio to keep (edge collapse)
 */
export async function pack(input, output, { simplify = 1, positionBits = 14 } = {}) {
  const args = [
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
  // The library keeps global state, so calls must not overlap: every caller awaits.
  try {
    await gltfpack(args, iface);
  } catch (err) {
    throw new Error(`gltfpack failed for ${input}\n${err instanceof Error ? err.message : String(err)}`);
  }
}
