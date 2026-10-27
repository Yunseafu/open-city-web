export interface QualityTier {
  name: string;
  /** How many chunks around the player are loaded at full detail. */
  loadRadius: number;
  /** Babylon hardware scaling level (1 = native resolution). */
  renderScale: number;
  /** Anisotropic filtering level for material textures (clamped to what the GPU supports). */
  anisotropy: number;
  /** Bloom post-process for neon; the low tier renders without any post-processing. */
  bloom: boolean;
}

export const TIERS: QualityTier[] = [
  { name: "high", loadRadius: 2, renderScale: 1, anisotropy: 8, bloom: true },
  { name: "medium", loadRadius: 1, renderScale: 1, anisotropy: 4, bloom: true },
  { name: "low", loadRadius: 1, renderScale: 1.5, anisotropy: 1, bloom: false },
];
