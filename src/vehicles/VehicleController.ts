import * as THREE from 'three';
import { createDrivableCarModel, type DrivableCarRig } from '../assets/vehicles/DrivableCarModel';
import type { MaterialPalette } from '../assets/materials/Palette';
import type { InputState } from '../core/InputManager';
import { i18n } from '../i18n/LocalizationManager';
import type { Interactable } from '../interaction/Interactable';
import type { CollisionManager } from '../world/CollisionManager';

export const VEHICLE_CONFIG = {
  maxForwardSpeed: 18.5,
  boostMaxSpeed: 23.0,
  maxReverseSpeed: 7.5,
  accelRate: 12.5,
  boostAccelRate: 17.5,
  brakeDecel: 24.0,
  handbrakeDecel: 28.0,
  coastFriction: 4.5,
  maxSteerAngle: 0.56,
  steerSpeed: 6.5,
  steerReturnSpeed: 8.5,
  wheelbase: 2.56,
  wheelRadius: 0.33,
  maxExitSpeed: 2.8,
} as const;

export interface VehicleInitOptions {
  id: string;
  name: string;
  position: THREE.Vector3;
  yaw: number;
  bodyMat: THREE.MeshStandardMaterial;
}

/**
 * Modular arcade drivable vehicle with speed-sensitive Ackermann steering,
 * wheel spin, headlight/brake-light feedback, CollisionManager integration,
 * and driver-door Interactable support.
 */
export class VehicleController implements Interactable {
  readonly id: string;
  readonly name: string;
  readonly type = 'vehicle' as const;
  readonly radius = 2.9;
  readonly colliderId: string;
  readonly colliderIds: readonly string[];
  readonly rig: DrivableCarRig;

  readonly position = new THREE.Vector3();
  yaw = 0;

  private speed = 0;
  private steerAngle = 0;
  private wheelSpinAngle = 0;
  private headlightsOn = true;
  private brakingActive = false;
  private handbrakeActive = false;
  private occupied = false;
  private highlighted = false;

  private readonly collision: CollisionManager;
  private readonly highlightRing: THREE.Mesh;
  private readonly doorWorldPos = new THREE.Vector3();

