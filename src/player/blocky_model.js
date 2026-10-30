// =============================================================
// PERSONAGEM QUADRADINHO (blocos, como em Minecraft/Roblox clássico).
// Cada parte é um bloco com articulação de verdade: cintura, ombros, cotovelos, quadris e joelhos,
// então as animações (andar, correr, pular, machadada, mineração, lança, soco) dobram nos lugares certos.
// As poses vêm das mesmas contas do PlayerModel (_computePose); aqui só se aplicam nas juntas.
// =============================================================
import * as THREE from 'three';
import { PlayerModel } from './player_model.js';
import { makeTool } from './player_hands.js';
import { pixelTexture } from './pixel_tex.js';

const lamb = (hex) => new THREE.MeshLambertMaterial({ color: hex, map: pixelTexture() });
const flat = (hex) => new THREE.MeshLambertMaterial({ color: hex });

function box(w, h, d, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export class BlockyModel {
  constructor() {
    const SKIN = lamb('#d4a174');
    const SHIRT = lamb('#3f8fc4');
    const SLEEVE = lamb('#3a83b5');
    const PANTS = lamb('#43498f');
    const BOOT = lamb('#4a3526');
    const HAIR = lamb('#4a2f1c');
    const DARK = flat('#1d1713');
    const WHITE = flat('#f2f2ee');

    this.root = new THREE.Group();
    this.root.name = 'Jogador';
    this.model = new THREE.Group(); // tamanho do boneco (um pouco menor que 1,9 m)
    this.model.scale.setScalar(0.96);
    this.model.rotation.y = Math.PI; // o jogo olha para o outro lado: gira o boneco todo
    this.root.add(this.model);

    // quadril (gira e desce nos agachamentos) — a 0,9 m do chão
    this.body = new THREE.Group();
    this.body.position.y = 0.9;
    this.model.add(this.body);
    this.body.add(box(0.46, 0.16, 0.25, PANTS, 0, -0.02, 0));

    // pernas: coxa (quadril) + canela (joelho) + pé
    const leg = (x) => {
      const hip = new THREE.Group();
      hip.position.set(x, -0.08, 0);
      hip.add(box(0.2, 0.42, 0.22, PANTS, 0, -0.21, 0));
      const knee = new THREE.Group();
      knee.position.set(0, -0.42, 0);
      knee.add(box(0.19, 0.36, 0.2, PANTS, 0, -0.18, 0));
      knee.add(box(0.2, 0.1, 0.3, BOOT, 0, -0.41, 0.04));
      hip.add(knee);
      this.body.add(hip);
      return { hip, knee };
    };
    // de frente (para +z) a direita do personagem fica no lado -x
    const lL = leg(0.11);
    const lR = leg(-0.11);
    this.legL = lL.hip; this.kneeL = lL.knee;
    this.legR = lR.hip; this.kneeR = lR.knee;

    // coluna (cintura): tronco, cabeça e braços giram juntos
    this.spine = new THREE.Group();
    this.spine.position.y = 0.06;
    this.body.add(this.spine);
    this.spine.add(box(0.48, 0.58, 0.25, SHIRT, 0, 0.3, 0));
    this.spine.add(box(0.5, 0.06, 0.27, flat('#6b4a2c'), 0, 0.03, 0)); // cinto

    // cabeça
    this.head = new THREE.Group();
    this.head.position.y = 0.62;
    this.head.add(box(0.14, 0.06, 0.14, SKIN, 0, 0.03, 0)); // pescoço
    this.head.add(box(0.31, 0.31, 0.31, SKIN, 0, 0.2, 0));
    this.head.add(box(0.33, 0.1, 0.33, HAIR, 0, 0.38, -0.005)); // cabelo: topo
    this.head.add(box(0.33, 0.28, 0.08, HAIR, 0, 0.22, -0.125)); // atrás
    this.head.add(box(0.04, 0.2, 0.3, HAIR, 0.16, 0.26, -0.02)); // costeletas
    this.head.add(box(0.04, 0.2, 0.3, HAIR, -0.16, 0.26, -0.02));
    for (const sx of [-1, 1]) {
      this.head.add(box(0.06, 0.05, 0.01, WHITE, sx * 0.075, 0.22, 0.156));
      this.head.add(box(0.035, 0.05, 0.012, DARK, sx * 0.075 + sx * 0.0, 0.22, 0.158));
    }
    this.head.add(box(0.08, 0.04, 0.02, lamb('#b87d56'), 0, 0.16, 0.165)); // nariz
    this.head.add(box(0.12, 0.02, 0.012, lamb('#8a4b3c'), 0, 0.1, 0.157)); // boca
    this.spine.add(this.head);

    // braços: ombro + cotovelo + mão
    const arm = (x) => {
      const sh = new THREE.Group();
      sh.position.set(x, 0.54, 0);
      sh.add(box(0.17, 0.3, 0.17, SLEEVE, 0, -0.14, 0));
      const el = new THREE.Group();
      el.position.set(0, -0.29, 0);
      el.add(box(0.16, 0.2, 0.16, SKIN, 0, -0.09, 0));
      el.add(box(0.17, 0.1, 0.17, SKIN, 0, -0.23, 0)); // mão
      sh.add(el);
      this.spine.add(sh);
      return { sh, el };
    };
    const aL = arm(0.33);
    const aR = arm(-0.33);
    this.armL = aL.sh; this.elbowL = aL.el;
    this.armR = aR.sh; this.elbowR = aR.el;

    this._phase = 0;
    this._swing = 0;
    this.toolKind = 'mao';
  }

  // ferramenta na mão direita (na ponta do antebraço)
  setTool(kind) {
    kind = kind ?? 'mao';
    if (kind === this.toolKind) return;
    this.toolKind = kind;
    if (this._toolMesh) {
      this.elbowR.remove(this._toolMesh);
      this._toolMesh = null;
    }
    if (kind === 'mao') return;
    const t = makeTool(kind);
    t.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    t.position.set(0, -0.26, 0.03);
    t.rotation.x = kind === 'arco' ? 0.2 : kind === 'pistola' || kind === 'luneta' ? Math.PI / 2 : kind === 'lanca' ? 1.8 : 1.1;
    if (kind === 'arco') t.rotation.z = -0.35;
    t.scale.setScalar(1.25);
    this.elbowR.add(t);
    this._toolMesh = t;
  }

  update(dt, s) {
    this.root.position.copy(s.position);
    this.root.rotation.y = s.facing;
    this.root.visible = s.visible;
    const b = this.body;
    this._deadT = s.dead ? (this._deadT ?? 0) + dt : 0;
    if (s.dead) {
      const k = Math.min(1, this._deadT / 0.9);
      const e = k * k;
      b.rotation.set(0, 0, (Math.PI / 2) * e);
      b.position.set(0.9 * e, 0.9 - 0.75 * e, 0);
      this.spine.rotation.set(0, 0, 0);
      this.armL.rotation.set(0, 0, -0.6 * e);
      this.armR.rotation.set(0, 0, 0.6 * e);
      return;
    }
    const L = this._computePose(dt, s);
    if (!L) {
      // nadando: deitado, braçadas e pernadas
      const sw = Math.sin(this._phase);
      b.rotation.set(1.15, 0, 0, 'YXZ');
      b.position.set(0, 0.95, 0.1);
      this.armL.rotation.set(-2.6 + sw * 0.8, 0, -0.3);
      this.armR.rotation.set(-2.6 - sw * 0.8, 0, 0.3);
      this.legL.rotation.set(sw * 0.4, 0, 0);
      this.legR.rotation.set(-sw * 0.4, 0, 0);
      this.kneeL.rotation.x = 0.3 + 0.25 * Math.max(0, sw);
      this.kneeR.rotation.x = 0.3 + 0.25 * Math.max(0, -sw);
      this.elbowL.rotation.x = this.elbowR.rotation.x = -0.25;
      this.spine.rotation.set(0, 0, 0);
      this.head.rotation.set(-0.9, 0, 0);
      return;
    }
    // juntas de verdade: coxa/ombro giram; joelho dobra a canela para trás, cotovelo o antebraço para a frente
    this.legL.rotation.set(L.legL, 0, 0);
    this.legR.rotation.set(L.legR, 0, 0);
    this.kneeL.rotation.x = L.kneeL;
    this.kneeR.rotation.x = L.kneeR;
    this.armL.rotation.set(L.axL, 0, -L.azL);
    this.armR.rotation.set(L.axR, 0, -L.azR);
    this.elbowL.rotation.x = -L.elbL;
    this.elbowR.rotation.x = -L.elbR;
    b.position.set(0, 0.9 + L.dip, 0);
    b.rotation.set(0, L.pelvis, 0, 'YXZ');
    this.spine.rotation.set(L.lean, L.twist, L.side, 'YXZ');
    this.head.rotation.set(L.headX, -L.twist * 0.5, 0);
  }
}

BlockyModel.prototype.swing = PlayerModel.prototype.swing;
BlockyModel.prototype.gather = PlayerModel.prototype.gather;
BlockyModel.prototype._computePose = PlayerModel.prototype._computePose;
