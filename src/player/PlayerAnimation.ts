import type { KfirRig } from '../assets/characters/KfirModel';
import type { PlayerAnimState } from '../core/EventBus';

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

interface GaitConfig {
  strideLength: number;
  legAmp: number;
  armAmp: number;
  armOutward: number;
  forwardLean: number;
  bounce: number;
}

const GAIT_CONFIGS: Record<'walk' | 'run' | 'sprint', GaitConfig> = {
  walk: {
    strideLength: 1.05,
    legAmp: 0.6,
    armAmp: 0.45,
    armOutward: 0.11,
    forwardLean: 0.05,
    bounce: 0.038,
  },
  run: {
    strideLength: 1.32,
    legAmp: 0.84,
    armAmp: 0.72,
    armOutward: 0.16,
    forwardLean: 0.14,
    bounce: 0.065,
  },
  sprint: {
    strideLength: 1.52,
    legAmp: 1.02,
    armAmp: 0.9,
    armOutward: 0.2,
    forwardLean: 0.22,
    bounce: 0.085,
  },
};

/**
 * Procedural animation state machine for Kfir's Stylized Low-Poly rig.
 * Locks stride phase to actual ground speed to eliminate foot sliding.
 */
export class PlayerAnimation {
  private cycleTime = 0;
  private keyTurnRemaining = 0;
  private keyTurnDuration = 0.85;
  private readonly rig: KfirRig;

  constructor(rig: KfirRig) {
    this.rig = rig;
  }

  playKeyTurnAnimation(durationSec = 0.85): void {
    this.keyTurnDuration = Math.max(0.25, durationSec);
    this.keyTurnRemaining = this.keyTurnDuration;
  }

  isPlayingKeyTurn(): boolean {
    return this.keyTurnRemaining > 0;
  }

  update(dt: number, state: PlayerAnimState, horizontalSpeed: number): void {
    const blend = 16;

    if (this.keyTurnRemaining > 0) {
      this.keyTurnRemaining = Math.max(0, this.keyTurnRemaining - dt);
      const p = 1 - this.keyTurnRemaining / this.keyTurnDuration;
      // Raise right arm to lock height and twist wrist to turn key cleanly
      const reach = Math.sin(Math.min(1, p / 0.25) * (Math.PI / 2));
      const twist = p > 0.28 && p < 0.82 ? Math.sin(((p - 0.28) / 0.54) * Math.PI) : 0;
      this.rig.hips.position.y = damp(this.rig.hips.position.y, 0.78, blend, dt);
      this.rig.torso.rotation.x = damp(this.rig.torso.rotation.x, 0.06 * reach, blend, dt);
      this.rig.rightArm.rotation.x = damp(this.rig.rightArm.rotation.x, -1.25 * reach, 24, dt);
      this.rig.rightArm.rotation.z = damp(this.rig.rightArm.rotation.z, -0.15 - twist * 0.65, 24, dt);
      this.rig.leftArm.rotation.x = damp(this.rig.leftArm.rotation.x, 0.08, blend, dt);
      this.rig.leftArm.rotation.z = damp(this.rig.leftArm.rotation.z, 0.12, blend, dt);
      this.rig.leftLeg.rotation.x = damp(this.rig.leftLeg.rotation.x, 0, blend, dt);
      this.rig.rightLeg.rotation.x = damp(this.rig.rightLeg.rotation.x, 0, blend, dt);
      return;
    }

    if (state === 'idle') {
      this.cycleTime += dt * 2.2;
      const breath = Math.sin(this.cycleTime) * 0.014;

      this.rig.hips.position.y = damp(this.rig.hips.position.y, 0.78 + breath, blend, dt);
      this.rig.torso.rotation.x = damp(this.rig.torso.rotation.x, 0, blend, dt);
      this.rig.headGroup.rotation.x = damp(
        this.rig.headGroup.rotation.x,
        Math.sin(this.cycleTime * 0.5) * 0.03,
        blend,
        dt,
      );

      this.rig.leftLeg.rotation.x = damp(this.rig.leftLeg.rotation.x, 0, blend, dt);
      this.rig.rightLeg.rotation.x = damp(this.rig.rightLeg.rotation.x, 0, blend, dt);
      this.rig.leftArm.rotation.x = damp(this.rig.leftArm.rotation.x, 0.04 + breath * 1.4, blend, dt);
      this.rig.rightArm.rotation.x = damp(
        this.rig.rightArm.rotation.x,
        -0.04 - breath * 1.4,
        blend,
        dt,
      );
      this.rig.leftArm.rotation.z = damp(this.rig.leftArm.rotation.z, 0.11, blend, dt);
      this.rig.rightArm.rotation.z = damp(this.rig.rightArm.rotation.z, -0.11, blend, dt);
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

    // Distance-locked stride cycle: advances exactly with resolved ground travel
    const gait = GAIT_CONFIGS[state];
    this.cycleTime += (horizontalSpeed * dt * Math.PI) / gait.strideLength;

    const swing = Math.sin(this.cycleTime);
    const bounce = Math.abs(Math.cos(this.cycleTime)) * gait.bounce;

    this.rig.hips.position.y = damp(this.rig.hips.position.y, 0.78 + bounce, 20, dt);
    this.rig.torso.rotation.x = damp(this.rig.torso.rotation.x, gait.forwardLean, blend, dt);
    this.rig.headGroup.rotation.x = damp(
      this.rig.headGroup.rotation.x,
      -gait.forwardLean * 0.5,
      blend,
      dt,
    );

    this.rig.leftLeg.rotation.x = damp(this.rig.leftLeg.rotation.x, swing * gait.legAmp, 24, dt);
    this.rig.rightLeg.rotation.x = damp(this.rig.rightLeg.rotation.x, -swing * gait.legAmp, 24, dt);

    this.rig.leftArm.rotation.x = damp(this.rig.leftArm.rotation.x, -swing * gait.armAmp, 24, dt);
    this.rig.rightArm.rotation.x = damp(this.rig.rightArm.rotation.x, swing * gait.armAmp, 24, dt);
    this.rig.leftArm.rotation.z = damp(this.rig.leftArm.rotation.z, gait.armOutward, blend, dt);
    this.rig.rightArm.rotation.z = damp(this.rig.rightArm.rotation.z, -gait.armOutward, blend, dt);
  }
}
