// =============================================================
// BANCO DE ENGRAMS (só dados). Gerado por tools/dados/gerar_engrams.py
// id = id da receita em data/crafting/receitas.json. tier/nível/custo/pré-requisitos: balanceie lá e rode o script.
// =============================================================
export const ENGRAMS = [
 {
  "id": "machado_pedra",
  "nome": "Machado de Pedra",
  "descricao": "Muito mais madeira das árvores e troncos.",
  "tier": 1,
  "nivel_requerido": 1,
  "custo_pontos": 2,
  "pre_requisitos": [
   "picareta_pedra"
  ],
  "resultado_crafting": "machado_pedra",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "picareta_pedra",
  "nome": "Picareta de Pedra",
  "descricao": "Mais sílex das pedras e mais palha das árvores.",
  "tier": 1,
  "nivel_requerido": 1,
  "custo_pontos": 1,
  "pre_requisitos": [],
  "resultado_crafting": "picareta_pedra",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "lanca",
  "nome": "Lança",
  "descricao": "Arma de alcance maior e muito dano.",
  "tier": 1,
  "nivel_requerido": 3,
  "custo_pontos": 2,
  "pre_requisitos": [
   "machado_pedra"
  ],
  "resultado_crafting": "lanca",
  "estacao_necessaria": "mao",
  "categoria": "Armas"
 },
 {
  "id": "clava",
  "nome": "Clava",
  "descricao": "Pancada forte.",
  "tier": 1,
  "nivel_requerido": 8,
  "custo_pontos": 3,
  "pre_requisitos": [
   "machado_pedra"
  ],
  "resultado_crafting": "clava",
  "estacao_necessaria": "mao",
  "categoria": "Armas"
 },
 {
  "id": "bandagem",
  "nome": "Bandagem",
  "descricao": "Feita de fibra.",
  "tier": 1,
  "nivel_requerido": 1,
  "custo_pontos": 1,
  "pre_requisitos": [],
  "resultado_crafting": "bandagem",
  "estacao_necessaria": "mao",
  "categoria": "Cura"
 },
 {
  "id": "unguento",
  "nome": "Unguento de Bagas",
  "descricao": "Pasta de bagas amassadas com fibra.",
  "tier": 1,
  "nivel_requerido": 4,
  "custo_pontos": 2,
  "pre_requisitos": [
   "bandagem"
  ],
  "resultado_crafting": "unguento",
  "estacao_necessaria": "mao",
  "categoria": "Cura"
 },
 {
  "id": "tocha",
  "nome": "Tocha",
  "descricao": "Ilumina o caminho à noite.",
  "tier": 1,
  "nivel_requerido": 1,
  "custo_pontos": 1,
  "pre_requisitos": [],
  "resultado_crafting": "tocha",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "fogueira",
  "nome": "Fogueira",
  "descricao": "Toque na barra rápida para colocar no chão.",
  "tier": 1,
  "nivel_requerido": 3,
  "custo_pontos": 2,
  "pre_requisitos": [],
  "resultado_crafting": "fogueira",
  "estacao_necessaria": "mao",
  "categoria": "Estruturas"
 },
 {
  "id": "saco_dormir",
  "nome": "Saco de Dormir",
  "descricao": "Coloque no chão: vira um ponto para renascer e dá para dormir até de manhã.",
  "tier": 1,
  "nivel_requerido": 5,
  "custo_pontos": 3,
  "pre_requisitos": [],
  "resultado_crafting": "saco_dormir",
  "estacao_necessaria": "mao",
  "categoria": "Estruturas"
 },
 {
  "id": "bancada",
  "nome": "Bancada de Trabalho",
  "descricao": "Coloque no chão.",
  "tier": 1,
  "nivel_requerido": 2,
  "custo_pontos": 2,
  "pre_requisitos": [],
  "resultado_crafting": "bancada",
  "estacao_necessaria": "mao",
  "categoria": "Estruturas"
 },
 {
  "id": "piso",
  "nome": "Piso de Madeira",
  "descricao": "Base da casa (3×3 m).",
  "tier": 2,
  "nivel_requerido": 10,
  "custo_pontos": 4,
  "pre_requisitos": [],
  "resultado_crafting": "piso",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "parede",
  "nome": "Parede de Madeira",
  "descricao": "Encaixa na beira de um piso ou teto.",
  "tier": 2,
  "nivel_requerido": 10,
  "custo_pontos": 3,
  "pre_requisitos": [
   "piso"
  ],
  "resultado_crafting": "parede",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "porta",
  "nome": "Parede com Porta",
  "descricao": "Parede com uma porta.",
  "tier": 2,
  "nivel_requerido": 12,
  "custo_pontos": 3,
  "pre_requisitos": [
   "parede"
  ],
  "resultado_crafting": "porta",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "teto",
  "nome": "Teto de Madeira",
  "descricao": "Vai em cima de um piso (3 m acima) ou de pilares.",
  "tier": 2,
  "nivel_requerido": 12,
  "custo_pontos": 3,
  "pre_requisitos": [
   "parede"
  ],
  "resultado_crafting": "teto",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "rampa",
  "nome": "Rampa",
  "descricao": "Em cima de um piso: sobe 3 m até o segundo andar.",
  "tier": 2,
  "nivel_requerido": 12,
  "custo_pontos": 3,
  "pre_requisitos": [
   "piso"
  ],
  "resultado_crafting": "rampa",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "arco",
  "nome": "Arco",
  "descricao": "Arma de longe: atire com Atacar.",
  "tier": 2,
  "nivel_requerido": 12,
  "custo_pontos": 5,
  "pre_requisitos": [],
  "resultado_crafting": "arco",
  "estacao_necessaria": "mao",
  "categoria": "Armas"
 },
 {
  "id": "flecha_pedra",
  "nome": "Flecha de Pedra",
  "descricao": "Munição do Arco.",
  "tier": 2,
  "nivel_requerido": 12,
  "custo_pontos": 3,
  "pre_requisitos": [
   "arco"
  ],
  "resultado_crafting": "flecha_pedra",
  "estacao_necessaria": "mao",
  "categoria": "Armas"
 },
 {
  "id": "pilao",
  "nome": "Pilão",
  "descricao": "Coloque no chão.",
  "tier": 1,
  "nivel_requerido": 6,
  "custo_pontos": 3,
  "pre_requisitos": [
   "bancada"
  ],
  "resultado_crafting": "pilao",
  "estacao_necessaria": "mao",
  "categoria": "Estruturas"
 },
 {
  "id": "narcotico",
  "nome": "Narcótico",
  "descricao": "Feito no Pilão.",
  "tier": 1,
  "nivel_requerido": 9,
  "custo_pontos": 3,
  "pre_requisitos": [
   "pilao"
  ],
  "resultado_crafting": "narcotico",
  "estacao_necessaria": "pilao",
  "categoria": "Cura"
 },
 {
  "id": "flecha_tranq",
  "nome": "Flecha Tranquilizante",
  "descricao": "Munição do Arco com Narcótico.",
  "tier": 2,
  "nivel_requerido": 18,
  "custo_pontos": 6,
  "pre_requisitos": [
   "flecha_pedra"
  ],
  "resultado_crafting": "flecha_tranq",
  "estacao_necessaria": "mao",
  "categoria": "Armas"
 },
 {
  "id": "cantil",
  "nome": "Cantil",
  "descricao": "Bolsa de couro para levar água.",
  "tier": 1,
  "nivel_requerido": 3,
  "custo_pontos": 2,
  "pre_requisitos": [],
  "resultado_crafting": "cantil",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "bau",
  "nome": "Baú de Madeira",
  "descricao": "Coloque no chão e use Interagir para guardar coisas (30 espaços).",
  "tier": 2,
  "nivel_requerido": 14,
  "custo_pontos": 4,
  "pre_requisitos": [],
  "resultado_crafting": "bau",
  "estacao_necessaria": "mao",
  "categoria": "Estruturas"
 },
 {
  "id": "forja",
  "nome": "Forja",
  "descricao": "Coloque no chão.",
  "tier": 3,
  "nivel_requerido": 30,
  "custo_pontos": 8,
  "pre_requisitos": [
   "bancada"
  ],
  "resultado_crafting": "forja",
  "estacao_necessaria": "mao",
  "categoria": "Estruturas"
 },
 {
  "id": "lingote_metal",
  "nome": "Lingote de Metal",
  "descricao": "Feito na Forja com Minério de Ferro.",
  "tier": 3,
  "nivel_requerido": 31,
  "custo_pontos": 6,
  "pre_requisitos": [
   "forja"
  ],
  "resultado_crafting": "lingote_metal",
  "estacao_necessaria": "forja",
  "categoria": "Ferramentas"
 },
 {
  "id": "machado_metal",
  "nome": "Machado de Metal",
  "descricao": "Corta árvores muito melhor e dura muito.",
  "tier": 2,
  "nivel_requerido": 15,
  "custo_pontos": 5,
  "pre_requisitos": [
   "machado_pedra"
  ],
  "resultado_crafting": "machado_metal",
  "estacao_necessaria": "bancada",
  "categoria": "Ferramentas"
 },
 {
  "id": "picareta_metal",
  "nome": "Picareta de Metal",
  "descricao": "Tira muito mais pedra, sílex e minério.",
  "tier": 2,
  "nivel_requerido": 15,
  "custo_pontos": 5,
  "pre_requisitos": [
   "picareta_pedra"
  ],
  "resultado_crafting": "picareta_metal",
  "estacao_necessaria": "bancada",
  "categoria": "Ferramentas"
 },
 {
  "id": "capuz_pele",
  "nome": "Capuz de Pele",
  "descricao": "Armadura de pele (capuz).",
  "tier": 2,
  "nivel_requerido": 16,
  "custo_pontos": 4,
  "pre_requisitos": [],
  "resultado_crafting": "capuz_pele",
  "estacao_necessaria": "mao",
  "categoria": "Roupas"
 },
 {
  "id": "camisa_pele",
  "nome": "Camisa de Pele",
  "descricao": "Armadura de pele (camisa).",
  "tier": 2,
  "nivel_requerido": 16,
  "custo_pontos": 5,
  "pre_requisitos": [],
  "resultado_crafting": "camisa_pele",
  "estacao_necessaria": "mao",
  "categoria": "Roupas"
 },
 {
  "id": "luvas_pele",
  "nome": "Luvas de Pele",
  "descricao": "Armadura de pele (luvas).",
  "tier": 2,
  "nivel_requerido": 17,
  "custo_pontos": 4,
  "pre_requisitos": [],
  "resultado_crafting": "luvas_pele",
  "estacao_necessaria": "mao",
  "categoria": "Roupas"
 },
 {
  "id": "calca_pele",
  "nome": "Calça de Pele",
  "descricao": "Armadura de pele (calça).",
  "tier": 2,
  "nivel_requerido": 17,
  "custo_pontos": 5,
  "pre_requisitos": [],
  "resultado_crafting": "calca_pele",
  "estacao_necessaria": "mao",
  "categoria": "Roupas"
 },
 {
  "id": "botas_pele",
  "nome": "Botas de Pele",
  "descricao": "Armadura de pele (botas).",
  "tier": 2,
  "nivel_requerido": 17,
  "custo_pontos": 4,
  "pre_requisitos": [],
  "resultado_crafting": "botas_pele",
  "estacao_necessaria": "mao",
  "categoria": "Roupas"
 },
 {
  "id": "carvao",
  "nome": "Carvão",
  "descricao": "Madeira queimada na Forja.",
  "tier": 3,
  "nivel_requerido": 31,
  "custo_pontos": 6,
  "pre_requisitos": [
   "forja"
  ],
  "resultado_crafting": "carvao",
  "estacao_necessaria": "forja",
  "categoria": "Ferramentas"
 },
 {
  "id": "lingote_petroleo",
  "nome": "Lingote de Metal",
  "descricao": "Feito na Forja com Minério de Ferro.",
  "tier": 3,
  "nivel_requerido": 33,
  "custo_pontos": 6,
  "pre_requisitos": [
   "forja"
  ],
  "resultado_crafting": "lingote_metal",
  "estacao_necessaria": "forja",
  "categoria": "Ferramentas"
 },
 {
  "id": "po_faisca",
  "nome": "Pó de Faísca",
  "descricao": "Sílex e pedra moídos no Pilão.",
  "tier": 1,
  "nivel_requerido": 8,
  "custo_pontos": 2,
  "pre_requisitos": [
   "pilao"
  ],
  "resultado_crafting": "po_faisca",
  "estacao_necessaria": "pilao",
  "categoria": "Ferramentas"
 },
 {
  "id": "polvora",
  "nome": "Pólvora",
  "descricao": "Carvão e Pó de Faísca no Pilão.",
  "tier": 2,
  "nivel_requerido": 25,
  "custo_pontos": 4,
  "pre_requisitos": [
   "pilao"
  ],
  "resultado_crafting": "polvora",
  "estacao_necessaria": "pilao",
  "categoria": "Armas"
 },
 {
  "id": "pasta_cimento",
  "nome": "Pasta de Cimento",
  "descricao": "Queratina com pedra, no Pilão.",
  "tier": 2,
  "nivel_requerido": 22,
  "custo_pontos": 4,
  "pre_requisitos": [
   "pilao"
  ],
  "resultado_crafting": "pasta_cimento",
  "estacao_necessaria": "pilao",
  "categoria": "Construção"
 },
 {
  "id": "luneta",
  "nome": "Luneta",
  "descricao": "Para ver longe: com ela na mão, use Atacar para aproximar ou afastar a vista.",
  "tier": 1,
  "nivel_requerido": 7,
  "custo_pontos": 3,
  "pre_requisitos": [],
  "resultado_crafting": "luneta",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "pote_agua",
  "nome": "Pote de Água",
  "descricao": "Pote de cimento que guarda muita água (3 cantis).",
  "tier": 2,
  "nivel_requerido": 26,
  "custo_pontos": 5,
  "pre_requisitos": [
   "cantil"
  ],
  "resultado_crafting": "pote_agua",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "flecha_obsidiana",
  "nome": "Flecha de Obsidiana",
  "descricao": "Munição do Arco com ponta de obsidiana.",
  "tier": 2,
  "nivel_requerido": 24,
  "custo_pontos": 5,
  "pre_requisitos": [
   "flecha_pedra"
  ],
  "resultado_crafting": "flecha_obsidiana",
  "estacao_necessaria": "mao",
  "categoria": "Armas"
 },
 {
  "id": "pistola",
  "nome": "Pistola Simples",
  "descricao": "Arma de fogo feita na Bancada.",
  "tier": 3,
  "nivel_requerido": 45,
  "custo_pontos": 12,
  "pre_requisitos": [
   "forja"
  ],
  "resultado_crafting": "pistola",
  "estacao_necessaria": "bancada",
  "categoria": "Armas"
 },
 {
  "id": "bala_simples",
  "nome": "Bala Simples",
  "descricao": "Munição da Pistola.",
  "tier": 3,
  "nivel_requerido": 46,
  "custo_pontos": 6,
  "pre_requisitos": [
   "pistola"
  ],
  "resultado_crafting": "bala_simples",
  "estacao_necessaria": "bancada",
  "categoria": "Armas"
 },
 {
  "id": "capuz_pelo",
  "nome": "Capuz de Pelo",
  "descricao": "Roupa de pelo de mamute: a mais quente (frio da Lapônia).",
  "tier": 3,
  "nivel_requerido": 35,
  "custo_pontos": 8,
  "pre_requisitos": [
   "capuz_pele"
  ],
  "resultado_crafting": "capuz_pelo",
  "estacao_necessaria": "bancada",
  "categoria": "Roupas"
 },
 {
  "id": "camisa_pelo",
  "nome": "Camisa de Pelo",
  "descricao": "Roupa de pelo de mamute: a mais quente (frio da Lapônia).",
  "tier": 3,
  "nivel_requerido": 35,
  "custo_pontos": 9,
  "pre_requisitos": [
   "camisa_pele"
  ],
  "resultado_crafting": "camisa_pelo",
  "estacao_necessaria": "bancada",
  "categoria": "Roupas"
 },
 {
  "id": "luvas_pelo",
  "nome": "Luvas de Pelo",
  "descricao": "Roupa de pelo de mamute: a mais quente (frio da Lapônia).",
  "tier": 3,
  "nivel_requerido": 36,
  "custo_pontos": 8,
  "pre_requisitos": [
   "luvas_pele"
  ],
  "resultado_crafting": "luvas_pelo",
  "estacao_necessaria": "bancada",
  "categoria": "Roupas"
 },
 {
  "id": "calca_pelo",
  "nome": "Calça de Pelo",
  "descricao": "Roupa de pelo de mamute: a mais quente (frio da Lapônia).",
  "tier": 3,
  "nivel_requerido": 36,
  "custo_pontos": 9,
  "pre_requisitos": [
   "calca_pele"
  ],
  "resultado_crafting": "calca_pelo",
  "estacao_necessaria": "bancada",
  "categoria": "Roupas"
 },
 {
  "id": "botas_pelo",
  "nome": "Botas de Pelo",
  "descricao": "Roupa de pelo de mamute: a mais quente (frio da Lapônia).",
  "tier": 3,
  "nivel_requerido": 36,
  "custo_pontos": 8,
  "pre_requisitos": [
   "botas_pele"
  ],
  "resultado_crafting": "botas_pelo",
  "estacao_necessaria": "bancada",
  "categoria": "Roupas"
 },
 {
  "id": "piso_palha",
  "nome": "Piso de Palha",
  "descricao": "Base da casa (3×3 m).",
  "tier": 1,
  "nivel_requerido": 5,
  "custo_pontos": 3,
  "pre_requisitos": [],
  "resultado_crafting": "piso_palha",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "parede_palha",
  "nome": "Parede de Palha",
  "descricao": "Encaixa na beira de um piso ou teto.",
  "tier": 1,
  "nivel_requerido": 5,
  "custo_pontos": 2,
  "pre_requisitos": [
   "piso_palha"
  ],
  "resultado_crafting": "parede_palha",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "porta_palha",
  "nome": "Parede com Porta de Palha",
  "descricao": "Parede com uma porta.",
  "tier": 1,
  "nivel_requerido": 6,
  "custo_pontos": 2,
  "pre_requisitos": [
   "parede_palha"
  ],
  "resultado_crafting": "porta_palha",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "teto_palha",
  "nome": "Teto de Palha",
  "descricao": "Vai em cima de um piso (3 m acima) ou de pilares.",
  "tier": 1,
  "nivel_requerido": 6,
  "custo_pontos": 2,
  "pre_requisitos": [
   "parede_palha"
  ],
  "resultado_crafting": "teto_palha",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "pilar",
  "nome": "Pilar de Madeira",
  "descricao": "Coluna de 3 m: no canto de um piso ou solta no chão.",
  "tier": 2,
  "nivel_requerido": 14,
  "custo_pontos": 3,
  "pre_requisitos": [
   "piso"
  ],
  "resultado_crafting": "pilar",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "janela",
  "nome": "Janela de Madeira",
  "descricao": "Parede com janela para olhar lá fora (encaixa como parede).",
  "tier": 2,
  "nivel_requerido": 14,
  "custo_pontos": 4,
  "pre_requisitos": [
   "parede"
  ],
  "resultado_crafting": "janela",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "telhado",
  "nome": "Telhado de Madeira",
  "descricao": "Teto inclinado: encaixa como o teto e cai para o lado que você olha.",
  "tier": 2,
  "nivel_requerido": 14,
  "custo_pontos": 4,
  "pre_requisitos": [
   "teto"
  ],
  "resultado_crafting": "telhado",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "cerca",
  "nome": "Cerca de Madeira",
  "descricao": "Muro baixo (1,3 m) na beira de um piso ou solto no chão; as próximas emendam.",
  "tier": 2,
  "nivel_requerido": 14,
  "custo_pontos": 3,
  "pre_requisitos": [
   "piso"
  ],
  "resultado_crafting": "cerca",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "piso_pedra",
  "nome": "Piso de Pedra",
  "descricao": "Base da casa (3×3 m).",
  "tier": 3,
  "nivel_requerido": 32,
  "custo_pontos": 8,
  "pre_requisitos": [],
  "resultado_crafting": "piso_pedra",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "parede_pedra",
  "nome": "Parede de Pedra",
  "descricao": "Encaixa na beira de um piso ou teto.",
  "tier": 3,
  "nivel_requerido": 32,
  "custo_pontos": 6,
  "pre_requisitos": [
   "piso_pedra"
  ],
  "resultado_crafting": "parede_pedra",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "porta_pedra",
  "nome": "Parede com Porta de Pedra",
  "descricao": "Parede com uma porta.",
  "tier": 3,
  "nivel_requerido": 33,
  "custo_pontos": 6,
  "pre_requisitos": [
   "parede_pedra"
  ],
  "resultado_crafting": "porta_pedra",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "teto_pedra",
  "nome": "Teto de Pedra",
  "descricao": "Vai em cima de um piso (3 m acima) ou de pilares.",
  "tier": 3,
  "nivel_requerido": 33,
  "custo_pontos": 6,
  "pre_requisitos": [
   "parede_pedra"
  ],
  "resultado_crafting": "teto_pedra",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "rampa_pedra",
  "nome": "Rampa de Pedra",
  "descricao": "Em cima de um piso: sobe 3 m até o segundo andar.",
  "tier": 3,
  "nivel_requerido": 36,
  "custo_pontos": 6,
  "pre_requisitos": [
   "piso_pedra"
  ],
  "resultado_crafting": "rampa_pedra",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "pilar_pedra",
  "nome": "Pilar de Pedra",
  "descricao": "Coluna de 3 m: no canto de um piso ou solta no chão.",
  "tier": 3,
  "nivel_requerido": 34,
  "custo_pontos": 6,
  "pre_requisitos": [
   "piso_pedra"
  ],
  "resultado_crafting": "pilar_pedra",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "janela_pedra",
  "nome": "Janela de Pedra",
  "descricao": "Parede com janela para olhar lá fora (encaixa como parede).",
  "tier": 3,
  "nivel_requerido": 35,
  "custo_pontos": 7,
  "pre_requisitos": [
   "parede_pedra"
  ],
  "resultado_crafting": "janela_pedra",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "telhado_pedra",
  "nome": "Telhado de Pedra",
  "descricao": "Teto inclinado: encaixa como o teto e cai para o lado que você olha.",
  "tier": 3,
  "nivel_requerido": 35,
  "custo_pontos": 6,
  "pre_requisitos": [
   "teto_pedra"
  ],
  "resultado_crafting": "telhado_pedra",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "cerca_pedra",
  "nome": "Cerca de Pedra",
  "descricao": "Muro baixo (1,3 m) na beira de um piso ou solto no chão; as próximas emendam.",
  "tier": 3,
  "nivel_requerido": 36,
  "custo_pontos": 6,
  "pre_requisitos": [
   "piso_pedra"
  ],
  "resultado_crafting": "cerca_pedra",
  "estacao_necessaria": "mao",
  "categoria": "Construção"
 },
 {
  "id": "piso_metal",
  "nome": "Piso de Metal",
  "descricao": "Base da casa (3×3 m).",
  "tier": 3,
  "nivel_requerido": 56,
  "custo_pontos": 9,
  "pre_requisitos": [
   "forja"
  ],
  "resultado_crafting": "piso_metal",
  "estacao_necessaria": "bancada",
  "categoria": "Construção"
 },
 {
  "id": "parede_metal",
  "nome": "Parede de Metal",
  "descricao": "Encaixa na beira de um piso ou teto.",
  "tier": 3,
  "nivel_requerido": 56,
  "custo_pontos": 8,
  "pre_requisitos": [
   "piso_metal"
  ],
  "resultado_crafting": "parede_metal",
  "estacao_necessaria": "bancada",
  "categoria": "Construção"
 },
 {
  "id": "porta_metal",
  "nome": "Parede com Porta de Metal",
  "descricao": "Parede com uma porta.",
  "tier": 3,
  "nivel_requerido": 57,
  "custo_pontos": 8,
  "pre_requisitos": [
   "parede_metal"
  ],
  "resultado_crafting": "porta_metal",
  "estacao_necessaria": "bancada",
  "categoria": "Construção"
 },
 {
  "id": "teto_metal",
  "nome": "Teto de Metal",
  "descricao": "Vai em cima de um piso (3 m acima) ou de pilares.",
  "tier": 3,
  "nivel_requerido": 57,
  "custo_pontos": 8,
  "pre_requisitos": [
   "parede_metal"
  ],
  "resultado_crafting": "teto_metal",
  "estacao_necessaria": "bancada",
  "categoria": "Construção"
 },
 {
  "id": "rampa_metal",
  "nome": "Rampa de Metal",
  "descricao": "Em cima de um piso: sobe 3 m até o segundo andar.",
  "tier": 3,
  "nivel_requerido": 58,
  "custo_pontos": 8,
  "pre_requisitos": [
   "piso_metal"
  ],
  "resultado_crafting": "rampa_metal",
  "estacao_necessaria": "bancada",
  "categoria": "Construção"
 },
 {
  "id": "pilar_metal",
  "nome": "Pilar de Metal",
  "descricao": "Coluna de 3 m: no canto de um piso ou solta no chão.",
  "tier": 3,
  "nivel_requerido": 58,
  "custo_pontos": 8,
  "pre_requisitos": [
   "piso_metal"
  ],
  "resultado_crafting": "pilar_metal",
  "estacao_necessaria": "bancada",
  "categoria": "Construção"
 },
 {
  "id": "janela_metal",
  "nome": "Janela de Metal",
  "descricao": "Parede com janela para olhar lá fora (encaixa como parede).",
  "tier": 3,
  "nivel_requerido": 59,
  "custo_pontos": 9,
  "pre_requisitos": [
   "parede_metal"
  ],
  "resultado_crafting": "janela_metal",
  "estacao_necessaria": "bancada",
  "categoria": "Construção"
 },
 {
  "id": "telhado_metal",
  "nome": "Telhado de Metal",
  "descricao": "Teto inclinado: encaixa como o teto e cai para o lado que você olha.",
  "tier": 3,
  "nivel_requerido": 60,
  "custo_pontos": 8,
  "pre_requisitos": [
   "teto_metal"
  ],
  "resultado_crafting": "telhado_metal",
  "estacao_necessaria": "bancada",
  "categoria": "Construção"
 },
 {
  "id": "cerca_metal",
  "nome": "Cerca de Metal",
  "descricao": "Muro baixo (1,3 m) na beira de um piso ou solto no chão; as próximas emendam.",
  "tier": 3,
  "nivel_requerido": 58,
  "custo_pontos": 7,
  "pre_requisitos": [
   "piso_metal"
  ],
  "resultado_crafting": "cerca_metal",
  "estacao_necessaria": "bancada",
  "categoria": "Construção"
 },
 {
  "id": "racao",
  "nome": "Ração",
  "descricao": "Comida feita para domar (como a kibble do ARK).",
  "tier": 2,
  "nivel_requerido": 15,
  "custo_pontos": 4,
  "pre_requisitos": [
   "pilao"
  ],
  "resultado_crafting": "racao",
  "estacao_necessaria": "pilao",
  "categoria": "Cura"
 },
 {
  "id": "sela_raptor",
  "nome": "Sela de Raptor",
  "descricao": "Sela de Raptor: sela leve para corredores.",
  "tier": 2,
  "nivel_requerido": 20,
  "custo_pontos": 6,
  "pre_requisitos": [],
  "resultado_crafting": "sela_raptor",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_galimimo",
  "nome": "Sela de Galimimo",
  "descricao": "Sela de Galimimo: sela leve para corredores.",
  "tier": 3,
  "nivel_requerido": 40,
  "custo_pontos": 10,
  "pre_requisitos": [],
  "resultado_crafting": "sela_galimimo",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_paquicefalossauro",
  "nome": "Sela de Paquicefalossauro",
  "descricao": "Sela de Paquicefalossauro: sela leve para corredores.",
  "tier": 2,
  "nivel_requerido": 21,
  "custo_pontos": 6,
  "pre_requisitos": [],
  "resultado_crafting": "sela_paquicefalossauro",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_parassauro",
  "nome": "Sela de Parassauro",
  "descricao": "Sela de Parassauro: sela reforçada com manta.",
  "tier": 3,
  "nivel_requerido": 41,
  "custo_pontos": 10,
  "pre_requisitos": [],
  "resultado_crafting": "sela_parassauro",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_triceratops",
  "nome": "Sela de Triceratops",
  "descricao": "Sela de Triceratops: sela reforçada com manta.",
  "tier": 3,
  "nivel_requerido": 42,
  "custo_pontos": 10,
  "pre_requisitos": [],
  "resultado_crafting": "sela_triceratops",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_estegossauro",
  "nome": "Sela de Estegossauro",
  "descricao": "Sela de Estegossauro: arreio de tiras de couro, com a almofada no ombro.",
  "tier": 3,
  "nivel_requerido": 43,
  "custo_pontos": 10,
  "pre_requisitos": [],
  "resultado_crafting": "sela_estegossauro",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_anquilossauro",
  "nome": "Sela de Anquilossauro",
  "descricao": "Sela de Anquilossauro: arreio de tiras de couro, com a almofada no ombro.",
  "tier": 3,
  "nivel_requerido": 44,
  "custo_pontos": 10,
  "pre_requisitos": [],
  "resultado_crafting": "sela_anquilossauro",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_sauropelta",
  "nome": "Sela de Sauropelta",
  "descricao": "Sela de Sauropelta: arreio de tiras de couro, com a almofada no ombro.",
  "tier": 3,
  "nivel_requerido": 45,
  "custo_pontos": 10,
  "pre_requisitos": [],
  "resultado_crafting": "sela_sauropelta",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_braquiossauro",
  "nome": "Sela de Braquiossauro",
  "descricao": "Sela de Braquiossauro: plataforma de madeira com grade.",
  "tier": 3,
  "nivel_requerido": 50,
  "custo_pontos": 12,
  "pre_requisitos": [
   "sela_galimimo"
  ],
  "resultado_crafting": "sela_braquiossauro",
  "estacao_necessaria": "bancada",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_argentinossauro",
  "nome": "Sela de Argentinossauro",
  "descricao": "Sela de Argentinossauro: plataforma de madeira com grade.",
  "tier": 3,
  "nivel_requerido": 51,
  "custo_pontos": 12,
  "pre_requisitos": [
   "sela_galimimo"
  ],
  "resultado_crafting": "sela_argentinossauro",
  "estacao_necessaria": "bancada",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_carnotauro",
  "nome": "Sela de Carnotauro",
  "descricao": "Sela de Carnotauro: sela reforçada com manta.",
  "tier": 3,
  "nivel_requerido": 46,
  "custo_pontos": 10,
  "pre_requisitos": [],
  "resultado_crafting": "sela_carnotauro",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_trex",
  "nome": "Sela de T-Rex",
  "descricao": "Sela de T-Rex: plataforma de madeira com grade.",
  "tier": 3,
  "nivel_requerido": 52,
  "custo_pontos": 12,
  "pre_requisitos": [
   "sela_galimimo"
  ],
  "resultado_crafting": "sela_trex",
  "estacao_necessaria": "bancada",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_titanoboa",
  "nome": "Sela de Titanoboa",
  "descricao": "Sela de Titanoboa: sela baixa e larga, presa com cintas.",
  "tier": 3,
  "nivel_requerido": 53,
  "custo_pontos": 12,
  "pre_requisitos": [
   "sela_galimimo"
  ],
  "resultado_crafting": "sela_titanoboa",
  "estacao_necessaria": "bancada",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_deinosuchus",
  "nome": "Sela de Deinosuchus",
  "descricao": "Sela de Deinosuchus: sela baixa e larga, presa com cintas.",
  "tier": 3,
  "nivel_requerido": 54,
  "custo_pontos": 12,
  "pre_requisitos": [
   "sela_galimimo"
  ],
  "resultado_crafting": "sela_deinosuchus",
  "estacao_necessaria": "bancada",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_espinossauro",
  "nome": "Sela de Espinossauro",
  "descricao": "Sela de Espinossauro: plataforma de madeira com grade.",
  "tier": 3,
  "nivel_requerido": 55,
  "custo_pontos": 12,
  "pre_requisitos": [
   "sela_galimimo"
  ],
  "resultado_crafting": "sela_espinossauro",
  "estacao_necessaria": "bancada",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_pterodactilo",
  "nome": "Sela de Pteranodonte",
  "descricao": "Sela de Pteranodonte: arreio de voo com cintas e argolas.",
  "tier": 2,
  "nivel_requerido": 22,
  "custo_pontos": 6,
  "pre_requisitos": [],
  "resultado_crafting": "sela_pterodactilo",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_quetzalcoatlus",
  "nome": "Sela de Quetzalcoatlus",
  "descricao": "Sela de Quetzalcoatlus: arreio de voo com cintas e argolas.",
  "tier": 3,
  "nivel_requerido": 56,
  "custo_pontos": 12,
  "pre_requisitos": [
   "sela_galimimo"
  ],
  "resultado_crafting": "sela_quetzalcoatlus",
  "estacao_necessaria": "bancada",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_mamute",
  "nome": "Sela de Mamute",
  "descricao": "Sela de Mamute: cesto alto de madeira preso com cordas.",
  "tier": 3,
  "nivel_requerido": 47,
  "custo_pontos": 10,
  "pre_requisitos": [],
  "resultado_crafting": "sela_mamute",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_argentavis",
  "nome": "Sela de Argentavis",
  "descricao": "Sela de Argentavis: arreio de voo com cintas e argolas.",
  "tier": 3,
  "nivel_requerido": 48,
  "custo_pontos": 10,
  "pre_requisitos": [],
  "resultado_crafting": "sela_argentavis",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_reidodo",
  "nome": "Sela de Rei-dodô",
  "descricao": "Sela de Rei-dodô: cesto alto de madeira preso com cordas.",
  "tier": 3,
  "nivel_requerido": 49,
  "custo_pontos": 10,
  "pre_requisitos": [],
  "resultado_crafting": "sela_reidodo",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_terizinossauro",
  "nome": "Sela de Terizinossauro",
  "descricao": "Sela de Terizinossauro: sela reforçada com manta.",
  "tier": 3,
  "nivel_requerido": 50,
  "custo_pontos": 10,
  "pre_requisitos": [],
  "resultado_crafting": "sela_terizinossauro",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_barionix",
  "nome": "Sela de Barionix",
  "descricao": "Sela de Barionix: sela reforçada com manta.",
  "tier": 3,
  "nivel_requerido": 51,
  "custo_pontos": 10,
  "pre_requisitos": [],
  "resultado_crafting": "sela_barionix",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_suchomimo",
  "nome": "Sela de Suchomimo",
  "descricao": "Sela de Suchomimo: sela reforçada com manta.",
  "tier": 3,
  "nivel_requerido": 52,
  "custo_pontos": 10,
  "pre_requisitos": [],
  "resultado_crafting": "sela_suchomimo",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_giganotossauro",
  "nome": "Sela de Giganotossauro",
  "descricao": "Sela de Giganotossauro: plataforma de madeira com grade.",
  "tier": 3,
  "nivel_requerido": 57,
  "custo_pontos": 12,
  "pre_requisitos": [
   "sela_galimimo"
  ],
  "resultado_crafting": "sela_giganotossauro",
  "estacao_necessaria": "bancada",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_sarcosuchus",
  "nome": "Sela de Sarcosuchus",
  "descricao": "Sela de Sarcosuchus: sela baixa e larga, presa com cintas.",
  "tier": 3,
  "nivel_requerido": 58,
  "custo_pontos": 12,
  "pre_requisitos": [
   "sela_galimimo"
  ],
  "resultado_crafting": "sela_sarcosuchus",
  "estacao_necessaria": "bancada",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_edmontossauro",
  "nome": "Sela de Edmontossauro",
  "descricao": "Sela de Edmontossauro: cesto alto de madeira preso com cordas.",
  "tier": 3,
  "nivel_requerido": 53,
  "custo_pontos": 10,
  "pre_requisitos": [],
  "resultado_crafting": "sela_edmontossauro",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "sela_paraceraterio",
  "nome": "Sela de Paraceratério",
  "descricao": "Sela de Paraceratério: cesto alto de madeira preso com cordas.",
  "tier": 3,
  "nivel_requerido": 54,
  "custo_pontos": 10,
  "pre_requisitos": [],
  "resultado_crafting": "sela_paraceraterio",
  "estacao_necessaria": "mao",
  "categoria": "Ferramentas"
 },
 {
  "id": "pocao_reset",
  "nome": "Poção de Reset",
  "descricao": "Devolve todos os pontos de atributo gastos.",
  "tier": 2,
  "nivel_requerido": 25,
  "custo_pontos": 6,
  "pre_requisitos": [
   "unguento"
  ],
  "resultado_crafting": "pocao_reset",
  "estacao_necessaria": "mao",
  "categoria": "Cura"
 }
];
