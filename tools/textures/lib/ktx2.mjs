// Encode 8-bit RGBA maps to KTX2 (Basis Universal UASTC + Zstd) with ktx2-encoder (WASM, no native tools).
import { encodeToKTX2 } from "ktx2-encoder";

// The Basis wasm logs every slice it encodes straight to stdout; keep our output readable.
const NOISE = /^(Encoding slice|basis_compressor|Slice:|Mode:|Total|Compression|Using|Processing|Generating|Mip|Output|Resampling|Writing|Creating|Packing|Initial|Done|Basis)/;
let patched = false;
function quietWasm() {
  if (patched) return;
  patched = true;
  const write = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk, ...rest) => (typeof chunk === "string" && NOISE.test(chunk.trimStart()) ? true : write(chunk, ...rest));
}

/** Per-map colour-space / preset settings. sRGB maps are perceptual; normals get the normal-map preset. */
const MAP_ENCODING = {
  albedo: { isPerceptual: true, isSetKTX2SRGBTransferFunc: true },
  emissive: { isPerceptual: true, isSetKTX2SRGBTransferFunc: true },
  normal: { isNormalMap: true, isPerceptual: false, isSetKTX2SRGBTransferFunc: false },
  orm: { isPerceptual: false, isSetKTX2SRGBTransferFunc: false },
};

// Measured on 1024x1024 asphalt (noisy, a worst case): uastc 1.0-1.3 MB / 1-4 s per map, etc1s 0.15-0.24 MB / 2 s.
// RDO shaves ~15-30% off UASTC albedo for 5-10x the time and nothing off normals, so it is not used.
export const CODECS = {
  etc1s: { isUASTC: false, qualityLevel: 160, compressionLevel: 1 },
  "etc1s-hq": { isUASTC: false, qualityLevel: 230, compressionLevel: 2 },
  uastc: { isUASTC: true, uastcLDRQualityLevel: 1, enableRDO: false },
  "uastc-hq": { isUASTC: true, uastcLDRQualityLevel: 2, enableRDO: false },
};

/**
 * Codec per map type. `web` is what ships: ETC1S (7x smaller) for colour-like maps, UASTC for normals
 * which ETC1S blocks up. `quality` is all UASTC for inspection. A recipe can override per map with
 * `codec: { emissive: "uastc" }`.
 */
export const PROFILES = {
  web: { albedo: "etc1s", emissive: "etc1s", orm: "etc1s", normal: "uastc" },
  quality: { albedo: "uastc-hq", emissive: "uastc-hq", orm: "uastc-hq", normal: "uastc-hq" },
};

/** data: Uint8Array RGBA (w*h*4), codec: key of CODECS. Returns Uint8Array (.ktx2 file). */
export async function encodeKtx2(mapName, data, w, h, codec = PROFILES.web[mapName]) {
  quietWasm();
  const imageDecoder = async (buf) => ({ data: buf, width: w, height: h });
  return encodeToKTX2(data, {
    generateMipmap: true,
    needSupercompression: true,
    imageDecoder,
    ...CODECS[codec],
    ...MAP_ENCODING[mapName],
  });
}
