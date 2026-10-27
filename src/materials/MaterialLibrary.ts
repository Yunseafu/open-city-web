import type { Scene } from "@babylonjs/core/scene";
import type { Node } from "@babylonjs/core/node";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { Material } from "@babylonjs/core/Materials/material";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PBRMaterial } from "@babylonjs/core/Materials/PBR/pbrMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import "@babylonjs/core/Materials/Textures/Loaders/ktxTextureLoader";

import type { Manifest, MapName, MaterialDef, TextureRef } from "./manifest";
import type { QualityTier } from "../util/Quality";

/** glTF `material.name` values with this prefix are replaced by library materials. */
export const MATERIAL_PREFIX = "mat_";

interface TextureEntry {
  texture: Texture;
  /** Resolves true once the texture is usable, false if it failed to load or transcode. */
  ok: Promise<boolean>;
}

/**
 * Owns every PBR material and texture of the game. Chunk GLBs only carry material *names*
 * (`mat_<category>_<name>`); `bindNodes` swaps them for the shared instances created here, so
 * a texture exists once on the GPU no matter how many chunks reference it, and unloading a
 * chunk never touches it.
 *
 * Works with an empty library (missing manifest, missing maps): materials then fall back to
 * the flat factors from `params`, per map.
 */
export class MaterialLibrary {
  private manifest: Manifest = { version: 1, materials: {} };
  private materials = new Map<string, PBRMaterial>();
  private textures = new Map<string, TextureEntry>();
  private settled: Promise<unknown>[] = [];
  private warned = new Set<string>();
  private anisotropy = 4;

  constructor(
    private scene: Scene,
    private baseUrl = "/textures",
    /** Freeze materials once their textures settled: skips per-frame dirty checks. */
    private freezeWhenReady = true,
  ) {}

