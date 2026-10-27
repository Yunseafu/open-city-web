#!/usr/bin/env node
// Regenerates the catalog tables in docs/materials.md from the built manifest and atlas layouts
// (between the <!-- catalog:start --> and <!-- catalog:end --> markers). Run after `npm run textures`.
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(root, "public/textures");
const DOC = path.join(root, "docs/materials.md");

const manifest = JSON.parse(await readFile(path.join(OUT, "materials.json"), "utf8"));
const gpu = (m) => Object.values(m.maps).reduce((a, r) => a + (r.size[0] * r.size[1] * 4) / 3 / 1048576, 0);
const rows = Object.entries(manifest.materials).map(([id, m]) => {
  const tile = Array.isArray(m.tileSizeM) ? m.tileSizeM.join(" x ") : (m.tileSizeM ?? (m.atlas ? "atlas" : "-"));
  const px = m.maps.albedo ? m.maps.albedo.size.join("x") : "-";
  const mb = gpu(m);
  return `| \`${id}\` | ${m.kind} | ${tile} | ${px} | ${Object.keys(m.maps).join(", ") || "-"} | ${mb ? mb.toFixed(1) : "-"} | ${m.note ?? ""} |`;
});
const total = Object.values(manifest.materials).reduce((a, m) => a + gpu(m), 0);

let md = `${Object.keys(manifest.materials).length} materials, about ${total.toFixed(0)} MB of VRAM (BC7 / ASTC at 1 byte per pixel plus mips) against the 350 MB texture budget.\n\n`;
md += "| id | kind | tile (m) | px | maps | GPU MB | note |\n|---|---|---|---|---|---|---|\n" + rows.join("\n") + "\n";

md += "\n### Atlas sprites\n\nRects are in `public/textures/atlas/<material id>.json`; use those, not the full cell. Sign art is drawn for a square quad, except `vertical_sign_*` (about 1:3, tall) and `wide_*` (about 3:1, wide), which are squeezed into the square cell and must be stretched back onto a quad of that proportion. Decal arrows are drawn for a 1:3 road quad.\n";
for (const f of (await readdir(path.join(OUT, "atlas"))).filter((f) => f.endsWith(".json")).sort()) {
  const { sprites } = JSON.parse(await readFile(path.join(OUT, "atlas", f), "utf8"));
  const names = Object.entries(sprites).map(([n, r]) => `\`${n}\`${Math.abs(r.w / r.h - 1) > 0.05 ? ` (${(r.w / r.h).toFixed(2)}:1)` : ""}`);
  md += `\n**${f.replace(".json", "")}** (${names.length} sprites; ratio shown when not square): ${names.join(", ")}\n`;
}

const doc = await readFile(DOC, "utf8");
const start = "<!-- catalog:start -->";
const end = "<!-- catalog:end -->";
const a = doc.indexOf(start);
const b = doc.indexOf(end);
if (a < 0 || b < 0) throw new Error("markers missing in docs/materials.md");
await writeFile(DOC, doc.slice(0, a + start.length) + "\n\n" + md + "\n" + doc.slice(b));
console.log(`updated ${path.relative(root, DOC)} (${rows.length} materials)`);