  constructor(
    options: VehicleInitOptions,
    palette: MaterialPalette,
    collision: CollisionManager,
  ) {
    this.id = options.id;
    this.name = options.name;
    this.colliderId = `vehicle-col-${options.id}`;
    this.colliderIds = [this.colliderId];
    this.collision = collision;

    this.position.copy(options.position);
    this.yaw = options.yaw;
    this.rig = createDrivableCarModel(palette, options.bodyMat);
    this.rig.root.position.copy(this.position);
    this.rig.root.rotation.y = this.yaw;

    // Visual highlight ring positioned at the driver-side door
    this.highlightRing = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.58, 20),
      new THREE.MeshBasicMaterial({
        color: 0xffda1a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      }),
    );
    this.highlightRing.rotation.x = -Math.PI / 2;
    this.highlightRing.position.set(1.22, 0.04, 0.05);
    this.highlightRing.visible = false;
    this.rig.root.add(this.highlightRing);

    this.collision.addOrientedBox(
      this.colliderId,
      new THREE.Vector3(this.position.x, this.rig.halfExtents.y, this.position.z),
      this.rig.halfExtents,
      this.yaw,
      false,
    );

    this.syncVisuals();
  }

  onEnterRequested?: (vehicle: VehicleController) => void;

  setOccupied(occupied: boolean): void {
    this.occupied = occupied;
    if (occupied) {
      this.setHighlighted(false);
    }
    this.syncLights();
  }

  isOccupied(): boolean {
    return this.occupied;
  }

  getSpeed(): number {
    return this.speed;
  }

  getSpeedKmh(): number {
    return Math.round(Math.abs(this.speed) * 3.6);
  }

  getGear(): 'P' | 'D' | 'R' {
    if (!this.occupied || (Math.abs(this.speed) < 0.15 && !this.handbrakeActive)) {
      return this.speed < -0.15 ? 'R' : this.speed > 0.15 ? 'D' : 'P';
    }
    if (this.speed < -0.15) return 'R';
    if (this.speed > 0.15) return 'D';
    return 'P';
  }

  isHeadlightsOn(): boolean {
    return this.headlightsOn;
  }

  isHandbrakeActive(): boolean {
    return this.handbrakeActive;
  }

  toggleHeadlights(): boolean {
    this.headlightsOn = !this.headlightsOn;
    this.syncLights();
    return this.headlightsOn;
  }

  getWorldPosition(): THREE.Vector3 {
    // Driver-side door handle in world coordinates (local +1.18 on driver X side)
    return this.localToWorld(1.18, 0, 0.05, this.doorWorldPos);
  }

  getDriverSeatWorldPosition(out = new THREE.Vector3()): THREE.Vector3 {
    return this.localToWorld(
      this.rig.driverSeatLocal.x,
      this.rig.driverSeatLocal.y,
      this.rig.driverSeatLocal.z,
      out,
    );
  }

  localToWorld(lx: number, ly: number, lz: number, out = new THREE.Vector3()): THREE.Vector3 {
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    return out.set(
      this.position.x + lx * cos + lz * sin,
      this.position.y + ly,
      this.position.z - lx * sin + lz * cos,
    );
  }

  getPromptText(): string {
    const localizedName =
      this.name.toLowerCase() === 'car' ? i18n.t('vehicle.name.car') : this.name;
    return i18n.t('prompt.enterVehicle', { name: localizedName.toUpperCase() });
  }

  canInteract(): boolean {
    return !this.occupied;
  }

  setHighlighted(active: boolean): void {
    this.highlighted = active;
    this.highlightRing.visible = active && !this.occupied;
    const mat = this.highlightRing.material as THREE.MeshBasicMaterial;
    mat.color.setHex(this.highlighted ? 0x2ecc71 : 0xffda1a);
  }

  onInteract(): void {
    if (!this.occupied) {
      this.onEnterRequested?.(this);
    }
  }

  /**
   * Advances vehicle physics for one fixed simulation step.
   * Accepts an idle input when unoccupied so any residual roll slows smoothly to rest.
   */
  updatePhysics(dt: number, input: InputState, allowControl: boolean): void {
    const throttle = allowControl ? input.moveZ : 0;
    const steerInput = allowControl ? -input.moveX : 0;
    const boosting = allowControl && input.sprint;
    this.handbrakeActive = allowControl && Boolean(input.handbrake);

    const speedAbs = Math.abs(this.speed);
    this.brakingActive = false;

    if (this.handbrakeActive) {
      this.brakingActive = true;
      const decel = VEHICLE_CONFIG.handbrakeDecel * dt;
      if (speedAbs <= decel) {
        this.speed = 0;
      } else {
        this.speed -= Math.sign(this.speed) * decel;
      }
    } else if (throttle > 0.05) {
      if (this.speed < -0.3) {
        this.brakingActive = true;
        this.speed = Math.min(0, this.speed + VEHICLE_CONFIG.brakeDecel * dt);
      } else {
        const targetMax = boosting ? VEHICLE_CONFIG.boostMaxSpeed : VEHICLE_CONFIG.maxForwardSpeed;
        const accel = boosting ? VEHICLE_CONFIG.boostAccelRate : VEHICLE_CONFIG.accelRate;
        this.speed = Math.min(targetMax, this.speed + accel * throttle * dt);
      }
    } else if (throttle < -0.05) {
      if (this.speed > 0.3) {
        this.brakingActive = true;
        this.speed = Math.max(0, this.speed - VEHICLE_CONFIG.brakeDecel * dt);
      } else {
        this.brakingActive = true;
        this.speed = Math.max(
          -VEHICLE_CONFIG.maxReverseSpeed,
          this.speed + VEHICLE_CONFIG.accelRate * 0.72 * throttle * dt,
        );
      }
    } else {
      const friction = VEHICLE_CONFIG.coastFriction * dt;
      if (speedAbs <= friction) {
        this.speed = 0;
      } else {
        this.speed -= Math.sign(this.speed) * friction;
      }
    }

    // Speed-sensitive steering angle smoothing
    const sensitivityScale = 1 / (1 + Math.abs(this.speed) * 0.045);
    const targetSteer = steerInput * VEHICLE_CONFIG.maxSteerAngle * sensitivityScale;
    const steerRate =
      Math.abs(steerInput) > 0.05 ? VEHICLE_CONFIG.steerSpeed : VEHICLE_CONFIG.steerReturnSpeed;
    const steerBlend = 1 - Math.exp(-steerRate * dt);
    this.steerAngle += (targetSteer - this.steerAngle) * steerBlend;

    // Only turn while rolling (bicycle/Ackermann kinematics prevents spinning in place)
    if (Math.abs(this.speed) > 0.08 && Math.abs(this.steerAngle) > 0.001) {
      const handbrakeFactor = this.handbrakeActive ? 1.25 : 1.0;
      const yawDelta =
        (this.speed / VEHICLE_CONFIG.wheelbase) * Math.tan(this.steerAngle) * dt * handbrakeFactor;
      this.yaw += yawDelta;
    }

    // Compute world XZ displacement along heading vector (+Z in local car frame)
    const fwdX = Math.sin(this.yaw);
    const fwdZ = Math.cos(this.yaw);
    const desiredDelta = new THREE.Vector3(fwdX * this.speed * dt, 0, fwdZ * this.speed * dt);

    const prevPos = this.position.clone();
    const result = this.collision.resolveVehicleMovement(
      this.position,
      desiredDelta,
      this.rig.halfExtents,
      this.yaw,
      [this.colliderId],
    );
    this.position.copy(result.position);

    if (result.hitWall) {
      // Remove inward speed component along wall normal so the vehicle slides cleanly without sticking
      const velX = fwdX * this.speed;
      const velZ = fwdZ * this.speed;
      const intoWall = velX * result.hitNormal.x + velZ * result.hitNormal.z;
      if (intoWall < 0) {
        const slideVelX = velX - intoWall * result.hitNormal.x;
        const slideVelZ = velZ - intoWall * result.hitNormal.z;
        const projected = slideVelX * fwdX + slideVelZ * fwdZ;
        this.speed = projected * 0.72;
      } else {
        this.speed *= 0.85;
      }
      if (Math.abs(this.speed) < 0.08) this.speed = 0;
    }

    // Spin wheels proportionally to actual resolved travel along forward heading
    const actualDx = this.position.x - prevPos.x;
    const actualDz = this.position.z - prevPos.z;
    const signedStep = actualDx * fwdX + actualDz * fwdZ;
    this.wheelSpinAngle += signedStep / VEHICLE_CONFIG.wheelRadius;

    this.collision.updateOrientedBox(
      this.colliderId,
      new THREE.Vector3(this.position.x, this.rig.halfExtents.y, this.position.z),
      this.rig.halfExtents,
      this.yaw,
    );

    this.syncVisuals();
  }

  private syncVisuals(): void {
    this.rig.root.position.copy(this.position);
    this.rig.root.rotation.y = this.yaw;

    this.rig.frontLeftSteerPivot.rotation.y = this.steerAngle;
    this.rig.frontRightSteerPivot.rotation.y = this.steerAngle;
    this.rig.steeringWheel.rotation.z = -this.steerAngle * 2.4;

    for (const wheel of this.rig.wheels) {
      wheel.rotation.x = this.wheelSpinAngle;
    }

    this.syncLights();
  }

  private syncLights(): void {
    this.rig.headlightBeams.visible = this.occupied && this.headlightsOn;
    this.rig.headlightMat.emissiveIntensity = this.headlightsOn ? (this.occupied ? 1.3 : 0.45) : 0.0;
    const brakeBright =
      this.brakingActive || this.handbrakeActive || (this.occupied && Math.abs(this.speed) < 0.2);
    this.rig.brakeLightMat.emissiveIntensity = brakeBright ? 1.6 : 0.22;
  }
}
