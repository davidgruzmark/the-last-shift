import * as THREE from 'three';
import type { WorldZoneId } from '../config/constants';
import type { GraphicsQuality } from '../config/graphicsPresets';
import type { PlayerAnimState } from '../core/EventBus';

export type ActiveOverlay =
  | 'none'
  | 'dialogue'
  | 'computer'
  | 'phone'
  | 'collection'
  | 'settings'
  | 'mission_complete';

export interface GameState {
  graphicsQuality: GraphicsQuality;
  debugVisible: boolean;
  isPointerLocked: boolean;
  fps: number;
  currentZone: WorldZoneId;
  playerPosition: THREE.Vector3;
  playerVelocity: THREE.Vector3;
  playerAnimState: PlayerAnimState;
  playerGrounded: boolean;
  cameraDistance: number;
  collectedItems: string[];
  totalCollectibles: number;
  activePrompt: string | null;
  activeOverlay: ActiveOverlay;
  unreadMessages: number;
  money: number;
  activeMissionTitle: string | null;
  activeObjectiveTitle: string | null;
  completedMissions: string[];
  hasControlRoomKey: boolean;
  perfumesCollected: number;
  perfumesTotal: number;
  watchesCollected: number;
  watchesTotal: number;
  slowMoUnlocked: boolean;
  slowMoActive: boolean;
  slowMoRemaining: number;
  slowMoCooldown: number;
  inVehicle: boolean;
  vehicleSpeedKmh: number;
  vehicleGear: 'P' | 'D' | 'R';
  vehicleHeadlights: boolean;
  vehicleHandbrake: boolean;
}

export function createInitialGameState(): GameState {
  return {
    graphicsQuality: 'medium',
    debugVisible: false,
    isPointerLocked: false,
    fps: 60,
    currentZone: 'Control Room',
    playerPosition: new THREE.Vector3(),
    playerVelocity: new THREE.Vector3(),
    playerAnimState: 'idle',
    playerGrounded: true,
    cameraDistance: 4.2,
    collectedItems: [],
    totalCollectibles: 0,
    activePrompt: null,
    activeOverlay: 'none',
    unreadMessages: 0,
    money: 0,
    activeMissionTitle: null,
    activeObjectiveTitle: null,
    completedMissions: [],
    hasControlRoomKey: true,
    perfumesCollected: 0,
    perfumesTotal: 5,
    watchesCollected: 0,
    watchesTotal: 4,
    slowMoUnlocked: false,
    slowMoActive: false,
    slowMoRemaining: 0,
    slowMoCooldown: 0,
    inVehicle: false,
    vehicleSpeedKmh: 0,
    vehicleGear: 'P',
    vehicleHeadlights: true,
    vehicleHandbrake: false,
  };
}
