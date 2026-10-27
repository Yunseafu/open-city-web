/**
 * Contract between the texture build (tools/textures, writes public/textures/materials.json)
 * and the runtime MaterialLibrary (src/materials). Keep both sides in sync with this file.
 *
 * Conventions
 *  - Material ids are `mat_<category>_<name>`, the same string as glTF `material.name`.
 *  - UV origin is top-left (glTF). KTX2 data is stored top-down, so no flipping is needed.
 *  - Colours are linear RGB unless stated otherwise. albedo/emissive textures are sRGB-encoded.
 *  - UV0 of tiling materials is in metres (1.0 = 1 m); the library scales by 1 / tileSizeM.
 *  - Atlas materials use UV0 in 0..1 atlas space (already baked into the mesh), no scaling.
 */

/** albedo: sRGB RGB(+A).  normal: tangent-space, +Y up (glTF/OpenGL), RGB.
 *  orm: R = ambient occlusion, G = roughness, B = metallic (linear).  emissive: sRGB RGB. */
export type MapName = "albedo" | "normal" | "orm" | "emissive";

export interface TextureRef {
  /** Path relative to the manifest, e.g. "road_asphalt_wet.albedo.ktx2". */
  url: string;
  /** Pixel size of mip 0. */
  size: [number, number];
}

export interface PbrParams {
  /** Linear base colour; multiplies the albedo map. The flat fallback when there is no map. */
  baseColor: [number, number, number];
  /** Multiplies ORM.b (or is the flat value without an ORM map). */
  metallic: number;
  /** Multiplies ORM.g (or is the flat value without an ORM map). */
  roughness: number;
  /** Linear emissive colour; multiplies the emissive map. Default: [1,1,1] when an emissive map exists, else [0,0,0]. */
  emissiveColor?: [number, number, number];
  /** Emissive multiplier (HDR, >1 feeds bloom). Default 1. */
  emissiveIntensity?: number;
  /** bumpTexture.level. Default 1. */
  normalStrength?: number;
  /** Strength of ORM.r occlusion. Default 1. */
  aoStrength?: number;
  clearCoat?: { intensity: number; roughness: number };
  /** Scales environment reflections. Default 1. */
  envIntensity?: number;
  alphaMode?: "opaque" | "mask" | "blend";
  alphaCutoff?: number;
  /** Flat alpha for alphaMode "blend" (multiplies albedo alpha). Default 1. */
  alpha?: number;
  doubleSided?: boolean;
  /** Depth bias for decal-like geometry (road markings). Negative pulls towards the camera. */
  zOffset?: number;
}

export interface MaterialDef {
  /**
   * tiling: repeats every tileSizeM metres, UV0 in metres.
   * atlas:  samples one sprite sheet, `atlas` names the entry of `Manifest.atlases`.
   * flat:   no textures (neon, chrome, tyre ...), only `params`.
   */
  kind: "tiling" | "atlas" | "flat";
  /** Metres covered by one repeat: a number (square) or [width, height]. Tiling only. */
  tileSizeM?: number | [number, number];
  atlas?: string;
  maps: Partial<Record<MapName, TextureRef>>;
  params: PbrParams;
  /** Free-text note shown in the preview page and docs. */
  note?: string;
}

/** Same layout the model tools read from public/textures/atlas/<name>.json (UV space, top-left origin). */
export interface AtlasLayout {
  sprites: Record<string, { x: number; y: number; w: number; h: number }>;
}

export interface Manifest {
  version: 1;
  materials: Record<string, MaterialDef>;
}
