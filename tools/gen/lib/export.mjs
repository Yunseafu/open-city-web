// ModelBuilder -> glTF 2.0 (GLB) via glTF-Transform.
//
// Coordinate conversion: builder space is Babylon's left-handed world. Babylon mirrors X when it
// imports glTF, so the file stores x -> -x (positions, normals, node translations; quaternions
// become (x, -y, -z, w)) and triangle winding is reversed. Loading the GLB in Babylon gives back
// exactly the geometry that was authored.

import { Document, NodeIO } from "@gltf-transform/core";
import { KHRMaterialsEmissiveStrength } from "@gltf-transform/extensions";
import { quat } from "./math.mjs";
import { material as lookupMaterial, srgbToLinear } from "./materials.mjs";

export function buildDocument(b, { name = "asset", extras = {} } = {}) {
  const doc = new Document();
  doc.getRoot().getAsset().generator = "open-city-web model generator";
  const emissiveExt = doc.createExtension(KHRMaterialsEmissiveStrength);
  const buffer = doc.createBuffer();
  const scene = doc.createScene(name);
  const mats = new Map();

  const getMaterial = (id) => {
    if (mats.has(id)) return mats.get(id);
    const d = lookupMaterial(id);
    const m = doc.createMaterial(id);
    const [r, g, bl] = srgbToLinear(d.color);
    m.setBaseColorFactor([r, g, bl, d.alpha ?? 1]);
    m.setMetallicFactor(d.metallic ?? 0);
    m.setRoughnessFactor(d.roughness ?? 0.8);
    if (d.emissive) {
      m.setEmissiveFactor(srgbToLinear(d.emissive));
      const s = d.emissiveStrength ?? 1;
      if (s > 1) m.setExtension("KHR_materials_emissive_strength", emissiveExt.createEmissiveStrength().setEmissiveStrength(s));
    }
    if ((d.alpha ?? 1) < 1) m.setAlphaMode("BLEND");
    m.setDoubleSided(false);
    // Marker for the runtime material library; not interpreted by glTF viewers.
    m.setExtras({ tile: d.tile ?? null, atlas: !!d.atlas, tint: !!d.tint });
    mats.set(id, m);
    return m;
  };

  const nodeMap = new Map();
  const emitNode = (bn) => {
    const node = doc.createNode(bn.name);
    nodeMap.set(bn.name, node);
    node.setTranslation([-bn.t[0], bn.t[1], bn.t[2]]);
    node.setRotation([bn.q[0], -bn.q[1], -bn.q[2], bn.q[3]]);
    node.setScale(bn.s);
    if (bn.extras) node.setExtras(bn.extras);
    if (bn.geo.size) {
      const mesh = doc.createMesh(bn.name);
      for (const [id, g] of bn.geo) {
        const pos = new Float32Array(g.pos.length);
        const nrm = new Float32Array(g.nrm.length);
        for (let i = 0; i < pos.length; i += 3) {
          pos[i] = -g.pos[i]; pos[i + 1] = g.pos[i + 1]; pos[i + 2] = g.pos[i + 2];
          nrm[i] = -g.nrm[i]; nrm[i + 1] = g.nrm[i + 1]; nrm[i + 2] = g.nrm[i + 2];
        }
        const vcount = g.verts;
        const idx = vcount > 65535 ? new Uint32Array(g.idx.length) : new Uint16Array(g.idx.length);
        for (let i = 0; i < g.idx.length; i += 3) {
          idx[i] = g.idx[i]; idx[i + 1] = g.idx[i + 2]; idx[i + 2] = g.idx[i + 1]; // reverse winding
        }
        const prim = doc
          .createPrimitive()
          .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(pos).setBuffer(buffer))
          .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(nrm).setBuffer(buffer))
          .setAttribute("TEXCOORD_0", doc.createAccessor().setType("VEC2").setArray(new Float32Array(g.uv)).setBuffer(buffer))
          .setAttribute("COLOR_0", doc.createAccessor().setType("VEC4").setArray(new Float32Array(g.col)).setBuffer(buffer))
          .setIndices(doc.createAccessor().setType("SCALAR").setArray(idx).setBuffer(buffer))
          .setMaterial(getMaterial(id));
        mesh.addPrimitive(prim);
      }
      node.setMesh(mesh);
    }
    for (const ch of bn.children) node.addChild(emitNode(ch));
    return node;
  };

  const rootNode = emitNode(b.root);
  rootNode.setName(name);
  nodeMap.set(name, rootNode);
  scene.addChild(rootNode);

  for (const clip of b.clips) {
    const anim = doc.createAnimation(clip.name);
    for (const tr of clip.tracks) {
      const target = nodeMap.get(tr.node);
      if (!target) throw new Error(`clip "${clip.name}": no node "${tr.node}"`);
      const times = new Float32Array(tr.keys.map((k) => k.t));
      let values, type;
      if (tr.path === "rotation") {
        type = "VEC4";
        values = new Float32Array(tr.keys.length * 4);
        tr.keys.forEach((k, i) => {
          const q = quat.fromEuler(k.v[0], k.v[1], k.v[2]);
          values.set([q[0], -q[1], -q[2], q[3]], i * 4);
        });
      } else {
        type = "VEC3";
        values = new Float32Array(tr.keys.length * 3);
        tr.keys.forEach((k, i) => values.set(tr.path === "translation" ? [-k.v[0], k.v[1], k.v[2]] : k.v, i * 3));
      }
      const sampler = doc
        .createAnimationSampler()
        .setInput(doc.createAccessor().setType("SCALAR").setArray(times).setBuffer(buffer))
        .setOutput(doc.createAccessor().setType(type).setArray(values).setBuffer(buffer))
        .setInterpolation("LINEAR");
      anim.addSampler(sampler);
      anim.addChannel(doc.createAnimationChannel().setTargetNode(target).setTargetPath(tr.path).setSampler(sampler));
    }
  }

  const st = b.stats();
  scene.setExtras({
    tris: st.tris,
    verts: st.verts,
    bounds: { min: st.min, max: st.max },
    ...extras,
  });
  return { doc, stats: st };
}

export async function writeGlb(b, file, opts) {
  const { doc, stats } = buildDocument(b, opts);
  const io = new NodeIO().registerExtensions([KHRMaterialsEmissiveStrength]);
  await io.write(file, doc);
  return stats;
}
