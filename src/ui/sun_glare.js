// =============================================================
// BRILHO DO SOL NA TELA: clarão em volta do sol, uma faixa de luz e uns
// reflexos de lente que andam do lado oposto quando o sol está à vista.
// É uma camada por cima do 3D (mistura "screen"), então funciona igual em
// qualquer qualidade gráfica, sem custo de pós-processamento.
// =============================================================
import * as THREE from 'three';

const _v = new THREE.Vector3();
const _f = new THREE.Vector3();
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class SunGlare {
  constructor(parent) {
    const el = document.createElement('div');
    el.className = 'sun-glare';
    el.hidden = true;
    el.innerHTML = '<i class="sg-core"></i><i class="sg-streak"></i><i class="sg-g sg-g1"></i><i class="sg-g sg-g2"></i><i class="sg-g sg-g3"></i>';
    // névoa dourada do sol baixo (cobre boa parte da tela, mesmo com o sol fora de vista)
    const haze = document.createElement('div');
    haze.className = 'sun-haze';
    haze.hidden = true;
    parent.appendChild(haze);
    this.haze = haze;
    parent.appendChild(el);
    // lavagem branca em volta do sol (tela clareia), some devagar quando desvia o olhar
    const wash = document.createElement('div');
    wash.className = 'sun-wash';
    wash.hidden = true;
    parent.appendChild(wash);
    this.wash = wash;
    this.dazzle = 0;      // 0 a 1: quão ofuscado o olho está (sobe rápido, desce devagar)
    this.amt = 0;         // força do clarão neste quadro (antes da adaptação)
    this._sx = 0;
    this._sy = 0;
    this._ray = new THREE.Raycaster();
    this._occB = 0;       // sol atrás de construção
    this.el = el;
    this.parts = [...el.children];
    this._sc = '';
    this._occT = 0;
    this._occluded = 0;   // 0 = sol à vista, 1 = atrás de morro
    this._occCur = 0;
  }

  // world: precisa de heightAt(x, z). active: false no menu e embaixo d'água.
  update(dt, camera, sky, world, active, brightness = 1) {
    // adaptação do olho: ofusca rápido, recupera devagar
    this.dazzle += (this.amt - this.dazzle) * Math.min(1, dt * (this.amt > this.dazzle ? 5 : 0.7));
    this.amt = 0;
    this._wash(brightness);
    const night = sky.night ?? 0;
    const sunUp = 1 - smooth(0.25, 0.75, night);
    if (!active || sunUp < 0.02) {
      this.el.hidden = true;
      this.haze.hidden = true;
      return;
    }
    camera.getWorldDirection(_f);
    const dir = sky.sunDir;
    const dot = _f.dot(dir);
    // névoa dourada: forte com o sol baixo (manhã e fim de tarde), mais forte de frente para ele
    {
      const lowSun = 1 - smooth(0.12, 0.7, dir.y);
      const front = 0.3 + 0.7 * smooth(-0.35, 0.6, dot);
      const hz = sunUp * lowSun * front * 0.75 + sunUp * 0.05;
      if (hz < 0.02) {
        this.haze.hidden = true;
      } else {
        _v.copy(camera.position).addScaledVector(dir, 1000).project(camera);
        const W0 = window.innerWidth;
        const H0 = window.innerHeight;
        const cx0 = dot > 0 ? Math.max(-0.4 * W0, Math.min(1.4 * W0, (_v.x * 0.5 + 0.5) * W0)) : W0 * 0.5;
        const cy0 = dot > 0 ? Math.max(-0.4 * H0, Math.min(1.4 * H0, (-_v.y * 0.5 + 0.5) * H0)) : H0 * 0.3;
        const sc0 = sky.sun.color;
        this.haze.hidden = false;
        this.haze.style.setProperty('--hx', `${cx0.toFixed(0)}px`);
        this.haze.style.setProperty('--hy', `${cy0.toFixed(0)}px`);
        this.haze.style.setProperty('--hc', `${Math.round(255 * Math.min(1, sc0.r + 0.05))},${Math.round(255 * Math.min(1, sc0.g * 0.72))},${Math.round(255 * Math.min(1, sc0.b * 0.42))}`);
        this.haze.style.opacity = Math.min(0.7, hz).toFixed(3);
      }
    }
    if (dot < 0.1) {
      this.el.hidden = true;
      return;
    }
    // atrás de um morro? (olha o terreno ao longo da direção do sol, de tempos em tempos)
    this._occT -= dt;
    if (this._occT <= 0) {
      this._occT = 0.25;
      let hit = 0;
      const p = camera.position;
      for (let d = 12; d <= 420; d += 18) {
        const x = p.x + dir.x * d;
        const z = p.z + dir.z * d;
        if (world.heightAt(x, z) > p.y + dir.y * d) {
          hit = 1;
          break;
        }
      }
      this._occluded = hit;
      // atrás de uma construção? (só as peças perto, poucas vezes por segundo)
      let b = 0;
      if (!hit && world.structures?.length) {
        const near = [];
        for (const st of world.structures) {
          if (st.root && st.root.visible !== false && Math.hypot(st.root.position.x - p.x, st.root.position.z - p.z) < 40) near.push(st.root);
        }
        if (near.length) {
          this._ray.set(p, dir);
          this._ray.far = 60;
          b = this._ray.intersectObjects(near, true).length ? 1 : 0;
        }
      }
      this._occB = b;
    }
    this._occCur += (Math.max(this._occluded, this._occB) - this._occCur) * Math.min(1, dt * 6);

    _v.copy(camera.position).addScaledVector(dir, 1000).project(camera);
    const W = window.innerWidth;
    const H = window.innerHeight;
    const sx = (_v.x * 0.5 + 0.5) * W;
    const sy = (-_v.y * 0.5 + 0.5) * H;
    const edge = 1 - smooth(1.0, 1.7, Math.max(Math.abs(_v.x), Math.abs(_v.y)));
    // o brilho (gamma) da pessoa muda a força do clarão
    const amt = sunUp * smooth(0.1, 0.45, dot) * edge * (1 - this._occCur * 0.92) * Math.min(1.35, 0.6 + 0.4 * brightness);
    this.amt = Math.min(1, amt * smooth(0.3, 1, dot));
    this._sx = sx;
    this._sy = sy;
    if (amt < 0.01) {
      this.el.hidden = true;
      return;
    }
    this.el.hidden = false;
    const sc = sky.sun.color;
    const col = `${Math.round(255 * Math.min(1, sc.r + 0.1))},${Math.round(255 * Math.min(1, sc.g + 0.1))},${Math.round(255 * Math.min(1, sc.b + 0.1))}`;
    if (col !== this._sc) {
      this._sc = col;
      this.el.style.setProperty('--sc', col);
    }
    // quanto mais alto o sol, menos clarão (de manhã e no pôr do sol o clarão é maior)
    const low = 1 - smooth(0.1, 0.9, dir.y);
    const [core, streak, g1, g2, g3] = this.parts;
    const put = (n, x, y, o, s = 1) => {
      n.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) scale(${s.toFixed(3)})`;
      n.style.opacity = o.toFixed(3);
    };
    put(core, sx, sy, Math.min(1, amt * (0.8 + 0.2 * low)), 1 + low * 0.4);
    put(streak, sx, sy, amt * 0.5, 1 + low * 0.3);
    const cx = W / 2;
    const cy = H / 2;
    // reflexos de lente: ficam na linha que liga o sol ao centro da tela, do outro lado
    const ghost = amt * smooth(0.0, 0.5, 1 - Math.hypot(_v.x, _v.y) * 0.8);
    put(g1, cx + (cx - sx) * 0.55, cy + (cy - sy) * 0.55, ghost * 0.9, 1);
    put(g2, cx + (cx - sx) * 1.05, cy + (cy - sy) * 1.05, ghost * 0.75, 1.7);
    put(g3, cx + (cx - sx) * 0.15, cy + (cy - sy) * 0.15, ghost * 0.6, 0.7);
  }

  // lavagem branca: círculo grande em volta do sol + véu leve na tela toda
  _wash(brightness) {
    const d = this.dazzle;
    if (d < 0.015) {
      this.wash.hidden = true;
      return;
    }
    this.wash.hidden = false;
    const k = Math.min(1.4, 0.55 + 0.45 * brightness);
    this.wash.style.setProperty('--wx', `${this._sx.toFixed(0)}px`);
    this.wash.style.setProperty('--wy', `${this._sy.toFixed(0)}px`);
    this.wash.style.opacity = Math.min(0.92, d * 0.85 * k).toFixed(3);
  }
}
