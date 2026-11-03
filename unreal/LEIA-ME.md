# Levar o jogo para o Unreal Engine

Esta pasta junta tudo do "Ilha Primordial" que dá para reaproveitar no Unreal.
O jogo atual é em JavaScript (three.js). O Unreal **não instala nada do GitHub sozinho**:
você baixa (clona) o repositório no seu PC e copia o que quer para o projeto.

## 1) Como baixar do GitHub

1. Instale o **Git** (ou o **GitHub Desktop**, mais fácil).
2. Clone o repositório `rafael16kafreire-cloud/CLAUDE-PUBLICO` e escolha a branch **`ccr-a1344ec6-8e764y`**.
   Pelo terminal: `git clone -b ccr-a1344ec6-8e764y https://github.com/rafael16kafreire-cloud/CLAUDE-PUBLICO`
3. Se o seu projeto Unreal também ficar no GitHub, use o **Git LFS** para arquivos grandes
   (modelos .glb, texturas, .uasset). O GitHub recusa arquivo acima de 100 MB.
4. O Unreal tem plugin de controle de versão com Git (Editor → Source Control), mas ele só
   salva o *seu* projeto. Importar os dados daqui é copiar arquivos.

## 2) O que tem aqui

| Pasta/arquivo | O que é |
|---|---|
| `unreal/dados/criaturas.csv` | 43 criaturas: vida, estamina, peso, torpor, dano, velocidades (m/s), temperamento ARK, tempos de ovo/maturação, habilidade especial |
| `unreal/dados/habilidades.csv` | 86 habilidades: dano, estamina, recarga (s), efeitos, requisitos |
| `unreal/dados/itens.csv` | 133 itens |
| `unreal/dados/receitas.csv` | 101 receitas |
| `bichos/modelos/` | 44 modelos .glb de dinossauros (com esqueleto e animações) |
| `construcao-lowpoly/modelos/` | 62 peças de construção .glb + `custos.json` |
| `modelos_originais/` | modelos convertidos do jogo (bichos, neve, plantas) |
| `unreal/codigo/GUIA_DOS_SISTEMAS.md` | **comece por aqui**: todos os sistemas explicados e como refazer no Unreal |
| `unreal/codigo/INDICE_DO_CODIGO.md` | cada arquivo de código: o que faz, o que exporta |
| `unreal/codigo/fonte/` | cópia de todo o código do jogo (JavaScript) |
| `unreal/dados/*.json` | todos os números: balanceamento, estamina, progressão, criação, IA, mundo |

## 3) Como importar no Unreal

- **Tabelas (.csv):** crie um *Struct* com as mesmas colunas e importe como **Data Table**
  (Content Browser → Import → escolha o struct). Dá para ler vida, dano, velocidades etc.
  direto em Blueprint ou C++.
- **Modelos (.glb):** o Unreal 5 importa glTF (plugin *Interchange* ou *glTF Importer*).
  Os bichos vêm com esqueleto e animações; confira a escala (o jogo usa metros, o Unreal usa
  centímetros: multiplique por 100).
- **Regras:** o resumo está abaixo. Os arquivos em `src/` têm os números exatos.

## 4) Resumo das regras do jogo

**Progressão do jogador:** níveis 1 a 100. XP para subir do nível N = `round(10 × N^1.8)`.
1 ponto de atributo por nível. Pontos de engrama: 8 iniciais + `3 + floor(nível/25)` por nível.

**Nível dos dinos (como no ARK):** o selvagem de nível L tem L−1 pontos sorteados entre vida
(+20%), estamina (+10%), oxigênio (+10%), comida (+10%), peso (+2%), dano (+5%). A velocidade
não sobe no selvagem. O torpor sobe +6% por nível. Domado: bônus de `floor(nível × eficiência / 2)` níveis.

**Temperamento (IA):** cada espécie tem um temperamento do ARK (`temperamento_ark` no CSV):
oblivious/cowardly/skittish fogem ao apanhar; docile/defensive/reactive revidam; aggressive,
territorial, patient etc. atacam o jogador. Filhote sempre foge. Domado tem 5 modos:
passivo-foge, passivo, neutro, atacar alvo, agressivo.

**Criação:** cooldown só da fêmea (18 a 48 h), gêmeos 10%, trigêmeos 2%. Herança de atributos
55% do maior / 45% do menor. Mutação 3 × 2,5%, teto de 20 por lado, +2 pontos. Impressão:
um pedido a cada 8 h, janela de 4 h, 100% = +20% nos atributos. Ovo só choca dentro da faixa
de temperatura; fora dela perde saúde. Rex: choca em 4 h 59 min, amadurece em 92 h 35 min.
Titanoboa não tem sexo e bota ovo sozinha (até 8 ovos). Rei-dodô e chefes são estéreis.

**Habilidades:** cada dinossauro tem **uma** habilidade especial (coluna `habilidade_especial`).

## 5) O que NÃO está confirmado (não use como verdade)

- Os tempos de ovo, maturação e temperatura de **todas as espécies, menos o Rex**, são os do Rex
  como substituto. Falta buscar na wiki do ARK.
- Duração da barra de acasalamento (30 s) e taxa em que o ovo perde saúde (1 h) são valores meus.
- Dano do Giganotossauro (480) não conferido. Piranha e mosassauro como estéreis: não conferido.
- Várias habilidades só existem nos dados (cuspe, agarrar, scan, feromônios, lentidão, veneno).
- Licenças: veja `bichos/CREDITOS.md`. Há modelos CC BY (dar crédito) e o arco é **CC BY-NC-SA**
  (não pode vender). A `titanoboa.glb` é só uso não comercial.
