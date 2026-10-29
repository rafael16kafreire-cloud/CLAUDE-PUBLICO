// =============================================================
// JEITO DE SE MEXER DE CADA BICHO (os que são feitos por código)
// Depois da animação geral (andar, respirar, atacar), cada espécie soma o seu
// jeito próprio: dodô bica e balança a cabeça, onça se agacha para caçar,
// triceratops baixa a cabeça para investir etc. Só mexe nos ossos que o
// corpo da espécie tem (hips, chest, neck, head, tail1..3).
// Tudo soma em cima da rotação que a animação geral já pôs (nunca troca).
// =============================================================
const TAU = Math.PI * 2;

// pulso suave 0..1 que "dispara" de vez em quando (período em segundos)
const pulso = (t, periodo, fase, largura = 0.12) => {
  const x = (((t + fase) / periodo) % 1 + 1) % 1;
  return x < largura ? Math.sin((x / largura) * Math.PI) : 0;
};
// "olhada" brusca: a cabeça pula de um lado para outro (valor entre -1 e 1)
const olhadas = (t, passo, fase) => {
  const k = Math.floor(t / passo + fase);
  const r = Math.sin(k * 127.1 + fase * 311.7) * 43758.5453;
  const v = (r - Math.floor(r)) * 2 - 1;
  const f = Math.min(1, (t / passo + fase - k) * 6); // vira rápido, depois segura
  const rp = Math.sin((k - 1) * 127.1 + fase * 311.7) * 43758.5453;
  const vp = (rp - Math.floor(rp)) * 2 - 1;
  return vp + (v - vp) * f;
};

const add = (bone, eixo, v) => {
  if (bone) bone.rotation[eixo] += v;
};

