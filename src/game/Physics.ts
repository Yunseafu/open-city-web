import RAPIER from "@dimforge/rapier3d-compat";
import type { ChunkSidecar } from "../world/ChunkManager";
import { CHUNK_SIZE } from "../world/ChunkManager";

/** Collision groups: the world is in group 1, actors in group 2 and only collide with the world. */
const WORLD_ALL = 0xffffffff;
const ACTOR_GROUPS = (0x0002 << 16) | 0x0001;

export const CURB_H = 0.15;
/** Sidewalk slabs, chunk-local [min,max] ranges on both axes (tools/gen/city.mjs `blockRanges`). */
const BLOCK_RANGES: [number, number][] = [
  [7, 57],
  [71, 121],
];

export interface RayHit {
  point: { x: number; y: number; z: number };
  distance: number;
  /** Set when the ray hit an actor's capsule. */
  actor: unknown;
}

export interface MoverOptions {
  radius: number;
  halfHeight: number;
}

export interface Mover {
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  radius: number;
  halfHeight: number;
  /** Feet position. */
  readonly feetOffset: number;
  grounded: boolean;
  vy: number;
}

/**
 * Thin wrapper over Rapier: static chunk colliders, kinematic capsule movers and ray casts.
 * Rapier is right-handed and Babylon left-handed, but both only see plain x/y/z numbers here, and a
 * rotation about Y by `a` sends +Z to (sin a, 0, cos a) in both, so coordinates pass through unchanged.
 */
export class Physics {
  world!: RAPIER.World;
  private controller!: RAPIER.KinematicCharacterController;
  private chunkColliders = new Map<string, RAPIER.Collider[]>();
  private actorOf = new Map<number, unknown>();

  async init(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.controller = this.world.createCharacterController(0.02);
    this.controller.setUp({ x: 0, y: 1, z: 0 });
    this.controller.setSlideEnabled(true);
    this.controller.enableAutostep(0.4, 0.15, false);
    this.controller.enableSnapToGround(0.3);
    this.controller.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
  }

  step(): void {
    this.world.step();
  }

  addChunk(key: string, cx: number, cz: number, sidecar: ChunkSidecar | null): void {
    this.removeChunk(key);
    const ox = cx * CHUNK_SIZE;
    const oz = cz * CHUNK_SIZE;
    const list: RAPIER.Collider[] = [];
    const box = (x: number, y: number, z: number, hx: number, hy: number, hz: number, rotY = 0) => {
      const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setTranslation(x, y, z)
        .setRotation({ x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) });
      list.push(this.world.createCollider(desc));
    };
    // ground under the chunk at y = 0 (one slab per chunk: a huge plane loses precision in shape casts)
    box(ox + CHUNK_SIZE / 2, -1, oz + CHUNK_SIZE / 2, CHUNK_SIZE / 2 + 0.5, 1, CHUNK_SIZE / 2 + 0.5);
    // raised sidewalk slabs: the walkable surface of a block is 0.15 m above the asphalt
    for (const [x0, x1] of BLOCK_RANGES) {
      for (const [z0, z1] of BLOCK_RANGES) {
        box(ox + (x0 + x1) / 2, CURB_H / 2, oz + (z0 + z1) / 2, (x1 - x0) / 2, CURB_H / 2, (z1 - z0) / 2);
      }
    }
    for (const c of sidecar?.colliders ?? []) {
      if (c.kind === "platform") continue; // awnings and ledges above head height
      box(ox + c.c[0], c.c[1], oz + c.c[2], c.h[0], c.h[1], c.h[2], c.rotY);
    }
    this.chunkColliders.set(key, list);
  }

  removeChunk(key: string): void {
    const list = this.chunkColliders.get(key);
    if (!list) return;
    for (const c of list) this.world.removeCollider(c, false);
    this.chunkColliders.delete(key);
  }

  /** Kinematic capsule. `pos` is the feet position. `owner` comes back in ray hits. */
  createMover(pos: { x: number; y: number; z: number }, opts: MoverOptions, owner: unknown): Mover {
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y + opts.halfHeight + opts.radius, pos.z),
    );
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(opts.halfHeight, opts.radius).setCollisionGroups(ACTOR_GROUPS),
      body,
    );
    this.actorOf.set(collider.handle, owner);
    return { body, collider, radius: opts.radius, halfHeight: opts.halfHeight, feetOffset: opts.halfHeight + opts.radius, grounded: false, vy: 0 };
  }

  removeMover(m: Mover): void {
    this.actorOf.delete(m.collider.handle);
    this.world.removeRigidBody(m.body);
  }

  /** Static box that rays hit and report as `owner` (shooting-range targets). Actors walk through it. */
  createHitBox(c: { x: number; y: number; z: number }, half: { x: number; y: number; z: number }, owner: unknown): RAPIER.Collider {
    const col = this.world.createCollider(RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z).setTranslation(c.x, c.y, c.z).setCollisionGroups(ACTOR_GROUPS));
    this.actorOf.set(col.handle, owner);
    return col;
  }

  removeHitBox(col: RAPIER.Collider): void {
    this.actorOf.delete(col.handle);
    this.world.removeCollider(col, false);
  }

  setMoverEnabled(m: Mover, enabled: boolean): void {
    m.collider.setEnabled(enabled);
  }

  feet(m: Mover): { x: number; y: number; z: number } {
    const t = m.body.translation();
    return { x: t.x, y: t.y - m.feetOffset, z: t.z };
  }

  teleport(m: Mover, x: number, y: number, z: number): void {
    m.body.setTranslation({ x, y: y + m.feetOffset, z }, true);
    m.vy = 0;
  }

  /**
   * Moves a mover by a horizontal wish (metres this frame) plus gravity, sliding along world colliders,
   * stepping up curbs and snapping to the ground. Returns whether it ended on the ground.
   */
  move(m: Mover, dx: number, dz: number, dt: number): boolean {
    m.vy = m.grounded && m.vy < 0 ? -1 : Math.max(m.vy + -22 * dt, -40);
    this.controller.computeColliderMovement(m.collider, { x: dx, y: m.vy * dt, z: dz }, undefined, ACTOR_GROUPS);
    const mv = this.controller.computedMovement();
    const t = m.body.translation();
    m.body.setTranslation({ x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z }, true);
    m.grounded = this.controller.computedGrounded();
    if (m.grounded && m.vy < 0) m.vy = 0;
    if (!m.grounded && mv.y > m.vy * dt + 1e-4 && m.vy > 0) m.vy = 0; // bumped a ceiling
    return m.grounded;
  }

  jump(m: Mover, speed: number): void {
    if (m.grounded) {
      m.vy = speed;
      m.grounded = false;
    }
  }

  /** Closest hit along a normalised direction; `exclude` is the shooter's own mover. */
  raycast(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, maxDist: number, exclude?: Mover): RayHit | null {
    const hit = this.world.castRay(new RAPIER.Ray(o, d), maxDist, true, undefined, WORLD_ALL, exclude?.collider);
    if (!hit) return null;
    const dist = hit.timeOfImpact;
    return {
      distance: dist,
      point: { x: o.x + d.x * dist, y: o.y + d.y * dist, z: o.z + d.z * dist },
      actor: this.actorOf.get(hit.collider.handle) ?? null,
    };
  }

  /** True when nothing solid lies between a and b (actors do not block sight). */
  lineOfSight(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): boolean {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return true;
    const hit = this.world.castRay(new RAPIER.Ray(a, { x: dx / len, y: dy / len, z: dz / len }), len, true, undefined, WORLD_ALL, undefined, undefined, (c) => !this.actorOf.has(c.handle));
    return !hit;
  }
}
