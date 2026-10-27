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
   `public/textures/atlas/<material id>.json` (for example `mat_atlas_signs.json`):
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
| albedo, emissive, orm | ETC1S (Basis) | about 7x smaller than UASTC, fine for colour-like data |
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

<!-- catalog:start -->

53 materials, about 138 MB of VRAM (BC7 / ASTC at 1 byte per pixel plus mips) against the 350 MB texture budget.

| id | kind | tile (m) | px | maps | GPU MB | note |
|---|---|---|---|---|---|---|
| `mat_atlas_billboard` | atlas | atlas | 2048x2048 | albedo, orm, emissive | 16.0 | lit ad screens (invented brands); cells are 512x256, big ads span cells |
| `mat_atlas_decal` | atlas | atlas | 1024x1024 | albedo, normal, orm | 4.0 | alpha-blended road and wall decals; fills each cell so the quad shape sets the proportions |
| `mat_atlas_signs` | atlas | atlas | 2048x2048 | albedo, normal, orm, emissive | 21.3 | neon sign sprite sheet, 64 square cells; emissive carries colour + baked glow |
| `mat_char_cloth` | tiling | 0.25 | 256x256 | albedo, normal, orm | 0.3 | 2/2 twill weave, mid-grey so baseColor / vertex colour can tint it |
| `mat_char_leather` | tiling | 0.25 | 256x256 | albedo, normal, orm | 0.3 | fine pebbled leather grain, darker creases, uneven sheen |
| `mat_char_skin` | flat | - | - | - | - | no SSS in v1 |
| `mat_fabric_awning` | tiling | 1 | 512x512 | albedo, normal, orm | 1.0 | canvas awning, near-white so COLOR_0 tints it; plain weave with soft sag folds and grime |
| `mat_facade_curtainwall` | tiling | 12 x 7.2 | 2048x1024 | albedo, normal, orm, emissive | 10.7 | glass curtain wall: 1.5 m panes, spandrel band every 3.6 m, about 20% of the panes lit as offices |
| `mat_facade_shopfront` | tiling | 12 x 4.8 | 2048x1024 | albedo, normal, orm, emissive | 10.7 | ground storey: fascia with LED strip, shop windows / door / roller shutter, bulkhead; concrete slab edge at the tile seam |
| `mat_facade_windows_dark` | tiling | 12 x 7.2 | 2048x1024 | albedo, normal, orm, emissive | 10.7 | same grid as windows_lit, all dark except one standby glow and the odd LED; warmer, darker wall tone |
| `mat_facade_windows_lit` | tiling | 12 x 7.2 | 2048x1024 | albedo, normal, orm, emissive | 10.7 | grimy concrete tower, 4 bays x 2 storeys, about half the windows lit (blinds, curtains, silhouettes, TVs) |
| `mat_foliage_leaf` | flat | - | - | - | - |  |
| `mat_glass_dark` | tiling | 1 | 512x512 | albedo, orm | 0.7 | smoky dark window glass: clear where water ran, grimy smears elsewhere (alpha 0.5 clean .. 0.85 dirty) |
| `mat_ground_curb` | tiling | 2 x 0.5 | 1024x256 | albedo, normal, orm | 1.0 | kerb face 2 x 0.5 m: V=0 is the top arris (chipped), joint every 1 m, tyre scuffs low on the face |
| `mat_ground_sidewalk_tiles` | tiling | 2 | 1024x1024 | albedo, normal, orm | 4.0 | 0.5 m concrete pavers, 4x4 per tile; damp patches, gum, hairline cracks |
| `mat_light_warm` | flat | - | - | - | - | windows, lamps, street light heads |
| `mat_metal_container` | tiling | 2 | 1024x1024 | albedo, normal, orm | 4.0 | corrugated shipping-container steel, light neutral paint so COLOR_0 tints it; chipped to rust and bare steel at the crests |
| `mat_metal_galvanized` | tiling | 2 | 512x512 | albedo, normal, orm | 1.0 | hot-dip galvanized sheet: faceted zinc spangle crystals, dull oxidised patches, scuffs |
| `mat_metal_painted_dark` | tiling | 2 | 512x512 | albedo, normal, orm | 1.0 | charcoal / blue-black painted panel: orange peel, hairline scratches, chips down to bare steel |
| `mat_metal_plate_worn` | tiling | 2 | 1024x1024 | albedo, normal, orm | 4.0 | 0.5 m welded steel plates, corner bolts, dark paint worn to bare steel at edges |
| `mat_metal_rust` | tiling | 2 | 1024x1024 | albedo, normal, orm | 4.0 | heavy rust over dark scale: flaking grey-green paint, pitting, vertical streaks, scoured bare steel |
| `mat_neon_amber` | flat | - | - | - | - |  |
| `mat_neon_cyan` | flat | - | - | - | - | tube / sign glow |
| `mat_neon_green` | flat | - | - | - | - |  |
| `mat_neon_magenta` | flat | - | - | - | - |  |
| `mat_neon_purple` | flat | - | - | - | - |  |
| `mat_neon_red` | flat | - | - | - | - |  |
| `mat_neon_white` | flat | - | - | - | - | cold white |
| `mat_prop_bag` | flat | - | - | - | - | glossy black rubbish bags |
| `mat_prop_paint_green` | flat | - | - | - | - |  |
| `mat_prop_paint_orange` | flat | - | - | - | - |  |
| `mat_prop_paint_red` | flat | - | - | - | - | painted props: hydrants, barriers |
| `mat_prop_paint_yellow` | flat | - | - | - | - |  |
| `mat_prop_plastic` | tiling | 0.5 | 256x256 | albedo, normal, orm | 0.3 | light-grey moulded plastic with fine orange-peel texture and faint flow marks; tint with baseColor |
| `mat_prop_rubber` | tiling | 0.5 | 256x256 | albedo, normal, orm | 0.3 | matte black rubber: fine grain, a moulding parting line, sparse pits, dusty patches |
| `mat_prop_screen_blue` | flat | - | - | - | - | idle terminal / monitor glow |
| `mat_prop_wood` | tiling | 1 | 512x512 | albedo, normal, orm | 1.0 | weathered dark planks 12.5 cm wide running along U, grooves, knots, grime |
| `mat_road_asphalt` | tiling | 4 | 1024x1024 | albedo, normal, orm | 4.0 | dry city asphalt: aggregate, cracks, repair patches, oil stains |
| `mat_road_asphalt_wet` | tiling | 4 | 1024x1024 | albedo, normal, orm | 4.0 | rain-soaked asphalt: damp film everywhere, mirror puddles in the low spots (same layout as mat_road_asphalt) |
| `mat_road_crosswalk` | tiling | 2 | 512x512 | albedo, normal, orm | 1.0 | crosswalk bars: white paint with heavy tyre wear |
| `mat_road_marking_white` | tiling | 2 | 512x512 | albedo, normal, orm | 1.0 | worn white thermoplastic; U runs along the stripe |
| `mat_road_marking_yellow` | tiling | 2 | 512x512 | albedo, normal, orm | 1.0 | worn traffic-yellow thermoplastic; U runs along the stripe |
| `mat_roof_tar` | tiling | 4 | 1024x1024 | albedo, normal, orm | 4.0 | tar paper roof: 1 m rolls with lap seams, gravel patches, ponding stains |
| `mat_veh_chrome` | flat | - | - | - | - |  |
| `mat_veh_glass` | flat | - | - | - | - |  |
| `mat_veh_light_head` | flat | - | - | - | - |  |
| `mat_veh_light_tail` | flat | - | - | - | - |  |
| `mat_veh_paint` | flat | - | - | - | - | white base, tinted per vehicle with COLOR_0 |
| `mat_veh_tire` | flat | - | - | - | - |  |
| `mat_wall_brick_dirty` | tiling | 3 | 1024x1024 | albedo, normal, orm | 4.0 | dark brick, running bond (13 x 40 per tile), soot, spalls, painted-over patches |
| `mat_wall_concrete_dark` | tiling | 3 | 1024x1024 | albedo, normal, orm | 4.0 | dark board-formed concrete, 20 boards per 3 m, soot and damp streaks |
| `mat_wall_concrete_panel` | tiling | 4 | 1024x1024 | albedo, normal, orm | 4.0 | precast concrete panels 2 x 1 m, tie-bolt holes, rain streaks and efflorescence (V grows down the wall) |
| `mat_wall_metal_cladding` | tiling | 2 | 1024x1024 | albedo, normal, orm | 4.0 | vertical trapezoid-rib sheet cladding, grey-green paint, fastener rows with rust drips, worn crests |

