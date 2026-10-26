// =============================================================
// BRAÇO EM PRIMEIRA PESSOA (modelo com ossos)
// Usa o braço direito do modelo "First Person hands rigged"
// (davidfischer, CC-BY 4.0): pele lisa, mão de verdade.
// - o braço esquerdo some (osso encolhido)
// - a mão fecha em punho: cada dedo dobra para o lado que leva a
//   ponta para perto da palma (descoberto sozinho, sem chutar eixo)
// - o braço é encaixado no "punho" do braço do jogo (mesmo lugar onde
//   as ferramentas ficam), apontando para frente
// =============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FP_ARMS_GLB } from './fp_arms_data.js';

const SKIN = new THREE.MeshLambertMaterial({ color: '#c99a6e' });

function bytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

const wp = (o) => new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);

// Dobra a cadeia de ossos do dedo: em cada junta testa os 6 sentidos e
// fica com o que deixa a ponta mais perto do centro da palma.
function curlFinger(chain, tip, palm, angle, root) {
  for (const b of chain) {
    let best = null;
    let bestD = Infinity;
    const r0 = b.quaternion.clone();
    for (const axis of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      b.quaternion.copy(r0).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...axis), angle));
      root.updateMatrixWorld(true);
      const d = wp(tip).distanceTo(palm);
      if (d < bestD) {
        bestD = d;
        best = b.quaternion.clone();
      }
    }
    b.quaternion.copy(best);
    root.updateMatrixWorld(true);
  }
}

// Carrega e devolve um Group com o braço direito já em punho, com a
// mão na origem e o antebraço indo para +z (a mão aponta para -z).
export function loadFpArm() {
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(bytes(FP_ARMS_GLB), '', (gltf) => {
      const model = gltf.scene;
      const bones = {};
      model.traverse((o) => {
        // o GLTFLoader tira os pontos dos nomes ("hand.R_010" -> "handR_010")
        if (o.isBone) bones[o.name.replace(/_\d+$/, '').replace(/\./g, '')] = o;
        if (o.isMesh) {
          o.material = SKIN;
          o.frustumCulled = false;
          o.renderOrder = 10;
          o.castShadow = false;
        }
      });
      model.updateMatrixWorld(true);
      // some o braço esquerdo
      if (bones['clavicleL']) bones['clavicleL'].scale.setScalar(0.001);
      model.updateMatrixWorld(true);
      // centro da palma (um pouco além do osso da mão, para os dedos)
      const hand = bones['handR'];
      const midBase = bones['f_middle01R'];
      const palm = wp(hand).lerp(wp(midBase), 0.7);
      for (const f of ['index', 'middle', 'ring', 'pinky']) {
        const chain = [1, 2, 3].map((k) => bones[`f_${f}0${k}R`]).filter(Boolean);
        const tip = bones[`f_${f}03R_end`] ?? chain[chain.length - 1];
        if (chain.length) curlFinger(chain, tip, palm, 1.25, model);
      }
      const thumb = [1, 2, 3].map((k) => bones[`thumb0${k}R`]).filter(Boolean);
      if (thumb.length) curlFinger(thumb.slice(1), bones['thumb03R_end'] ?? thumb[2], wp(bones['f_index02R'] ?? hand), 0.7, model);

      // eixo do antebraço (cotovelo -> mão) e lado do polegar
      const elbow = wp(bones['forearmR']);
      const h = wp(hand);
      const fwd = h.clone().sub(elbow).normalize();
      const side = wp(bones['thumb01R'] ?? hand).sub(wp(bones['palm_pinkyR'] ?? hand)).normalize();
      // gira para: antebraço -> -z, polegar -> -x (lado de dentro da tela)
      const m = new THREE.Matrix4().makeBasis(
        side.clone().negate(),
        new THREE.Vector3().crossVectors(fwd.clone().negate(), side.clone().negate()).normalize(),
        fwd.clone().negate(),
      );
      // corrige a base para ficar ortogonal
      const x = side.clone().negate();
      const z = fwd.clone().negate();
      x.sub(z.clone().multiplyScalar(x.dot(z))).normalize();
      const y = new THREE.Vector3().crossVectors(z, x).normalize();
      m.makeBasis(x, y, z);
      const q = new THREE.Quaternion().setFromRotationMatrix(m).invert();
      const holder = new THREE.Group();
      const pivot = new THREE.Group();
      pivot.quaternion.copy(q);
      pivot.add(model);
      // mão na origem (a escala do modelo é em centímetros)
      model.position.copy(h).multiplyScalar(-1);
      holder.add(pivot);
      holder.scale.setScalar(0.0125); // cm -> m, um pouco maior para a mão aparecer bem
      resolve({ group: holder, bones });
    }, reject);
  });
}
