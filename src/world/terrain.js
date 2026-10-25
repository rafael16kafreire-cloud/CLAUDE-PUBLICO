// =============================================================
// TERRENO – transforma a grade de alturas em malhas 3D.
// A ilha é dividida em "pedaços" (chunks): o celular só desenha
// os pedaços que estão na frente da câmera e dentro da distância
// de visão. Luz suave + textura de detalhe (materials.js).
// =============================================================
import * as THREE from 'three';
import { makeTerrainMaterial } from './materials.js';

export function buildTerrain(map, chunkCells) {
  const group = new THREE.Group();
  group.name = 'Terreno';

  const material = makeTerrainMaterial();

  const perSide = Math.ceil(map.cells / chunkCells);
  const chunks = [];

  for (let cz = 0; cz < perSide; cz++) {
    for (let cx = 0; cx < perSide; cx++) {
      const geom = buildChunkGeometry(map, cx * chunkCells, cz * chunkCells, chunkCells);
      const mesh = new THREE.Mesh(geom, material);
      mesh.name = `terreno_${cx}_${cz}`;
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      group.add(mesh);
      chunks.push(mesh);
    }
  }

  return { group, material, chunks };
}

// terra de verdade: floresta toda, igapó e pântano um pouco menos; praia e mar nada;
// -1 = rocha de montanha (Lapônia): textura de pedra no shader
// (índices = BIOME: mar, praia, floresta, igapó, pântano, neve)
const DIRT_BY_BIOME = [0, 0, 1, 0.8, 0.6, -1];

function buildChunkGeometry(map, i0, j0, size) {
  const cellsX = Math.min(size, map.cells - i0);
  const cellsZ = Math.min(size, map.cells - j0);
  const vx = cellsX + 1;
  const vz = cellsZ + 1;
  const positions = new Float32Array(vx * vz * 3);
  const colors = new Float32Array(vx * vz * 3);
  const dirt = new Float32Array(vx * vz); // quanto de textura de terra (por bioma)
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
      dirt[j * vx + i] = DIRT_BY_BIOME[map.biomes[src]] ?? 0;
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
  geom.setAttribute('aDirt', new THREE.BufferAttribute(dirt, 1));
  geom.setAttribute('aSnow', new THREE.BufferAttribute(snow, 1));
  geom.setIndex(new THREE.BufferAttribute(index, 1));
  geom.computeVertexNormals();
  geom.computeBoundingSphere();
  return geom;
}
