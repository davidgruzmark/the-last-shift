import * as THREE from 'three';
import type { KfirRig } from '../assets/characters/KfirModel';
import type { MaterialPalette } from '../assets/materials/Palette';
import { PLAYER_CONFIG } from '../config/constants';
import type { EventBus, GameEvents } from '../core/EventBus';
import type { InputState } from '../core/InputManager';
import { i18n } from '../i18n/LocalizationManager';
import type { InteractionManager } from '../interaction/InteractionManager';
import type { PlayerController } from '../player/PlayerController';
import type { CollisionManager } from '../world/CollisionManager';
import { VEHICLE_CONFIG, VehicleController, type VehicleInitOptions } from './VehicleController';

type TransitionMode = 'on_foot' | 'entering' | 'driving' | 'exiting';

const ENTER_DURATION = 0.24;
const EXIT_DURATION = 0.2;

/**
 * Coordinates entering, seated driving attachment, headlight toggles,
 * and collision-checked exiting across all drivable vehicles in the world.
 */
export class VehicleManager {
  private readonly vehicles: VehicleController[] = [];
  private readonly eventBus: EventBus<GameEvents>;
  private readonly collision: CollisionManager;
  private readonly interactions: InteractionManager;
  private readonly palette: MaterialPalette;
  private readonly kfirRig: KfirRig;
  private readonly playerController: PlayerController;

  private activeVehicle: VehicleController | null = null;
  private mode: TransitionMode = 'on_foot';
  private transitionTimer = 0;
  private readonly transitionStartPos = new THREE.Vector3();
  private readonly transitionEndPos = new THREE.Vector3();
  private statusToast: string | undefined;

  constructor(
    palette: MaterialPalette,
    collision: CollisionManager,
    interactions: InteractionManager,
    eventBus: EventBus<GameEvents>,
    kfirRig: KfirRig,
    playerController: PlayerController,
  ) {
    this.palette = palette;
    this.collision = collision;
    this.interactions = interactions;
    this.eventBus = eventBus;
    this.kfirRig = kfirRig;
    this.playerController = playerController;
  }

  spawnVehicle(options: VehicleInitOptions): VehicleController {
    const vehicle = new VehicleController(options, this.palette, this.collision);
    vehicle.onEnterRequested = (v) => this.enterVehicle(v);
    this.vehicles.push(vehicle);
    this.interactions.register(vehicle);
    return vehicle;
  }

  getVehicles(): readonly VehicleController[] {
    return this.vehicles;
  }

  getActiveVehicle(): VehicleController | null {
    return this.activeVehicle;
  }

  isInVehicle(): boolean {
    return this.mode !== 'on_foot';
  }

  isDriving(): boolean {
    return this.mode === 'driving';
  }

  enterVehicle(vehicle: VehicleController): boolean {
    if (this.mode !== 'on_foot' || vehicle.isOccupied()) return false;

    this.activeVehicle = vehicle;
    vehicle.setOccupied(true);
    this.mode = 'entering';
    this.transitionTimer = 0;
    this.transitionStartPos.copy(this.playerController.position);
    vehicle.getDriverSeatWorldPosition(this.transitionEndPos);

    this.playerController.velocity.set(0, 0, 0);
    this.interactions.clearActiveTarget();
    this.statusToast = undefined;
    this.emitState();
    return true;
  }

  tryExit(): boolean {
    if (!this.activeVehicle || this.mode !== 'driving') return false;

    if (Math.abs(this.activeVehicle.getSpeed()) > VEHICLE_CONFIG.maxExitSpeed) {
      this.statusToast = i18n.t('vehicle.toast.slowDown');
      this.emitState();
      return false;
    }

    const safePos = this.findSafeExitPosition(this.activeVehicle);
    if (!safePos) {
      this.statusToast = i18n.t('vehicle.toast.exitBlocked');
      this.emitState();
      return false;
    }

    this.statusToast = undefined;
    this.mode = 'exiting';
    this.transitionTimer = 0;
    this.activeVehicle.getDriverSeatWorldPosition(this.transitionStartPos);
    this.transitionEndPos.copy(safePos);
    this.emitState();
    return true;
  }

  toggleHeadlights(): boolean {
    if (!this.activeVehicle || this.mode !== 'driving') return false;
    const on = this.activeVehicle.toggleHeadlights();
    this.statusToast = on
      ? i18n.t('vehicle.toast.headlightsOn')
      : i18n.t('vehicle.toast.headlightsOff');
    this.emitState();
    return on;
  }

