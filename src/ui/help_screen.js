// =============================================================
// TELA DE AJUDA (guia do jogo), no mesmo formato da ajuda do ARK Mobile:
// barra de ícones no topo (Sobrevivência, Interface, Fabricação,
// Criaturas, Mapa), lista de assuntos à esquerda e, à direita, o título,
// uma imagem e o texto. As imagens ficam em assets/ajuda/<id>.jpg
// (entram no jogo na hora de gerar; sem imagem, aparece só a moldura).
// Abre pelo menu de pausa (botão AJUDA) e fecha com o X, Esc ou voltar.
// =============================================================
import IMAGES from 'virtual:ajuda';
import { sound } from '../audio/audio.js';

const svg = (d) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${d}</svg>`;

const TAB_ICONS = {
  survival: svg('<path d="M9.2 8.6a3 3 0 1 1 4.3 2.7c-.9.5-1.5 1-1.5 2.2v.4h-2.2v-.5c0-2 1-2.8 2.1-3.4.6-.3.8-.6.8-1a1.5 1.5 0 0 0-3 .1zM10.9 16h2.4v2.4h-2.4z"/>'),
  ui: svg('<path d="M3 7.5h13.5V19H3z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7.5 4h13.5v11.5" fill="none" stroke="currentColor" stroke-width="1.8"/>'),
  craft: svg('<path d="M3 20.5l9-9 2 2-9 9z"/><path d="M12.3 3.2l7.2 3-1.6 3.6-1.4-.6-1.2 2.9-1.6-.7-3.5-3.5z"/>'),
  creatures: svg('<path d="M3 11.3c0-3.9 3.3-7 7.8-7 3.5 0 6.2 1.4 8.1 3.7l-3.6.3 4.7 2.2-3.3.9.3 1.7-3.1-.5-.8 3-2.7-1.6-1.3 2.1-1.6-2.2-2.1-.1.8-2-2.8-1.2z"/>'),
  map: svg('<path d="M3.5 6.2l5.3-2 6.4 2.2 5.3-2v13.4l-5.3 2-6.4-2.2-5.3 2zM8.8 4.2v13.4M15.2 6.4v13.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'),
  close: svg('<path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none"/>'),
};

// Cada aba: título do painel esquerdo e a lista de assuntos (id da imagem, título e texto).
const TABS = [
  {
    id: 'survival', icon: 'survival', title: 'SOBREVIVÊNCIA',
    items: [
      ['comecando', 'COMEÇANDO', 'Você acorda numa praia da ilha, sem nada. Soque palmeiras e plantas para juntar palha e fibra, pegue gravetos e pedrinhas do chão e abra o Inventário para fabricar as primeiras ferramentas. Um machado de pedra rende muito mais madeira que os punhos.'],
      ['fome', 'FOME E SEDE', 'As barras de comida e de água caem com o tempo, e bem mais rápido quando você corre ou nada. Bagas e frutas matam a fome e curam um pouco; a carne precisa ser assada na fogueira (crua ela enjoa e tira vida aos poucos). Beba em qualquer lago, riacho ou no mar, usando o botão Interagir; segure um cantil para levar água.'],
      ['temperatura', 'TEMPERATURA', 'Nas montanhas nevadas faz muito frio: a fome aumenta e, congelando, você perde vida. Vista roupas de pele, fique perto de uma fogueira e aumente a Fortaleza para aguentar mais. A barra de temperatura aparece no Inventário, na ficha Você.'],
      ['dia', 'DIA E NOITE', 'O dia dura 7 minutos e a noite 3. À noite o escuro é de verdade: leve uma tocha ou acenda uma fogueira. Num saco de dormir você passa a noite e ainda o transforma em ponto de renascer.'],
      ['morte', 'MORTE E RENASCER', 'Ao morrer, tudo o que você carregava fica numa bolsa no lugar da morte (marcado com um X vermelho no mapa). Escolha uma zona de renascimento na lista, volte e recupere a bolsa tocando em Interagir.'],
    ],
  },
  {
    id: 'ui', icon: 'ui', title: 'INTERFACE DE USUÁRIO',
    items: [
      ['visao', 'VISÃO GERAL', 'A parte de baixo da tela mostra sua vida, estamina, comida, água e peso. No alto ficam o nível, a hora do jogo e a temperatura. Quando houver algo para usar, colher ou atacar na mira, aparece um aviso com o nome e o botão certo.'],
      ['interface', 'INTERFACE', 'No celular: arraste o lado esquerdo para andar (toque duplo e segure para correr, deslize para cima para pular) e o lado direito para olhar. Toque na direita para usar ou atacar. No PC: WASD para andar, Shift corre, Espaço pula, clique ataca, E interage, Tab abre o inventário, M o mapa e Esc pausa.'],
      ['roda', 'RODA RADIAL', 'Arraste a partir da borda direita da tela para abrir a roda de ações (agachar, interagir, inventário, construir, mapa, recarregar e pausar). Da borda esquerda abre a roda de assovios, com os comandos para os bichos domados: seguir, parar, agressivo, neutro, passivo e atacar o alvo.'],
      ['inventario', 'INVENTÁRIO', 'Sobreviventes, criaturas e baús têm inventário. A aba Inventário guarda seus itens e a aba Fabricação cria itens novos. Embaixo ficam os atalhos da barra rápida (toque duas vezes num item para mandá-lo para lá). À direita aparecem o seu personagem e os itens vestidos.'],
      ['experiencia', 'EXPERIÊNCIA', 'Você ganha experiência fazendo quase tudo e sobe de nível. Cada nível dá um ponto para gastar na ficha Você: Saúde, Estamina, Oxigênio, Comida, Água e Peso (+10 cada, Oxigênio +20), Dano de combate +5%, Velocidade de movimento +1,5%, Fortaleza +2 e Habilidade de fabricação +10%.'],
      ['engramas', 'ENGRAMAS', 'A cada nível você também ganha pontos de engrama para aprender receitas novas, das ferramentas de pedra até as armas e construções mais avançadas. Cada receita pede um nível mínimo e um custo; os pontos gastos são permanentes.'],
    ],
  },
  {
    id: 'craft', icon: 'craft', title: 'FABRICAÇÃO',
    items: [
      ['coleta', 'COLETA', 'Antes de fabricar você precisa juntar materiais. Soque palmeiras e plantas para palha e fibra, pegue pedrinhas e gravetos do chão, colha bagas dos arbustos e, com o machado, corte árvores para ter madeira. Cada ferramenta rende mais de um tipo de recurso.'],
      ['fabricacao', 'FABRICAÇÃO', 'Com os materiais na mochila, abra a aba Fabricação do Inventário, escolha a receita e toque em Criar. Os itens ficam numa fila e saem pouco a pouco; a habilidade de fabricação acelera essa fila. Receitas trancadas precisam de pontos de engrama.'],
      ['abrigo', 'ABRIGO', 'A ilha é perigosa, então construa um abrigo. Escolha um lugar com recursos por perto e sem bichos por perto, depois monte pisos, paredes, teto, porta e janelas. Uma casa fechada protege do frio e dos predadores.'],
      ['posicionamento', 'POSICIONAMENTO', 'Abra o modo Construir pela roda de ações. A peça aparece verde quando pode ser colocada e vermelha quando não cabe. A primeira peça (o piso) vai no chão; as seguintes se encaixam nas bordas das anteriores e a base cresce.'],
      ['niveis', 'NÍVEIS', 'As construções têm quatro materiais: palha, madeira, pedra e metal. Cada um aguenta mais dano que o anterior, mas pede receitas e engramas mais avançados. Comece com palha e vá melhorando a base com o nível.'],
      ['mesa', 'MESA DE FABRICAÇÃO', 'Itens avançados não saem no inventário: precisam de uma estação por perto. A Bancada de Trabalho faz ferramentas e armas melhores, o Pilão faz pastas e remédios e a Forja trabalha o metal. Chegue perto da estação e abra o Inventário.'],
    ],
  },
  {
    id: 'creatures', icon: 'creatures', title: 'CRIATURAS E DOMESTICAÇÃO',
    items: [
      ['criaturas', 'CRIATURAS', 'As criaturas da ilha podem ser domadas e usadas para transporte, caça, coleta, defesa e companhia. Existem dois métodos: domesticação por torpor e domesticação passiva. Aponte para o bicho para ver o nome, o nível e se ele é pacífico ou agressivo.'],
      ['torpor', 'DOMESTICAÇÃO POR TORPOR', 'Deixe a criatura inconsciente enchendo a barra de torpor: flechas tranquilizantes, clava ou socos. Depois coloque no prato dela a comida preferida até a afinidade chegar ao máximo, e ela será domada. Para mantê-la desmaiada use narcóticos. Quanto mais demora ou mais dano ela leva, pior fica o resultado.'],
      ['passiva', 'DOMESTICAÇÃO PASSIVA', 'Alguns herbívoros calmos podem ser domados sem desmaiar: ofereça a comida preferida por trás e continue até a afinidade chegar ao máximo. Se o bicho levar dano ou ficar agressivo, a afinidade se perde e você recomeça.'],
    ],
  },
  {
    id: 'map', icon: 'map', title: 'MAPA E MUNDO',
    items: [
      ['mapa', 'O MAPA', 'Abra o mapa com M (ou tocando no minimapa) para ver a ilha inteira, onde você está, os pontos de renascimento e os nomes das regiões. A Floresta Amazônica cobre quase tudo, com praias ao redor, pântano, serras de pedra, campos e a Montanha Nevada.'],
      ['biomas', 'BIOMAS', 'Cada região tem recursos e perigos próprios: praias para começar, floresta densa com muita caça, igapó e pântano com predadores d\'água, serras com metal, obsidiana e cristal, campos de manadas e a neve, onde o frio mata.'],
      ['respawn', 'ZONAS DE RENASCIMENTO', 'Ao morrer você escolhe onde voltar: zonas fáceis nas praias do sul, médias no leste e oeste e difíceis no norte, perto das montanhas. Um saco de dormir vira um ponto de renascimento seu.'],
    ],
  },
];

export class HelpScreen {
  constructor(root, { onClose } = {}) {
    this.onClose = onClose;
    this.tab = 0;
    this.item = 0;
    const el = document.createElement('div');
    el.className = 'overlay helpscr';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Ajuda');
    el.innerHTML = `
      <div class="hs-wrap">
        <div class="hs-top">
          ${TABS.map((t, i) => `<button type="button" class="hs-tab" data-tab="${i}" aria-label="${t.title}">${TAB_ICONS[t.icon]}</button>`).join('')}
          <button type="button" class="hs-tab hs-x" data-close aria-label="Fechar">${TAB_ICONS.close}</button>
        </div>
        <div class="hs-body">
          <div class="hs-left">
            <h2 class="hs-ltitle" data-ref="ltitle"></h2>
            <div class="hs-list" data-ref="list"></div>
            <div class="hs-brand"><b>ISLA</b><span>Guia de sobrevivência. Para mais detalhes, explore a ilha e teste cada coisa.</span></div>
          </div>
          <div class="hs-right">
            <h2 class="hs-rtitle" data-ref="rtitle"></h2>
            <div class="hs-img" data-ref="img"></div>
            <p class="hs-text" data-ref="text"></p>
          </div>
        </div>
      </div>`;
    root.appendChild(el);
    this.el = el;
    this.refs = {};
    el.querySelectorAll('[data-ref]').forEach((n) => { this.refs[n.dataset.ref] = n; });
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) {
        sound.play('clique');
        this.close();
        return;
      }
      const tab = e.target.closest('[data-tab]');
      if (tab) {
        sound.play('clique');
        this.select(Number(tab.dataset.tab), 0);
        return;
      }
      const it = e.target.closest('[data-item]');
      if (it) {
        sound.play('clique');
        this.select(this.tab, Number(it.dataset.item));
      }
    });
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  get visible() {
    return !this.el.hidden;
  }

  open(tab = 0, item = 0) {
    this.select(tab, item);
    this.el.hidden = false;
  }

  close() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.onClose?.();
  }

  select(tab, item) {
    this.tab = tab;
    this.item = item;
    const t = TABS[tab];
    const [id, title, text] = t.items[item];
    this.refs.ltitle.textContent = t.title;
    this.refs.list.innerHTML = t.items.map(([, name], i) => `<button type="button" class="hs-item${i === item ? ' on' : ''}" data-item="${i}">${name}</button>`).join('');
    this.refs.rtitle.textContent = title;
    this.refs.text.textContent = text;
    const src = IMAGES[`${t.id}_${id}`] ?? IMAGES[id] ?? null;
    this.refs.img.innerHTML = src ? `<img alt="${title}" src="${src}">` : '';
    this.refs.img.classList.toggle('vazio', !src);
    this.el.querySelectorAll('.hs-tab[data-tab]').forEach((b) => b.classList.toggle('on', Number(b.dataset.tab) === tab));
  }
}
