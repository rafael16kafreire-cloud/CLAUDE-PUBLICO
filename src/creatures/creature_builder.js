// =============================================================
// CONSTRUTOR DE CRIATURAS (modelos feitos por código)
// Cada espécie é descrita em creature_models.js por uma "coluna"
// (da ponta da cauda até o focinho), pernas, braços, asas e
// detalhes. Aqui isso vira UMA malha com esqueleto (ossos):
//   - corpo liso e arredondado, com barriga clara e costas escuras
//   - ossos para pernas, cauda, pescoço, cabeça e asas (animação)
//   - 1 desenho por criatura (leve para o celular)
// =============================================================
import * as THREE from 'three';

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);

class MeshBuilder {
  constructor() {
    this.pos = [];
    this.col = [];
    this.si = [];
    this.sw = [];
    this.idx = [];
    this.bones = []; // { name, parent, pos: Vector3 }
    this.boneIndex = new Map();
  }

  bone(name, parent, pos) {
    if (this.boneIndex.has(name)) return this.boneIndex.get(name);
    const i = this.bones.length;
    this.bones.push({ name, parent, pos: pos.clone() });
    this.boneIndex.set(name, i);
    return i;
  }

  b(name) {
    const i = this.boneIndex.get(name);
    if (i === undefined) throw new Error(`osso desconhecido: ${name}`);
    return i;
  }

  vertex(p, c, b0, b1 = b0, w = 0) {
    this.pos.push(p.x, p.y, p.z);
    this.col.push(c.r, c.g, c.b);
    this.si.push(b0, b1, 0, 0);
    this.sw.push(1 - w, w, 0, 0);
    return this.pos.length / 3 - 1;
  }

  // Acrescenta uma forma pronta do three.js presa a um osso.
  addGeometry(geom, matrix, bone, color) {
    const g = geom.index ? geom : geom;
    g.applyMatrix4(matrix);
    const base = this.pos.length / 3;
    const p = g.attributes.position;
    const tmp = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      tmp.fromBufferAttribute(p, i);
      this.vertex(tmp, typeof color === 'function' ? color(tmp) : color, bone);
    }
    if (g.index) {
      const ix = g.index.array;
      for (let i = 0; i < ix.length; i++) this.idx.push(base + ix[i]);
    } else {
      for (let i = 0; i < p.count; i++) this.idx.push(base + i);
    }
  }

  // Tubo liso ao longo de uma curva (corpo, cauda, pescoço, chifres).
  // ctrl: [{ p, r, h (achatamento), bone }]
  tube(ctrl, colorFn, radial = 10, perMeter = 7) {
    const pts = ctrl.map((c) => c.p);
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const len = curve.getLength();
    const segs = Math.max(6, Math.min(48, Math.round(len * perMeter)));
    const n = ctrl.length - 1;
    const rings = [];
    let side = new THREE.Vector3(1, 0, 0);
    const up = new THREE.Vector3();
    const Y = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const c = curve.getPoint(t);
      const T = curve.getTangent(t).normalize();
      const s = new THREE.Vector3().crossVectors(T, Y);
      if (s.lengthSq() > 1e-4) side = s.normalize();
      up.crossVectors(side, T).normalize();
      const k = Math.min(n - 1, Math.floor(t * n));
      const f = t * n - k;
      const sf = f * f * (3 - 2 * f);
      const r = ctrl[k].r + (ctrl[k + 1].r - ctrl[k].r) * sf;
      const h = (ctrl[k].h ?? 1) + ((ctrl[k + 1].h ?? 1) - (ctrl[k].h ?? 1)) * sf;
      const b0 = this.b(ctrl[k].bone);
      const b1 = this.b(ctrl[k + 1].bone);
      const ring = [];
      for (let j = 0; j <= radial; j++) {
        const a = -Math.PI / 2 + (j / radial) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const p = c.clone().addScaledVector(side, ca * r).addScaledVector(up, sa * r * h);
        ring.push(this.vertex(p, colorFn(t, sa, i), b0, b1, b0 === b1 ? 0 : f));
      }
      rings.push({ ring, c, T, b0 });
    }
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < radial; j++) {
        const a = rings[i].ring[j];
        const b = rings[i + 1].ring[j];
        const c = rings[i + 1].ring[j + 1];
        const d = rings[i].ring[j + 1];
        this.idx.push(a, b, d, b, c, d);
      }
    }
    // Fecha as pontas (dos dois lados, para não ficar buraco).
    for (const [ri, dir] of [[0, -1], [segs, 1]]) {
      const R = rings[ri];
      const center = this.vertex(R.c.clone().addScaledVector(R.T, dir * 0.01), colorFn(ri / segs, -1, ri), R.b0);
      for (let j = 0; j < radial; j++) {
        this.idx.push(center, R.ring[j], R.ring[j + 1], center, R.ring[j + 1], R.ring[j]);
      }
    }
  }

  // Segmento de perna/braço entre dois pontos.
  segment(a, b, r0, r1, bone, color, radial = 8) {
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(r1, r0, len, radial, 1, false);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    const m = new THREE.Matrix4().compose(a, q, new THREE.Vector3(1, 1, 1));
    this.addGeometry(g, m, bone, color);
  }

  ellipsoid(center, radii, bone, color, seg = [10, 8]) {
    const g = new THREE.SphereGeometry(1, seg[0], seg[1]);
    const m = new THREE.Matrix4().compose(center, new THREE.Quaternion(), new THREE.Vector3(...radii));
    this.addGeometry(g, m, bone, color);
  }

  cone(base, tip, r, bone, color, radial = 8) {
    const len = base.distanceTo(tip);
    const g = new THREE.ConeGeometry(r, len, radial);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(base).normalize());
    this.addGeometry(g, new THREE.Matrix4().compose(base, q, new THREE.Vector3(1, 1, 1)), bone, color);
  }

  // Membrana da asa: triângulos dos dois lados.
  membrane(points, bones, weights, color) {
    // points: [ombro, punho, ponta, meio da borda de trás, raiz]
    const tris = [[0, 1, 3], [1, 2, 3], [0, 3, 4]];
    for (const flip of [false, true]) {
      const ids = points.map((p, i) => this.vertex(p, color, bones[i][0], bones[i][1], weights[i]));
      for (const [a, b, c] of tris) {
        if (flip) this.idx.push(ids[a], ids[c], ids[b]);
        else this.idx.push(ids[a], ids[b], ids[c]);
      }
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    // Margem extra: os ossos mexem o corpo durante a animação.
    g.boundingSphere.radius *= 1.3;
    return g;
  }
}

