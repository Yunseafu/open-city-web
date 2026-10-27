import { KhronosTextureContainer2 } from "@babylonjs/core/Misc/khronosTextureContainer2";
import { MeshoptCompression } from "@babylonjs/core/Meshes/Compression/meshoptCompression";

/**
 * Points the meshopt and KTX2/Basis decoders at the self-hosted copies in public/decoders
 * (written by tools/copy-decoders.mjs) so nothing is fetched from a CDN.
 */
export function configureDecoders(base = "/decoders"): void {
  MeshoptCompression.Configuration.decoder.url = `${base}/meshopt_decoder.js`;
  KhronosTextureContainer2.URLConfig = {
    jsDecoderModule: `${base}/babylon.ktx2Decoder.js`,
    wasmUASTCToASTC: `${base}/ktx2/uastc_astc.wasm`,
    wasmUASTCToBC7: `${base}/ktx2/uastc_bc7.wasm`,
    wasmUASTCToRGBA_UNORM: `${base}/ktx2/uastc_rgba8_unorm_v2.wasm`,
    wasmUASTCToRGBA_SRGB: `${base}/ktx2/uastc_rgba8_srgb_v2.wasm`,
    wasmUASTCToR8_UNORM: `${base}/ktx2/uastc_r8_unorm.wasm`,
    wasmUASTCToRG8_UNORM: `${base}/ktx2/uastc_rg8_unorm.wasm`,
    jsMSCTranscoder: `${base}/ktx2/msc_basis_transcoder.js`,
    wasmMSCTranscoder: `${base}/ktx2/msc_basis_transcoder.wasm`,
    wasmZSTDDecoder: `${base}/ktx2/zstddec.wasm`,
  };
}
