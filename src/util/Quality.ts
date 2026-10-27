export interface QualityTier {
  name: string;
  /** How many chunks around the player are loaded at full detail. */
  loadRadius: number;
  /** Babylon hardware scaling level (1 = native resolution). */
  renderScale: number;
  /** Bloom-style glow on emissive materials (neon). */
  glow: boolean;
}

export const TIERS: QualityTier[] = [
  { name: "high", loadRadius: 2, renderScale: 1, glow: true },
  { name: "medium", loadRadius: 1, renderScale: 1, glow: true },
  { name: "low", loadRadius: 1, renderScale: 1.5, glow: false },
];
