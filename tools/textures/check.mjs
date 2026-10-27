#!/usr/bin/env node
// Sanity-check the built texture set: required ids present, files exist, every KTX2 header matches the
// manifest, and the GPU memory estimate against the 350 MB texture budget. Exit code 1 on any failure.
//   node tools/textures/check.mjs [--budget 350] [--markdown]   (--markdown prints the catalog table for docs/materials.md)
import { open, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../../public/textures");
const argv = process.argv.slice(2);
const budget = Number(argv.includes("--budget") ? argv[argv.indexOf("--budget") + 1] : 350);

const manifest = JSON.parse(await readFile(path.join(OUT, "materials.json"), "utf8"));
const required = JSON.parse(await readFile(path.join(here, "required-ids.json"), "utf8")).ids;
const problems = [];

for (const id of required) if (!manifest.materials[id]) problems.push(`missing material ${id}`);

const KTX2_MAGIC = Buffer.from([0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a]);
const rows = [];
const catalog = [];
let gpuMB = 0;
let diskMB = 0;
for (const [id, mat] of Object.entries(manifest.materials)) {
  let mb = 0;
  for (const [name, ref] of Object.entries(mat.maps)) {
    const file = path.join(OUT, ref.url);
    let fh;
    try {
      fh = await open(file);
    } catch {
      problems.push(`${id}.${name}: ${ref.url} missing`);
      continue;
    }
    const head = Buffer.alloc(32);
    await fh.read(head, 0, 32, 0);
    const size = (await fh.stat()).size;
    await fh.close();
    diskMB += size / 1048576;
    if (!head.subarray(0, 12).equals(KTX2_MAGIC)) problems.push(`${ref.url}: not a KTX2 file`);
    const w = head.readUInt32LE(20);
    const h = head.readUInt32LE(24);
    if (w !== ref.size[0] || h !== ref.size[1]) problems.push(`${ref.url}: header ${w}x${h} != manifest ${ref.size.join("x")}`);
    mb += (ref.size[0] * ref.size[1] * 4) / 3 / 1048576 * 1; // 1 byte/px * 4/3 for the mip chain
  }
  if (mat.kind === "atlas" && !mat.atlas) problems.push(`${id}: atlas material without atlas name`);
  gpuMB += mb;
  rows.push([id, mat.kind, Object.keys(mat.maps).join("+") || "-", mb]);
  const tile = Array.isArray(mat.tileSizeM) ? mat.tileSizeM.join(" x ") : (mat.tileSizeM ?? (mat.atlas ? `atlas ${mat.atlas}` : "-"));
  const px = mat.maps.albedo ? mat.maps.albedo.size.join("x") : "-";
  catalog.push(`| \`${id}\` | ${mat.kind} | ${tile} | ${px} | ${Object.keys(mat.maps).join(", ") || "-"} | ${mb ? mb.toFixed(1) : "-"} | ${mat.note ?? ""} |`);
}

if (argv.includes("--markdown")) {
  console.log("| id | kind | tile (m) | px | maps | GPU MB | note |\n|---|---|---|---|---|---|---|");
  console.log(catalog.join("\n"));
  process.exit(0);
}
rows.sort((a, b) => b[3] - a[3]);
console.log("material".padEnd(30), "kind".padEnd(8), "maps".padEnd(32), "GPU MB");
for (const [id, kind, maps, mb] of rows) if (mb > 0) console.log(id.padEnd(30), kind.padEnd(8), maps.padEnd(32), mb.toFixed(1));
console.log(`\n${rows.length} materials, ${gpuMB.toFixed(1)} MB GPU (BC7/ASTC 1 byte/px + mips), ${diskMB.toFixed(1)} MB on disk, budget ${budget} MB`);
if (gpuMB > budget) problems.push(`texture budget exceeded: ${gpuMB.toFixed(0)} > ${budget} MB`);

if (problems.length) {
  console.error("\nproblems:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log("ok");
