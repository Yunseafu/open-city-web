import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { AssetContainer } from "@babylonjs/core/assetContainer";

export const CHUNK_SIZE = 128;

interface LoadedChunk {
  key: string;
  root: TransformNode;
  container?: AssetContainer;
}

/**
 * Streams square world chunks around the player. Each chunk is one meshopt +
 * KTX2 compressed GLB at `${baseUrl}/${cx}_${cz}.glb`. Chunks without a GLB
 * fall back to a procedural placeholder so the streaming logic can be tested
 * before real map data exists.
 */
export class ChunkManager {
  private chunks = new Map<string, LoadedChunk>();
  private loading = new Set<string>();
  private centre = "";

  constructor(
    private scene: Scene,
    private baseUrl = "/chunks",
    public loadRadius = 1,
  ) {}

  get loadedCount(): number {
    return this.chunks.size;
  }

  update(player: Vector3): void {
    const cx = Math.floor(player.x / CHUNK_SIZE);
    const cz = Math.floor(player.z / CHUNK_SIZE);
    const centre = `${cx}_${cz}_${this.loadRadius}`;
    if (centre === this.centre) return;
    this.centre = centre;

    const wanted = new Set<string>();
    for (let dx = -this.loadRadius; dx <= this.loadRadius; dx++) {
      for (let dz = -this.loadRadius; dz <= this.loadRadius; dz++) {
        wanted.add(`${cx + dx}_${cz + dz}`);
      }
    }
    for (const key of wanted) void this.load(key);

    // Unload with one chunk of hysteresis so crossing a border does not thrash.
    for (const [key, chunk] of this.chunks) {
      const [x, z] = key.split("_").map(Number);
      if (Math.max(Math.abs(x - cx), Math.abs(z - cz)) > this.loadRadius + 1) {
        this.unload(chunk);
      }
    }
  }

  private async load(key: string): Promise<void> {
    if (this.chunks.has(key) || this.loading.has(key)) return;
    this.loading.add(key);
    const [x, z] = key.split("_").map(Number);
    const root = new TransformNode(`chunk_${key}`, this.scene);
    root.position.set(x * CHUNK_SIZE, 0, z * CHUNK_SIZE);
    const chunk: LoadedChunk = { key, root };

    try {
      const container = await LoadAssetContainerAsync(`${this.baseUrl}/${key}.glb`, this.scene);
      container.addAllToScene();
      for (const node of container.rootNodes) node.parent = root;
      chunk.container = container;
    } catch {
      this.buildPlaceholder(chunk, x, z);
    }

    this.loading.delete(key);
    this.chunks.set(key, chunk);
  }

  private buildPlaceholder(chunk: LoadedChunk, x: number, z: number): void {
    const ground = MeshBuilder.CreateGround(`ground_${chunk.key}`, { width: CHUNK_SIZE, height: CHUNK_SIZE }, this.scene);
    ground.parent = chunk.root;
    ground.position.set(CHUNK_SIZE / 2, 0, CHUNK_SIZE / 2);
    const gm = new StandardMaterial(`gm_${chunk.key}`, this.scene);
    gm.diffuseColor = new Color3(0.05, 0.06, 0.09);
    gm.specularColor = Color3.Black();
    ground.material = gm;
    ground.freezeWorldMatrix();

    // A few neon towers, deterministic per chunk.
    let seed = (x * 73856093) ^ (z * 19349663);
    const rand = () => ((seed = (seed * 1664525 + 1013904223) | 0) >>> 0) / 4294967296;
    const neon = new StandardMaterial(`neon_${chunk.key}`, this.scene);
    neon.emissiveColor = rand() > 0.5 ? new Color3(0, 0.9, 1) : new Color3(1, 0.1, 0.7);
    neon.disableLighting = true;
    for (let i = 0; i < 8; i++) {
      const h = 15 + rand() * 60;
      const tower = MeshBuilder.CreateBox(`t_${chunk.key}_${i}`, { width: 10, depth: 10, height: h }, this.scene);
      tower.parent = chunk.root;
      tower.position.set(10 + rand() * (CHUNK_SIZE - 20), h / 2, 10 + rand() * (CHUNK_SIZE - 20));
      tower.material = i % 3 === 0 ? neon : gm;
      tower.freezeWorldMatrix();
    }
  }

  private unload(chunk: LoadedChunk): void {
    this.chunks.delete(chunk.key);
    // dispose children (meshes/materials/textures) so GPU memory is released
    if (chunk.container) chunk.container.dispose();
    chunk.root.dispose(false, true);
  }
}
