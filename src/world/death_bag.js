// =============================================================
// SACO DE MORTE
// Fica onde o jogador morreu, com um feixe de luz visível de longe.
// Some depois de X minutos (balanceamento: morte.saco_duracao_min).
// Fase 1: o saco ainda vai vazio (o inventário chega na Fase 2).
// =============================================================
import * as THREE from 'three';
import { BALANCE } from '../core/balance.js';

const SACK_MAT = new THREE.MeshLambertMaterial({ color: '#7a5a3a', flatShading: true });
const TIE_MAT = new THREE.MeshLambertMaterial({ color: '#d9c48f', flatShading: true });
const BEAM_MAT = new THREE.MeshBasicMaterial({
  color: '#ffd27a',
  transparent: true,
  opacity: 0.35,
  depthWrite: false,
  fog: false,
  blending: THREE.AdditiveBlending,
});

export class DeathBag {
  constructor(scene, position, items = [], label = 'saco de morte') {
    this.scene = scene;
    this.items = items;
    this.label = label;
    this.timeLeft = BALANCE.morte.saco_duracao_min * 60;
    this.removed = false;
    this.interactRange = 3.2;
    this.interactRadius = 1.2;

    this.root = new THREE.Group();
    this.root.position.copy(position);
    this.root.name = 'SacoDeMorte';

    const sack = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0).scale(1, 0.85, 1), SACK_MAT);
    sack.position.y = 0.38;
    sack.castShadow = true;
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.22, 6), TIE_MAT);
    tie.position.y = 0.8;
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 40, 8, 1, true), BEAM_MAT);
    this.beam.position.y = 20;
    this.root.add(sack, tie, this.beam);
    scene.add(this.root);

    this.interactPoint = position.clone().add(new THREE.Vector3(0, 0.5, 0));
    this._t = 0;
  }

  promptText() {
    const m = Math.floor(this.timeLeft / 60);
    const s = Math.floor(this.timeLeft % 60).toString().padStart(2, '0');
    const n = this.items.reduce((a, it) => a + it.qty, 0);
    return `Recuperar ${this.label}${n ? ` · ${n} itens` : ''} (${m}:${s})`;
  }

  // Devolve os itens e remove o saco.
  interact() {
    if (this.removed) return [];
    const items = this.items;
    this.remove();
    return items;
  }

  update(dt) {
    this.timeLeft -= dt;
    this._t += dt;
    this.beam.material.opacity = 0.25 + Math.sin(this._t * 3) * 0.1;
    if (this.timeLeft <= 0) this.remove();
  }

  remove() {
    if (this.removed) return;
    this.removed = true;
    this.scene.remove(this.root);
  }
}
