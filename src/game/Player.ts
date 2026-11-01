import type { Scene } from "@babylonjs/core/scene";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";

import type { Physics, Mover } from "./Physics";
import type { Input } from "./Input";
import type { Hud } from "./Hud";
import type { Sfx } from "./Sfx";
import { CharacterModel } from "./Character";
import { CHEST, type Damageable, type V3 } from "./types";
import type { MaterialLibrary } from "../materials/MaterialLibrary";

const MAX_HP = 100;
const WALK = 4.2;
const RUN = 7.4;
const JUMP = 7.2;
const MAG = 12;
const FIRE_INTERVAL = 0.22;
const DAMAGE = 34;
const RANGE = 120;
const RELOAD_TIME = 1.3;

/** Third-person controller: capsule mover, shoulder camera, hitscan pistol. */
export class Player implements Damageable {
  readonly isPlayer = true;
  hp = MAX_HP;
  dead = false;
  mover!: Mover;
  model!: CharacterModel;
  camera: UniversalCamera;
  yaw = 0;
  pitch = 0.12; // radians, positive looks down
  heading = 0;
  mag = MAG;
  reserve = 60;
  /** Called with the Damageable that was hit and whether it died. */
  onHit: ((target: Damageable, killed: boolean) => void) | null = null;
  onDeath: (() => void) | null = null;
  onShot: (() => void) | null = null;

  private fireCd = 0;
  private reloadT = 0;
  private aiming = 0; // 0..1 blend towards the aiming camera
  private camDist = 3.4;
  private tracers: { mesh: Mesh; life: number }[] = [];
  private tracerMat: StandardMaterial;
  private flashLight: PointLight;
  private flashT = 0;
  private lastDamage = -99;
  private time = 0;

  constructor(
    private scene: Scene,
    private physics: Physics,
    private input: Input,
    private hud: Hud,
    private sfx: Sfx,
  ) {
    this.camera = new UniversalCamera("playerCam", new Vector3(0, 3, 0), scene);
    this.camera.minZ = 0.1;
    this.camera.maxZ = 1500;
    this.camera.inputs.clear(); // we drive it ourselves
    this.camera.fov = 1.0;
    this.tracerMat = new StandardMaterial("tracer", scene);
    this.tracerMat.emissiveColor = new Color3(1, 0.9, 0.4);
    this.tracerMat.disableLighting = true;
    this.flashLight = new PointLight("muzzle", Vector3.Zero(), scene);
    this.flashLight.diffuse = new Color3(1, 0.8, 0.4);
    this.flashLight.range = 14;
    this.flashLight.intensity = 0;
  }

  async init(materials: MaterialLibrary | null, spawn: V3, heading: number): Promise<void> {
    this.model = await CharacterModel.load(this.scene, materials, "char_player_male");
    this.mover = this.physics.createMover(spawn, { radius: 0.3, halfHeight: 0.6 }, this);
    this.heading = heading;
    this.yaw = heading;
    this.model.play("idle");
    this.syncModel();
    this.hud.setHealth(this.hp, MAX_HP);
    this.hud.setAmmo(this.mag, this.reserve, false);
  }

  get feet(): V3 {
    return this.physics.feet(this.mover);
  }

  get chest(): V3 {
    const f = this.feet;
    return { x: f.x, y: f.y + CHEST, z: f.z };
  }

  respawn(pos: V3, heading: number): void {
    this.hp = MAX_HP;
    this.dead = false;
    this.mag = MAG;
    this.reserve = Math.max(this.reserve, 36);
    this.reloadT = 0;
    this.physics.setMoverEnabled(this.mover, true);
    this.physics.teleport(this.mover, pos.x, pos.y, pos.z);
    this.model.root.rotation.x = 0;
    this.yaw = this.heading = heading;
    this.hud.setHealth(this.hp, MAX_HP);
    this.hud.setAmmo(this.mag, this.reserve, false);
  }

