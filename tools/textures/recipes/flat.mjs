// Materials without textures: pure parameters. Colours are LINEAR RGB.
// Neon is emissive-only: a near-black base plus HDR emission that the bloom pass picks up.

const neon = (name, emissiveColor, note) => ({
  id: `mat_neon_${name}`,
  note,
  params: { baseColor: [0.02, 0.02, 0.025], metallic: 0, roughness: 0.35, emissiveColor, emissiveIntensity: 5 },
});

export const flat = [
  neon("cyan", [0.0, 0.79, 1.0], "tube / sign glow"),
  neon("magenta", [1.0, 0.007, 0.35]),
  neon("amber", [1.0, 0.35, 0.007]),
  neon("green", [0.02, 1.0, 0.13]),
  neon("red", [1.0, 0.013, 0.02]),
  neon("purple", [0.3, 0.045, 1.0]),
  neon("white", [0.79, 0.87, 1.0], "cold white"),

  {
    id: "mat_veh_paint",
    note: "white base, tinted per vehicle with COLOR_0",
    params: { baseColor: [1, 1, 1], metallic: 0.55, roughness: 0.3, clearCoat: { intensity: 1, roughness: 0.04 }, envIntensity: 1.2 },
  },
  {
    id: "mat_veh_glass",
    params: { baseColor: [0.02, 0.03, 0.04], metallic: 0, roughness: 0.04, alphaMode: "blend", alpha: 0.4, envIntensity: 1.6, doubleSided: true },
  },
  { id: "mat_veh_tire", params: { baseColor: [0.015, 0.015, 0.017], metallic: 0, roughness: 0.85 } },
  { id: "mat_veh_chrome", params: { baseColor: [0.9, 0.9, 0.92], metallic: 1, roughness: 0.06, envIntensity: 1.3 } },
  {
    id: "mat_veh_light_head",
    params: { baseColor: [0.6, 0.6, 0.6], metallic: 0, roughness: 0.1, emissiveColor: [1.0, 0.93, 0.8], emissiveIntensity: 8 },
  },
  {
    id: "mat_veh_light_tail",
    params: { baseColor: [0.1, 0.01, 0.01], metallic: 0, roughness: 0.15, emissiveColor: [1.0, 0.02, 0.03], emissiveIntensity: 4 },
  },
  {
    id: "mat_light_warm",
    note: "windows, lamps, street light heads",
    params: { baseColor: [0.06, 0.05, 0.03], metallic: 0, roughness: 0.4, emissiveColor: [1.0, 0.69, 0.35], emissiveIntensity: 3 },
  },
  { id: "mat_foliage_leaf", params: { baseColor: [0.014, 0.068, 0.023], metallic: 0, roughness: 0.8, doubleSided: true } },
  { id: "mat_char_skin", note: "no SSS in v1", params: { baseColor: [0.58, 0.3, 0.2], metallic: 0, roughness: 0.55 } },
];
