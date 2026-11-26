import * as THREE from 'three';
import type { CollectibleDefinition } from '../collectibles/CollectibleManager';
import type { MissionManager } from '../missions/MissionManager';
import type { NpcDefinition, NPCInteraction } from '../npcs/NPCInteraction';
import { WORLD_ANCHORS } from '../world/WorldAnchors';

export const EMPLOYEE_NPCS: NpcDefinition[] = [
  {
    id: 'employee-danny',
    name: 'Danny',
    nameKey: 'npc.Danny',
    position: WORLD_ANCHORS.showroom.danny.position.clone(),
    floor: WORLD_ANCHORS.showroom.danny.floor,
    facingYaw: WORLD_ANCHORS.showroom.danny.facingYaw ?? -Math.PI * 0.35,
    visual: { skinColor: 0xeac0a2, hairColor: 0x3b281c },
    lines: [
      { speaker: 'DANNY (SHOWROOM)', speakerKey: 'speaker.DANNY (SHOWROOM)', text: 'Hey Kfir, everything okay?', textKey: 'ambient.danny.1' },
      { speaker: 'KFIR', speakerKey: 'speaker.KFIR', text: 'Yeah, just doing my rounds.', textKey: 'ambient.danny.2' },
      {
        speaker: 'DANNY (SHOWROOM)',
        speakerKey: 'speaker.DANNY (SHOWROOM)',
        text: 'Keep an eye on the warehouse. Things are getting weird today.',
        textKey: 'ambient.danny.3',
      },
    ],
  },
  {
    id: 'employee-maya',
    name: 'Maya',
    nameKey: 'npc.Maya',
    position: WORLD_ANCHORS.showroom.maya.position.clone(),
    floor: WORLD_ANCHORS.showroom.maya.floor,
    facingYaw: WORLD_ANCHORS.showroom.maya.facingYaw ?? Math.PI * 0.75,
    visual: { skinColor: 0xf0c9b2, hairColor: 0x5c331c, variant: 'female', hairStyle: 'ponytail' },
    lines: [
      {
        speaker: 'MAYA (LIVING ROOM)',
        speakerKey: 'speaker.MAYA (LIVING ROOM)',
        text: 'Customers keep asking if the POÄNG chair comes pre-assembled.',
        textKey: 'ambient.maya.1',
      },
      { speaker: 'KFIR', speakerKey: 'speaker.KFIR', text: 'Tell them that is half the IKEA experience.', textKey: 'ambient.maya.2' },
      {
        speaker: 'MAYA (LIVING ROOM)',
        speakerKey: 'speaker.MAYA (LIVING ROOM)',
        text: 'True. By the way, someone left Swedish meatballs on every display table again!',
        textKey: 'ambient.maya.3',
      },
    ],
  },
  {
    id: 'employee-yossi',
    name: 'Yossi',
    nameKey: 'npc.Yossi',
    position: WORLD_ANCHORS.warehouse.yossi.position.clone(),
    floor: WORLD_ANCHORS.warehouse.yossi.floor,
    facingYaw: WORLD_ANCHORS.warehouse.yossi.facingYaw ?? 0.2,
    patrolPoints: [
      WORLD_ANCHORS.warehouse.yossi.position.clone(),
      new THREE.Vector3(18.6, 0, -26.8),
    ],
    patrolSpeed: 1.6,
    visual: { skinColor: 0xd9a886, hairColor: 0x241c18 },
    lines: [
      {
        speaker: 'YOSSI (WAREHOUSE)',
        speakerKey: 'speaker.YOSSI (WAREHOUSE)',
        text: 'Kfir! Good timing. Forklift #2 has been acting up all morning.',
        textKey: 'ambient.yossi.1',
      },
      {
        speaker: 'KFIR',
        speakerKey: 'speaker.KFIR',
        text: 'I saw something on CAM 04. Everything secure in the aisles?',
        textKey: 'ambient.yossi.2',
      },
      {
        speaker: 'YOSSI (WAREHOUSE)',
        speakerKey: 'speaker.YOSSI (WAREHOUSE)',
        text: 'For now, yeah. Let me know if you spot any stray KALLAX pallets blocking the exit.',
        textKey: 'ambient.yossi.3',
      },
    ],
  },
];

