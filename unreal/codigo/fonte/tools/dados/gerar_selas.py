"""Gera um item e uma receita de sela para cada bicho de src/data/creatures/selas.json
(itens.json e receitas.json). Pode rodar de novo: refaz só as selas "sela_<bicho>".
Uso: python3 tools/dados/gerar_selas.py"""
import json
R = 'src/data/'
selas = json.load(open(R + 'creatures/selas.json'))['selas']
def load(p):
    return json.load(open(R + p))
itens = load('items/itens.json'); rec = load('crafting/receitas.json')
base = {x['id']: x for x in rec['receitas']}
# modelos de preço: as 3 selas antigas (ou, se já foram trocadas, a de um bicho de cada porte)
tier = {k: base.get(a) or base[b] for k, a, b in (('pequena', 'sela', 'sela_raptor'), ('media', 'sela_media', 'sela_parassauro'), ('grande', 'sela_grande', 'sela_braquiossauro'))}
# o nível ficou deslocado por bicho: volta ao nível-base do porte
for k in tier:
    tier[k] = dict(tier[k]); tier[k]['nivel'] = {'pequena': 18, 'media': 16, 'grande': 74}[k]
desc = {
 'leve': 'sela leve para corredores',
 'padrao': 'sela reforçada com manta',
 'arreio': 'arreio de tiras de couro, com a almofada no ombro',
 'plataforma': 'plataforma de madeira com grade',
 'cesto': 'cesto alto de madeira preso com cordas',
 'cobra': 'sela baixa e larga, presa com cintas',
 'voo': 'arreio de voo com cintas e argolas',
}
itens['itens'] = [i for i in itens['itens'] if not (i['id'].startswith('sela_') and i['id'] not in ('sela_media', 'sela_grande'))]
rec['receitas'] = [r for r in rec['receitas'] if not (r['id'].startswith('sela_') and r['id'] not in ('sela_media', 'sela_grande'))]
# as 3 selas antigas só existem para saves velhos: saem do menu de criar
rec['receitas'] = [r for r in rec['receitas'] if r['id'] not in ('sela', 'sela_media', 'sela_grande')]
for n, (sid, s) in enumerate(selas.items()):
    t = tier[s['porte']]
    nome = s['nome']
    itens['itens'].append({
        'id': 'sela_' + sid, 'nome': nome, 'tipo': 'consumivel', 'peso': 20.0, 'pilha': 1,
        'descricao': f"{nome}: {desc[s['estilo']]}. Só serve nesse bicho. Com ela na mão, Interagir no bicho domado.",
        'icone': {'forma': 'sela', 'cor': s['couro'], 'cor2': s['pano']},
    })
    r = {k: v for k, v in t.items() if k not in ('id', 'resultado')}
    r = {'id': 'sela_' + sid, 'resultado': 'sela_' + sid, **r}
    r['nivel'] = min(100, t['nivel'] + (n % 5))
    rec['receitas'].append(r)
json.dump(itens, open(R + 'items/itens.json', 'w'), ensure_ascii=False, indent=1)
json.dump(rec, open(R + 'crafting/receitas.json', 'w'), ensure_ascii=False, indent=1)
print(len(selas), 'selas')
