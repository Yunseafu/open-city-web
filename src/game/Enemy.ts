import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";

import type { Physics, Mover } from "./Physics";
import type { Player } from "./Player";
import type { Sfx } from "./Sfx";
import { CharacterModel } from "./Character";
import { CHEST, EYES, type Damageable, type V3 } from "./types";
import type { MaterialLibrary } from "../materials/MaterialLibrary";

type State = "idle" | "combat" | "dead";

const SIGHT = 34;
const PREFERRED_MIN = 9;
const PREFERRED_MAX = 17;
const SHOT_DAMAGE = 9;

/** Hostile gang member: stands guard, spots the player with line of sight, closes to mid range and shoots. */
export class Enemy implements Damageable {
  readonly isPlayer = false;
  hp = 100;
  state: State = "idle";
  mover!: Mover;
  model!: CharacterModel;
  onDeath: ((e: Enemy) => void) | null = null;

  private heading = 0;
  private home: V3;
  private shootCd = 1;
  private lostSightT = 0;
  private strafe = 1;
  private strafeT = 0;
  private deadT = 0;
  private alerted = false;
  private tracerMat: StandardMaterial;

  constructor(
    private scene: Scene,
    private physics: Physics,
    private player: Player,
    private sfx: Sfx,
    pos: V3,
    heading: number,
    private modelId: string,
  ) {
    this.home = { ...pos };
    this.heading = heading;
    this.tracerMat = new StandardMaterial("etracer", scene);
    this.tracerMat.emissiveColor = new Color3(1, 0.2, 0.3);
    this.tracerMat.disableLighting = true;
    this.shootCd = 0.8 + Math.random() * 0.8;
  }

  async init(materials: MaterialLibrary | null): Promise<void> {
    this.model = await CharacterModel.load(this.scene, materials, this.modelId);
    this.mover = this.physics.createMover(this.home, { radius: 0.3, halfHeight: 0.6 }, this);
    this.model.play("idle");
    this.sync();
  }

  get feet(): V3 {
    return this.physics.feet(this.mover);
  }

  damage(amount: number, _from: V3): boolean {
    if (this.state === "dead") return false;
    this.hp -= amount;
    if (!this.alerted) this.alert();
    // getting shot makes it turn on the shooter even without line of sight
    this.lostSightT = 0;
    this.state = "combat";
    if (this.hp <= 0) {
      this.state = "dead";
      this.physics.setMoverEnabled(this.mover, false);
      this.model.play("idle");
      this.onDeath?.(this);
      return true;
    }
    return false;
  }

  /** After the player respawns: back to the post, full health. */
  reset(): void {
    if (this.state === "dead") return;
    this.hp = 100;
    this.state = "idle";
    this.alerted = false;
    this.physics.teleport(this.mover, this.home.x, this.home.y, this.home.z);
  }

  private alert(): void {
    this.alerted = true;
  }

  update(dt: number): void {
    if (this.state === "dead") {
      this.deadT += dt;
      // topple over, then sink away
      this.model.root.rotation.x = -Math.min(1, this.deadT / 0.35) * (Math.PI / 2);
      return;
    }
    const f = this.feet;
    const p = this.player.feet;
    const dx = p.x - f.x, dz = p.z - f.z;
    const dist = Math.hypot(dx, dz);
    const eye: V3 = { x: f.x, y: f.y + EYES, z: f.z };
    const target: V3 = { x: p.x, y: p.y + CHEST, z: p.z };
    const sees = !this.player.dead && dist < SIGHT && this.physics.lineOfSight(eye, target);

    if (this.state === "idle") {
      if (sees) {
        this.state = "combat";
        this.alert();
      }
    } else {
      if (sees) this.lostSightT = 0;
      else this.lostSightT += dt;
      if (this.player.dead || this.lostSightT > 5) {
        this.state = "idle";
        this.alerted = false;
      }
    }

    let mx = 0, mz = 0;
    if (this.state === "combat" && !this.player.dead) {
      const want = Math.atan2(dx, dz);
      this.heading = turnTo(this.heading, want, 8 * dt);
      const nx = dx / (dist || 1), nz = dz / (dist || 1);
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafe = Math.random() < 0.5 ? -1 : 1;
        this.strafeT = 1 + Math.random() * 1.5;
      }
      let speed = 0;
      if (!sees || dist > PREFERRED_MAX) {
        mx = nx;
        mz = nz;
        speed = dist > 24 ? 5.8 : 3.6;
      } else if (dist < PREFERRED_MIN) {
        mx = -nx;
        mz = -nz;
        speed = 3;
      } else {
        mx = -nz * this.strafe;
        mz = nx * this.strafe;
        speed = 2.2;
      }
      this.physics.move(this.mover, mx * speed * dt, mz * speed * dt, dt);
      if (speed > 5) this.model.play("run");
      else this.model.play("walk");

      if (sees) {
        this.shootCd -= dt;
        if (this.shootCd <= 0) {
          this.shootCd = 0.9 + Math.random() * 0.9;
          this.shoot(eye, target, dist);
        }
      }
    } else {
      // idle: stay put (gravity only), face home heading slowly
      this.physics.move(this.mover, 0, 0, dt);
      this.model.play("idle");
    }
    this.sync();
  }

  private shoot(from: V3, to: V3, dist: number): void {
    // accuracy falls with distance; a miss is aimed a little off the chest
    const hitChance = Math.max(0.2, 0.7 - dist * 0.022);
    const hit = Math.random() < hitChance;
    const spread = hit ? 0 : 1.1 + Math.random() * 0.9;
    const aim: V3 = {
      x: to.x + (Math.random() - 0.5) * spread * 2,
      y: to.y + (Math.random() - 0.5) * spread,
      z: to.z + (Math.random() - 0.5) * spread * 2,
    };
    const dx = aim.x - from.x, dy = aim.y - from.y, dz = aim.z - from.z;
    const len = Math.hypot(dx, dy, dz);
    const dir = { x: dx / len, y: dy / len, z: dz / len };
    const ray = this.physics.raycast(from, dir, SIGHT + 10, this.mover);
    const end = ray ? ray.point : { x: from.x + dir.x * 40, y: from.y + dir.y * 40, z: from.z + dir.z * 40 };
    this.sfx.shot(Math.max(0.15, 0.6 - dist * 0.015));
    this.tracer(from, end);
    if (ray?.actor === this.player) this.player.damage(SHOT_DAMAGE, from);
  }

  private tracer(a: V3, b: V3): void {
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (len < 0.5) return;
    const m = MeshBuilder.CreateBox("etracer", { width: 0.03, height: 0.03, depth: len }, this.scene);
    m.material = this.tracerMat;
    m.isPickable = false;
    m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    m.lookAt(new Vector3(b.x, b.y, b.z));
    setTimeout(() => m.dispose(), 70);
  }

  private sync(): void {
    const f = this.feet;
    this.model.root.position.set(f.x, f.y, f.z);
    this.model.root.rotation.y = this.heading;
  }

  dispose(): void {
    this.physics.removeMover(this.mover);
    this.model.dispose();
  }
}

function turnTo(cur: number, target: number, maxStep: number): number {
  let d = target - cur;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d) <= maxStep ? target : cur + Math.sign(d) * maxStep;
}
