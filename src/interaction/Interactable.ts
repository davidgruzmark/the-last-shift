import type * as THREE from 'three';

export type InteractableType =
  | 'door'
  | 'npc'
  | 'collectible'
  | 'computer'
  | 'vehicle'
  | 'interact'
  | 'collect'
  | 'activate_switch';

export interface Interactable {
  readonly id: string;
  readonly type: InteractableType;
  readonly radius: number;
  readonly floor?: 1 | 2;
  readonly colliderIds?: readonly string[];
  getWorldPosition(): THREE.Vector3;
  getPromptText(): string;
  getPriority?(): number;
  canInteract(): boolean;
  onInteract(): void;
  setHighlighted?(active: boolean): void;
  update?(dt: number, playerPos: THREE.Vector3): void;
}
