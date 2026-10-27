#!/usr/bin/env node
// Fast recipe iteration without KTX2 encoding: renders one or more materials to PNG so you can look at them.
//   node tools/textures/preview.mjs mat_road_asphalt [mat_other ...] [--scale 0.5] [--tiles 2]
//   node tools/textures/preview.mjs --atlas signs
// Output (.cache/textures/preview/<id>/): albedo.png normal.png orm.png emissive.png shaded.png sheet.png
//   shaded.png  CPU-lit tile repeated --tiles x --tiles times, shows seams, relief and reflections
//   sheet.png   albedo | normal | orm (R=AO G=rough B=metal) | shaded, one image to look at
// Warnings from the seam / sanity checks are printed.
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeContext, finalizeMaps } from "./lib/recipe.mjs";
import { composeAtlas } from "./lib/atlas.mjs";
import { encodePng } from "./lib/png.mjs";
import { shadePreview } from "./lib/shade.mjs";
import { settings } from "./lib/noise.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const argv = process.argv.slice(2);
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const scale = Number(opt("scale", 1));
if (scale < 1) settings.strictNyquist = false;
const tiles = Number(opt("tiles", 2));
const atlasName = opt("atlas");
const ids = argv.filter((a, i) => !a.startsWith("--") && !(argv[i - 1] ?? "").startsWith("--"));

const scaleSize = (size) => size.map((s) => Math.max(4, Math.round((s * scale) / 4) * 4));

async function allModules() {
  const dir = path.join(here, "recipes");
  const mods = [];
  for (const f of (await readdir(dir)).filter((f) => f.endsWith(".mjs")).sort()) mods.push(await import(pathToFileURL(path.join(dir, f)).href));
  return mods;
}

/** Nearest-neighbour resize of an RGBA image to a target height (keeps aspect), for the contact sheet. */
function fit(img, targetH) {
  const s = targetH / img.h;
  const w = Math.max(1, Math.round(img.w * s));
  const out = new Uint8Array(w * targetH * 4);
  for (let y = 0; y < targetH; y++) {
    const sy = Math.min(img.h - 1, Math.floor(y / s));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(img.w - 1, Math.floor(x / s));
      const i = (sy * img.w + sx) * 4;
      out.set(img.data.subarray(i, i + 4), (y * w + x) * 4);
    }
  }
  return { w, h: targetH, data: out };
}

function sheet(panels, gap = 6) {
  const h = Math.max(...panels.map((p) => p.h));
  const w = panels.reduce((a, p) => a + p.w, 0) + gap * (panels.length - 1);
  const out = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) out.set([20, 20, 24, 255], i * 4);
  let x0 = 0;
  for (const p of panels) {
    for (let y = 0; y < p.h; y++) out.set(p.data.subarray(y * p.w * 4, (y + 1) * p.w * 4), (y * w + x0) * 4);
    x0 += p.w + gap;
  }
  return { w, h, data: out };
}

const asImg = (w, h, data) => ({ w, h, data });
function opaque(data) {
  const o = data.slice();
  for (let i = 3; i < o.length; i += 4) o[i] = 255;
  return o;
}

async function save(dir, name, img) {
  await writeFile(path.join(dir, name), encodePng(img.w, img.h, 4, img.data));
}

async function previewTiling(def) {
  const size = scaleSize(def.size);
  const ctx = makeContext({ id: def.id, size, tileSizeM: def.tileSizeM, seed: def.seed });
  const t0 = Date.now();
  const set = def.build(ctx);
  const fin = finalizeMaps(def, ctx, set);
  const dir = path.join(root, ".cache/textures/preview", def.id);
  await mkdir(dir, { recursive: true });
  const { w, h } = fin;
  const albedo = asImg(w, h, opaque(fin.albedo));
  await save(dir, "albedo.png", albedo);
  const panels = [albedo];
  if (fin.normal) {
    const n = asImg(w, h, fin.normal);
    await save(dir, "normal.png", n);
    panels.push(n);
  }
  if (fin.orm) {
    const o = asImg(w, h, fin.orm);
    await save(dir, "orm.png", o);
    panels.push(o);
  }
  if (fin.emissive) await save(dir, "emissive.png", asImg(w, h, fin.emissive));
  const shaded = shadePreview({ ...fin }, { tiles });
  await save(dir, "shaded.png", shaded);
  const H = 512;
  await save(dir, "sheet.png", sheet([...panels.map((p) => fit(p, H)), fit(shaded, H)]));
  const dens = `${(w / ctx.sizeM[0]).toFixed(0)}x${(h / ctx.sizeM[1]).toFixed(0)} px/m`;
  console.log(`${def.id}  ${w}x${h}  ${dens}  ${Date.now() - t0}ms  -> ${path.relative(root, dir)}/sheet.png`);
  for (const wn of fin.warnings) console.log(`  ! ${wn}`);
}

async function previewAtlas(def) {
  const size = scaleSize(def.size);
  const scaled = { ...def, size, padPx: Math.max(1, Math.round((def.padPx ?? 4) * scale)) };
  const t0 = Date.now();
  const { maps, layout, warnings } = composeAtlas(scaled);
  const dir = path.join(root, ".cache/textures/preview", def.id);
  await mkdir(dir, { recursive: true });
  for (const [name, data] of Object.entries(maps)) await save(dir, `${name}.png`, asImg(size[0], size[1], name === "albedo" ? opaque(data) : data));
  await writeFile(path.join(dir, "layout.json"), JSON.stringify(layout, null, 2));
  console.log(`${def.id}  atlas ${size[0]}x${size[1]}  ${Object.keys(layout.sprites).length} sprites  ${Date.now() - t0}ms  -> ${path.relative(root, dir)}/`);
  for (const wn of warnings) console.log(`  ! ${wn}`);
}

const mods = await allModules();
let n = 0;
if (atlasName) {
  for (const m of mods) for (const a of m.atlases ?? []) if (a.name === atlasName || a.id === atlasName) (await previewAtlas(a), n++);
} else {
  for (const m of mods) for (const r of m.recipes ?? []) if (ids.length === 0 || ids.includes(r.id)) (await previewTiling(r), n++);
}
if (n === 0) {
  console.error("nothing matched; known ids:", mods.flatMap((m) => [...(m.recipes ?? []).map((r) => r.id), ...(m.atlases ?? []).map((a) => `atlas:${a.name}`)]).join(" "));
  process.exit(1);
}
