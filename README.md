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

## Chunk pipeline

```bash
node tools/build-chunk.mjs tools/raw/0_0.glb public/chunks/0_0.glb --lod 0
```

Baked lightmaps are authored in the DCC tool and shipped as KTX2 textures inside each chunk GLB.

## Memory budget (MB)

textures 350, geometry 120, lightmaps 80, JS heap 100, plus WASM, audio and misc; 800 total, ~200 headroom.

## TODO (next milestones)

- Self-host the meshopt and Basis decoders instead of the CDN
- M2: player controller, Rapier physics, weapons
- M3: Node/WebSocket server-authoritative multiplayer
- M4: data-driven quest and puzzle system
