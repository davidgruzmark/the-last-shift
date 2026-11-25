import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CollisionManager } from '../src/world/CollisionManager';

describe('CollisionManager', () => {
  it('blocks player from walking through a solid wall and allows sliding along the free axis', () => {
    const cm = new CollisionManager();
    // Floor at y <= 0
    cm.addBox('floor', new THREE.Vector3(-10, -1, -10), new THREE.Vector3(10, 0, 10));
    // North wall at z <= -2
    cm.addBox('north-wall', new THREE.Vector3(-10, 0, -2.5), new THREE.Vector3(10, 4, -2));

    const pos = new THREE.Vector3(0, 0, -1.5);
    const delta = new THREE.Vector3(0.4, 0, -1.0); // Moving diagonally into north wall
    const res = cm.resolvePlayerMovement(pos, delta, 0.38, 1.75);

    expect(res.hitWall).toBe(true);
    // Should slide along X freely
    expect(res.position.x).toBeCloseTo(0.4, 4);
    // Should stop at wall boundary (-2 + 0.38)
    expect(res.position.z).toBeCloseTo(-1.62, 4);
    expect(res.grounded).toBe(true);
  });

  it('lands cleanly on floor and supports standing on a crate', () => {
    const cm = new CollisionManager();
    cm.addBox('floor', new THREE.Vector3(-10, -1, -10), new THREE.Vector3(10, 0, 10));
    cm.addBox('crate', new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 0.65, 1));

    // Falling onto crate from above
    const res = cm.resolvePlayerMovement(
      new THREE.Vector3(0, 0.7, 0),
      new THREE.Vector3(0, -0.2, 0),
      0.38,
      1.75,
    );

    expect(res.grounded).toBe(true);
    expect(res.position.y).toBeCloseTo(0.65, 4);
  });

  it('clamps camera raycast before a wall so camera never clips outside the room', () => {
    const cm = new CollisionManager();
    cm.addBox('south-wall', new THREE.Vector3(-10, 0, 6), new THREE.Vector3(10, 4, 6.3), true);

    const pivot = new THREE.Vector3(0, 1.45, 4.5);
    const idealCamera = new THREE.Vector3(0, 2.2, 8.7); // Behind south wall
    const clamped = cm.raycastCamera(pivot, idealCamera, 0.25, 0.8);

    expect(clamped.z).toBeLessThan(6.0);
    expect(clamped.z).toBeGreaterThan(4.5);
  });
});
