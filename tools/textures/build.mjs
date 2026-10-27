#!/usr/bin/env node
// Procedural PBR texture build.
//   recipes/*.mjs  ->  public/textures/<id>.<map>.ktx2, public/textures/materials.json,
//                      public/textures/atlas/<name>.json
//
// Usage: node tools/textures/build.mjs [--only mat_a,mat_b] [--scale 0.5] [--force] [--if-missing]
//                                      [--png] [--jobs N]
//   --only        build just these ids (atlas: use the atlas name); others are kept from cache
//   --scale       multiply every texture size (0.25 for a quick smoke test; sizes stay multiples of 4)
//   --force       ignore the cache
//   --if-missing  do nothing when public/textures/materials.json already exists (used by `npm run dev`)
//   --profile     web (default: ETC1S colour maps, UASTC normals) | quality (all UASTC)
//   --png         also write debug PNGs of every map to .cache/textures/png
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const OUT = path.join(root, "public/textures");
const CACHE = path.join(root, ".cache/textures");
const ID_RE = /^mat_[a-z0-9]+(_[a-z0-9]+)+$/;

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const only = opt("only") ? new Set(opt("only").split(",")) : null;
const scale = Number(opt("scale", 1));
const force = flag("force");
const profile = opt("profile", "web");
const jobsN = Number(opt("jobs", Math.min(4, os.cpus().length)));

if (flag("if-missing") && existsSync(path.join(OUT, "materials.json"))) {
  console.log("[textures] materials.json exists, skipping (use `npm run textures` to rebuild)");
  process.exit(0);
}

const sha = (...parts) => {
  const h = createHash("sha1");
  for (const p of parts) h.update(p);
  return h.digest("hex");
};

async function readDir(dir, ext) {
  return (await readdir(dir)).filter((f) => f.endsWith(ext)).sort();
}

// Everything the output depends on except the recipe file itself.
async function libHash() {
  const files = [
    ...(await readDir(path.join(here, "lib"), ".mjs")).map((f) => path.join(here, "lib", f)),
    path.join(here, "worker.mjs"),
  ];
  const pkg = JSON.parse(await readFile(path.join(root, "node_modules/ktx2-encoder/package.json"), "utf8"));
  return sha(pkg.version, ...(await Promise.all(files.map((f) => readFile(f)))));
}

async function loadRecipes() {
  const dir = path.join(here, "recipes");
  const found = { tiling: [], atlas: [], flat: [] };
  for (const f of await readDir(dir, ".mjs")) {
    const file = path.join(dir, f);
    const mod = await import(pathToFileURL(file).href);
    const text = await readFile(file);
    for (const r of mod.recipes ?? []) found.tiling.push({ file, text, def: r });
    for (const a of mod.atlases ?? []) found.atlas.push({ file, text, def: a });
    for (const m of mod.flat ?? []) found.flat.push({ file, def: m });
  }
  const ids = new Set();
  const claim = (id) => {
    if (!ID_RE.test(id)) throw new Error(`bad material id "${id}" (want mat_<category>_<name>, lowercase)`);
    if (ids.has(id)) throw new Error(`duplicate material id ${id}`);
    ids.add(id);
  };
  found.tiling.forEach((r) => claim(r.def.id));
  found.atlas.forEach((a) => claim(a.def.id));
  found.flat.forEach((m) => claim(m.def.id));
  return found;
}

class Pool {
  constructor(n) {
    this.idle = [];
    this.queue = [];
    for (let i = 0; i < n; i++) this.idle.push(new Worker(path.join(here, "worker.mjs")));
    this.all = [...this.idle];
  }
  run(job) {
    return new Promise((resolve) => {
      this.queue.push({ job, resolve });
      this.pump();
    });
  }
  pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop();
      const { job, resolve } = this.queue.shift();
      const onMsg = (msg) => {
        w.off("message", onMsg);
        w.off("error", onErr);
        this.idle.push(w);
        resolve(msg);
        this.pump();
      };
      const onErr = (err) => {
        w.off("message", onMsg);
        resolve({ ok: false, key: job.key, error: String(err?.stack ?? err) });
      };
      w.on("message", onMsg);
      w.on("error", onErr);
      w.postMessage(job);
    }
  }
  close() {
    return Promise.all(this.all.map((w) => w.terminate()));
  }
}

