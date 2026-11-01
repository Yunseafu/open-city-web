import type { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Collider } from "@dimforge/rapier3d-compat";

import type { Physics } from "./Physics";
import type { Player } from "./Player";
import { Enemy } from "./Enemy";
import type { Hud } from "./Hud";
import type { Sfx } from "./Sfx";
import type { Input } from "./Input";
import type { Damageable, V3 } from "./types";
import type { MaterialLibrary } from "../materials/MaterialLibrary";

/** World positions (chunk 0_0, the road along z at x = 64 and the crossing at z = 64). */
export const SPAWN: V3 = { x: 72.5, y: 0.15, z: 36 };
const TARGETS: V3[] = [
  { x: 62.3, y: 0, z: 42 },
  { x: 65.7, y: 0, z: 48 },
  { x: 62.3, y: 0, z: 54 },
];
const GANG: { pos: V3; heading: number; model: string }[] = [
  { pos: { x: 60, y: 0, z: 69 }, heading: 2.6, model: "char_gang_a" },
  { pos: { x: 68.5, y: 0, z: 70 }, heading: 3.6, model: "char_gang_b" },
  { pos: { x: 64, y: 0, z: 77 }, heading: 3.14, model: "char_gang_a" },
  { pos: { x: 57.8, y: 0, z: 63.5 }, heading: 1.5, model: "char_gang_b" },
];
const TERMINAL: V3 = { x: 64, y: 0, z: 95.5 };
const PYLONS: V3[] = [
  { x: 59.8, y: 0, z: 100 },
  { x: 64, y: 0, z: 102 },
  { x: 68.2, y: 0, z: 100 },
];
const NEON = [new Color3(0, 0.9, 1), new Color3(1, 0.1, 0.8), new Color3(1, 0.7, 0)];
const SEQ_LEN = 4;
const INTERACT_RANGE = 2.6;

/** A pop-up practice target on a stand; two shots in the red ring bring it down. */
class Target implements Damageable {
  readonly isPlayer = false;
  hp = 60;
  private root: TransformNode;
  private disc: ReturnType<typeof MeshBuilder.CreateCylinder>;
  private mat: StandardMaterial;
  private col: Collider;
  private fall = 0;
  onDown: (() => void) | null = null;

  constructor(scene: Scene, private physics: Physics, pos: V3) {
    this.root = new TransformNode("target", scene);
    this.root.position.set(pos.x, 0, pos.z);
    const stand = MeshBuilder.CreateCylinder("stand", { diameter: 0.12, height: 1.1 }, scene);
    stand.parent = this.root;
    stand.position.y = 0.55;
    const metal = new StandardMaterial("standMat", scene);
    metal.diffuseColor = new Color3(0.1, 0.1, 0.12);
    stand.material = metal;
    this.disc = MeshBuilder.CreateCylinder("disc", { diameter: 1.1, height: 0.08, tessellation: 24 }, scene);
    this.disc.parent = this.root;
    this.disc.rotation.x = Math.PI / 2;
    this.disc.position.y = 1.45;
    this.mat = new StandardMaterial("targetMat", scene);
    this.mat.emissiveColor = new Color3(1, 0.08, 0.2);
    this.mat.disableLighting = true;
    this.disc.material = this.mat;
    this.col = physics.createHitBox({ x: pos.x, y: 1.45, z: pos.z }, { x: 0.55, y: 0.55, z: 0.1 }, this);
  }

  damage(amount: number): boolean {
    if (this.hp <= 0) return false;
    this.hp -= amount;
    this.mat.emissiveColor = new Color3(1, 1, 1);
    setTimeout(() => !this.down && (this.mat.emissiveColor = new Color3(1, 0.08, 0.2)), 90);
    if (this.hp <= 0) {
      this.physics.removeHitBox(this.col);
      this.mat.emissiveColor = new Color3(0.15, 0.02, 0.05);
      this.onDown?.();
      return true;
    }
    return false;
  }

  get down(): boolean {
    return this.hp <= 0;
  }

  update(dt: number): void {
    if (!this.down) return;
    this.fall = Math.min(1, this.fall + dt * 3);
    this.disc.position.y = 1.45 - 0.9 * this.fall;
  }

  get position(): V3 {
    return { x: this.root.position.x, y: 1.4, z: this.root.position.z };
  }
}

type Stage = "range" | "gang" | "hack" | "done";

