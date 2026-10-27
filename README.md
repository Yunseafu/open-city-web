# Open City Web

Web open-world game: GTA-style story and multiplayer, cyberpunk look, runs in the
browser within a 1GB memory budget.

## Status: M1 skeleton

- Babylon.js + TypeScript + Vite
- `ChunkManager`: streams 128m chunks around the player, unloads with hysteresis,
  falls back to procedural placeholders when `public/chunks/<x>_<z>.glb` is missing
- `MemoryMonitor` + HUD: textures / geometry / JS heap against the budget; steps the
  quality tier down above 85% of the budget
- `tools/build-chunk.mjs`: gltfpack wrapper (edge-collapse simplify, meshopt, KTX2)

## Run

```bash
npm install
npm run dev     # WASD + mouse look
npm run build
```

## Runtime decoders

The meshopt and KTX2/Basis decoders are self-hosted: `npm run decoders` (also run by `predev` and
`prebuild`) writes them to `public/decoders/` (gitignored) from the npm packages, so the game never
loads anything from a CDN. `src/materials/decoders.ts` points Babylon at them.

## Materials preview

`npm run dev`, then open `/materials.html` for the material gallery (`?ids=a,b`, `?full=1`,
`?tier=low`, `?test=normal`, `?test=bind`). `npm run shots -- --page materials|normal|bind|game`
renders it headless with the preinstalled Playwright Chromium into `shots/`.

## Chunk pipeline

```bash
node tools/build-chunk.mjs tools/raw/0_0.glb public/chunks/0_0.glb --lod 0
```

Baked lightmaps are authored in the DCC tool and shipped as KTX2 textures inside each chunk GLB.

## Memory budget (MB)

textures 350, geometry 120, lightmaps 80, JS heap 100, plus WASM, audio and misc; 800 total, ~200 headroom.

## TODO (next milestones)

- M2: player controller, Rapier physics, weapons
- M3: Node/WebSocket server-authoritative multiplayer
- M4: data-driven quest and puzzle system
