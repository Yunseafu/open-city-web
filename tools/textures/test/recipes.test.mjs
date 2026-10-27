// Every recipe must build at a tiny size, give seam-free tiling maps, and respect the manifest contract.
import test from "node:test";
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { makeContext, finalizeMaps } from "../lib/recipe.mjs";
import { atlasLayout, composeAtlas } from "../lib/atlas.mjs";
import { settings } from "../lib/noise.mjs";

// Tiny sizes: finer noise octaves legitimately fall above Nyquist there.
settings.strictNyquist = false;

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../recipes");
const ID_RE = /^mat_[a-z0-9]+(_[a-z0-9]+)+$/;
const files = (await readdir(dir)).filter((f) => f.endsWith(".mjs")).sort();
const ids = new Set();
const scaleSize = (size, s) => size.map((v) => Math.max(8, Math.round((v * s) / 4) * 4));

for (const f of files) {
  const mod = await import(pathToFileURL(path.join(dir, f)).href);

  for (const def of mod.recipes ?? []) {
    test(`${f}: ${def.id} builds, tiles and is deterministic`, () => {
      assert.match(def.id, ID_RE);
      assert.ok(!ids.has(def.id), "duplicate id");
      ids.add(def.id);
      assert.ok(def.tileSizeM, "tileSizeM missing");
      const size = scaleSize(def.size, 0.25);
      const run = () => {
        const ctx = makeContext({ id: def.id, size, tileSizeM: def.tileSizeM, seed: def.seed });
        return finalizeMaps(def, ctx, def.build(ctx));
      };
      const a = run();
      assert.deepEqual(a.warnings, [], a.warnings.join("; "));
      const b = run();
      assert.deepEqual(a.albedo, b.albedo, "albedo not deterministic");
      assert.ok(Array.isArray(a.params.baseColor) && a.params.baseColor.length === 3);
    });
  }

  for (const def of mod.atlases ?? []) {
    test(`${f}: atlas ${def.name} composes with unique sprites inside the grid`, () => {
      assert.match(def.id, ID_RE);
      assert.ok(!ids.has(def.id), "duplicate id");
      ids.add(def.id);
      const small = { ...def, size: scaleSize(def.size, 0.25), padPx: 1 };
      const { warnings } = composeAtlas(small);
      assert.deepEqual(warnings, []);
      const { sprites } = atlasLayout(def);
      assert.equal(Object.keys(sprites).length, def.sprites.length, "duplicate sprite names");
      for (const s of def.sprites) {
        const [c, r, cs = 1, rs = 1] = s.cell;
        assert.ok(c >= 0 && r >= 0 && c + cs <= def.grid.cols && r + rs <= def.grid.rows, `${s.name} outside grid`);
      }
    });
  }

  for (const def of mod.flat ?? []) {
    test(`${f}: flat ${def.id}`, () => {
      assert.match(def.id, ID_RE);
      assert.ok(!ids.has(def.id), "duplicate id");
      ids.add(def.id);
      assert.ok(def.params);
    });
  }
}
