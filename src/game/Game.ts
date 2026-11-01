import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Matrix } from "@babylonjs/core/Maths/math.vector";

import type { ChunkManager } from "../world/ChunkManager";
import type { MaterialLibrary } from "../materials/MaterialLibrary";
import { Physics } from "./Physics";
import { Input } from "./Input";
import { Hud } from "./Hud";
import { Sfx } from "./Sfx";
import { Player } from "./Player";
import { Mission, SPAWN } from "./Mission";

/** Wires physics, the player, the mission and the HUD to the streaming city. */
export class Game {
  readonly physics = new Physics();
  readonly hud = new Hud();
  readonly sfx = new Sfx();
  input!: Input;
  player!: Player;
  mission!: Mission;
  private completed = false;
  private lastTime = 0;

  constructor(
    private scene: Scene,
    private chunks: ChunkManager,
    private materials: MaterialLibrary | null,
    private canvas: HTMLCanvasElement,
  ) {}

  get camera() {
    return this.player.camera;
  }

  async init(): Promise<void> {
    await this.physics.init();
    this.input = new Input(this.canvas);

    // colliders follow the streamed chunks
    let spawnReady!: () => void;
    const spawnLoaded = new Promise<void>((r) => (spawnReady = r));
    this.chunks.onLoaded = (key, cx, cz, sidecar) => {
      this.physics.addChunk(key, cx, cz, sidecar);
      if (key === "0_0") spawnReady();
    };
    this.chunks.onUnloaded = (key) => this.physics.removeChunk(key);
    this.chunks.update(new Vector3(SPAWN.x, SPAWN.y, SPAWN.z));
    await spawnLoaded;

    this.player = new Player(this.scene, this.physics, this.input, this.hud, this.sfx);
    await this.player.init(this.materials, SPAWN, 0);
    this.scene.activeCamera = this.player.camera;
    this.mission = new Mission(this.scene, this.physics, this.player, this.hud, this.sfx, this.input, this.materials);
    await this.mission.init();
    this.mission.onComplete = () => {
      this.completed = true;
      document.exitPointerLock();
      window.setTimeout(() => this.hud.showComplete(), 900);
    };
    this.player.onDeath = () => {
      document.exitPointerLock();
      window.setTimeout(() => this.hud.showDeath(true), 700);
    };

    this.hud.onStartClick = () => {
      this.sfx.resume();
      this.input.lock();
    };
    this.hud.onRespawnClick = () => {
      this.hud.showDeath(false);
      this.player.respawn(SPAWN, 0);
      this.mission.playerRespawned();
      this.sfx.resume();
      this.input.lock();
    };
    this.input.onLockChange = (locked) => {
      if (locked) this.hud.showStart(false);
      else if (!this.player.dead && !this.completed) this.hud.showStart(true, "已暂停，点击继续");
    };
  }

  /** Call once per frame from the render loop. */
  update(): void {
    const now = performance.now();
    const dt = Math.min(0.05, (now - (this.lastTime || now)) / 1000);
    this.lastTime = now;

    this.physics.step();
    this.player.update(dt);
    this.mission.update(dt);
    this.chunks.update(new Vector3(this.player.feet.x, 0, this.player.feet.z));
    this.updateWaypoint();
    this.input.endFrame();
  }

  private updateWaypoint(): void {
    const wp = this.mission.waypoint;
    if (!wp) return this.hud.setWaypoint(0, 0, 0, false);
    const engine = this.scene.getEngine();
    const w = engine.getRenderWidth(), h = engine.getRenderHeight();
    const cam = this.player.camera;
    const p = Vector3.Project(new Vector3(wp.x, wp.y + 4, wp.z), Matrix.Identity(), this.scene.getTransformMatrix(), cam.viewport.toGlobal(w, h));
    const f = this.player.feet;
    const dist = Math.hypot(f.x - wp.x, f.z - wp.z);
    // behind the camera or off screen: clamp to the edge
    const m = 40;
    let x = p.x, y = p.y;
    if (p.z < 0 || p.z > 1) {
      x = w - x;
      y = h - m;
    }
    x = Math.min(w - m, Math.max(m, x));
    y = Math.min(h - m, Math.max(m, y));
    this.hud.setWaypoint(x * (window.innerWidth / w), y * (window.innerHeight / h), dist, true);
  }

  /** Dev handle: teleports the player (for scripted tests). */
  teleport(x: number, z: number): void {
    this.physics.teleport(this.player.mover, x, 0.2, z);
  }
}
