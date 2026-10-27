// High-rise / downtown buildings (zone:downtown, some also zone:mid).
// Recipes live in lib/bhigh_a.mjs, bhigh_b.mjs and bhigh_c.mjs and share lib/bhigh_kit.mjs.
//
// Contract with the city layout: footprint centred on the origin, base at y = 0, front on +Z,
// everything inside |x| <= w/2 (+0.25 ledges) and |z| <= d/2. w and d are multiples of 3 m,
// the mass rectangle is X [-w/2, w/2] x Z [-d/2 + 1.5, d/2 - 1.5] (see bhigh_kit.mjs).
// Facade walls above the shopfront start their texture tile at y = 4.8 (vOff = -4.8).
import { glassSetback, megaStack, taperedSpire } from "../lib/bhigh_a.mjs";
import { twinCore, corpHQ, ledMegablock } from "../lib/bhigh_b.mjs";
import { hotel, arcology, needle, brutalist } from "../lib/bhigh_c.mjs";

const TOWER_BUDGET = 3500;
const lot = (w, d, floors) => ({ w, d, floors });
const DT = ["building", "zone:downtown"];

export const assets = [
  {
    id: "bld_hi_glass_setback", category: "building", tags: [...DT, "zone:mid"], budget: TOWER_BUDGET,
    lot: lot([18, 42], [18, 42], [16, 45]),
    params: { w: 21, d: 21, floors: 28 },
    variants: [{ suffix: "" }, { suffix: "_wide", seed: 11, params: { w: 36, d: 27, floors: 20 } }],
    build: glassSetback,
  },
  {
    id: "bld_hi_megastack", category: "building", tags: DT, budget: TOWER_BUDGET,
    lot: lot([24, 42], [21, 42], [18, 45]),
    params: { w: 30, d: 24, floors: 30 },
    variants: [{ suffix: "" }, { suffix: "_b", seed: 23, params: { w: 42, d: 36, floors: 38 } }],
    build: megaStack,
  },
  {
    id: "bld_hi_tapered_spire", category: "building", tags: DT, budget: TOWER_BUDGET,
    lot: lot([21, 42], [21, 42], [24, 45]),
    params: { w: 24, d: 24, floors: 36 },
    variants: [{ suffix: "" }, { suffix: "_b", seed: 7, params: { w: 33, d: 30, floors: 30 } }],
    build: taperedSpire,
  },
  {
    id: "bld_hi_twin_core", category: "building", tags: DT, budget: TOWER_BUDGET,
    lot: lot([30, 42], [21, 42], [18, 45]),
    params: { w: 36, d: 27, floors: 32 },
    variants: [{ suffix: "" }, { suffix: "_b", seed: 5, params: { w: 42, d: 33, floors: 24 } }],
    build: twinCore,
  },
  {
    id: "bld_hi_corp_hq", category: "building", tags: [...DT, "zone:mid"], budget: TOWER_BUDGET,
    lot: lot([24, 42], [21, 42], [20, 40]),
    params: { w: 30, d: 27, floors: 30 },
    variants: [{ suffix: "" }, { suffix: "_b", seed: 9, params: { w: 42, d: 36, floors: 24 } }],
    build: corpHQ,
  },
  {
    id: "bld_hi_led_megablock", category: "building", tags: [...DT, "zone:mid"], budget: TOWER_BUDGET,
    lot: lot([30, 42], [21, 36], [20, 36]),
    params: { w: 36, d: 24, floors: 28 },
    variants: [{ suffix: "" }, { suffix: "_b", seed: 4, params: { w: 30, d: 21, floors: 22 } }],
    build: ledMegablock,
  },
  {
    id: "bld_hi_hotel", category: "building", tags: [...DT, "zone:mid"], budget: TOWER_BUDGET,
    lot: lot([24, 42], [30, 42], [16, 34]),
    params: { w: 33, d: 36, floors: 26 },
    variants: [{ suffix: "" }, { suffix: "_b", seed: 13, params: { w: 24, d: 30, floors: 18 } }],
    build: hotel,
  },
  {
    id: "bld_hi_arcology", category: "building", tags: DT, budget: TOWER_BUDGET,
    lot: lot([30, 42], [30, 42], [20, 40]),
    params: { w: 42, d: 42, floors: 32 },
    variants: [{ suffix: "" }, { suffix: "_b", seed: 17, params: { w: 30, d: 30, floors: 22 } }],
    build: arcology,
  },
  {
    id: "bld_hi_needle", category: "building", tags: DT, budget: TOWER_BUDGET,
    lot: lot([18, 30], [18, 30], [30, 45]),
    params: { w: 21, d: 21, floors: 40 },
    variants: [{ suffix: "" }, { suffix: "_b", seed: 3, params: { w: 18, d: 18, floors: 32 } }],
    build: needle,
  },
  {
    id: "bld_hi_brutalist", category: "building", tags: [...DT, "zone:mid"], budget: TOWER_BUDGET,
    lot: lot([24, 42], [21, 42], [14, 36]),
    params: { w: 33, d: 30, floors: 26 },
    variants: [{ suffix: "" }, { suffix: "_b", seed: 21, params: { w: 24, d: 21, floors: 16 } }],
    build: brutalist,
  },
];
