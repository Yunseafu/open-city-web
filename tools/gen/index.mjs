#!/usr/bin/env node
// Procedural model generator.
//
//   node tools/gen/index.mjs [models|chunks|all] [--only id,id] [--radius N] [--no-pack] [--if-missing]
//
// models: tools/gen/assets/*.mjs -> public/models/<id>.glb + public/models/index.json
// chunks: city layout (tools/gen/city.mjs) -> public/chunks/<x>_<z>.glb (+ .json sidecar)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ModelBuilder } from "./lib/builder.mjs";
import { writeGlb } from "./lib/export.mjs";
import { pack } from "./lib/pack.mjs";
import { makeRng, hash } from "./lib/math.mjs";
import { loadAssets } from "./registry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rawDir = path.join(root, "tools/raw/gen");
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const target = args.find((a) => ["models", "chunks", "all"].includes(a)) ?? "all";

fs.mkdirSync(rawDir, { recursive: true });

async function genModels() {
  const outDir = path.join(root, "public/models");
  const only = opt("only", "")?.split(",").filter(Boolean);
  if (flag("if-missing") && fs.existsSync(path.join(outDir, "index.json"))) return;
  fs.mkdirSync(outDir, { recursive: true });
  const assets = (await loadAssets()).filter((a) => !only?.length || only.includes(a.id));
  let failed = 0;
  for (const a of assets) {
    // the base model is always emitted; a variant with suffix "" overrides its params/seed
    const variants = [...(a.variants ?? [])];
    if (!variants.some((v) => !v.suffix)) variants.unshift({ suffix: "" });
    for (const v of variants) {
      const id = a.id + (v.suffix ?? "");
      const b = new ModelBuilder();
      const rng = makeRng(v.seed ?? hash(id));
      a.build(b, rng, v.params ?? a.params ?? {});
      const raw = path.join(rawDir, `${id}.glb`);
      const stats = await writeGlb(b, raw, { name: id, extras: { id, category: a.category, budget: a.budget ?? null } });
      const out = path.join(outDir, `${id}.glb`);
      if (flag("no-pack")) fs.copyFileSync(raw, out);
      else pack(raw, out);
      const over = a.budget && stats.tris > a.budget;
      if (over) failed++;
      if (b.invertedTris || b.degenerateTris) {
        console.warn(`WARN ${id}: ${b.invertedTris} triangles face against their normals, ${b.degenerateTris} are degenerate`);
        if (b.invertedTris) failed++;
      }
      const entry = {
        id, category: a.category, tags: a.tags ?? [], tris: stats.tris, verts: stats.verts, budget: a.budget ?? null,
        bytes: fs.statSync(out).size, bounds: { min: stats.min.map(round), max: stats.max.map(round) },
        materials: stats.byMat, anchors: b.anchors.map((x) => x.name), colliders: b.colliders.length,
        clips: b.clips.map((c) => c.name),
      };
      fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(entry));
      console.log(`${over ? "OVER " : "ok   "} ${id.padEnd(34)} ${String(stats.tris).padStart(6)} tris${a.budget ? ` / ${a.budget}` : ""}  ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
    }
  }
  // index.json is rebuilt from the per-model metadata files, so partial runs (--only) never drop entries.
  const manifest = fs
    .readdirSync(outDir)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .map((f) => JSON.parse(fs.readFileSync(path.join(outDir, f), "utf8")))
    .filter((m) => fs.existsSync(path.join(outDir, `${m.id}.glb`)));
  manifest.sort((x, y) => x.category.localeCompare(y.category) || x.id.localeCompare(y.id));
  fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify({ models: manifest }, null, 1));
  if (failed) {
    console.error(`${failed} model(s) over their triangle budget`);
    process.exitCode = 1;
  }
}

const round = (n) => Math.round(n * 100) / 100;

if (target === "models" || target === "all") await genModels();
if (target === "chunks" || target === "all") {
  const city = await import("./city.mjs").catch(() => null);
  if (city) await city.genChunks({ root, rawDir, radius: Number(opt("radius", 2)), pack: !flag("no-pack"), ifMissing: flag("if-missing") });
  else console.log("no tools/gen/city.mjs yet, skipping chunks");
}