/** Three-step mission: shooting range, clear the crossing, solve the sequence terminal. */
export class Mission {
  stage: Stage = "range";
  waypoint: V3 | null = null;
  readonly enemies: Enemy[] = [];
  private targets: Target[] = [];
  private beam: ReturnType<typeof MeshBuilder.CreateCylinder>;
  private beamMat: StandardMaterial;
  private pylonMats: StandardMaterial[] = [];
  private terminalMat: StandardMaterial;
  private sequence: number[] = [];
  private progress = 0;
  private playing = false;
  private time = 0;
  onComplete: (() => void) | null = null;

  constructor(
    private scene: Scene,
    private physics: Physics,
    private player: Player,
    private hud: Hud,
    private sfx: Sfx,
    private input: Input,
    private materials: MaterialLibrary | null,
  ) {
    for (const p of TARGETS) {
      const t = new Target(scene, physics, p);
      t.onDown = () => this.onTargetDown();
      this.targets.push(t);
    }
    this.beamMat = new StandardMaterial("beam", scene);
    this.beamMat.emissiveColor = new Color3(1, 0.17, 0.85);
    this.beamMat.disableLighting = true;
    this.beamMat.alpha = 0.35;
    this.beam = MeshBuilder.CreateCylinder("beam", { diameter: 0.7, height: 60, tessellation: 12 }, scene);
    this.beam.material = this.beamMat;
    this.beam.isPickable = false;
    this.beam.position.y = 30;

    // hack site: terminal + three colour pylons
    this.terminalMat = new StandardMaterial("terminal", scene);
    this.terminalMat.emissiveColor = new Color3(0.2, 0.9, 0.7);
    this.terminalMat.disableLighting = true;
    const term = MeshBuilder.CreateBox("terminal", { width: 0.9, height: 1.4, depth: 0.5 }, scene);
    term.position.set(TERMINAL.x, 0.7, TERMINAL.z);
    const frame = new StandardMaterial("terminalFrame", scene);
    frame.diffuseColor = new Color3(0.08, 0.09, 0.12);
    term.material = frame;
    const screen = MeshBuilder.CreatePlane("screen", { width: 0.7, height: 0.5 }, scene);
    screen.position.set(TERMINAL.x, 1.0, TERMINAL.z - 0.26);
    screen.rotation.y = Math.PI; // faces -z, towards the player coming from the south
    screen.material = this.terminalMat;
    PYLONS.forEach((p, i) => {
      const m = MeshBuilder.CreateCylinder(`pylon${i}`, { diameter: 0.7, height: 2.2, tessellation: 16 }, scene);
      m.position.set(p.x, 1.1, p.z);
      const mat = new StandardMaterial(`pylonMat${i}`, scene);
      mat.emissiveColor = NEON[i].scale(0.18);
      mat.diffuseColor = new Color3(0.04, 0.04, 0.05);
      m.material = mat;
      this.pylonMats.push(mat);
      this.physics.createHitBox({ x: p.x, y: 1.1, z: p.z }, { x: 0.35, y: 1.1, z: 0.35 }, null);
    });
    this.resetSequence();
  }

  async init(): Promise<void> {
    for (const g of GANG) {
      const e = new Enemy(this.scene, this.physics, this.player, this.sfx, g.pos, g.heading, g.model);
      await e.init(this.materials);
      e.onDeath = () => this.onEnemyDown();
      this.enemies.push(e);
    }
    this.refresh();
  }

  /** After a respawn the gang resets to its posts. */
  playerRespawned(): void {
    for (const e of this.enemies) e.reset();
  }

  private get targetsDown(): number {
    return this.targets.filter((t) => t.down).length;
  }
  private get enemiesDown(): number {
    return this.enemies.filter((e) => e.state === "dead").length;
  }

  private onTargetDown(): void {
    if (this.targetsDown === this.targets.length && this.stage === "range") {
      this.sfx.good();
      this.stage = "gang";
      this.player.addAmmo(24);
      this.hud.say("靶场完成，前方路口有帮派，小心");
    }
    this.refresh();
  }

  private onEnemyDown(): void {
    this.player.addAmmo(12);
    if (this.enemiesDown === this.enemies.length && this.stage === "gang") {
      this.sfx.good();
      this.stage = "hack";
      this.hud.say("路口已清理。去北边的终端");
    }
    this.refresh();
  }

