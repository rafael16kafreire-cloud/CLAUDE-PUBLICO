// Titanoboa (modelo do kenchoo, CC BY-NC 4.0): o original só tem uma animação (enrolada).
// Aqui o corpo inteiro é posto em linha e animado por uma onda que corre da cabeça para a cauda.
// Depois: node adaptar.mjs config/titanoboa.json  (tamanho real e orientação)
import { readFileSync } from 'node:fs';
const linhas = readFileSync(new URL('./titanoboa_ossos.txt', import.meta.url), 'utf8').trim().split('\n').map(l => l.trim().split(/\s+/));
const pos = Object.fromEntries(linhas.map(([n, , x, y, z]) => [n, [+x, +y, +z]]));
const filhos = {}; for (const [n, pai] of linhas) (filhos[pai] ||= []).push(n);
// corrente do corpo: Bone_89 (atrás da cabeça) até a ponta da cauda
const nomes = ['Bone_89']; for (;;) { const f = (filhos[nomes.at(-1)] || []).filter(n => n !== 'Bone085_88'); if (!f.length) break; nomes.push(f[0]); }
const ar = [], s = []; let acc = 0;
for (let i = 0; i < nomes.length - 1; i++) {
  const a = pos[nomes[i]], b = pos[nomes[i + 1]], dx = b[0] - a[0], dz = b[2] - a[2];
  ar.push(Math.atan2(dx, dz)); s.push(acc); acc += Math.hypot(dx, dz);
}
const C = { nomes: nomes.slice(0, -1), ar, s, L: acc };

// pose(C, o): o.theta(s) = ângulo lateral (rad), o.pitch(s) = inclinação extra do segmento (graus),
// o.roll = rolagem do corpo todo (graus), o.pos = deslocamento da cabeça, o.boca = levantar a cabeça (graus), o.cabeca = [graus X, Y, Z]
const POSE = `(C, o) => {
  const qa = (ax, ay, az, g) => { const h = g * Math.PI / 360, sn = Math.sin(h); return [ax * sn, ay * sn, az * sn, Math.cos(h)]; };
  const mul = (a, b) => [a[3]*b[0] + a[0]*b[3] + a[1]*b[2] - a[2]*b[1], a[3]*b[1] - a[0]*b[2] + a[1]*b[3] + a[2]*b[0],
                         a[3]*b[2] + a[0]*b[1] - a[1]*b[0] + a[2]*b[3], a[3]*b[3] - a[0]*b[0] - a[1]*b[1] - a[2]*b[2]];
  const wrap = x => Math.atan2(Math.sin(x), Math.cos(x));
  const out = { $pos: { Bone_89: o.pos || [0, 0, 0] } }; let prev = 0;
  for (let i = 0; i < C.nomes.length; i++) {
    const alvo = Math.PI + (o.theta ? o.theta(C.s[i]) : 0), D = wrap(alvo - C.ar[i]), yaw = wrap(D - prev); prev = D;
    const a = C.ar[i] + yaw, dx = Math.sin(a), dz = Math.cos(a), ph = o.pitch ? o.pitch(C.s[i]) : 0;
    let q = mul(qa(-dz, 0, dx, ph), qa(0, 1, 0, yaw * 180 / Math.PI));
    if (i === 0 && o.roll) q = mul(qa(Math.sin(alvo), 0, Math.cos(alvo), o.roll), q);
    out[C.nomes[i]] = q;
  }
  const c = o.cabeca || [0, 0, 0];
  // a boca do modelo já é aberta e não tem osso de mandíbula: 'boca' vira um levantar de cabeça
  out.Bone086_85 = [c[0] - (o.boca || 0) * 0.3, c[1], c[2]];
  return out;
}`;
const vars = { C, POSE };
// onda que anda da cabeça para a cauda; mais fraca perto da cabeça
const onda = `(C, A, lam, T, t) => s => A * Math.min(1, 0.25 + s / (0.2 * C.L)) * Math.sin(2 * Math.PI * (s / (lam * C.L) - t / T))`;
// cabeça erguida: os primeiros 'f' do corpo sobem 'g' graus
// cabeça erguida: o primeiro segmento sobe 'g' graus e a curva volta ao chão aos poucos até f*L
const ergue = `(C, g, f) => { const ds = C.L / C.nomes.length; return s => s < 0.01 ? -g : (s < f * C.L ? g * ds / (f * C.L) : 0); }`;
vars.ONDA = onda; vars.ERGUE = ergue;
const H = `(C, g, f) => { const r = Math.max(1e-3, g * Math.PI / 180); return [0, f * C.L * (1 - Math.cos(r)) / r, 0]; }`; vars.H = H;

