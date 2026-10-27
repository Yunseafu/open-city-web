// Material IDs used by generated models, with fallback shading factors.
//
// GLBs never embed textures. Each material.name is one of the IDs below and the
// runtime material library swaps in the shared textured material by name. The
// factors here are written into the GLB so models still look right while the
// texture set for an ID does not exist yet.
//
// Colours are sRGB hex (converted to linear on export). `tile` is the texture
// repeat size in metres [u, v]; omit it for untextured (pure factor) materials.

export const MATERIALS = {
  // ---- roads and ground -------------------------------------------------
  mat_road_asphalt: { color: "#1b1d22", roughness: 0.92, tile: [4, 4] },
  mat_road_asphalt_wet: { color: "#13151a", roughness: 0.22, tile: [4, 4] },
  mat_road_marking_white: { color: "#cdd2d8", roughness: 0.65, tile: [4, 4] },
  mat_road_marking_yellow: { color: "#c9a227", roughness: 0.65, tile: [4, 4] },
  mat_road_crosswalk: { color: "#c6cbd2", roughness: 0.7, tile: [4, 4] },
  mat_ground_sidewalk_tiles: { color: "#3a3d45", roughness: 0.85, tile: [4, 4] },
  mat_ground_curb: { color: "#51555d", roughness: 0.8, tile: [2, 0.5] },

  // ---- walls ------------------------------------------------------------
  mat_wall_concrete_panel: { color: "#4b4f58", roughness: 0.88, tile: [4, 4] },
  mat_wall_concrete_dark: { color: "#2b2e35", roughness: 0.9, tile: [4, 4] },
  mat_wall_brick_dirty: { color: "#4d3630", roughness: 0.9, tile: [4, 4] },
  mat_wall_metal_cladding: { color: "#3a4452", metallic: 0.6, roughness: 0.5, tile: [4, 4] },

  // ---- facades: window grids come from the texture (tile = 4 bays x 2 floors) ----
  mat_facade_windows_lit: { color: "#2a3039", roughness: 0.6, tile: [12, 7.2] },
  mat_facade_windows_dark: { color: "#222730", roughness: 0.6, tile: [12, 7.2] },
  mat_facade_curtainwall: { color: "#1d2a3b", metallic: 0.8, roughness: 0.2, tile: [12, 7.2] },
  mat_facade_shopfront: { color: "#2a2e37", roughness: 0.55, tile: [12, 4.8] },

  // ---- roofs ------------------------------------------------------------
  mat_roof_tar: { color: "#222428", roughness: 0.95, tile: [4, 4] },

  // ---- metal ------------------------------------------------------------
  mat_metal_plate_worn: { color: "#4a4e56", metallic: 0.85, roughness: 0.55, tile: [2, 2] },
  mat_metal_painted_dark: { color: "#23262c", metallic: 0.6, roughness: 0.45, tile: [2, 2] },
  mat_metal_galvanized: { color: "#8a9099", metallic: 0.9, roughness: 0.4, tile: [2, 2] },
  mat_metal_rust: { color: "#6b3d28", metallic: 0.5, roughness: 0.8, tile: [2, 2] },

  // ---- glass ------------------------------------------------------------
  mat_glass_dark: { color: "#0a1018", roughness: 0.05, alpha: 0.45 },

  // ---- neon / lights (pure emissive, no texture) ------------------------------
  mat_neon_cyan: { color: "#06222a", emissive: "#00f0ff", emissiveStrength: 4 },
  mat_neon_magenta: { color: "#2a0a24", emissive: "#ff2bd6", emissiveStrength: 4 },
  mat_neon_amber: { color: "#2a1c00", emissive: "#ffb000", emissiveStrength: 4 },
  mat_neon_green: { color: "#082a12", emissive: "#39ff6a", emissiveStrength: 4 },
  mat_neon_red: { color: "#2a080c", emissive: "#ff2a3c", emissiveStrength: 4 },
  mat_neon_purple: { color: "#1a0a2e", emissive: "#9d4dff", emissiveStrength: 4 },
  mat_neon_white: { color: "#20262a", emissive: "#f4fbff", emissiveStrength: 4 },
  mat_light_warm: { color: "#2a2418", emissive: "#ffd9a0", emissiveStrength: 3 },

  // ---- atlas materials: UV0 is 0-1 inside a sprite rect of the atlas -----------
  mat_atlas_signs: { color: "#1a1c24", emissive: "#c040ff", emissiveStrength: 1.5, atlas: true },
  mat_atlas_billboard: { color: "#202228", emissive: "#40c0ff", emissiveStrength: 1.2, atlas: true },
  mat_atlas_decal: { color: "#555555", roughness: 0.9, alpha: 0.6, atlas: true }, // road arrows, manholes, stains, graffiti (alpha-blended)

  // ---- vehicles ---------------------------------------------------------
  mat_veh_paint: { color: "#ffffff", metallic: 0.6, roughness: 0.3, tint: true },
  mat_veh_glass: { color: "#0b1220", roughness: 0.05, alpha: 0.5 },
  mat_veh_tire: { color: "#101012", roughness: 0.92 },
  mat_veh_chrome: { color: "#c8ccd4", metallic: 1, roughness: 0.15 },
  mat_veh_light_head: { color: "#202428", emissive: "#f2f8ff", emissiveStrength: 5 },
  mat_veh_light_tail: { color: "#300508", emissive: "#ff1020", emissiveStrength: 4 },

  // ---- characters (cloth is white so vertex colour tints it) ----------------
  mat_char_skin: { color: "#f0d2bc", roughness: 0.7, tint: true }, // light base, vertex colour darkens to the skin tone
  mat_char_cloth: { color: "#ffffff", roughness: 0.85, tint: true },
  mat_char_leather: { color: "#2a211c", roughness: 0.6 },

  // ---- props ------------------------------------------------------------
  mat_prop_plastic: { color: "#2a2d33", roughness: 0.5, tile: [1, 1] },
  mat_prop_rubber: { color: "#141416", roughness: 0.95 },
  mat_foliage_leaf: { color: "#1f4a2a", roughness: 0.8 },
  // fabric awnings / curtains / laundry and shipping containers: white-ish base, vertex colour tints them
  mat_fabric_awning: { color: "#ffffff", roughness: 0.9, tint: true, tile: [1, 1] },
  mat_metal_container: { color: "#c4c8cc", metallic: 0.5, roughness: 0.6, tint: true, tile: [2, 2] },
  mat_prop_paint_red: { color: "#8a1c1f", metallic: 0.3, roughness: 0.5, tile: [1, 1] },
  mat_prop_paint_yellow: { color: "#b58a12", metallic: 0.3, roughness: 0.55, tile: [1, 1] },
  mat_prop_paint_orange: { color: "#c4540f", roughness: 0.6 },
  mat_prop_paint_green: { color: "#1d4a3a", metallic: 0.3, roughness: 0.55, tile: [1, 1] },
  mat_prop_wood: { color: "#4a3626", roughness: 0.9, tile: [1, 1] },
  mat_prop_bag: { color: "#0d0e11", roughness: 0.35 },
  mat_prop_screen_blue: { color: "#06141c", emissive: "#2ab4ff", emissiveStrength: 2.5 },
};

export function material(id) {
  const m = MATERIALS[id];
  if (!m) throw new Error(`unknown material "${id}" - add it to tools/gen/lib/materials.mjs and tell the texture thread`);
  return m;
}

export function srgbToLinear(hex) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return [ch((n >> 16) & 255), ch((n >> 8) & 255), ch(n & 255)];
}

/** sRGB hex -> [r,g,b] in 0..1 sRGB (used for vertex tint, which glTF treats as linear but we want art-directable). */
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
