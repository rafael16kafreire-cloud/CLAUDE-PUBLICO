"""Gera src/progression/engram_database.js (dados dos engrams) a partir das receitas do jogo.
Cada receita de data/crafting/receitas.json vira UM engram (id = id da receita).
Os números (tier, nível, custo, pré-requisitos) ficam na tabela abaixo: é aqui que se balanceia
o pool de pontos (meta ~650). Uso: python3 tools/dados/gerar_engrams.py
"""
import json
R = json.load(open('src/data/crafting/receitas.json'))['receitas']
itens = {i['id']: i for i in json.load(open('src/data/items/itens.json'))['itens']}
selas = json.load(open('src/data/creatures/selas.json'))['selas']
rec = {r['id']: r for r in R}

# id: (tier, nivel, custo, [pré-requisitos])
T = {
 # TIER 1 – pedra / início (níveis 1-14, custo 1-3)
 'picareta_pedra': (1, 1, 1, []), 'tocha': (1, 1, 1, []), 'bandagem': (1, 1, 1, []),
 'machado_pedra': (1, 1, 2, ['picareta_pedra']), 'bancada': (1, 2, 2, []),
 'lanca': (1, 3, 2, ['machado_pedra']), 'fogueira': (1, 3, 2, []), 'cantil': (1, 3, 2, []),
 'unguento': (1, 4, 2, ['bandagem']), 'saco_dormir': (1, 5, 3, []),
 'piso_palha': (1, 5, 3, []), 'parede_palha': (1, 5, 2, ['piso_palha']),
 'porta_palha': (1, 6, 2, ['parede_palha']), 'teto_palha': (1, 6, 2, ['parede_palha']),
 'pilao': (1, 6, 3, ['bancada']), 'luneta': (1, 7, 3, []), 'po_faisca': (1, 8, 2, ['pilao']),
 'clava': (1, 8, 3, ['machado_pedra']), 'narcotico': (1, 9, 3, ['pilao']),
 # TIER 2 – madeira (níveis 10-34, custo 3-6)
 'piso': (2, 10, 4, []), 'parede': (2, 10, 3, ['piso']), 'teto': (2, 12, 3, ['parede']), 'porta': (2, 12, 3, ['parede']),
 'rampa': (2, 12, 3, ['piso']), 'pilar': (2, 14, 3, ['piso']), 'janela': (2, 14, 4, ['parede']),
 'telhado': (2, 14, 4, ['teto']), 'cerca': (2, 14, 3, ['piso']), 'bau': (2, 14, 4, []),
 'arco': (2, 12, 5, []), 'flecha_pedra': (2, 12, 3, ['arco']), 'flecha_tranq': (2, 18, 6, ['flecha_pedra']),
 'flecha_obsidiana': (2, 24, 5, ['flecha_pedra']),
 'machado_metal': (2, 15, 5, ['machado_pedra']), 'picareta_metal': (2, 15, 5, ['picareta_pedra']),
 'racao': (2, 15, 4, ['pilao']),
 'capuz_pele': (2, 16, 4, []), 'camisa_pele': (2, 16, 5, []), 'luvas_pele': (2, 17, 4, []),
 'calca_pele': (2, 17, 5, []), 'botas_pele': (2, 17, 4, []),
 'pasta_cimento': (2, 22, 4, ['pilao']), 'polvora': (2, 25, 4, ['pilao']), 'pote_agua': (2, 26, 5, ['cantil']),
 'pocao_reset': (2, 25, 6, ['unguento']),
 # TIER 3 – metal (níveis 30-64, custo 6-12)
 'forja': (3, 30, 8, ['bancada']), 'lingote_metal': (3, 31, 6, ['forja']), 'carvao': (3, 31, 6, ['forja']),
 'lingote_petroleo': (3, 33, 6, ['forja']),
 'piso_pedra': (3, 32, 8, []), 'parede_pedra': (3, 32, 6, ['piso_pedra']), 'porta_pedra': (3, 33, 6, ['parede_pedra']),
 'teto_pedra': (3, 33, 6, ['parede_pedra']), 'pilar_pedra': (3, 34, 6, ['piso_pedra']), 'janela_pedra': (3, 35, 7, ['parede_pedra']),
 'telhado_pedra': (3, 35, 6, ['teto_pedra']), 'cerca_pedra': (3, 36, 6, ['piso_pedra']), 'rampa_pedra': (3, 36, 6, ['piso_pedra']),
 'capuz_pelo': (3, 35, 8, ['capuz_pele']), 'camisa_pelo': (3, 35, 9, ['camisa_pele']), 'luvas_pelo': (3, 36, 8, ['luvas_pele']),
 'calca_pelo': (3, 36, 9, ['calca_pele']), 'botas_pelo': (3, 36, 8, ['botas_pele']),
 'pistola': (3, 45, 12, ['forja']), 'bala_simples': (3, 46, 6, ['pistola']),
 'piso_metal': (3, 56, 9, ['forja']), 'parede_metal': (3, 56, 8, ['piso_metal']), 'porta_metal': (3, 57, 8, ['parede_metal']),
 'teto_metal': (3, 57, 8, ['parede_metal']), 'rampa_metal': (3, 58, 8, ['piso_metal']), 'pilar_metal': (3, 58, 8, ['piso_metal']),
 'janela_metal': (3, 59, 9, ['parede_metal']), 'telhado_metal': (3, 60, 8, ['teto_metal']), 'cerca_metal': (3, 58, 7, ['piso_metal']),
}
# selas: uma por bicho, pelo porte (pequena = tier 2; média e grande = tier 3)
niv_p, niv_m, niv_g = 20, 40, 50
n = {'pequena': 0, 'media': 0, 'grande': 0}
for sid, s in selas.items():
    k = s['porte']
    if k == 'pequena': T['sela_' + sid] = (2, niv_p + n[k], 6, ['bancada'] if False else [])
    elif k == 'media': T['sela_' + sid] = (3, niv_m + n[k], 10, [])
    else: T['sela_' + sid] = (3, niv_g + n[k], 12, ['sela_media_ref'])
    n[k] += 1