// c = criatura, b = ossos, t = tempo da criatura, k = { mov, corre, parado, comendo, perseguindo, atk, morto }
const TRACOS = {
  // Dodô: balança a cabeça para frente e para trás ao andar e bica o chão parado
  dodo(c, b, t, k) {
    add(b.neck, 'x', Math.sin(c.phase * TAU * 2) * 0.2 * k.mov + -0.5 * pulso(t, 4.2, c.id, 0.16) * k.parado);
    add(b.head, 'y', olhadas(t, 1.3, c.id) * 0.35 * k.parado);
    add(b.hips, 'z', Math.sin(c.phase * TAU) * 0.07 * k.mov); // gingado
  },
  // Galimimo: corre com a cauda esticada para trás e o pescoço em S; olha em volta aos tranquinhos
  galimimo(c, b, t, k) {
    add(b.tail1, 'x', -0.14 * k.corre);
    add(b.tail2, 'x', -0.1 * k.corre);
    add(b.neck, 'x', Math.sin(c.phase * TAU * 2) * 0.14 * k.mov);
    add(b.head, 'y', olhadas(t, 1.8, c.id) * 0.3 * k.parado);
    add(b.chest, 'x', 0.06 * k.corre);
  },
  // Capivara: anda gingando e, parada, mastiga devagar e mexe a cabeça
  capivara(c, b, t, k) {
    add(b.hips, 'z', Math.sin(c.phase * TAU) * 0.09 * k.mov);
    add(b.chest, 'z', -Math.sin(c.phase * TAU) * 0.06 * k.mov);
    add(b.head, 'x', Math.sin(t * 4.5) * 0.05 * (k.parado + k.comendo));
    add(b.head, 'y', olhadas(t, 2.6, c.id) * 0.25 * k.parado);
  },
  // Paquicefalossauro: cabeçada de verdade (pescoço e quadril vão para frente e a cabeça baixa)
  paquicefalossauro(c, b, t, k) {
    add(b.neck, 'x', -0.55 * k.atk - 0.18 * k.perseguindo);
    add(b.head, 'x', -0.35 * k.atk);
    add(b.hips, 'x', 0.14 * k.atk);
    add(b.chest, 'x', 0.1 * k.atk);
    add(b.head, 'y', olhadas(t, 2.2, c.id) * 0.2 * k.parado);
  },
  // Triceratops: baixa a cabeça com os chifres para investir e balança de lado
  triceratops(c, b, t, k) {
    const inv = Math.max(k.atk, k.perseguindo * 0.9);
    add(b.neck, 'x', -0.5 * inv);
    add(b.head, 'x', -0.3 * inv);
    add(b.head, 'y', Math.sin(t * 9) * 0.16 * k.atk);
    add(b.chest, 'x', 0.05 * inv);
    add(b.tail1, 'y', Math.sin(t * 1.2) * 0.1 * k.parado);
  },
  // Compsognato: nervoso, vira a cabeça em movimentos rápidos e balança a cauda
  compsognato(c, b, t, k) {
    add(b.head, 'y', olhadas(t, 0.55, c.id) * 0.55 * (k.parado + 0.4 * k.mov));
    add(b.head, 'x', olhadas(t + 3.1, 0.7, c.id) * 0.18 * k.parado);
    add(b.tail1, 'y', Math.sin(t * 7) * 0.2 * k.parado);
    add(b.tail2, 'y', Math.sin(t * 7 - 0.8) * 0.25 * k.parado);
  },
  // Dilofossauro: agachado e com o pescoço em S para frente ao atacar; cabeça trêmula (cuspe)
  dilofossauro(c, b, t, k) {
    const bote = Math.max(k.atk, k.perseguindo * 0.8);
    add(b.neck, 'x', 0.32 * bote);
    add(b.head, 'x', -0.3 * bote);
    add(b.head, 'z', Math.sin(t * 15) * 0.14 * k.atk);
    add(b.chest, 'x', 0.12 * bote);
    add(b.tail1, 'x', -0.16 * bote);
    add(b.head, 'y', olhadas(t, 1.5, c.id) * 0.3 * k.parado);
  },
  // Onça: caça agachada (corpo baixo, cabeça baixa) e pula no bote
  onca(c, b, t, k) {
    const espreita = k.perseguindo * (1 - k.atk) * (1 - k.corre * 0.6);
    if (b.hips?.userData.rest) b.hips.position.y = b.hips.userData.rest.y - 0.12 * espreita * c.scale;
    add(b.neck, 'x', -0.3 * espreita);
    add(b.head, 'x', -0.2 * espreita);
    add(b.chest, 'x', 0.12 * espreita - 0.3 * k.atk);
    add(b.tail1, 'x', -0.35 * k.atk + 0.2 * espreita);
    add(b.tail2, 'y', Math.sin(t * 2.2) * 0.45 * (k.parado + espreita)); // cauda balançando
  },
  // Aranha: treme as patas ao andar e levanta a frente do corpo para morder
  aranha(c, b, t, k) {
    add(b.hips, 'z', Math.sin(t * 28) * 0.025 * k.mov);
    add(b.chest, 'x', -0.5 * k.atk - 0.12 * k.perseguindo);
    add(b.head, 'x', -0.25 * k.atk);
    add(b.hips, 'y', Math.sin(t * 0.7 + c.id) * 0.06 * k.parado);
  },
  // Piranha: ondula o corpo todo e dá mordidas rápidas
  piranha(c, b, t, k) {
    const v = 0.35 + 0.9 * Math.min(1, c.speed / 3);
    add(b.tail1, 'y', Math.sin(t * 13) * 0.3 * v);
    add(b.tail2, 'y', Math.sin(t * 13 - 0.9) * 0.38 * v);
    add(b.chest, 'y', Math.sin(t * 13 + 0.9) * 0.1 * v);
    add(b.head, 'y', -Math.sin(t * 13) * 0.1 * v + Math.sin(t * 26) * 0.35 * k.atk);
  },
  // Arara: balança a cabeça de lado, dá cabeçadinhas e se ajeita no chão
  arara(c, b, t, k) {
    add(b.head, 'z', Math.sin(t * 1.1 + c.id) * 0.25 * (k.parado + 0.5 * k.mov));
    add(b.head, 'y', olhadas(t, 0.8, c.id) * 0.5 * k.parado);
    add(b.head, 'x', -0.3 * pulso(t, 3.4, c.id, 0.14) * k.parado);
    add(b.tail1, 'x', Math.sin(t * 2.4) * 0.07 * k.parado);
  },
};

export function aplicarTraco(c, b, t, A, CSTATE) {
  const fn = TRACOS[c.species.id];
  if (!fn || c.state === CSTATE.DEAD || c.state === CSTATE.KO) return;
  const mov = Math.min(1, c.speed / Math.max(0.5, c.walkSpeed ?? 1));
  const parado = c.state === CSTATE.IDLE && c.speed < 0.2 ? 1 : 0;
  fn(c, b, t, {
    mov,
    corre: Math.min(1, A.run ?? 0),
    parado,
    comendo: c.state === CSTATE.EAT ? 1 : 0,
    perseguindo: c.state === CSTATE.CHASE || c.state === CSTATE.ATTACK ? 1 : 0,
    atk: Math.max(0, Math.min(1, Math.sin(Math.min(1, c.attackAnim) * Math.PI))),
  });
}