export const COLLECTIBLE_DEFS: CollectibleDefinition[] = [
  {
    id: 'keycard-spare',
    name: 'Spare Security Keycard',
    nameKey: 'item.keycard-spare',
    position: WORLD_ANCHORS.controlRoom.spareKeycard.position.clone(),
    floor: WORLD_ANCHORS.controlRoom.spareKeycard.floor,
    color: 0x1e90ff,
    kind: 'keycard',
  },
  {
    id: 'flashlight-led',
    name: 'Security LED Flashlight',
    nameKey: 'item.flashlight-led',
    position: WORLD_ANCHORS.showroom.flashlight.position.clone(),
    floor: WORLD_ANCHORS.showroom.flashlight.floor,
    color: 0x38bdf8,
    kind: 'battery',
  },
  {
    id: 'watch-classic',
    name: 'Classic Wristwatch',
    nameKey: 'item.watch-classic',
    position: WORLD_ANCHORS.restaurant.classicWatch.position.clone(),
    floor: WORLD_ANCHORS.restaurant.classicWatch.floor,
    color: 0xf4c430,
    kind: 'watch',
  },
  {
    id: 'radio-battery',
    name: 'Radio Battery Pack',
    nameKey: 'item.radio-battery',
    position: WORLD_ANCHORS.warehouse.radioBattery.position.clone(),
    floor: WORLD_ANCHORS.warehouse.radioBattery.floor,
    color: 0x2ecc71,
    kind: 'battery',
  },
];

/**
 * Registers mission- and world-state-aware ambient dialogue resolvers on IKEA NPCs
 * so casual conversations reflect resolved incidents (Forklift #2, Missing Watch, Perfume Heist).
 */
