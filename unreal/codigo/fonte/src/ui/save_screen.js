// =============================================================
// JOGOS SALVOS – escolher o save que quer jogar, começar um jogo novo num espaço,
// apagar um save e voltar o nível a 1. Cada ação perigosa pede "Tem certeza?".
// =============================================================
import { SLOTS, listSlots, getActiveSlot, mainSummary } from '../core/save.js';

const quando = (t) => {
  if (!t) return '';
  const d = new Date(t);
  return `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

export class SaveScreen {
  // actions: { onPlaySlot(n), onNewInSlot(n), onDeleteSlot(n), onResetSlot(n), onSaveHere(n)?, onContinue(), onResetMain() }
  constructor(root, actions) {
    this.actions = actions;
    this.inGame = false;
    this.el = document.createElement('div');
    this.el.className = 'overlay saves-overlay';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="saves-panel">
        <header class="saves-head"><h2>JOGOS SALVOS</h2><button type="button" class="saves-x" data-act="fechar" aria-label="Fechar">✕</button></header>
        <div class="saves-list" data-ref="lista"></div>
        <p class="saves-note" data-ref="nota"></p>
        <div class="saves-confirm" data-ref="confirma" hidden>
          <div class="saves-confirm-box">
            <p data-ref="pergunta"></p>
            <div class="saves-confirm-btns">
              <button type="button" class="btn btn-small" data-act="nao">Não</button>
              <button type="button" class="btn btn-small btn-danger" data-act="sim">Sim, tenho certeza</button>
            </div>
          </div>
        </div>
      </div>`;
    root.appendChild(this.el);
    this.refs = {};
    this.el.querySelectorAll('[data-ref]').forEach((e) => { this.refs[e.dataset.ref] = e; });
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      this._click(b.dataset.act, Number(b.dataset.n || 0));
    });
    this._pending = null;
  }

  open({ inGame = false } = {}) {
    this.inGame = inGame;
    this._pending = null;
    this.refs.confirma.hidden = true;
    this.el.hidden = false;
    this.render();
  }

  close() {
    this.el.hidden = true;
  }

  _ask(text, fn) {
    this._pending = fn;
    this.refs.pergunta.textContent = text;
    this.refs.confirma.hidden = false;
  }

  _click(act, n) {
    const A = this.actions;
    switch (act) {
      case 'fechar': this.close(); break;
      case 'nao': this._pending = null; this.refs.confirma.hidden = true; break;
      case 'sim': { const f = this._pending; this._pending = null; this.refs.confirma.hidden = true; f?.(); break; }
      case 'continuar': A.onContinue?.(); break;
      case 'resetar-auto': this._ask('Voltar o nível do jogo atual para 1? Você perde o XP, os pontos de habilidade e os engramas aprendidos. A base, a mochila e os bichos ficam.', () => A.onResetMain?.()); break;
      case 'jogar': A.onPlaySlot?.(n); break;
      case 'novo': this._ask(`Começar um jogo NOVO no Espaço ${n}? O jogo que está aberto agora não é salvo.`, () => A.onNewInSlot?.(n)); break;
      case 'salvar': {
        const used = !listSlots().find((m) => m.n === n)?.empty;
        const go = () => { A.onSaveHere?.(n); this.render(); };
        if (used) this._ask(`Salvar por cima do Espaço ${n}? O que está lá será substituído.`, go); else go();
        break;
      }
      case 'resetar': this._ask(`Voltar o nível do Espaço ${n} para 1? Você perde o XP, os pontos e os engramas aprendidos. A base, a mochila e os bichos ficam.`, () => { A.onResetSlot?.(n); this.render(); }); break;
      case 'apagar': this._ask(`APAGAR o Espaço ${n}? Isso não dá para desfazer.`, () => { A.onDeleteSlot?.(n); this.render(); }); break;
      default: break;
    }
  }

  render() {
    const ativo = getActiveSlot();
    const main = mainSummary();
    const rows = [];
    rows.push(`
      <div class="save-card ${main ? '' : 'vazio'}">
        <div class="save-info"><b>Jogo atual (salvo automático)</b>
          <span>${main ? `Nível ${main.level} · Dia ${main.day}${main.tamed ? ` · ${main.tamed} domado(s)` : ''}${ativo ? ` · jogando no Espaço ${ativo}` : ''}` : 'Nenhum jogo em andamento'}</span></div>
        <div class="save-btns">
          ${main && !this.inGame ? '<button type="button" class="btn btn-small btn-primary" data-act="continuar">Continuar</button>' : ''}
          ${main ? '<button type="button" class="btn btn-small" data-act="resetar-auto">Resetar nível</button>' : ''}
        </div>
      </div>`);
    for (const m of listSlots()) {
      const eAtivo = m.n === ativo;
      rows.push(`
      <div class="save-card ${m.empty ? 'vazio' : ''} ${eAtivo ? 'ativo' : ''}">
        <div class="save-info"><b>Espaço ${m.n}${eAtivo ? ' · em uso' : ''}</b>
          <span>${m.empty ? 'Vazio' : `Nível ${m.level} · Dia ${m.day}${m.tamed ? ` · ${m.tamed} domado(s)` : ''} · ${quando(m.savedAt)}`}</span></div>
        <div class="save-btns">
          ${m.empty
    ? `<button type="button" class="btn btn-small btn-primary" data-act="novo" data-n="${m.n}">Novo jogo</button>`
    : `<button type="button" class="btn btn-small btn-primary" data-act="jogar" data-n="${m.n}">Jogar</button>`}
          ${this.inGame ? `<button type="button" class="btn btn-small" data-act="salvar" data-n="${m.n}">Salvar aqui</button>` : ''}
          ${m.empty ? '' : `<button type="button" class="btn btn-small" data-act="resetar" data-n="${m.n}">Resetar nível</button>
          <button type="button" class="btn btn-small btn-danger" data-act="apagar" data-n="${m.n}">Apagar</button>`}
        </div>
      </div>`);
    }
    this.refs.lista.innerHTML = rows.join('');
    this.refs.nota.textContent = `${SLOTS.length} espaços. Jogando de um espaço, o progresso é guardado nele sozinho.`;
  }
}
