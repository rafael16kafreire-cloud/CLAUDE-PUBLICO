// =============================================================
// AVISO DE PERIGO – quando um bicho selvagem está vindo te caçar,
// aparece uma seta vermelha na borda da tela apontando de onde ele
// vem (como o indicador de dano do ARK), com o nome e a distância.
// Assim dá pra ver um carnotauro chegando mesmo que ele esteja atrás,
// no escuro ou escondido no mato. Poucos <div> reaproveitados.
// =============================================================
import { CSTATE } from '../creatures/creature.js';

const MAX = 3;
const RAIO_MAX = 95; // só avisa de bichos a até tantos metros
const RAIO_PERTO = 28; // abaixo disso a borda da tela pulsa em vermelho

export class Perigo {
  constructor(root) {
    this.el = document.createElement('div');
    this.el.className = 'perigo-layer';
    this.el.hidden = true;
    root.appendChild(this.el);
    this.setas = [];
    for (let i = 0; i < MAX; i++) {
      const d = document.createElement('div');
      d.className = 'perigo-seta';
      d.hidden = true;
      d.innerHTML = '<span class="perigo-ponta"></span><span class="perigo-nome"></span>';
      this.el.appendChild(d);
      this.setas.push({ d, nome: d.querySelector('.perigo-nome') });
    }
    this.aviso = document.createElement('div');
    this.aviso.className = 'perigo-aviso';
    this.aviso.hidden = true;
    this.el.appendChild(this.aviso);
    this._lista = [];
    this._t = 0;
  }

  /** player: jogador; creatures: manager; yaw: direção da câmera; ativo: false esconde tudo. */
  update(dt, { player, creatures, yaw, ativo }) {
    if (!ativo || player.dead) {
      if (!this.el.hidden) this._esconder();
      return;
    }
    this._t += dt;
    const lista = this._lista;
    lista.length = 0;
    const px = player.position.x;
    const pz = player.position.z;
    for (const c of creatures.list) {
      if (!c.alive || c.tamed || c.netControlled) continue;
      if (c.state !== CSTATE.CHASE && c.state !== CSTATE.ATTACK) continue;
      if (c.target !== player) continue;
      const dx = c.position.x - px;
      const dz = c.position.z - pz;
      const d = Math.hypot(dx, dz);
      if (d > RAIO_MAX) continue;
      lista.push({ c, dx, dz, d });
    }
    if (!lista.length) {
      if (!this.el.hidden) this._esconder();
      return;
    }
    lista.sort((a, b) => a.d - b.d);
    this.el.hidden = false;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const raio = Math.min(w, h) * 0.36;
    // eixos da câmera no plano: frente = (-sin yaw, -cos yaw), direita = (cos yaw, -sin yaw)
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const rx = Math.cos(yaw);
    const rz = -Math.sin(yaw);
    for (let i = 0; i < MAX; i++) {
      const s = this.setas[i];
      const it = lista[i];
      if (!it) {
        if (!s.d.hidden) s.d.hidden = true;
        continue;
      }
      const frente = it.dx * fx + it.dz * fz;
      const lado = it.dx * rx + it.dz * rz;
      const ang = Math.atan2(lado, frente); // 0 = à frente, +90° = à direita, 180° = atrás
      const perto = Math.min(1, Math.max(0, 1 - (it.d - 6) / (RAIO_MAX - 6)));
      const pulso = it.d < RAIO_PERTO ? 0.75 + 0.25 * Math.sin(this._t * 14) : 1;
      s.d.hidden = false;
      s.d.style.opacity = String((0.55 + perto * 0.45) * pulso);
      s.d.style.transform = `translate(${w / 2 + Math.sin(ang) * raio}px, ${h / 2 - Math.cos(ang) * raio}px) translate(-50%, -50%) scale(${(0.9 + perto * 0.7).toFixed(2)})`;
      s.d.firstChild.style.transform = `rotate(${ang}rad)`;
      s.nome.textContent = `${it.c.species.nome} ${Math.round(it.d)} m`;
    }
    const mais = lista[0];
    this.aviso.hidden = false;
    this.aviso.textContent = mais.d < RAIO_PERTO ? `${mais.c.species.nome.toUpperCase()} PERTO!` : `${mais.c.species.nome} te caçando`;
    document.body.classList.toggle('perigo-perto', mais.d < RAIO_PERTO);
  }

  _esconder() {
    this.el.hidden = true;
    for (const s of this.setas) s.d.hidden = true;
    this.aviso.hidden = true;
    document.body.classList.remove('perigo-perto');
  }
}
