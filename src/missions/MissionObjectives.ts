import type * as THREE from 'three';
import type { DialogueLine } from '../npcs/DialogueManager';
import type { FloorId } from '../world/CollisionManager';

export type ObjectiveType =
  | 'reach_location'
  | 'interact'
  | 'talk_npc'
  | 'collect'
  | 'inspect_camera'
  | 'activate_switch'
  | 'complete_minigame';

export type DynamicTargetKey = 'm2_cart' | 'm2_clipboard' | 'm4_forklift' | 'm6_ball';

export interface InvestigationState {
  spokeTo: ReadonlySet<string>;
  hasSpokenTo: (npcId: string) => boolean;
}

export interface MissionObjectiveDef {
  id: string;
  type: ObjectiveType;
  title: string;
  titleKey?: string;
  optional?: boolean;
  hideMarker?: boolean;
  requiredCount?: number;
  dynamicTargetKey?: DynamicTargetKey;
  chaseDistance?: number;
  minTravelDistance?: number;
  minPlayerZ?: number;
  maxPlayerZ?: number;
  targetPos?: THREE.Vector3;
  floor?: FloorId;
  radius?: number;
  targetId?: string;
  targetIds?: readonly string[];
  targetCamIndex?: number;
  targetNpcPositions?: Record<string, THREE.Vector3>;
  npcDialogues?: Record<string, DialogueLine[]>;
  npcDialogueResolver?: Record<string, (state: InvestigationState) => DialogueLine[]>;
  onStartEvent?: string;
  onCompleteEvent?: string;
  completionDialogue?: { speaker: string; speakerKey?: string; lines: DialogueLine[] };
}

export interface MissionReward {
  money: number;
  itemId?: string;
  itemName?: string;
  itemNameKey?: string;
}

export interface MissionDefinition {
  id: string;
  number: number;
  title: string;
  titleKey?: string;
  description: string;
  descriptionKey?: string;
  openingDialogue?: { title: string; titleKey?: string; lines: DialogueLine[] };
  openingPhoneMessage?: { sender: string; senderKey?: string; text: string; textKey?: string };
  objectives: MissionObjectiveDef[];
  reward: MissionReward;
  completionMessage: string;
  completionMessageKey?: string;
}