export function bindContextAwareNpcDialogues(
  npcs: readonly NPCInteraction[],
  missions: MissionManager,
): void {
  for (const npc of npcs) {
    if (npc.id === 'employee-yossi') {
      npc.setAmbientDialogueResolver(() => {
        if (missions.hasCompletedMission('mission-04')) {
          return [
            {
              speaker: 'YOSSI (WAREHOUSE)',
              speakerKey: 'speaker.YOSSI (WAREHOUSE)',
              text: 'Forklift #2 is finally shut down and tagged for maintenance—hitting that emergency stop saved our shelves, Kfir.',
              textKey: 'ambient.yossi.m4.1',
            },
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'Glad power cut in time. No more runaway rides in Aisle 01.',
              textKey: 'ambient.yossi.m4.2',
            },
            {
              speaker: 'YOSSI (WAREHOUSE)',
              speakerKey: 'speaker.YOSSI (WAREHOUSE)',
              text: 'Rest of the warehouse is clear. Holler if anything else rolls loose.',
              textKey: 'ambient.yossi.m4.3',
            },
          ];
        }
        if (missions.hasCompletedMission('mission-02')) {
          return [
            {
              speaker: 'YOSSI (WAREHOUSE)',
              speakerKey: 'speaker.YOSSI (WAREHOUSE)',
              text: 'Thanks for halting that runaway furniture cart earlier. Watch out though—Forklift #2 is still acting weird.',
              textKey: 'ambient.yossi.m2.1',
            },
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'I will keep an eye on the forklift aisles, Yossi.',
              textKey: 'ambient.yossi.m2.2',
            },
          ];
        }
        return [
          {
            speaker: 'YOSSI (WAREHOUSE)',
            speakerKey: 'speaker.YOSSI (WAREHOUSE)',
            text: 'Kfir! Good timing. Forklift #2 has been acting up all morning.',
            textKey: 'ambient.yossi.1',
          },
          {
            speaker: 'KFIR',
            speakerKey: 'speaker.KFIR',
            text: 'I saw something on CAM 04. Everything secure in the aisles?',
            textKey: 'ambient.yossi.2',
          },
          {
            speaker: 'YOSSI (WAREHOUSE)',
            speakerKey: 'speaker.YOSSI (WAREHOUSE)',
            text: 'For now, yeah. Let me know if you spot any stray KALLAX pallets blocking the exit.',
            textKey: 'ambient.yossi.3',
          },
        ];
      });
    } else if (npc.id === 'employee-danny') {
      npc.setAmbientDialogueResolver(() => {
        if (missions.hasCompletedMission('mission-05')) {
          return [
            {
              speaker: 'DANNY (SHOWROOM)',
              speakerKey: 'speaker.DANNY (SHOWROOM)',
              text: 'Showroom fragrance display is quiet again—and Midnight Noir is safer with Security anyway.',
              textKey: 'ambient.danny.m5.1',
            },
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'Glad it stayed on the property. Keep an eye on the main aisles, Danny.',
              textKey: 'ambient.danny.m5.2',
            },
          ];
        }
        if (missions.hasCompletedMission('mission-03')) {
          return [
            {
              speaker: 'DANNY (SHOWROOM)',
              speakerKey: 'speaker.DANNY (SHOWROOM)',
              text: 'Still cannot believe that watch turned up next to the Swedish meatballs.',
              textKey: 'ambient.danny.m3.1',
            },
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'Never underestimate someone’s lunch break around here.',
              textKey: 'ambient.danny.m3.2',
            },
            {
              speaker: 'DANNY (SHOWROOM)',
              speakerKey: 'speaker.DANNY (SHOWROOM)',
              text: 'Let me know if you spot anything else unusual on the Showroom floor.',
              textKey: 'ambient.danny.m3.3',
            },
          ];
        }
        return [
          {
            speaker: 'DANNY (SHOWROOM)',
            speakerKey: 'speaker.DANNY (SHOWROOM)',
            text: 'Hey Kfir, everything okay?',
            textKey: 'ambient.danny.1',
          },
          {
            speaker: 'KFIR',
            speakerKey: 'speaker.KFIR',
            text: 'Yeah, just doing my rounds.',
            textKey: 'ambient.danny.2',
          },
          {
            speaker: 'DANNY (SHOWROOM)',
            speakerKey: 'speaker.DANNY (SHOWROOM)',
            text: 'Keep an eye on the warehouse. Things are getting weird today.',
            textKey: 'ambient.danny.3',
          },
        ];
      });
    } else if (npc.id === 'employee-maya') {
      npc.setAmbientDialogueResolver(() => {
        if (missions.hasCompletedMission('mission-05')) {
          return [
            {
              speaker: 'MAYA (LIVING ROOM)',
              speakerKey: 'speaker.MAYA (LIVING ROOM)',
              text: 'Missing watches, runaway forklifts, stolen cologne... quite a shift you are having, Kfir.',
              textKey: 'ambient.maya.m5.1',
            },
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'Tell me about it. At least the Showroom smells better now.',
              textKey: 'ambient.maya.m5.2',
            },
          ];
        }
        return [
          {
            speaker: 'MAYA (LIVING ROOM)',
            speakerKey: 'speaker.MAYA (LIVING ROOM)',
            text: 'Customers keep asking if the POÄNG chair comes pre-assembled.',
            textKey: 'ambient.maya.1',
          },
          {
            speaker: 'KFIR',
            speakerKey: 'speaker.KFIR',
            text: 'Tell them that is half the IKEA experience.',
            textKey: 'ambient.maya.2',
          },
          {
            speaker: 'MAYA (LIVING ROOM)',
            speakerKey: 'speaker.MAYA (LIVING ROOM)',
            text: 'True. By the way, someone left Swedish meatballs on every display table again!',
            textKey: 'ambient.maya.3',
          },
        ];
      });
    }
  }
}