// ------------------------------------------------------------
// Monta o modelo de uma espécie a partir da descrição.
// ------------------------------------------------------------
export function buildSpeciesModel(spec) {
  const mb = new MeshBuilder();
  const top = new THREE.Color(spec.colors.top);
  const belly = new THREE.Color(spec.colors.belly);
  const pattern = new THREE.Color(spec.colors.pattern ?? spec.colors.top);
  const limbColor = top.clone().lerp(belly, 0.25).multiplyScalar(0.92);

  // --- Ossos da coluna ---
  const spine = spec.spine.map((s) => ({ p: V(s), r: s[3], h: s[4] ?? 1, bone: s[5] }));
  const rootName = spec.root ?? 'hips';
  const rootIdx = spine.findIndex((s) => s.bone === rootName);
  mb.bone(rootName, null, spine[rootIdx].p);
  // para trás (cauda) e para frente (pescoço/cabeça)
  for (const dir of [-1, 1]) {
    let parent = rootName;
    for (let i = rootIdx + dir; i >= 0 && i < spine.length; i += dir) {
      const name = spine[i].bone;
      if (!mb.boneIndex.has(name)) {
        mb.bone(name, parent, spine[i].p);
        parent = name;
      } else if (name !== parent && name !== rootName) {
        parent = name;
      }
    }
  }
  for (const extraBone of spec.bones ?? []) mb.bone(extraBone.name, extraBone.parent, V(extraBone.pos));

  // --- Corpo: costas escuras, barriga clara, listras/manchas ---
  const freq = spec.colors.patternFreq ?? 0;
  const tmpC = new THREE.Color();
  const bodyColor = (t, upness, i) => {
    tmpC.copy(belly).lerp(top, Math.min(1, Math.max(0, (upness + 0.35) / 0.9)));
    if (freq > 0 && upness > -0.1) {
      const s = Math.sin(t * freq * Math.PI * 2 + Math.sin(i * 1.7) * 0.6);
      if (s > 0.55) tmpC.lerp(pattern, (spec.colors.patternStrength ?? 0.6) * Math.min(1, (upness + 0.1) * 1.6));
    }
    return tmpC.clone();
  };
  mb.tube(spine, bodyColor, spec.radial ?? 12, spec.ringsPerMeter ?? 7);

  // --- Pernas e braços: osso da coxa, canela e pé ---
  for (const leg of spec.legs ?? []) {
    const [hip, knee, ankle, toe] = [V(leg.hip), V(leg.knee), V(leg.ankle), V(leg.toe)];
    const [r0, r1, r2] = leg.r;
    const parent = leg.parent ?? rootName;
    const thigh = mb.bone(leg.name, parent, hip);
    const shin = mb.bone(`${leg.name}_joelho`, leg.name, knee);
    const foot = mb.bone(`${leg.name}_pe`, `${leg.name}_joelho`, ankle);
    const col = leg.color ? new THREE.Color(leg.color) : limbColor;
    mb.ellipsoid(hip, [r0 * 1.15, r0 * 1.25, r0 * 1.3], thigh, col);
    mb.segment(hip, knee, r0, r1 * 1.1, thigh, col);
    mb.ellipsoid(knee, [r1 * 1.1, r1 * 1.1, r1 * 1.1], shin, col, [8, 6]);
    mb.segment(knee, ankle, r1, r2, shin, col);
    mb.ellipsoid(ankle, [r2, r2, r2], foot, col, [6, 5]);
    mb.segment(ankle, toe, r2, r2 * 0.55, foot, col, 6);
  }

  // --- Asas ---
  for (const wing of spec.wings ?? []) {
    const [shoulder, wrist, tip, mid, root] = wing.points.map(V);
    const wb = mb.bone(wing.name, wing.parent ?? 'chest', shoulder);
    const wr = mb.bone(`${wing.name}_punho`, wing.name, wrist);
    const mcol = new THREE.Color(wing.color);
    mb.segment(shoulder, wrist, wing.armR, wing.armR * 0.7, wb, limbColor, 6);
    mb.segment(wrist, tip, wing.armR * 0.7, wing.armR * 0.25, wr, limbColor, 5);
    mb.membrane(
      [shoulder, wrist, tip, mid, root],
      [[wb, wb], [wr, wr], [wr, wr], [wb, wr], [wb, wb]],
      [0, 0, 0, 0.6, 0],
      mcol,
    );
  }

  // --- Detalhes: olhos, crista, cúpula, bico, dentes, placas ---
  for (const e of spec.extras ?? []) {
    const bone = mb.b(e.bone);
    const col = new THREE.Color(e.color);
    if (e.type === 'ellipsoid') mb.ellipsoid(V(e.p), e.r, bone, col, e.seg ?? [10, 8]);
    else if (e.type === 'cone') mb.cone(V(e.base), V(e.tip), e.r, bone, col);
    else if (e.type === 'tube') {
      mb.tube(e.points.map((p, i) => ({ p: V(p), r: e.radii[i], bone: e.bone })), () => col.clone(), 8, 10);
    }
  }

  return { geometry: mb.build(), bones: mb.bones };
}

// Cria uma criatura nova (ossos próprios, malha compartilhada).
export function createSkinnedMesh(model, material) {
  const bones = model.bones.map((def) => {
    const b = new THREE.Bone();
    b.name = def.name;
    return b;
  });
  const byName = {};
  model.bones.forEach((def, i) => {
    const b = bones[i];
    byName[def.name] = b;
    if (def.parent) {
      const parentIdx = model.bones.findIndex((d) => d.name === def.parent);
      b.position.copy(def.pos).sub(model.bones[parentIdx].pos);
      bones[parentIdx].add(b);
    } else {
      b.position.copy(def.pos);
    }
  });
  const mesh = new THREE.SkinnedMesh(model.geometry, material);
  const root = bones[model.bones.findIndex((d) => !d.parent)];
  mesh.add(root);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  // Guarda a pose de descanso para as animações partirem dela.
  for (const b of bones) b.userData.rest = b.position.clone();
  return { mesh, bones: byName };
}