  private refresh(): void {
    switch (this.stage) {
      case "range":
        this.waypoint = { x: 64, y: 0, z: 48 };
        this.hud.setObjective("任务 1 / 3", "靶场：击落 3 个红色靶标", `${this.targetsDown} / ${this.targets.length}　左键开枪，右键举枪`);
        break;
      case "gang":
        this.waypoint = { x: 64, y: 0, z: 66 };
        this.hud.setObjective("任务 2 / 3", "清理路口的帮派成员", `${this.enemiesDown} / ${this.enemies.length}　他们会还击，注意掩护`);
        break;
      case "hack":
        this.waypoint = { ...TERMINAL };
        this.hud.setObjective(
          "任务 3 / 3",
          "破解终端",
          "靠近终端按 E 读取灯光顺序，再按同样顺序去按三根能量柱（E）",
        );
        break;
      case "done":
        this.waypoint = null;
        this.hud.setObjective("任务完成", "自由探索", "");
        break;
    }
  }

  private resetSequence(): void {
    this.sequence = Array.from({ length: SEQ_LEN }, () => Math.floor(Math.random() * 3));
    // avoid a boring single-colour sequence
    if (this.sequence.every((c) => c === this.sequence[0])) this.sequence[SEQ_LEN - 1] = (this.sequence[0] + 1) % 3;
    this.progress = 0;
  }

  private distTo(p: V3): number {
    const f = this.player.feet;
    return Math.hypot(f.x - p.x, f.z - p.z);
  }

  private flashPylon(i: number, ms: number): void {
    this.pylonMats[i].emissiveColor = NEON[i];
    setTimeout(() => (this.pylonMats[i].emissiveColor = NEON[i].scale(0.18)), ms);
  }

  private playSequence(): void {
    if (this.playing) return;
    this.playing = true;
    this.progress = 0;
    this.hud.setSequence(this.sequence, 0);
    this.sequence.forEach((c, k) => {
      setTimeout(() => {
        this.flashPylon(c, 520);
        this.sfx.beep(c);
        if (k === this.sequence.length - 1) setTimeout(() => (this.playing = false), 700);
      }, 500 + k * 800);
    });
  }

  private pressPylon(i: number): void {
    if (this.playing || this.stage !== "hack") return;
    this.flashPylon(i, 300);
    this.sfx.beep(i);
    if (this.sequence[this.progress] === i) {
      this.progress++;
      this.hud.setSequence(this.sequence, this.progress);
      if (this.progress === this.sequence.length) {
        this.sfx.good();
        this.stage = "done";
        this.terminalMat.emissiveColor = new Color3(0.2, 1, 0.3);
        this.hud.setSequence(null);
        this.refresh();
        this.onComplete?.();
      }
    } else {
      this.sfx.bad();
      this.progress = 0;
      this.hud.setSequence(this.sequence, 0);
      this.hud.say("顺序错误，回终端重新读取");
      this.terminalMat.emissiveColor = new Color3(1, 0.2, 0.2);
      setTimeout(() => (this.terminalMat.emissiveColor = new Color3(0.2, 0.9, 0.7)), 600);
    }
  }

  update(dt: number): void {
    this.time += dt;
    for (const t of this.targets) t.update(dt);
    for (const e of this.enemies) e.update(dt);

    // objective beam
    const wp = this.waypoint;
    this.beam.setEnabled(!!wp);
    if (wp) {
      this.beam.position.set(wp.x, 30, wp.z);
      this.beamMat.alpha = 0.25 + 0.1 * Math.sin(this.time * 3);
    }

    if (this.stage === "hack") {
      const nearTerm = this.distTo(TERMINAL) < INTERACT_RANGE;
      const nearPylon = PYLONS.findIndex((p) => this.distTo(p) < INTERACT_RANGE);
      if (this.input.wasPressed("KeyE")) {
        if (nearTerm) this.playSequence();
        else if (nearPylon >= 0) this.pressPylon(nearPylon);
      }
    }
  }

  /** Target positions, for debugging and tests. */
  get debug(): { stage: Stage; targets: V3[]; enemies: V3[]; sequence: number[]; pylons: V3[]; terminal: V3 } {
    return { stage: this.stage, targets: this.targets.map((t) => t.position), enemies: this.enemies.map((e) => e.feet), sequence: this.sequence, pylons: PYLONS, terminal: TERMINAL };
  }
}

