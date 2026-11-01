"""
BICHO .glb (bichos/modelos, esqueleto padrão): monta a configuração do
conversor (o mesmo formato de bichos.json) a partir dos nomes dos ossos.

O esqueleto padrão tem quadril, coluna_1..3, pescoco_1..3, cabeca,
mandibula, cauda_1..8, ombro/antebraco/mao_E/D e coxa/canela/pe_E/D.
Aqui cada osso do jogo (hips, chest, neck, head, jaw, tail1-3, pernas)
ganha o osso padrão que faz o mesmo papel, e cada papel de clipe do jogo
ganha a animação do .glb com o mesmo jeito.

Uso: python glb_config.py pasta_cru ossos_molde.json base.json config.json
  base.json = configuração já existente da espécie (credito, triangulos...), ou {}
"""
import json
import sys

# papel do clipe no jogo -> animação do .glb (e se repete)
CLIPES = {
    'parado': ('parado', True),
    'andar': ('andar', True),
    'voar': ('voar', True),
    'rugido': ('rugir', False),
    'ataque': ('atacar', False),
}


def main(cru, molde_path, base_path, out):
    meta = json.load(open(f'{cru}/cru.json'))
    molde = json.load(open(molde_path))
    cfg = json.load(open(base_path))
    nomes = meta['ossos']
    idx = {n: i for i, n in enumerate(nomes)}

    def osso(*cands):
        for c in cands:
            if c in idx:
                return idx[c]
        return None

    colunas = sorted(n for n in nomes if n.startswith('coluna_'))
    pescocos = sorted(n for n in nomes if n.startswith('pescoco_'))
    caudas = sorted((n for n in nomes if n.startswith('cauda_')), key=lambda n: int(n.split('_')[1]))
    want = {b['name'] for b in molde['bones']}
    m = {'hips': osso('quadril')}
    if colunas:
        m['chest'] = idx[colunas[-1]]
    elif 'peito' in idx:  # esqueleto de ave: coluna, peito, pescoco, asa1-3
        m['chest'] = idx['peito']
    if 'pescoco' in idx:
        m['neck'] = idx['pescoco']
    for lado in 'ED':
        if f'asa1_{lado}' in idx:
            m[f'asa{lado}'] = idx[f'asa1_{lado}']
            m[f'asa{lado}_punho'] = idx.get(f'asa2_{lado}')
    if pescocos:
        m['neck'] = idx[pescocos[0]]
        if len(pescocos) > 1 and 'neck2' in want:
            m['neck2'] = idx[pescocos[len(pescocos) // 2]]
    m['head'] = osso('cabeca')
    m['jaw'] = osso('mandibula')
    # cauda: 3 ossos do jogo espalhados pela cauda do modelo
    tails = sorted(n for n in want if n.startswith('tail'))
    for k, t in enumerate(tails):
        if caudas:
            m[t] = idx[caudas[min(len(caudas) - 1, round(k * (len(caudas) - 1) / max(1, len(tails) - 1) * 0.75))]]
    # pernas: de trás = coxa/canela/pé; da frente = ombro/antebraço/mão
    for leg in molde.get('legs', []):
        n = leg['name']
        lado = n[-1]  # E ou D
        frente = n.startswith(('frente', 'braco'))
        trio = (f'ombro_{lado}', f'antebraco_{lado}', f'mao_{lado}') if frente else (f'coxa_{lado}', f'canela_{lado}', f'pe_{lado}')
        for suf, b in zip(('', '_joelho', '_pe'), trio):
            if b in idx:
                m[n + suf] = idx[b]
    # esqueleto próprio do autor: "mapa" em bichos.json (_glb) diz o nome de cada osso
    for k, nome in cfg.pop('mapa', {}).items():
        m[k] = idx.get(nome)
        if m[k] is None:
            print('osso não achado:', nome)
    cfg['ossos'] = {k: v for k, v in m.items() if v is not None and k in want | {'jaw', 'neck2'}}
    acoes = meta.get('acoes', {})
    cfg['clipes'] = {papel: {'acao': a, 'loop': loop} for papel, (a, loop) in CLIPES.items() if a in acoes}
    cfg.setdefault('giro', 'y180')
    cfg.setdefault('repouso', 'ligacao')
    json.dump(cfg, open(out, 'w'), indent=1, ensure_ascii=False)
    faltam = sorted(want - set(cfg['ossos']))
    print('ossos', len(cfg['ossos']), 'faltam', faltam, 'clipes', list(cfg['clipes']))


if __name__ == '__main__':
    main(*sys.argv[1:5])