### Atlas sprites

Rects are in `public/textures/atlas/<material id>.json`; use those, not the full cell. Sign art is drawn for a square quad, except `vertical_sign_*` (about 1:3, tall) and `wide_*` (about 3:1, wide), which are squeezed into the square cell and must be stretched back onto a quad of that proportion. Decal arrows are drawn for a 1:3 road quad.

**mat_atlas_billboard** (20 sprites; ratio shown when not square): `ad_solaris_hero` (2.02:1), `ad_novamed_wide` (4.10:1), `ad_zenkai_01` (2.03:1), `ad_vortex_01` (2.03:1), `ad_halcyon_tall` (0.50:1), `ad_neon_cola_wide` (4.10:1), `ad_neon_cola_can` (2.03:1), `ad_neon_cola_bubbles` (2.03:1), `ad_price_tag_01` (2.03:1), `ad_qr_01` (2.03:1), `ad_glitch_01` (2.03:1), `ad_hologirl_01` (2.03:1), `ad_aurum_bank_01` (2.03:1), `ad_kaisen_noodle_01` (2.03:1), `ad_chrome_clinic_01` (2.03:1), `ad_news_01` (2.03:1), `ad_zenkai_banner` (4.10:1), `ad_vortex_hero` (2.02:1), `ad_arcade_promo_01` (2.03:1), `ad_fizz0_promo_01` (2.03:1)