  damage(amount: number, _from: V3): boolean {
    if (this.dead) return false;
    this.hp -= amount;
    this.lastDamage = this.time;
    this.hud.setHealth(this.hp, MAX_HP);
    this.hud.damageFlash();
    this.sfx.hurt();
    if (this.hp <= 0) {
      this.dead = true;
      this.physics.setMoverEnabled(this.mover, false);
      this.model.root.rotation.x = -Math.PI / 2;
      this.onDeath?.();
      return true;
    }
    return false;
  }

  addAmmo(n: number): void {
    this.reserve += n;
    this.hud.setAmmo(this.mag, this.reserve, this.reloadT > 0);
  }

  update(dt: number): void {
    this.time += dt;
    const inp = this.input;
    if (!this.dead && inp.locked) {
      this.yaw += inp.mouseDX * 0.0022;
      this.pitch = Math.min(1.25, Math.max(-0.75, this.pitch + inp.mouseDY * 0.0022));
    }

    let moving = false;
    let running = false;
    if (!this.dead) {
      const fwd = (inp.isDown("KeyW") ? 1 : 0) - (inp.isDown("KeyS") ? 1 : 0);
      const side = (inp.isDown("KeyD") ? 1 : 0) - (inp.isDown("KeyA") ? 1 : 0);
      const aiming = inp.rightDown;
      moving = fwd !== 0 || side !== 0;
      running = inp.isDown("ShiftLeft") && fwd > 0 && !aiming;
      const speed = aiming ? WALK * 0.6 : running ? RUN : WALK;
      let dx = 0, dz = 0;
      if (moving) {
        const len = Math.hypot(fwd, side);
        const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
        // forward = (sin yaw, cos yaw), right = (cos yaw, -sin yaw) in Babylon's left-handed frame
        dx = ((sy * fwd + cy * side) / len) * speed * dt;
        dz = ((cy * fwd - sy * side) / len) * speed * dt;
      }
      if (inp.wasPressed("Space")) this.physics.jump(this.mover, JUMP);
      this.physics.move(this.mover, dx, dz, dt);

      // face the camera while aiming or firing, otherwise the direction of travel
      const shooting = inp.leftDown || this.fireCd > 0.12;
      let want = this.heading;
      if (aiming || shooting) want = this.yaw;
      else if (moving) want = Math.atan2(dx, dz);
      this.heading = turnTowards(this.heading, want, (aiming || shooting ? 18 : 12) * dt);

      this.updateWeapon(dt);
    }

    const clip = this.dead ? "idle" : !this.mover.grounded ? "run" : inp.rightDown ? "aim" : moving ? (running ? "run" : "walk") : "idle";
    this.model.play(clip);
    this.syncModel();
    this.updateCamera(dt);
    this.updateEffects(dt);

    // slow health regeneration after a few quiet seconds
    if (!this.dead && this.hp < MAX_HP && this.time - this.lastDamage > 6) {
      this.hp = Math.min(MAX_HP, this.hp + 6 * dt);
      this.hud.setHealth(this.hp, MAX_HP);
    }
  }