  updateDriving(dt: number, input: InputState, allowControl: boolean): void {
    for (const vehicle of this.vehicles) {
      const controlThis = allowControl && this.mode === 'driving' && vehicle === this.activeVehicle;
      vehicle.updatePhysics(dt, input, controlThis);
    }

    if (!this.activeVehicle) return;

    if (this.mode === 'entering') {
      this.transitionTimer += dt;
      const t = Math.min(1, this.transitionTimer / ENTER_DURATION);
      const seatPos = this.activeVehicle.getDriverSeatWorldPosition(this.transitionEndPos);
      this.kfirRig.root.position.lerpVectors(this.transitionStartPos, seatPos, t);
      this.kfirRig.root.rotation.y = this.activeVehicle.yaw;
      this.playerController.position.copy(this.kfirRig.root.position);
      this.applySeatedPose(t);

      if (t >= 1) {
        this.mode = 'driving';
        this.emitState();
      }
      return;
    }

    if (this.mode === 'driving') {
      const seatPos = this.activeVehicle.getDriverSeatWorldPosition();
      this.kfirRig.root.position.copy(seatPos);
      this.kfirRig.root.rotation.y = this.activeVehicle.yaw;
      this.playerController.position.copy(seatPos);
      this.applySeatedPose(1);
      this.emitState();
      return;
    }

    if (this.mode === 'exiting') {
      this.transitionTimer += dt;
      const t = Math.min(1, this.transitionTimer / EXIT_DURATION);
      this.kfirRig.root.position.lerpVectors(this.transitionStartPos, this.transitionEndPos, t);
      this.applySeatedPose(1 - t);

      if (t >= 1) {
        this.finishExit();
      }
    }
  }

  updateIdle(dt: number): void {
    const zeroInput: InputState = {
      moveX: 0,
      moveZ: 0,
      sprint: false,
      jumpPressed: false,
      handbrake: false,
      lookDeltaX: 0,
      lookDeltaY: 0,
    };
    for (const vehicle of this.vehicles) {
      vehicle.updatePhysics(dt, zeroInput, false);
    }
  }

  private findSafeExitPosition(vehicle: VehicleController): THREE.Vector3 | null {
    // Check driver side first, then passenger side, front/rear sides, and finally rear/front bumper
    const localCandidates: Array<[number, number, number]> = [
      [1.75, 0, 0.05],
      [-1.75, 0, 0.05],
      [1.75, 0, 1.15],
      [1.75, 0, -1.15],
      [-1.75, 0, 1.15],
      [-1.75, 0, -1.15],
      [0, 0, -2.85],
      [0, 0, 2.85],
    ];

    for (const [lx, ly, lz] of localCandidates) {
      const worldPos = vehicle.localToWorld(lx, ly, lz);
      if (this.collision.isPositionClear(worldPos, PLAYER_CONFIG.radius, PLAYER_CONFIG.height)) {
        return worldPos;
      }
    }
    return null;
  }

  private finishExit(): void {
    if (!this.activeVehicle) return;
    this.resetKfirPose();
    this.playerController.position.copy(this.transitionEndPos);
    this.playerController.velocity.set(0, 0, 0);
    this.playerController.facingYaw = this.activeVehicle.yaw;
    this.kfirRig.root.position.copy(this.transitionEndPos);

    this.activeVehicle.setOccupied(false);
    this.activeVehicle = null;
    this.mode = 'on_foot';
    this.statusToast = undefined;
    this.emitState();
  }

  private applySeatedPose(amount: number): void {
    this.kfirRig.hips.position.y = -0.22 * amount;
    this.kfirRig.leftLeg.rotation.x = -1.15 * amount;
    this.kfirRig.rightLeg.rotation.x = -1.15 * amount;
    this.kfirRig.leftArm.rotation.x = -0.78 * amount;
    this.kfirRig.rightArm.rotation.x = -0.78 * amount;
    this.kfirRig.leftArm.rotation.z = -0.18 * amount;
    this.kfirRig.rightArm.rotation.z = 0.18 * amount;
  }

  private resetKfirPose(): void {
    this.kfirRig.hips.position.y = 0;
    this.kfirRig.leftLeg.rotation.x = 0;
    this.kfirRig.rightLeg.rotation.x = 0;
    this.kfirRig.leftArm.rotation.x = 0;
    this.kfirRig.rightArm.rotation.x = 0;
    this.kfirRig.leftArm.rotation.z = 0;
    this.kfirRig.rightArm.rotation.z = 0;
  }

  private emitState(): void {
    const v = this.activeVehicle;
    this.eventBus.emit('vehicle:stateChanged', {
      inVehicle: this.mode !== 'on_foot',
      vehicleName: v?.name ?? null,
      speedKmh: v?.getSpeedKmh() ?? 0,
      gear: v?.getGear() ?? 'P',
      handbrake: v?.isHandbrakeActive() ?? false,
      headlights: v?.isHeadlightsOn() ?? true,
      statusToast: this.statusToast,
    });
    if (this.statusToast) {
      this.statusToast = undefined;
    }
  }
}