# as selas grandes pedem uma sela média qualquer (a primeira) como pré-requisito
primeira_media = next('sela_' + sid for sid, s in selas.items() if s['porte'] == 'media')
for k, v in list(T.items()):
    if v[3] == ['sela_media_ref']: T[k] = (v[0], v[1], v[2], [primeira_media])

faltando = [r['id'] for r in R if r['id'] not in T]
assert not faltando, faltando
estacao = lambda r: {'bancada': 'bancada', 'forja': 'forja', 'pilao': 'pilao'}.get(r.get('estacao'), 'mao')
out = []
for r in R:
    t, nv, c, pre = T[r['id']]
    it = itens.get(r['resultado'], {})
    out.append({'id': r['id'], 'nome': it.get('nome', r['id']), 'descricao': (it.get('descricao') or '').split('.')[0] + '.',
                'tier': t, 'nivel_requerido': nv, 'custo_pontos': c, 'pre_requisitos': pre,
                'resultado_crafting': r['resultado'], 'estacao_necessaria': estacao(r), 'categoria': r.get('categoria', '')})
tot = sum(e['custo_pontos'] for e in out)
por_tier = {}
for e in out: por_tier[e['tier']] = por_tier.get(e['tier'], 0) + e['custo_pontos']
print(len(out), 'engrams, pool', tot, por_tier)
js = '// =============================================================\n// BANCO DE ENGRAMS (só dados). Gerado por tools/dados/gerar_engrams.py\n// id = id da receita em data/crafting/receitas.json. tier/nível/custo/pré-requisitos: balanceie lá e rode o script.\n// =============================================================\nexport const ENGRAMS = ' + json.dumps(out, ensure_ascii=False, indent=1) + ';\n'
open('src/progression/engram_database.js', 'w').write(js)
