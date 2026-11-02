// Exporta o esqueleto do molde de cada espécie (creature_models.js) para
// o conversor de bichos encaixar no modelo enviado.
// Uso: node bicho_ossos.mjs espécie > ossos.json
import { MODELS } from '../../src/creatures/creature_models.js';
import { buildSpeciesModel } from '../../src/creatures/creature_builder.js';

const id = process.argv[2];
const m = buildSpeciesModel(MODELS[id]);
m.geometry.computeBoundingBox();
const bb = m.geometry.boundingBox;
console.log(JSON.stringify({
  body: MODELS[id].body,
  legs: (MODELS[id].legs ?? []).map((l) => ({ name: l.name })),
  box: [bb.min.toArray(), bb.max.toArray()],
  bones: m.bones.map((b) => ({ name: b.name, parent: b.parent, pos: b.pos.toArray() })),
}));
