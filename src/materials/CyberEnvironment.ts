import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { Constants } from "@babylonjs/core/Engines/constants";
import { RawCubeTexture } from "@babylonjs/core/Materials/Textures/rawCubeTexture";
import { CubeMapToSphericalPolynomialTools } from "@babylonjs/core/Misc/HighDynamicRange/cubemapToSphericalPolynomial";
import { ImageProcessingConfiguration } from "@babylonjs/core/Materials/imageProcessingConfiguration";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";

import type { QualityTier } from "../util/Quality";

const FACE = 64;

/** Neon blobs on the horizon: azimuth (rad), elevation (rad), angular radius (rad), linear RGB. */
const BLOBS: readonly [number, number, number, [number, number, number]][] = [
  [0.3, 0.1, 0.22, [0.0, 0.85, 1.0]],
  [1.1, 0.22, 0.16, [1.0, 0.1, 0.65]],
  [1.9, 0.06, 0.3, [0.7, 0.2, 1.0]],
  [2.6, 0.3, 0.12, [1.0, 0.65, 0.1]],
  [3.4, 0.12, 0.25, [0.0, 0.8, 0.9]],
  [4.1, 0.05, 0.2, [1.0, 0.15, 0.4]],
  [4.8, 0.26, 0.14, [0.2, 1.0, 0.6]],
  [5.5, 0.14, 0.28, [0.9, 0.2, 0.9]],
];

function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Radiance (linear RGB) looking along unit direction (x, y, z), y up. */
function makeRadiance(): (x: number, y: number, z: number) => [number, number, number] {
  const rand = mulberry32(2077);
  // Thin vertical light strips (tower edges, signage) scattered along the skyline.
  const strips = Array.from({ length: 40 }, () => ({
    az: rand() * Math.PI * 2,
    width: 0.01 + rand() * 0.02,
    height: 0.05 + rand() * 0.3,
    color: [[0, 0.8, 1], [1, 0.15, 0.6], [1, 0.7, 0.2], [0.6, 0.3, 1]][Math.floor(rand() * 4)] as [number, number, number],
    gain: 0.3 + rand() * 0.5,
  }));

  return (x, y, z) => {
    const az = Math.atan2(z, x);
    const el = Math.asin(Math.max(-1, Math.min(1, y)));
    // Dusk-purple haze at the horizon fading to a deep blue zenith; near-black wet ground.
    const up = Math.max(0, y);
    const down = Math.max(0, -y);
    let r = 0.015 + 0.1 * Math.exp(-up * 5) * 1.0;
    let g = 0.01 + 0.025 * Math.exp(-up * 5);
    let b = 0.04 + 0.16 * Math.exp(-up * 4);
    const ground = 0.006 + 0.02 * Math.exp(-down * 6);
    if (y < 0) {
      r = ground * 1.3;
      g = ground;
      b = ground * 1.6;
    }
    for (const [baz, bel, rad, c] of BLOBS) {
      let d = Math.abs(az - baz);
      d = Math.min(d, Math.PI * 2 - d);
      const dist2 = (d * Math.cos(el)) ** 2 + (el - bel) ** 2;
      const k = Math.exp(-dist2 / (rad * rad)) * 0.9;
      r += c[0] * k;
      g += c[1] * k;
      b += c[2] * k;
    }
    for (const s of strips) {
      let d = Math.abs(az - s.az);
      d = Math.min(d, Math.PI * 2 - d);
      if (el < 0 || el > s.height) continue;
      const k = Math.exp(-(d * d) / (s.width * s.width)) * s.gain * (1 - el / s.height);
      r += s.color[0] * k;
      g += s.color[1] * k;
      b += s.color[2] * k;
    }
    return [r, g, b];
  };
}

/** OpenGL cube face layout: direction for face texel coordinates s, t in [-1, 1] (t grows downwards). */
const FACE_DIRS: ((s: number, t: number) => [number, number, number])[] = [
  (s, t) => [1, -t, -s], // +X
  (s, t) => [-1, -t, s], // -X
  (s, t) => [s, 1, t], // +Y
  (s, t) => [s, -1, -t], // -Y
  (s, t) => [s, -t, 1], // +Z
  (s, t) => [-s, -t, -1], // -Z
];

