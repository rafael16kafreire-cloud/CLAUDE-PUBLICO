// =============================================================
// FLECHAS – voam com gravidade, acertam bichos (dano e sono/torpor)
// e ficam espetadas no chão um tempinho.
// =============================================================
import * as THREE from 'three';
import { BALANCE } from '../core/balance.js';
import { sound } from '../audio/audio.js';

const SHAFT = new THREE.CylinderGeometry(0.012, 0.012, 0.75, 5).rotateX(Math.PI / 2);
const TIP = new THREE.ConeGeometry(0.03, 0.09, 5).rotateX(-Math.PI / 2).translate(0, 0, -0.42);
const FLETCH = new THREE.BoxGeometry(0.07, 0.005, 0.12).translate(0, 0, 0.33);
const WOOD = new THREE.MeshLambertMaterial({ color: '#8a6440' });
const STONE = new THREE.MeshLambertMaterial({ color: '#7a7a80' });
const TRANQ = new THREE.MeshLambertMaterial({ color: '#7a4ac8' });
const FEATHER = new THREE.MeshLambertMaterial({ color: '#e8e0c8', side: THREE.DoubleSide });

export class Projectiles {
  constructor(world) {
    this.world = world;
    this.list = [];
    this._pt = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._fwd = new THREE.Vector3(0, 0, -1);
  }

  _mesh(ammo) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(SHAFT, WOOD));
    g.add(new THREE.Mesh(TIP, ammo.torpor > 0 ? TRANQ : STONE));
    const f1 = new THREE.Mesh(FLETCH, FEATHER);
    const f2 = f1.clone();
    f2.rotation.z = Math.PI / 2;
    g.add(f1, f2);
    this.world.scene.add(g);
    return g;
  }

  // Atira: origem, direção (normalizada), munição { dano, torpor }, quem atirou
  fire(origin, dir, ammo, owner, damageMul = 1) {
    const A = BALANCE.arco;
    const p = { pos: origin.clone(), vel: dir.clone().multiplyScalar(A.velocidade_m_s), ammo, owner, mul: damageMul, life: A.alcance_m / A.velocidade_m_s + 1, stuck: 0 };
    p.mesh = this._mesh(ammo);
    p.mesh.position.copy(p.pos);
    this.list.push(p);
    return p;
  }

  update(dt) {
    const A = BALANCE.arco;
    const w = this.world;
    for (const p of [...this.list]) {
      if (p.stuck > 0) {
        p.stuck -= dt;
        if (p.stuck <= 0) this._remove(p);
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        this._remove(p);
        continue;
      }
      // anda em passos pequenos (não atravessa bicho fino)
      const steps = Math.max(1, Math.ceil((p.vel.length() * dt) / 0.6));
      const h = dt / steps;
      let done = false;
      for (let k = 0; k < steps && !done; k++) {
        p.vel.y -= A.gravidade * h;
        p.pos.addScaledVector(p.vel, h);
        // bicho
        const c = this._hitCreature(p);
        if (c) {
          const dmg = p.ammo.dano * p.mul;
          c.takeDamage(dmg, p.owner);
          if (p.ammo.torpor) c.addTorpor?.(p.ammo.torpor, p.owner);
          w.creatures?.defendOwner(p.owner, c);
          w.effects?.burst(p.pos.clone(), 'sangue', 5, 2);
          sound.play('carne', p.pos);
          p.owner?.stats?.addXP(A.xp_acerto);
          p.owner?.onArrowHit?.(c);
          this._remove(p);
          done = true;
          break;
        }
        // chão ou água
        const g = w.heightAt(p.pos.x, p.pos.z);
        const water = w.waterAt(p.pos.x, p.pos.z);
        if (water && p.pos.y < water.level) {
          w.effects?.burst(p.pos.clone(), 'agua', 4, 1.5);
          this._remove(p);
          done = true;
        } else if (p.pos.y < g) {
          p.pos.y = g + 0.05;
          p.stuck = 15; // fica espetada no chão
          done = true;
        }
      }
      // aponta para onde está indo
      if (p.mesh) {
        p.mesh.position.copy(p.pos);
        if (p.vel.lengthSq() > 0.01) p.mesh.quaternion.setFromUnitVectors(this._fwd, this._pt.copy(p.vel).normalize());
      }
    }
  }

  _hitCreature(p) {
    const list = this.world.creatures?.list;
    if (!list) return null;
    for (const c of list) {
      if (!c.alive || c.rider || (c.tamed && c.owner === p.owner)) continue;
      if (Math.abs(c.pos.x - p.pos.x) > 25 || Math.abs(c.pos.z - p.pos.z) > 25) continue;
      c.closestBodyPoint(p.pos.x, p.pos.z, this._pt);
      const r = Math.min(c.radius, 1.6) + 0.15;
      if (Math.hypot(this._pt.x - p.pos.x, this._pt.z - p.pos.z) > r) continue;
      const base = (c.flies || c.aquatic) ? c.pos.y - c.height * 0.5 : c.pos.y;
      if (p.pos.y < base - 0.2 || p.pos.y > base + c.height * 1.1 + 0.2) continue;
      return c;
    }
    return null;
  }

  _remove(p) {
    this.world.scene.remove(p.mesh);
    this.list = this.list.filter((x) => x !== p);
  }
}
