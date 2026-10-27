import test from "node:test";
import assert from "node:assert/strict";
import { Field } from "../lib/field.mjs";
import { perlin, fbm, worley } from "../lib/noise.mjs";
import { seamRatio, makeContext, finalizeMaps } from "../lib/recipe.mjs";
import { heightToNormal } from "../lib/maps.mjs";
import { Rgb } from "../lib/color.mjs";
import { disc } from "../lib/draw.mjs";
import { atlasLayout, composeAtlas } from "../lib/atlas.mjs";

test("noise tiles seamlessly on non-square sizes", () => {
  for (const f of [perlin(256, 128, 5, 3, 1), fbm(256, 128, { fx: 4, fy: 2, seed: 2 }), worley(256, 128, 12, 6, 3).f1]) {
    const [sx, sy] = seamRatio(f);
    assert.ok(sx < 2 && sy < 2, `seam ratio ${sx.toFixed(2)} ${sy.toFixed(2)}`);
  }
});

test("shapes wrap around the tile edge", () => {
  const f = new Field(64, 64);
  disc(f, 2, 32, 6, 1);
  assert.ok(f.at(62, 32) > 0.9, "disc centred near the left edge shows up on the right edge");
});

test("normal map follows the glTF convention (+X right, +Y image-up)", () => {
  const h = Field.from(64, 64, (x, y) => Math.exp(-((x - 32) ** 2 + (y - 32) ** 2) / 200));
  const n = heightToNormal(h, { depthM: 0.5, sizeM: [1, 1] });
  const px = (x, y) => [n[(y * 64 + x) * 4], n[(y * 64 + x) * 4 + 1], n[(y * 64 + x) * 4 + 2]];
  assert.ok(px(22, 32)[0] < 120, "left flank of a bump leans left (-X)");
  assert.ok(px(42, 32)[0] > 136, "right flank leans right (+X)");
  assert.ok(px(32, 22)[1] > 136, "upper flank (smaller row) leans image-up (+Y)");
  assert.ok(px(32, 42)[1] < 120, "lower flank leans down (-Y)");
  assert.ok(px(32, 32)[2] > 250, "peak points straight out");
});

test("constant roughness/metal/ao produce no ORM texture; fields do", () => {
  const ctx = makeContext({ id: "mat_test_flat", size: [16, 16], tileSizeM: 1 });
  const albedo = Rgb.filled(16, 16, [0.5, 0.5, 0.5]);
  const flat = finalizeMaps({ id: "mat_test_flat", params: {} }, ctx, { albedo, roughness: 0.4, metallic: 0 });
  assert.equal(flat.orm, undefined);
  assert.equal(flat.params.roughness, 0.4);
  assert.equal(flat.normal, undefined);
  const varied = finalizeMaps({ id: "mat_test_flat", params: {} }, ctx, { albedo, roughness: Field.filled(16, 16, 0.5) });
  assert.equal(varied.orm.length, 16 * 16 * 4);
  assert.equal(varied.orm[1], 128);
});

test("blend materials must provide alpha", () => {
  const ctx = makeContext({ id: "mat_test_glass", size: [8, 8] });
  assert.throws(() => finalizeMaps({ id: "mat_test_glass", params: { alphaMode: "blend" } }, ctx, { albedo: Rgb.filled(8, 8, [0, 0, 0]) }), /alpha/);
});

test("atlas layout rects are inside the atlas, inside their cell and never overlap", () => {
  const def = {
    id: "mat_atlas_test",
    name: "test",
    size: [256, 256],
    grid: { cols: 4, rows: 4 },
    padPx: 4,
    params: {},
    sprites: [
      { name: "a", cell: [0, 0], draw: () => null },
      { name: "b", cell: [1, 0, 2, 1], draw: () => null },
      { name: "c", cell: [0, 1, 1, 2], draw: () => null },
    ],
  };
  const { sprites } = atlasLayout(def);
  const rects = Object.entries(sprites);
  for (const [name, r] of rects) {
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1 && r.y + r.h <= 1, `${name} inside atlas`);
  }
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const [, a] = rects[i];
      const [, b] = rects[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!overlap, `${rects[i][0]} overlaps ${rects[j][0]}`);
    }
  }
  assert.equal(sprites.a.x, 4 / 256);
  assert.equal(sprites.b.w, (128 - 8) / 256);
});

test("atlas gutters are extruded from the sprite edge", () => {
  const def = {
    id: "mat_atlas_test",
    name: "test",
    size: [64, 64],
    grid: { cols: 2, rows: 2 },
    padPx: 4,
    params: {},
    sprites: [{ name: "red", cell: [0, 0], draw: (ctx) => ({ albedo: Rgb.filled(ctx.w, ctx.h, [1, 0, 0]), roughness: 0.5 }) }],
  };
  const { maps } = composeAtlas(def);
  assert.deepEqual([...maps.albedo.subarray(0, 4)], [255, 0, 0, 255], "gutter pixel (0,0) copies the sprite edge");
  const outside = (40 * 64 + 40) * 4;
  assert.deepEqual([...maps.albedo.subarray(outside, outside + 3)], [0, 0, 0], "unused cell stays dark");
});

test("the same recipe seed gives identical output", () => {
  const a = fbm(64, 64, { fx: 3, fy: 3, seed: 7 });
  const b = fbm(64, 64, { fx: 3, fy: 3, seed: 7 });
  assert.deepEqual(a.data, b.data);
});
