import type { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import type { MaterialLibrary } from "../materials/MaterialLibrary";

/**
 * A generated character GLB (rigid segmented rig, clips idle / walk / run / aim) under a holder node
 * whose Y rotation is the compass heading (0 = +Z, the model's front).
 */
export class CharacterModel {
  readonly root: TransformNode;
  private clips = new Map<string, AnimationGroup>();
  private current = "";

  private constructor(private container: AssetContainer, root: TransformNode) {
    this.root = root;
    for (const g of container.animationGroups) {
      g.stop();
      this.clips.set(g.name, g);
    }
  }

  static async load(scene: Scene, materials: MaterialLibrary | null, id: string): Promise<CharacterModel> {
    const container = await LoadAssetContainerAsync(`/models/${id}.glb`, scene);
    container.addAllToScene();
    materials?.bindContainer(container);
    const root = new TransformNode(`char_${id}`, scene);
    for (const n of container.rootNodes) n.parent = root;
    for (const mesh of container.meshes) {
      mesh.isPickable = false;
      mesh.alwaysSelectAsActiveMesh = true; // skinless rigid rig: bounds are not updated by node animation
    }
    return new CharacterModel(container, root);
  }

  play(clip: string, speed = 1): void {
    if (clip === this.current) {
      this.clips.get(clip)?.setWeightForAllAnimatables(1);
      return;
    }
    this.clips.get(this.current)?.stop();
    const g = this.clips.get(clip);
    g?.start(true, speed);
    this.current = clip;
  }

  setVisible(v: boolean): void {
    this.root.setEnabled(v);
  }

  dispose(): void {
    for (const g of this.clips.values()) g.stop();
    this.container.dispose();
    this.root.dispose();
  }
}