const toByte = (linear: number) => Math.round(Math.min(1, Math.pow(Math.max(0, linear), 1 / 2.2)) * 255);

/**
 * Procedural night-city environment (8-bit, gamma encoded, 64px faces ≈ 100 KB with mips): dark
 * purple sky, near-black wet ground, neon blobs and light strips on the horizon. It is the only
 * thing metals, glass and wet asphalt have to reflect, so it carries most of the cyberpunk look.
 * Also installs Khronos PBR-neutral tone mapping (keeps neon hues instead of bleaching them to white like ACES) on the scene so tiers with and without bloom look alike.
 */
export function createCyberEnvironment(scene: Scene, intensity = 1.2): RawCubeTexture {
  const radiance = makeRadiance();
  const faces: Uint8Array[] = [];
  for (const dirOf of FACE_DIRS) {
    const data = new Uint8Array(FACE * FACE * 4);
    for (let row = 0; row < FACE; row++) {
      for (let col = 0; col < FACE; col++) {
        const [dx, dy, dz] = dirOf((2 * (col + 0.5)) / FACE - 1, (2 * (row + 0.5)) / FACE - 1);
        const len = Math.hypot(dx, dy, dz);
        const [r, g, b] = radiance(dx / len, dy / len, dz / len);
        const i = (row * FACE + col) * 4;
        data[i] = toByte(r);
        data[i + 1] = toByte(g);
        data[i + 2] = toByte(b);
        data[i + 3] = 255;
      }
    }
    faces.push(data);
  }

  const texture = new RawCubeTexture(scene, faces, FACE, Constants.TEXTUREFORMAT_RGBA, Constants.TEXTURETYPE_UNSIGNED_BYTE, true, false);
  texture.name = "cyber_env";
  texture.gammaSpace = true;
  // Diffuse ambient from spherical harmonics, so the cube itself is only sampled for reflections.
  texture.sphericalPolynomial = CubeMapToSphericalPolynomialTools.ConvertCubeMapToSphericalPolynomial({
    size: FACE,
    right: faces[0],
    left: faces[1],
    up: faces[2],
    down: faces[3],
    front: faces[4],
    back: faces[5],
    format: Constants.TEXTUREFORMAT_RGBA,
    type: Constants.TEXTURETYPE_UNSIGNED_BYTE,
    gammaSpace: true,
  });

  scene.environmentTexture = texture;
  scene.environmentIntensity = intensity;

  const ip = scene.imageProcessingConfiguration;
  ip.toneMappingEnabled = true;
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL;
  ip.exposure = 1.1;
  ip.contrast = 1.15;
  return texture;
}

/** Bloom for neon, created or disposed as the quality tier changes. No SSAO, DOF or anything else. */
export class CyberPostFx {
  private pipeline: DefaultRenderingPipeline | null = null;
  /** scene.clearColor as authored: display space, what the no-post-process path shows as is. */
  private clearDisplay = new Color4();

  constructor(
    private scene: Scene,
    private camera: Camera,
    tier: QualityTier,
  ) {
    this.clearDisplay = scene.clearColor.clone();
    this.apply(tier);
  }

  apply(tier: QualityTier): void {
    if (tier.bloom && !this.pipeline) {
      const hdr = this.scene.getEngine().getCaps().textureHalfFloatRender;
      const p = new DefaultRenderingPipeline("cyber_fx", hdr, this.scene, [this.camera]);
      p.bloomEnabled = true;
      p.bloomThreshold = hdr ? 1.0 : 0.85; // emissive neon is > 1 in HDR
      p.bloomWeight = 0.45;
      p.bloomKernel = 48;
      p.bloomScale = 0.5;
      p.fxaaEnabled = false;
      this.pipeline = p;
    } else if (!tier.bloom && this.pipeline) {
      this.pipeline.dispose();
      this.pipeline = null;
    }
    // The HDR pipeline treats the clear colour as linear and encodes it on output, the plain path does not.
    this.scene.clearColor = this.pipeline ? this.clearDisplay.toLinearSpace() : this.clearDisplay.clone();
  }

  dispose(): void {
    this.pipeline?.dispose();
    this.pipeline = null;
  }
}
