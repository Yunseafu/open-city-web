#!/usr/bin/env node
// Self-host the runtime decoders so the game never touches a CDN:
//   public/decoders/meshopt_decoder.js        classic script defining the global `MeshoptDecoder`
//   public/decoders/babylon.ktx2Decoder.js    classic script defining the global `KTX2DECODER`
//   public/decoders/ktx2/*                    Basis/UASTC transcoder wasm, the MSC transcoder, zstddec.wasm
// Idempotent: skipped when the stamp (package versions) matches and all outputs exist.
import { createRequire } from "node:module";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "decoders");

const ktx2Dir = join(root, "node_modules", "@babylonjs", "ktx2decoder");
const meshoptDir = join(root, "node_modules", "meshoptimizer");
const zstdDir = join(root, "node_modules", "zstddec");
const version = (dir) => JSON.parse(readFileSync(join(dir, "package.json"), "utf8")).version;
const stamp = `ktx2decoder ${version(ktx2Dir)}\nmeshoptimizer ${version(meshoptDir)}\nzstddec ${version(zstdDir)}\n`;

const wasmFiles = [
  "uastc_astc.wasm",
  "uastc_bc7.wasm",
  "uastc_r8_unorm.wasm",
  "uastc_rg8_unorm.wasm",
  "uastc_rgba8_srgb_v2.wasm",
  "uastc_rgba8_unorm_v2.wasm",
  "msc_basis_transcoder.js",
  "msc_basis_transcoder.wasm",
];
const outputs = [
  join(out, "meshopt_decoder.js"),
  join(out, "babylon.ktx2Decoder.js"),
  ...wasmFiles.map((f) => join(out, "ktx2", f)),
  join(out, "ktx2", "zstddec.wasm"),
];
const stampFile = join(out, ".stamp");

if (existsSync(stampFile) && readFileSync(stampFile, "utf8") === stamp && outputs.every(existsSync)) {
  console.log("[decoders] up to date");
  process.exit(0);
}

mkdirSync(join(out, "ktx2"), { recursive: true });

// meshoptimizer ships an ES module; Babylon expects a classic script with a global.
const mjs = readFileSync(join(meshoptDir, "meshopt_decoder.mjs"), "utf8");
const classic = mjs.replace(/\nexport \{ MeshoptDecoder \};\s*$/, "\n");
if (classic === mjs) throw new Error("meshopt_decoder.mjs: expected trailing `export { MeshoptDecoder };`");
writeFileSync(join(out, "meshopt_decoder.js"), classic);

// @babylonjs/ktx2decoder is ES modules only. The workers importScripts() one file that sets the
// global KTX2DECODER, so bundle it. Not minified: it has no heavy code besides the wasm blobs.
const { buildSync } = require("esbuild");
buildSync({
  entryPoints: [join(ktx2Dir, "index.js")],
  bundle: true,
  format: "iife",
  globalName: "KTX2DECODER",
  outfile: join(out, "babylon.ktx2Decoder.js"),
  logLevel: "warning",
});

for (const f of wasmFiles) copyFileSync(join(ktx2Dir, "wasm", f), join(out, "ktx2", f));

// Babylon fetches zstddec.wasm from its CDN for Zstandard-supercompressed KTX2 (UASTC + zstd). The
// zstddec package (same exports and imports) embeds that module as base64; unpack it.
const zstdSrc = readFileSync(join(zstdDir, "dist", "zstddec.mjs"), "utf8");
const zstdB64 = /const wasm = "([A-Za-z0-9+/=]+)"/.exec(zstdSrc)?.[1];
if (!zstdB64) throw new Error("zstddec.mjs: embedded wasm not found");
writeFileSync(join(out, "ktx2", "zstddec.wasm"), Buffer.from(zstdB64, "base64"));
writeFileSync(stampFile, stamp);
console.log(`[decoders] wrote ${outputs.length} files to public/decoders`);