  /** Fetches materials.json. Never throws: on failure the library stays empty and warns once. */
  async load(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/materials.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Manifest;
      if (data?.version !== 1 || typeof data.materials !== "object" || data.materials === null) {
        throw new Error("not a version 1 manifest");
      }
      this.manifest = data;
    } catch (err) {
      this.warnOnce("manifest", `[materials] no usable ${this.baseUrl}/materials.json (${String(err)}); using an empty library`);
    }
  }

  /** Adds or replaces a definition at runtime (tools, previews, tests). Existing instances are not rebuilt. */
  register(id: string, def: MaterialDef): void {
    this.manifest.materials[id] = def;
  }

  get ids(): string[] {
    return Object.keys(this.manifest.materials);
  }

  def(id: string): MaterialDef | undefined {
    return this.manifest.materials[id];
  }

  has(id: string): boolean {
    return id in this.manifest.materials;
  }

  /** Shared material for `id`, created lazily. Throws for ids missing from the manifest, see `tryGet`. */
  get(id: string): PBRMaterial {
    const mat = this.tryGet(id);
    if (!mat) throw new Error(`unknown material '${id}'`);
    return mat;
  }

  tryGet(id: string): PBRMaterial | null {
    const cached = this.materials.get(id);
    if (cached) return cached;
    const def = this.manifest.materials[id];
    if (!def) return null;
    const mat = this.build(id, def);
    this.materials.set(id, mat);
    return mat;
  }

  /** Resolves when every texture requested so far finished loading (or failed). */
  async whenReady(): Promise<void> {
    let n = -1;
    while (n !== this.settled.length) {
      n = this.settled.length;
      await Promise.all(this.settled);
    }
  }

  /**
   * Replaces `mat_*` materials on the meshes under `nodes` (and the nodes themselves) with the
   * shared library materials. Unknown ids keep the GLB's own fallback material. The replaced
   * originals are left to the owning AssetContainer; GLBs must not embed textures.
   * @returns number of meshes rebound
   */
  bindNodes(nodes: readonly Node[]): number {
    let count = 0;
    const visit = (mesh: AbstractMesh) => {
      if (mesh.getClassName() === "InstancedMesh") return; // follows its source mesh
      const mat = mesh.material;
      if (!mat) return;
      if (mat.getClassName() === "MultiMaterial") {
        const subs = (mat as Material & { subMaterials: (Material | null)[] }).subMaterials;
        subs.forEach((sub, i) => {
          const lib = sub && this.libraryFor(sub);
          if (lib) subs[i] = lib;
        });
        return;
      }
      const lib = this.libraryFor(mat);
      if (!lib) return;
      mesh.material = lib;
      // The glTF loader marks vec4 COLOR_0 as vertex alpha, which would push opaque meshes into the
      // transparent pass. COLOR_0 is an AO / tint multiplier (rgb); only blended materials keep alpha.
      if (lib.transparencyMode !== PBRMaterial.PBRMATERIAL_ALPHABLEND) mesh.hasVertexAlpha = false;
      count++;
    };
    for (const node of nodes) {
      if (node instanceof AbstractMesh) visit(node);
      for (const mesh of node.getChildMeshes(false)) visit(mesh);
    }
    return count;
  }

  bindContainer(container: AssetContainer): number {
    return this.bindNodes(container.rootNodes);
  }

  /** Re-applies the tier's anisotropy to every live texture and to textures created later. */
  applyTier(tier: QualityTier): void {
    const max = this.scene.getEngine().getCaps().maxAnisotropy || 1;
    this.anisotropy = Math.max(1, Math.min(tier.anisotropy, max));
    for (const { texture } of this.textures.values()) texture.anisotropicFilteringLevel = this.anisotropy;
  }

  /** Call before changing scene state that feeds shader defines (lights, fog, environment). */
  unfreezeAll(): void {
    for (const mat of this.materials.values()) mat.unfreeze();
  }

  freezeAll(): void {
    for (const mat of this.materials.values()) mat.freeze();
  }

  dispose(): void {
    for (const mat of this.materials.values()) mat.dispose(false, false);
    for (const { texture } of this.textures.values()) texture.dispose();
    this.materials.clear();
    this.textures.clear();
    this.settled = [];
  }

  private libraryFor(material: Material): PBRMaterial | null {
    const id = material.name;
    if (!id.startsWith(MATERIAL_PREFIX)) return null;
    const lib = this.tryGet(id);
    if (!lib) this.warnOnce(id, `[materials] '${id}' is not in the manifest; keeping the GLB fallback material`);
    return lib;
  }

  private build(id: string, def: MaterialDef): PBRMaterial {
    const p = def.params;
    const mat = new PBRMaterial(id, this.scene);

    // The API takes gamma-space colours (Babylon converts to linear for the shader); the manifest is linear.
    mat.albedoColor = Color3.FromArray(p.baseColor).toGammaSpace();
    mat.metallic = p.metallic;
    mat.roughness = p.roughness;
    mat.environmentIntensity = p.envIntensity ?? 1;
    mat.ambientTextureStrength = p.aoStrength ?? 1;
    if (p.zOffset) {
      mat.zOffset = p.zOffset;
      mat.zOffsetUnits = p.zOffset;
    }
    if (p.doubleSided) {
      mat.backFaceCulling = false;
      mat.twoSidedLighting = true;
    }
    if (p.clearCoat) {
      mat.clearCoat.isEnabled = true;
      mat.clearCoat.intensity = p.clearCoat.intensity;
      mat.clearCoat.roughness = p.clearCoat.roughness;
    }

    // glTF tangent space is +Y up; Babylon's glTF loader sets these flags for a left-handed scene
    // (invertNormalMapX = !useRightHandedSystem, invertNormalMapY = useRightHandedSystem).
    // The GLBs carry no TANGENT attribute, Babylon derives the frame per pixel from UV0 derivatives.
    const rightHanded = this.scene.useRightHandedSystem;
    mat.invertNormalMapX = !rightHanded;
    mat.invertNormalMapY = rightHanded;

    const tile = def.kind === "tiling" ? def.tileSizeM : undefined;
    const [tw, th] = Array.isArray(tile) ? tile : [tile ?? 1, tile ?? 1];
    const scale: [number, number] | null = def.kind === "tiling" ? [1 / tw, 1 / th] : null;
    const clamp = def.kind === "atlas";
    const pending: Promise<unknown>[] = [];

    const attach = (name: MapName, apply: (tex: Texture | null) => void) => {
      const ref = def.maps[name];
      if (!ref || def.kind === "flat") return;
      const entry = this.texture(ref, scale, clamp);
      apply(entry.texture);
      pending.push(
        entry.ok.then((ok) => {
          if (ok) return;
          // Per-map fallback: drop the failed map, the flat factors from params take over.
          apply(null);
          this.warnOnce(ref.url, `[materials] ${id}: ${name} map '${ref.url}' failed to load; using flat values`);
        }),
      );
    };

    attach("albedo", (t) => (mat.albedoTexture = t));
    attach("normal", (t) => {
      mat.bumpTexture = t;
      if (t) t.level = p.normalStrength ?? 1;
    });
    attach("orm", (t) => {
      mat.metallicTexture = t;
      mat.useAmbientOcclusionFromMetallicTextureRed = !!t;
      mat.useRoughnessFromMetallicTextureGreen = !!t;
      mat.useMetallnessFromMetallicTextureBlue = !!t;
    });
    attach("emissive", (t) => (mat.emissiveTexture = t));

    // An emissive map is multiplied by emissiveColor, which defaults to black in Babylon: use white unless the manifest says otherwise.
    const emissive = p.emissiveColor ?? (def.maps.emissive && def.kind !== "flat" ? [1, 1, 1] : [0, 0, 0]);
    mat.emissiveColor = Color3.FromArray(emissive).toGammaSpace();
    mat.emissiveIntensity = p.emissiveIntensity ?? 1;

    switch (p.alphaMode ?? "opaque") {
      case "mask":
        mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST;
        mat.alphaCutOff = p.alphaCutoff ?? 0.5;
        mat.useAlphaFromAlbedoTexture = true;
        break;
      case "blend":
        mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND;
        mat.alpha = p.alpha ?? 1;
        mat.useAlphaFromAlbedoTexture = !!def.maps.albedo;
        break;
      default:
        mat.transparencyMode = PBRMaterial.PBRMATERIAL_OPAQUE;
    }

    const settled = Promise.all(pending).then(() => {
      if (this.freezeWhenReady && this.materials.get(id) === mat) mat.freeze();
    });
    this.settled.push(settled);
    return mat;
  }

  /** One Texture per (file, scale, wrap): the engine shares the GPU resource by URL on top of that. */
  private texture(ref: TextureRef, scale: [number, number] | null, clamp: boolean): TextureEntry {
    const key = `${ref.url}|${scale?.join(",") ?? ""}|${clamp ? "c" : "w"}`;
    const cached = this.textures.get(key);
    if (cached) return cached;

    let resolve!: (ok: boolean) => void;
    const ok = new Promise<boolean>((r) => (resolve = r));
    const texture = new Texture(`${this.baseUrl}/${ref.url}`, this.scene, {
      noMipmap: false,
      invertY: false, // glTF UV convention, KTX2 rows are stored top-down
      samplingMode: Texture.TRILINEAR_SAMPLINGMODE,
      onLoad: () => resolve(true),
      onError: () => {
        resolve(false);
        this.textures.delete(key);
        texture.dispose();
      },
    });
    texture.wrapU = texture.wrapV = clamp ? Texture.CLAMP_ADDRESSMODE : Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = this.anisotropy;
    if (scale) {
      texture.uScale = scale[0];
      texture.vScale = scale[1];
    }
    const entry = { texture, ok };
    this.textures.set(key, entry);
    return entry;
  }

  private warnOnce(key: string, message: string): void {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    console.warn(message);
  }
}
