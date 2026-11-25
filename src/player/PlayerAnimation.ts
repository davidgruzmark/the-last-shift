import type { KfirRig } from '../assets/characters/KfirModel';
import type { PlayerAnimState } from '../core/EventBus';

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/**
 * Procedural animation state machine for Kfir's Stylized Low-Poly rig.
 * Uses exponential damping for smooth transitions across idle, walk, run, and jump.
 */
export class PlayerAnimation {
  private cycleTime = 0;
  private readonly rig: KfirRig;

  constructor(rig: KfirRig) {
    this.rig = rig;
  }

  update(dt: number, state: PlayerAnimState, horizontalSpeed: number): void {
    const blend = 14;

    if (state === 'idle') {
      this.cycleTime += dt * 2.2;
      const breath = Math.sin(this.cycleTime) * 0.015;

      this.rig.hips.position.y = damp(this.rig.hips.position.y, 0.78 + breath, blend, dt);
      this.rig.torso.rotation.x = damp(this.rig.torso.rotation.x, 0, blend, dt);
      this.rig.headGroup.rotation.x = damp(this.rig.headGroup.rotation.x, Math.sin(this.cycleTime * 0.5) * 0.03, blend, dt);

      this.rig.leftLeg.rotation.x = damp(this.rig.leftLeg.rotation.x, 0, blend, dt);
      this.rig.rightLeg.rotation.x = damp(this.rig.rightLeg.rotation.x, 0, blend, dt);
      this.rig.leftArm.rotation.x = damp(this.rig.leftArm.rotation.x, 0.05 + breath * 1.5, blend, dt);
      this.rig.rightArm.rotation.x = damp(this.rig.rightArm.rotation.x, -0.05 - breath * 1.5, blend, dt);
      this.rig.leftArm.rotation.z = damp(this.rig.leftArm.rotation.z, 0.07, blend, dt);
      this.rig.rightArm.rotation.z = damp(this.rig.rightArm.rotation.z, -0.07, blend, dt);
      return;
    }

    if (state === 'jump') {
      this.rig.hips.position.y = damp(this.rig.hips.position.y, 0.84, blend, dt);
      this.rig.torso.rotation.x = damp(this.rig.torso.rotation.x, 0.08, blend, dt);
      this.rig.headGroup.rotation.x = damp(this.rig.headGroup.rotation.x, -0.06, blend, dt);

      this.rig.leftLeg.rotation.x = damp(this.rig.leftLeg.rotation.x, -0.45, blend, dt);
      this.rig.rightLeg.rotation.x = damp(this.rig.rightLeg.rotation.x, 0.35, blend, dt);
      this.rig.leftArm.rotation.x = damp(this.rig.leftArm.rotation.x, -0.85, blend, dt);
      this.rig.rightArm.rotation.x = damp(this.rig.rightArm.rotation.x, -0.65, blend, dt);
      this.rig.leftArm.rotation.z = damp(this.rig.leftArm.rotation.z, 0.28, blend, dt);
      this.rig.rightArm.rotation.z = damp(this.rig.rightArm.rotation.z, -0.28, blend, dt);
      return;
    }

    // Walk / Run cycle scaled smoothly by movement speed
    const isRun = state === 'run';
    const freq = isRun ? 11.5 : 7.5;
    this.cycleTime += dt * freq * Math.max(0.5, horizontalSpeed / (isRun ? 8 : 4.5));

    const swing = Math.sin(this.cycleTime);
    const bounce = Math.abs(Math.cos(this.cycleTime)) * (isRun ? 0.07 : 0.035);
    const legAmp = isRun ? 0.85 : 0.55;
    const armAmp = isRun ? 0.75 : 0.42;
    const forwardLean = isRun ? 0.16 : 0.05;

    this.rig.hips.position.y = damp(this.rig.hips.position.y, 0.78 + bounce, 18, dt);
    this.rig.torso.rotation.x = damp(this.rig.torso.rotation.x, forwardLean, blend, dt);
    this.rig.headGroup.rotation.x = damp(this.rig.headGroup.rotation.x, -forwardLean * 0.5, blend, dt);

    this.rig.leftLeg.rotation.x = damp(this.rig.leftLeg.rotation.x, swing * legAmp, 20, dt);
    this.rig.rightLeg.rotation.x = damp(this.rig.rightLeg.rotation.x, -swing * legAmp, 20, dt);

    this.rig.leftArm.rotation.x = damp(this.rig.leftArm.rotation.x, -swing * armAmp, 20, dt);
    this.rig.rightArm.rotation.x = damp(this.rig.rightArm.rotation.x, swing * armAmp, 20, dt);
    this.rig.leftArm.rotation.z = damp(this.rig.leftArm.rotation.z, isRun ? 0.16 : 0.08, blend, dt);
    this.rig.rightArm.rotation.z = damp(this.rig.rightArm.rotation.z, isRun ? -0.16 : -0.08, blend, dt);
  }
}
