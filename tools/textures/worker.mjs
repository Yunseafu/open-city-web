// Worker thread: build one tiling recipe or atlas, encode its maps to KTX2 and report the manifest entry.
import { parentPort } from "node:worker_threads";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { makeContext, finalizeMaps } from "./lib/recipe.mjs";
import { composeAtlas } from "./lib/atlas.mjs";
import { encodeKtx2, PROFILES } from "./lib/ktx2.mjs";
import { encodePng } from "./lib/png.mjs";

// The Basis wasm prints per-slice progress to stdout; results are reported via postMessage only.
process.stdout.write = () => true;

const scaleSize = (size, scale) => size.map((s) => Math.max(4, Math.round((s * scale) / 4) * 4));
const slugOf = (id) => id.replace(/^mat_/, "");
const MAP_ORDER = ["albedo", "normal", "orm", "emissive"];

async function writeMaps(id, maps, w, h, job, override = {}) {
  const refs = {};
  for (const name of MAP_ORDER) {
    const data = maps[name];
    if (!data) continue;
    const file = `${slugOf(id)}.${name}.ktx2`;
    const ktx = await encodeKtx2(name, data, w, h, override[name] ?? PROFILES[job.profile][name]);
    await writeFile(path.join(job.outDir, file), ktx);
    refs[name] = { url: file, size: [w, h] };
    if (job.pngDir) {
      await mkdir(job.pngDir, { recursive: true });
      await writeFile(path.join(job.pngDir, `${slugOf(id)}.${name}.png`), encodePng(w, h, 4, data));
    }
  }
  return refs;
}

async function buildTiling(job) {
  const mod = await import(pathToFileURL(job.file).href);
  const def = mod.recipes.find((r) => r.id === job.id);
  const size = scaleSize(def.size, job.scale);
  const ctx = makeContext({ id: def.id, size, tileSizeM: def.tileSizeM, seed: def.seed });
  const set = def.build(ctx);
  const fin = finalizeMaps(def, ctx, set);
  const maps = await writeMaps(def.id, fin, ctx.w, ctx.h, job, def.codec);
  return {
    entry: { kind: "tiling", tileSizeM: def.tileSizeM, maps, params: fin.params, ...(def.note ? { note: def.note } : {}) },
    warnings: fin.warnings,
  };
}

async function buildAtlas(job) {
  const mod = await import(pathToFileURL(job.file).href);
  const def = mod.atlases.find((a) => a.name === job.id);
  const size = scaleSize(def.size, job.scale);
  const scaled = { ...def, size, padPx: Math.max(1, Math.round((def.padPx ?? 4) * job.scale)) };
  const { maps, params, layout, warnings } = composeAtlas(scaled);
  const refs = await writeMaps(def.id, maps, size[0], size[1], job, def.codec);
  await mkdir(path.join(job.outDir, "atlas"), { recursive: true });
  await writeFile(path.join(job.outDir, "atlas", `${def.name}.json`), JSON.stringify(layout, null, 2) + "\n");
  return {
    entry: { kind: "atlas", atlas: def.name, maps: refs, params, ...(def.note ? { note: def.note } : {}) },
    id: def.id,
    warnings,
  };
}

parentPort.on("message", async (job) => {
  const t0 = Date.now();
  try {
    const res = job.kind === "atlas" ? await buildAtlas(job) : await buildTiling(job);
    parentPort.postMessage({ ok: true, key: job.key, ms: Date.now() - t0, ...res });
  } catch (err) {
    parentPort.postMessage({ ok: false, key: job.key, error: String(err?.stack ?? err) });
  }
});
