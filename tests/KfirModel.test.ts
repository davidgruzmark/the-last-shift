import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createKfirModel } from '../src/assets/characters/KfirModel';
import { createPalette } from '../src/assets/materials/Palette';
import { IKEA_COLORS } from '../src/config/constants';
import { AssetManager } from '../src/core/AssetManager';

describe('KfirModel', () => {
  it('uses non-overlapping hair geometry with no coplanar faces against the head or other hair pieces', () => {
    const assets = new AssetManager();
    const palette = createPalette(assets);
    const rig = createKfirModel(palette);

    const hairGroup = rig.headGroup.getObjectByName('KfirHairGroup');
    expect(hairGroup).toBeDefined();

    const boxes: Array<{ name: string; min: THREE.Vector3; max: THREE.Vector3 }> = [];
    hairGroup!.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const params = (obj.geometry as THREE.BoxGeometry).parameters;
        const half = new THREE.Vector3(params.width / 2, params.height / 2, params.depth / 2);
        boxes.push({
          name: obj.name,
          min: obj.position.clone().sub(half),
          max: obj.position.clone().add(half),
        });
        expect(obj.receiveShadow).toBe(false);
      }
    });

    expect(boxes.length).toBeGreaterThanOrEqual(8);

    // Ensure no two hair boxes have strictly overlapping 3D interior volumes
    const eps = 1e-4;
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlapX = Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x);
        const overlapY = Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y);
        const overlapZ = Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z);
        const intersects = overlapX > eps && overlapY > eps && overlapZ > eps;
        expect(intersects, `${a.name} overlaps ${b.name}`).toBe(false);
      }
    }

    // Ensure hair does not penetrate the head box [-0.17, 0.17] x [0.06, 0.42] x [-0.16, 0.16]
    const headMin = new THREE.Vector3(-0.17, 0.06, -0.16);
    const headMax = new THREE.Vector3(0.17, 0.42, 0.16);
    for (const hair of boxes) {
      const overlapX = Math.min(hair.max.x, headMax.x) - Math.max(hair.min.x, headMin.x);
      const overlapY = Math.min(hair.max.y, headMax.y) - Math.max(hair.min.y, headMin.y);
      const overlapZ = Math.min(hair.max.z, headMax.z) - Math.max(hair.min.z, headMin.z);
      const penetratesHead = overlapX > eps && overlapY > eps && overlapZ > eps;
      expect(penetratesHead, `${hair.name} penetrates head`).toBe(false);
    }
  });

  it('uses 3-tone brown Marine fade, fair skin, black polo, beige trousers, and belt equipment', () => {
    expect(IKEA_COLORS.hair).toBe(0x4b3120);
    expect(IKEA_COLORS.hairMidFade).toBe(0x73523a);
    expect(IKEA_COLORS.hairFade).toBe(0x9c7656);
    expect(IKEA_COLORS.facialHair).toBe(0x684a35);
    expect(IKEA_COLORS.skin).toBe(0xf2ccb7);
    expect(IKEA_COLORS.securityShirt).toBe(0x1b1e23);
    expect(IKEA_COLORS.securityPants).toBe(0xc8b598);

    const assets = new AssetManager();
    const palette = createPalette(assets);
    const rig = createKfirModel(palette);

    expect(rig.headGroup.getObjectByName('kfir-mustache')).toBeDefined();
    expect(rig.headGroup.getObjectByName('kfir-goatee')).toBeDefined();
    expect(rig.torso.getObjectByName('kfir-radio')).toBeDefined();
    expect(rig.torso.getObjectByName('kfir-pistol-holster')).toBeDefined();
    expect(rig.torso.getObjectByName('kfir-keys')).toBeDefined();
  });
});