**mat_atlas_decal** (16 sprites; ratio shown when not square): `arrow_straight`, `arrow_left`, `arrow_right`, `arrow_left_straight`, `stop_line`, `text_stop`, `text_slow`, `bike_symbol`, `hazard_chevrons`, `graffiti_tag_1`, `graffiti_tag_2`, `poster_torn_1`, `poster_torn_2`, `stain_oil`, `manhole_cover`, `drain_grate`

**mat_atlas_signs** (64 sprites; ratio shown when not square): `ramen`, `noodles`, `sushi`, `izakaya`, `bar`, `hotel`, `open_24h`, `pharmacy`, `cyberware`, `clinic`, `arcade`, `karaoke`, `cafe`, `pizza`, `burger`, `taco`, `noodle_bar`, `vape`, `tattoo`, `pawn`, `hologram_girl`, `arrow_left`, `arrow_right`, `arrow_up`, `arrow_down`, `neon_cross`, `neon_star`, `neon_dragon`, `neon_koi`, `neon_katana`, `neon_skull`, `neon_eye`, `neon_heart`, `neon_lightning`, `neon_moon`, `glyph_1`, `glyph_2`, `glyph_3`, `glyph_4`, `glyph_5`, `glyph_6`, `glyph_7`, `glyph_8`, `vertical_sign_1`, `vertical_sign_2`, `vertical_sign_3`, `vertical_sign_4`, `vertical_sign_5`, `vertical_sign_6`, `hazard_stripes`, `warning_triangle`, `no_entry`, `wifi`, `battery`, `power`, `blank_dark`, `bank`, `wide_hotel`, `wide_ramen`, `wide_cyberware`, `drone_repair`, `wide_open_24h`, `exit`, `taxi`

<!-- catalog:end -->
