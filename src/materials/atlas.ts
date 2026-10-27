import type { AtlasLayout } from "./manifest";

/** [u0, v0, u1, v1] in atlas UV space, origin top-left (glTF). */
export type SpriteRect = [number, number, number, number];

/** Layouts are committed next to the textures: `${baseUrl}/atlas/<name>.json`. */
export async function loadAtlasLayout(name: string, baseUrl = "/textures"): Promise<AtlasLayout> {
  const res = await fetch(`${baseUrl}/atlas/${name}.json`);
  if (!res.ok) throw new Error(`atlas layout '${name}': HTTP ${res.status}`);
  return (await res.json()) as AtlasLayout;
}

export function getSpriteRect(layout: AtlasLayout, sprite: string): SpriteRect {
  const s = layout.sprites[sprite];
  if (!s) throw new Error(`unknown atlas sprite '${sprite}'`);
  return [s.x, s.y, s.x + s.w, s.y + s.h];
}

/** Maps a 0..1 quad UV into the sprite's cell. Bake this into mesh UVs: gltfpack -mm merges same-material meshes. */
export function remapUV(u: number, v: number, rect: SpriteRect): [number, number] {
  return [rect[0] + u * (rect[2] - rect[0]), rect[1] + v * (rect[3] - rect[1])];
}
