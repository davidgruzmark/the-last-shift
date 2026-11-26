import * as THREE from 'three';
import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';
import type { Interactable } from './Interactable';

export interface CameraFeedInfo {
  id: string;
  name: string;
  label: string;
  location: string;
  status: string;
  accent: string;
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
}

export const SECURITY_CAMERA_FEEDS: readonly CameraFeedInfo[] = [
  {
    id: 'CAM 01',
    name: 'IKEA Showroom',
    label: 'CAM 01 — IKEA SHOWROOM',
    location: 'Living, Bedroom & Restaurant Displays',
    status: 'NORMAL · SHOWROOM FLOOR CLEAR',
    accent: '#1E90FF',
    position: new THREE.Vector3(18.5, 4.4, 12.2),
    lookAt: new THREE.Vector3(13.0, 1.0, -4.0),
  },
  {
    id: 'CAM 02',
    name: 'Parking Lot',
    label: 'CAM 02 — PARKING LOT',
    location: 'IKEA Exterior Facade & Customer Lot',
    status: 'NORMAL · 6 VEHICLES PARKED',
    accent: '#FFDA1A',
    position: new THREE.Vector3(36.0, 6.2, 46.5),
    lookAt: new THREE.Vector3(20.0, 2.5, 25.0),
  },
  {
    id: 'CAM 03',
    name: 'Main Entrance',
    label: 'CAM 03 — MAIN ENTRANCE',
    location: 'Checkout Lanes & Sliding Glass Doors',
    status: 'NORMAL · ENTRANCE SENSORS ACTIVE',
    accent: '#2ECC71',
    position: new THREE.Vector3(13.5, 4.4, 15.2),
    lookAt: new THREE.Vector3(21.0, 1.4, 24.5),
  },
  {
    id: 'CAM 04',
    name: 'Warehouse',
    label: 'CAM 04 — WAREHOUSE',
    location: 'Self-Serve Aisles 01–03 & Forklifts',
    status: 'ALERT · MOTION DETECTED IN AISLE 02',
    accent: '#FF5A5F',
    position: new THREE.Vector3(16.5, 5.6, -15.2),
    lookAt: new THREE.Vector3(22.0, 1.5, -28.0),
  },
] as const;

/**
 * Interactive security workstation computer in the Control Room.
 */
export class ComputerInteraction implements Interactable {
  readonly id = 'control-room-computer';
  readonly type = 'computer' as const;
  readonly radius = 2.8;

  private readonly worldPos: THREE.Vector3;
  private readonly eventBus?: EventBus<GameEvents>;
  private open = false;
  private activeCam = 0;

  constructor(worldPos: THREE.Vector3, eventBus?: EventBus<GameEvents>) {
    this.worldPos = worldPos.clone();
    this.eventBus = eventBus;
  }

  getWorldPosition(): THREE.Vector3 {
    return this.worldPos;
  }

  isOpen(): boolean {
    return this.open;
  }

  getActiveCamera(): number {
    return this.activeCam;
  }

  canInteract(): boolean {
    return !this.open;
  }

  getPromptText(): string {
    return i18n.t('prompt.computer');
  }

  onInteract(): void {
    this.open = true;
    this.emitState();
  }

  selectCamera(index: number): void {
    if (index < 0 || index >= SECURITY_CAMERA_FEEDS.length) return;
    this.activeCam = index;
    this.emitState();
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.emitState();
  }

  private emitState(): void {
    this.eventBus?.emit('computer:changed', {
      open: this.open,
      activeCam: this.activeCam,
    });
  }
}
