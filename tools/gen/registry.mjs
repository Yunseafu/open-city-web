// Discovers asset recipes in tools/gen/assets/*.mjs. Each module exports `assets`:
//
//   export const assets = [{
//     id: "prop_bollard_a",       // unique; becomes public/models/<id>.glb
//     category: "prop",           // building | road | prop | sign | vehicle | character
//     budget: 120,                // triangle budget; the generator fails when exceeded
//     build(b, rng, params) {},   // draws into a ModelBuilder; origin = ground centre, +Z = front
//     params: {},                 // optional: params used for the standalone model
//     variants: [{ suffix, seed, params }], // optional: extra standalone models (the base model is always emitted)
//     lot: {...},                 // buildings only, see docs/models.md
//   }];
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export async function loadAssets() {
  const dir = path.join(here, "assets");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mjs") && !f.startsWith("_")).sort();
  const all = [];
  const seen = new Set();
  for (const f of files) {
    const mod = await import(pathToFileURL(path.join(dir, f)).href);
    for (const a of mod.assets ?? []) {
      if (seen.has(a.id)) throw new Error(`duplicate asset id "${a.id}" (${f})`);
      seen.add(a.id);
      all.push({ ...a, source: f });
    }
  }
  return all;
}
