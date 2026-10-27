import type { Scene } from "@babylonjs/core/scene";

export const MB = 1024 * 1024;

/** Per-category budgets in MB; the total stays under 1GB with ~200MB headroom. */
export const BUDGET_MB = {
  textures: 350,
  geometry: 120,
  lightmaps: 80,
  jsHeap: 100,
  total: 800,
} as const;

export interface MemoryStats {
  texturesMB: number;
  geometryMB: number;
  jsHeapMB: number;
  totalMB: number;
}

/**
 * Estimates memory use from the scene (textures are counted at their
 * GPU-compressed size, 1 byte/px for BC7/ASTC, plus ~33% for mips) and the
 * JS heap where the browser exposes it (Chromium only).
 */
export class MemoryMonitor {
  private timer = 0;

  constructor(
    private scene: Scene,
    private onUpdate: (stats: MemoryStats) => void,
  ) {}

  start(intervalMs = 1000): void {
    this.timer = window.setInterval(() => this.onUpdate(this.sample()), intervalMs);
  }

  stop(): void {
    window.clearInterval(this.timer);
  }

  sample(): MemoryStats {
    let texBytes = 0;
    for (const tex of this.scene.textures) {
      const { width, height } = tex.getSize();
      texBytes += width * height * 1.33;
    }
    let vertBytes = 0;
    for (const mesh of this.scene.meshes) {
      // Packed layout from tools/gen: 16-bit position (8 B), 8-bit normal (4 B), float UV (8 B),
      // 8-bit colour (4 B) = 24 bytes/vertex, plus 4-byte indices.
      vertBytes += mesh.getTotalVertices() * 24 + mesh.getTotalIndices() * 4;
    }
    const perf = performance as Performance & { memory?: { usedJSHeapSize: number } };
    const jsHeap = perf.memory?.usedJSHeapSize ?? 0;
    const texturesMB = texBytes / MB;
    const geometryMB = vertBytes / MB;
    const jsHeapMB = jsHeap / MB;
    return { texturesMB, geometryMB, jsHeapMB, totalMB: texturesMB + geometryMB + jsHeapMB };
  }
}