async function main() {
  const t0 = Date.now();
  await mkdir(OUT, { recursive: true });
  await mkdir(path.join(CACHE, "meta"), { recursive: true });
  const lib = await libHash();
  const found = await loadRecipes();

  const entries = {}; // id -> manifest entry
  const todo = [];
  const consider = async (kind, key, id, file, text, extraCheck) => {
    const metaFile = path.join(CACHE, "meta", `${key}.json`);
    const hash = sha(lib, text, String(scale), profile);
    let meta = null;
    try {
      meta = JSON.parse(await readFile(metaFile, "utf8"));
    } catch {}
    const selected = !only || only.has(id) || only.has(key);
    const fresh = meta?.hash === hash && Object.values(meta.entry.maps).every((m) => existsSync(path.join(OUT, m.url))) && (!extraCheck || extraCheck());
    if (fresh && (!force || !selected)) {
      entries[id] = meta.entry;
    } else if (selected) {
      todo.push({ kind, key, id: kind === "atlas" ? key : id, outId: id, file, hash, metaFile });
    } else if (meta) {
      entries[id] = meta.entry; // not selected, stale: keep what we have
    }
  };

  for (const r of found.tiling) await consider("tiling", r.def.id, r.def.id, r.file, r.text);
  for (const a of found.atlas) {
    await consider("atlas", a.def.name, a.def.id, a.file, a.text, () => existsSync(path.join(OUT, "atlas", `${a.def.name}.json`)));
  }

  let failed = 0;
  if (todo.length) {
    console.log(`[textures] building ${todo.length} of ${found.tiling.length + found.atlas.length} (scale ${scale}, ${jobsN} workers)`);
    const pool = new Pool(Math.min(jobsN, todo.length));
    await Promise.all(
      todo.map((j) =>
        pool.run({ ...j, outDir: OUT, scale, profile, pngDir: flag("png") ? path.join(CACHE, "png") : null }).then(async (res) => {
          if (!res.ok) {
            failed++;
            console.error(`[textures] FAILED ${j.outId}\n${res.error}`);
            return;
          }
          entries[j.outId] = res.entry;
          await writeFile(j.metaFile, JSON.stringify({ hash: j.hash, entry: res.entry }));
          const w = res.warnings.length ? `  ! ${res.warnings.join("; ")}` : "";
          console.log(`[textures] ${j.outId.padEnd(30)} ${(res.ms / 1000).toFixed(1)}s${w}`);
        }),
      ),
    );
    await pool.close();
  } else {
    console.log("[textures] everything up to date");
  }

  for (const m of found.flat) {
    entries[m.def.id] = { kind: "flat", maps: {}, params: { baseColor: [1, 1, 1], metallic: 0, roughness: 0.5, ...m.def.params }, ...(m.def.note ? { note: m.def.note } : {}) };
  }

  const materials = Object.fromEntries(Object.keys(entries).sort().map((k) => [k, entries[k]]));
  await writeFile(path.join(OUT, "materials.json"), JSON.stringify({ version: 1, materials }, null, 2) + "\n");

  let bytes = 0;
  let texels = 0;
  for (const e of Object.values(materials)) {
    for (const m of Object.values(e.maps)) {
      try {
        bytes += (await readFile(path.join(OUT, m.url))).length;
      } catch {}
      texels += m.size[0] * m.size[1];
    }
  }
  console.log(
    `[textures] ${Object.keys(materials).length} materials, ${(bytes / 1048576).toFixed(1)} MB on disk, ~${((texels * 1.333) / 1048576).toFixed(0)} MB GPU (1 byte/px + mips), ${((Date.now() - t0) / 1000).toFixed(0)}s`,
  );
  if (failed) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
