# Materials and textures

How surfaces get their look in Open City Web, and the contract between the models pipeline (GLB
authoring) and the texture pipeline. Models side: `docs/models.md`.

All textures are generated procedurally at build time, compressed to KTX2 (Basis Universal) and shared
by every chunk. Nothing binary is committed; the whole set is reproducible from `tools/textures/recipes`.

## Contract for GLB authors

1. **Material name = library id.** Every glTF `material.name` is `mat_<category>_<name>` (lowercase,
   underscores), one of the ids in the catalog below. At load time `MaterialLibrary.bindContainer()`
   swaps the GLB material for the shared library material of the same name. Unknown `mat_*` ids keep
   the GLB's own fallback material and log one warning.
2. **No textures inside GLBs.** Only the material name and the fallback factors (`baseColorFactor`,
   `metallicFactor`, `roughnessFactor`, `emissiveFactor`) so a mesh still looks right when textures are
   missing. Textures are global and shared; embedding them would duplicate memory per chunk.
3. **UV0 is in metres** for tiling materials: 1.0 = 1 m in the world. The library scales by
   `1 / tileSizeM` (number, or `[width, height]` for facades). Do not unwrap to 0..1. UV origin is
   top-left (glTF).
4. **UV1 (`TEXCOORD_1`)** is reserved for baked lightmaps (unique, non-overlapping, 0..1 per mesh).
   Meshes without baked light simply omit it.
5. **Atlas materials** (`mat_atlas_*`: signs, billboards, decals) use UV0 in 0..1 atlas space, already
   pointing into the sprite's rectangle, because `gltfpack -mm` merges meshes that share a material and
   the runtime cannot remap UVs per mesh afterwards. Rectangles come from
   `public/textures/atlas/<name>.json`:
   `{ "sprites": { "ramen": { "x": 0.0156, "y": 0.0156, "w": 0.1094, "h": 0.1094 } } }`
   in UV space, top-left origin. `x, y, w, h` is the **content** rectangle; the 4 px around it is a
   gutter that keeps mip levels from bleeding between sprites, so do not use the full cell.
6. **No TANGENT attribute.** The runtime derives the tangent frame from screen-space derivatives,
   which saves vertex memory.
7. **`COLOR_0`** is honoured as a multiplier on base colour: baked vertex AO near the ground on
   buildings, and the per-vehicle tint on `mat_veh_paint` (which is white).
8. Facade tiles: `mat_facade_*` tile `[12, 7.2]` m (4 bays of 3.0 m by 2 storeys of 3.6 m);
   `mat_facade_shopfront` tiles `[12, 4.8]` m (ground-floor storey). Align geometry to these modules.

## Texture conventions

| map | content | colour space |
|---|---|---|
| albedo | base colour (+ alpha for `blend` / `mask` materials) | sRGB |
| normal | tangent-space, glTF/OpenGL (+X right, +Y up), RGB | linear |
| orm | R = ambient occlusion, G = roughness, B = metallic | linear |
| emissive | emitted colour; HDR scale is `params.emissiveIntensity` | sRGB |

Materials without maps (`kind: "flat"`: neon, chrome, tyres, ...) are pure parameters. When the
textures have not been built, every material still renders from its flat parameters.

Material parameters (`src/materials/manifest.ts`, `PbrParams`) multiply the maps: `roughness` and
`metallic` scale ORM.g / ORM.b, `baseColor` scales albedo, `emissiveColor * emissiveIntensity` scales
the emissive map.

## Build

```bash
npm run textures                        # all recipes -> public/textures (cached by content hash)
node tools/textures/build.mjs --scale 0.5          # half-size smoke build
node tools/textures/build.mjs --only mat_road_asphalt
node tools/textures/build.mjs --profile quality    # all-UASTC for inspection
npm run textures:check                  # required ids, KTX2 headers, memory budget
npm test                                # generator unit tests + every recipe at tiny size
```

`npm run dev` builds missing textures once and copies the decoders; `npm run build` always runs the
texture build first. Outputs (`public/textures/*.ktx2`, `materials.json`) are git-ignored; the atlas
layouts in `public/textures/atlas/*.json` are committed so the models tools can read them without
running the build.

### Compression

| map | codec | why |
|---|---|---|
| albedo, emissive, orm | ETC1S (Basis), Zstd not needed | about 7x smaller than UASTC, fine for colour-like data |
| normal | UASTC LDR 4x4 + Zstd | ETC1S blocks up normal maps |

Both transcode on the client to BC7 / ASTC / ETC2 depending on the GPU, 1 byte per pixel in VRAM
plus about a third for mips. A recipe can override a map with `codec: { emissive: "uastc" }`.
Measured on a 1024x1024 asphalt map: ETC1S 150-200 KB and 2 s, UASTC 1.0-1.3 MB and 1-4 s.

## Adding a material

Create or extend a file in `tools/textures/recipes/` and export `recipes` (tiling), `atlases` or
`flat`. The contract is documented at the top of `tools/textures/lib/recipe.mjs` and
`tools/textures/lib/atlas.mjs`; `recipes/road.mjs` is a worked example. Iterate with

```bash
node tools/textures/preview.mjs mat_road_asphalt_wet --scale 0.5
```

which writes `.cache/textures/preview/<id>/sheet.png` (albedo | normal | ORM | CPU-shaded tile) and
warns about visible tiling seams. Features are placed in metres (`ctx.cycles(m)`, `ctx.px(m)`), so a
recipe looks the same at any resolution. Never use `Math.random()`; recipes are deterministic.

## Preview in the browser

`materials.html` (dev server: `/materials.html`) shows every material on a sphere and a tile plane
under the procedural night environment, plus a lit normal-map self-test.
`npm run shots -- --page materials` saves a headless-Chromium screenshot to `shots/`.

## Catalog

CATALOG_PLACEHOLDER
