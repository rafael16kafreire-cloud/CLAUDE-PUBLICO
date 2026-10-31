// =============================================================
// TERRENO – transforma a grade de alturas em malhas 3D.
// A ilha é dividida em "pedaços" (chunks): o celular só desenha
// os pedaços que estão na frente da câmera e dentro da distância
// de visão. Low-poly: faces planas e uma cor da paleta por face (materials.js).
// =============================================================
import * as THREE from 'three';
import { makeTerrainMaterial } from './materials.js';

// Os pedaços NÃO são montados todos de uma vez: updateTerrain() monta os que estão
// perto do jogador e descarta (libera a memória) os que ficaram longe. Ao andar,
// a ilha vai sendo "carregada" à frente.
export function buildTerrain(map, chunkCells) {
  const group = new THREE.Group();
  group.name = 'Terreno';

  const material = makeTerrainMaterial();

  const perSide = Math.ceil(map.cells / chunkCells);
  const chunks = [];
  const lado = chunkCells * map.cell;
  for (let cz = 0; cz < perSide; cz++) {
    for (let cx = 0; cx < perSide; cx++) {
      const x0 = cx * lado - map.half;
      const z0 = cz * lado - map.half;
      chunks.push({ cx, cz, x0, z0, x1: x0 + lado, z1: z0 + lado, mesh: null });
    }
  }

  return { group, material, chunks, chunkCells, map, last: { x: 1e9, z: 1e9, t: 0 }, loaded: 0 };
}

// >>> CHUNKS DO TERRENO: raio = até onde monta (metros); FOLGA = quanto além disso
//     ainda segura antes de descartar (evita montar/descartar o mesmo pedaço indo e voltando).
const FOLGA = 200;
const PERTO = 180; // pedaços a menos disso são montados na hora (sem buraco ao renascer/teleportar)

/** Monta os pedaços perto de (x, z) e descarta os longe. porQuadro = quantos monta de cada vez (além dos de perto). */
export function updateTerrain(T, x, z, raio, dt = 0.016, porQuadro = 3) {
  T.last.t -= dt;
  const andou = Math.hypot(x - T.last.x, z - T.last.z);
  if (andou < 12 && T.last.t > 0 && !T.pendente) return;
  T.last.x = x;
  T.last.z = z;
  T.last.t = 0.4;
  let feitos = 0;
  T.pendente = false;
  for (const c of T.chunks) {
    // distância do jogador até o retângulo do pedaço
    const dx = Math.max(c.x0 - x, 0, x - c.x1);
    const dz = Math.max(c.z0 - z, 0, z - c.z1);
    const d = Math.hypot(dx, dz);
    if (!c.mesh && d < raio) {
      if (d > PERTO && feitos >= porQuadro) {
        T.pendente = true; // falta montar: continua no próximo quadro
        continue;
      }
      const geom = buildChunkGeometry(T.map, c.cx * T.chunkCells, c.cz * T.chunkCells, T.chunkCells);
      const mesh = new THREE.Mesh(geom, T.material);
      mesh.name = `terreno_${c.cx}_${c.cz}`;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      T.group.add(mesh);
      c.mesh = mesh;
      T.loaded++;
      feitos++;
    } else if (c.mesh && d > raio + FOLGA) {
      T.group.remove(c.mesh);
      c.mesh.geometry.dispose();
      c.mesh = null;
      T.loaded--;
    }
  }
}

function buildChunkGeometry(map, i0, j0, size) {
  const cellsX = Math.min(size, map.cells - i0);
  const cellsZ = Math.min(size, map.cells - j0);
  const vx = cellsX + 1;
  const vz = cellsZ + 1;
  const positions = new Float32Array(vx * vz * 3);
  const colors = new Float32Array(vx * vz * 3);
  const snow = new Float32Array(vx * vz); // quanto de neve (Lapônia)

  for (let j = 0; j < vz; j++) {
    for (let i = 0; i < vx; i++) {
      const gi = i0 + i;
      const gj = j0 + j;
      const src = gj * map.verts + gi;
      const dst = (j * vx + i) * 3;
      positions[dst] = gi * map.cell - map.half;
      positions[dst + 1] = map.heights[src];
      positions[dst + 2] = gj * map.cell - map.half;
      colors[dst] = map.colors[src * 3];
      colors[dst + 1] = map.colors[src * 3 + 1];
      colors[dst + 2] = map.colors[src * 3 + 2];
      snow[j * vx + i] = map.snow[src];
    }
  }

  // Dois triângulos por quadrado, com a MESMA diagonal usada em
  // IslandMap.heightAt (assim o jogador pisa exatamente no desenho).
  const index = new Uint16Array(cellsX * cellsZ * 6);
  let k = 0;
  for (let j = 0; j < cellsZ; j++) {
    for (let i = 0; i < cellsX; i++) {
      const a = j * vx + i;        // (0,0)
      const b = j * vx + i + 1;    // (1,0)
      const c = (j + 1) * vx + i;  // (0,1)
      const d = (j + 1) * vx + i + 1; // (1,1)
      index[k++] = a; index[k++] = c; index[k++] = b;
      index[k++] = c; index[k++] = d; index[k++] = b;
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geom.setAttribute('aSnow', new THREE.BufferAttribute(snow, 1));
  geom.setIndex(new THREE.BufferAttribute(index, 1));
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
  return geom;
}