  private updateWeapon(dt: number): void {
    const inp = this.input;
    this.fireCd = Math.max(0, this.fireCd - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const take = Math.min(MAG - this.mag, this.reserve);
        this.mag += take;
        this.reserve -= take;
        this.hud.setAmmo(this.mag, this.reserve, false);
      }
      return;
    }
    if (inp.wasPressed("KeyR") && this.mag < MAG && this.reserve > 0) {
      this.reloadT = RELOAD_TIME;
      this.sfx.reload();
      this.hud.setAmmo(this.mag, this.reserve, true);
      return;
    }
    if (inp.leftDown && this.fireCd <= 0) {
      if (this.mag <= 0) {
        this.fireCd = 0.3;
        if (this.reserve > 0) {
          this.reloadT = RELOAD_TIME;
          this.sfx.reload();
          this.hud.setAmmo(this.mag, this.reserve, true);
        } else this.sfx.empty();
        return;
      }
      this.fire();
    }
  }

  private fire(): void {
    this.fireCd = FIRE_INTERVAL;
    this.mag--;
    this.hud.setAmmo(this.mag, this.reserve, false);
    this.sfx.shot();
    this.onShot?.();

    const cam = this.camera.position;
    const dir = aimDir(this.yaw, this.pitch);
    const hit = this.physics.raycast(cam, dir, RANGE, this.mover);
    const end = hit ? hit.point : { x: cam.x + dir.x * RANGE, y: cam.y + dir.y * RANGE, z: cam.z + dir.z * RANGE };
    const f = this.feet;
    const muzzle = {
      x: f.x + Math.sin(this.heading) * 0.5 + Math.cos(this.heading) * 0.25,
      y: f.y + 1.3,
      z: f.z + Math.cos(this.heading) * 0.5 - Math.sin(this.heading) * 0.25,
    };
    this.spawnTracer(muzzle, end);
    this.flashLight.position.set(muzzle.x, muzzle.y, muzzle.z);
    this.flashLight.intensity = 3;
    this.flashT = 0.05;

    const target = hit?.actor as Damageable | null | undefined;
    if (target && !target.isPlayer && target.hp > 0) {
      const killed = target.damage(DAMAGE, f);
      this.sfx.hit();
      this.hud.hitMarker(killed);
      if (killed) this.sfx.kill();
      this.onHit?.(target, killed);
    }
    // recoil kick
    this.pitch -= 0.012;
  }

  private spawnTracer(a: V3, b: V3): void {
    const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (len < 0.5) return;
    const m = MeshBuilder.CreateBox("tracer", { width: 0.025, height: 0.025, depth: len }, this.scene);
    m.material = this.tracerMat;
    m.isPickable = false;
    m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    m.lookAt(new Vector3(b.x, b.y, b.z));
    this.tracers.push({ mesh: m, life: 0.06 });
  }

  private updateEffects(dt: number): void {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        t.mesh.dispose();
        this.tracers.splice(i, 1);
      }
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      if (this.flashT <= 0) this.flashLight.intensity = 0;
    }
  }

  private syncModel(): void {
    const f = this.feet;
    this.model.root.position.set(f.x, f.y, f.z);
    this.model.root.rotation.y = this.heading;
  }

  private updateCamera(dt: number): void {
    this.aiming += ((this.input.rightDown ? 1 : 0) - this.aiming) * Math.min(1, dt * 10);
    const f = this.feet;
    const pivot = { x: f.x, y: f.y + 1.55, z: f.z };
    const dir = aimDir(this.yaw, this.pitch);
    // shoulder offset to the right of the view direction
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    const shoulder = 0.45 + 0.25 * this.aiming;
    const dist = this.camDist - 1.5 * this.aiming;
    const origin = { x: pivot.x + rx * shoulder, y: pivot.y, z: pivot.z + rz * shoulder };
    const back = { x: -dir.x, y: -dir.y, z: -dir.z };
    // pull the camera in when a wall is behind the player
    const hit = this.physics.raycast(origin, back, dist + 0.3, this.mover);
    const d = hit ? Math.max(0.4, hit.distance - 0.3) : dist;
    const pos = { x: origin.x + back.x * d, y: Math.max(0.3, origin.y + back.y * d), z: origin.z + back.z * d };
    this.camera.position.set(pos.x, pos.y, pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.camera.fov = 1.0 - 0.18 * this.aiming;
  }
}

/** Look direction for a yaw (compass, 0 = +Z) and a pitch (positive = down). */
export function aimDir(yaw: number, pitch: number): V3 {
  const c = Math.cos(pitch);
  return { x: Math.sin(yaw) * c, y: -Math.sin(pitch), z: Math.cos(yaw) * c };
}

function turnTowards(cur: number, target: number, maxStep: number): number {
  let d = target - cur;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d) <= maxStep ? target : cur + Math.sign(d) * maxStep;
}
