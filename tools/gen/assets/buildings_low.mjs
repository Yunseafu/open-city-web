// Mid / low-rise buildings (residential, commercial, industrial, mid-rise offices).
// Recipes live in tools/gen/lib/blow_*.mjs; this file only registers them.
import { residential } from "../lib/blow_res.mjs";
import { mid } from "../lib/blow_mid.mjs";
import { commercial } from "../lib/blow_com.mjs";
import { industrial } from "../lib/blow_ind.mjs";

// The registry builds ONLY the listed variants when `variants` is set, so make the default one explicit.
const withDefault = (a) => (a.variants?.some((v) => !v.suffix) ? a : { ...a, variants: [{ suffix: "" }, ...(a.variants ?? [])] });

export const assets = [...mid, ...residential, ...commercial, ...industrial].map(withDefault);