const nadando = (nome, A, T, g) => ({ nome, base: 'Animation', baseT: 0, dur: T, f: `(t, d, u) => {
  const pose = eval(POSE), onda = eval(ONDA), ergue = eval(ERGUE), h = eval(H);
  return pose(C, { theta: onda(C, ${A}, 0.7, ${T}, t), pitch: ergue(C, ${g}, 0.08), pos: h(C, ${g}, 0.08) }); }` });

export default {
  modelo: '../originais/titanoboa_kenchoo.glb', saida: process.env.SAIDA || '../teste/titanoboa_anim.glb', vars,
  clipes: [
    { nome: 'parado', base: 'Animation', baseT: 0, dur: 4, f: `(t, d, u) => {
      const pose = eval(POSE), onda = eval(ONDA), ergue = eval(ERGUE), h = eval(H);
      return pose(C, { theta: onda(C, 0.22, 0.9, 4, t), pitch: ergue(C, 14, 0.07), pos: h(C, 14, 0.07), cabeca: [3 * u.sin(t, 2), 4 * u.sin(t, 4), 0] }); }` },
    nadando('andar', 0.45, 2, 8),
    nadando('correr', 0.6, 1, 6),
    nadando('nadar', 0.5, 2.4, 4),
    nadando('nadar_rapido', 0.65, 1.2, 3),
    { nome: 'atacar', base: 'Animation', baseT: 0, dur: 1.8, f: `(t, d, u) => {
      const pose = eval(POSE), ergue = eval(ERGUE), h = eval(H);
      const arma = u.ida(t, 0, 0.6, 0.75, 0.95), bote = u.ida(t, 0.7, 0.85, 1.1, 1.6), g = 14 + 20 * arma - 10 * bote;
      const S = s => (0.9 * arma) * Math.max(0, 1 - s / (0.3 * C.L)) * Math.sin(2 * Math.PI * s / (0.22 * C.L));
      return pose(C, { theta: S, pitch: ergue(C, g, 0.1), pos: [0, h(C, g, 0.1)[1], 0.08 * C.L * bote], boca: 55 * u.ida(t, 0.65, 0.8, 0.95, 1.2) }); }` },
    { nome: 'rugir', base: 'Animation', baseT: 0, dur: 2.6, f: `(t, d, u) => {
      const pose = eval(POSE), onda = eval(ONDA), ergue = eval(ERGUE), h = eval(H);
      const k = u.ida(t, 0, 0.5, 2.1, 2.6), g = 14 + 22 * k;
      return pose(C, { theta: onda(C, 0.25, 0.9, 2.6, t), pitch: ergue(C, g, 0.12), pos: h(C, g, 0.12), boca: 60 * u.ida(t, 0.4, 0.7, 1.9, 2.3), cabeca: [-10 * k, 5 * k * u.sin(t, 0.13), 0] }); }` },
    { nome: 'comer', base: 'Animation', baseT: 0, dur: 3, f: `(t, d, u) => {
      const pose = eval(POSE), onda = eval(ONDA);
      const m = Math.max(0, u.sin(t, 1));
      return pose(C, { theta: onda(C, 0.15, 0.9, 3, t), boca: 45 * m, cabeca: [10, 6 * u.sin(t, 1.5), 8 * u.sin(t, 1)] }); }` },
    { nome: 'dormir', base: 'Animation', baseT: 0, dur: 4, f: `(t, d, u) => ({ Bone_89: [0, 2 * u.sin(t, 4), 0], Bone086_85: [4, 0, 0] })` },
    { nome: 'morrer', base: 'Animation', baseT: 0, dur: 3.2, f: `(t, d, u) => {
      const pose = eval(POSE);
      const A = 0.7 * (1 - u.e(t, 0.4, 1.8)) + 0.08, rol = 150 * u.e(t, 1.2, 2.4);
      const th = s => A * Math.min(1, 0.25 + s / (0.2 * C.L)) * Math.sin(2 * Math.PI * (s / (0.6 * C.L) - t / 0.6));
      return pose(C, { theta: th, roll: rol, pos: [0, 0.022 * C.L * (1 - Math.cos(rol * Math.PI / 180)), 0], boca: 40 * u.e(t, 1.6, 2.4) }); }` },
  ],
};
