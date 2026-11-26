import * as THREE from 'three';
import { WORLD_ANCHORS } from '../world/WorldAnchors';
import type { MissionDefinition } from './MissionObjectives';

export const CAMPAIGN_MISSIONS: readonly MissionDefinition[] = [
  {
    id: 'mission-01',
    number: 1,
    title: 'ANOTHER DAY AT IKEA',
    titleKey: 'm1.title',
    description: 'Start your 08:00 AM security shift and investigate motion on Camera 04.',
    descriptionKey: 'm1.desc',
    openingDialogue: {
      title: 'Shift Start — 08:00 AM',
      titleKey: 'm1.openTitle',
      lines: [
        {
          speaker: 'SHIFT MANAGER',
          speakerKey: 'speaker.SHIFT MANAGER',
          text: 'Morning, Kfir. Everything quiet over there?',
          textKey: 'm1.open.1',
        },
        { speaker: 'KFIR', speakerKey: 'speaker.KFIR', text: 'Yeah. So far.', textKey: 'm1.open.2' },
        {
          speaker: 'SECURITY SYSTEM',
          speakerKey: 'speaker.SECURITY SYSTEM',
          text: 'CAMERA 04 — MOTION DETECTED in the Self-Serve Warehouse!',
          textKey: 'm1.open.3',
        },
        {
          speaker: 'SHIFT MANAGER',
          speakerKey: 'speaker.SHIFT MANAGER',
          text: 'Check Camera 04 on your desk terminal, grab your security radio, and go check the Warehouse.',
          textKey: 'm1.open.4',
        },
      ],
    },
    objectives: [
      {
        id: 'm1-check-cam04',
        type: 'inspect_camera',
        title: 'Inspect Camera 04 (Warehouse) on the control desk computer',
        titleKey: 'm1.obj.cam04',
        targetCamIndex: 3,
        targetPos: WORLD_ANCHORS.controlRoom.computer.position.clone(),
        floor: WORLD_ANCHORS.controlRoom.computer.floor,
      },
      {
        id: 'm1-pickup-radio',
        type: 'interact',
        title: 'Pick up the security radio',
        titleKey: 'm1.obj.radio',
        targetId: 'm1-radio',
        targetPos: WORLD_ANCHORS.controlRoom.m1Radio.position.clone(),
        floor: WORLD_ANCHORS.controlRoom.m1Radio.floor,
      },
      {
        id: 'm1-leave-control',
        type: 'reach_location',
        title: 'Open the door and leave the control room',
        titleKey: 'm1.obj.leave',
        targetPos: WORLD_ANCHORS.controlRoom.eastDoorExit.position.clone(),
        floor: WORLD_ANCHORS.controlRoom.eastDoorExit.floor,
        radius: 2.2,
      },
      {
        id: 'm1-reach-warehouse',
        type: 'reach_location',
        title: 'Reach the Self-Serve Warehouse',
        titleKey: 'm1.obj.reachWh',
        targetPos: WORLD_ANCHORS.warehouse.entrance.position.clone(),
        floor: WORLD_ANCHORS.warehouse.entrance.floor,
        radius: 2.8,
      },
      {
        id: 'm1-investigate-clue',
        type: 'interact',
        title: 'Investigate the suspicious activity in Aisle 02',
        titleKey: 'm1.obj.clue',
        targetId: 'm1-warehouse-clue',
        targetPos: WORLD_ANCHORS.warehouse.m1Clue.position.clone(),
        floor: WORLD_ANCHORS.warehouse.m1Clue.floor,
        completionDialogue: {
          speaker: 'Kfir',
          speakerKey: 'speaker.KFIR',
          lines: [
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'A stray pallet cart rolling loose in Aisle 02... Wait—something bigger just rattled down Aisle 01!',
              textKey: 'm1.clueDone.1',
            },
          ],
        },
      },
    ],
    reward: {
      money: 150,
    },
    completionMessage: 'First patrol complete! Wait... what was that noise down Aisle 01?',
    completionMessageKey: 'm1.complete',
  },
  {
    id: 'mission-02',
    number: 2,
    title: 'WAREHOUSE INCIDENT',
    titleKey: 'm2.title',
    description: 'A giant loaded furniture cart is tearing through the Warehouse!',
    descriptionKey: 'm2.desc',
    openingPhoneMessage: {
      sender: 'SHIFT MANAGER',
      senderKey: 'speaker.SHIFT MANAGER',
      text: 'Kfir! A massive furniture cart just broke loose in the Warehouse! Stop it before it flattens Aisle 03!',
      textKey: 'm2.phone',
    },
    objectives: [
      {
        id: 'm2-reach-incident',
        type: 'reach_location',
        title: 'Reach the Warehouse incident location',
        titleKey: 'm2.obj.reach',
        targetPos: WORLD_ANCHORS.warehouse.m2Reach.position.clone(),
        floor: WORLD_ANCHORS.warehouse.m2Reach.floor,
        radius: 2.8,
        onCompleteEvent: 'm2_start_cart',
      },
      {
        id: 'm2-follow-cart',
        type: 'reach_location',
        title: 'Dodge falling boxes and chase the runaway cart',
        titleKey: 'm2.obj.follow',
        dynamicTargetKey: 'm2_cart',
        chaseDistance: 4.5,
        minTravelDistance: 8,
        targetPos: new THREE.Vector3(25.5, 0, -24.0),
        floor: 1,
      },
      {
        id: 'm2-stop-cart',
        type: 'interact',
        title: 'Catch up and stop the runaway furniture cart',
        titleKey: 'm2.obj.stop',
        dynamicTargetKey: 'm2_cart',
        targetId: 'm2-runaway-cart',
        targetPos: new THREE.Vector3(26.0, 0, -20.5),
        floor: 1,
      },
      {
        id: 'm2-investigate-cause',
        type: 'interact',
        title: 'Inspect the cart clipboard',
        titleKey: 'm2.obj.cause',
        dynamicTargetKey: 'm2_clipboard',
        targetId: 'm2-cart-clipboard',
        targetPos: new THREE.Vector3(24.8, 0, -19.5),
        floor: 1,
        completionDialogue: {
          speaker: 'Kfir',
          speakerKey: 'speaker.KFIR',
          lines: [
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'No brake lock engaged... Who leaves a cart like that?!',
              textKey: 'm2.causeDone.1',
            },
          ],
        },
      },
    ],
    reward: {
      money: 250,
      itemId: 'golden-wrench',
      itemName: 'Golden Flat-Pack Wrench',
      itemNameKey: 'item.golden-wrench',
    },
    completionMessage: 'You halted the runaway cart and saved the KALLAX stock!',
    completionMessageKey: 'm2.complete',
  },
  {
    id: 'mission-03',
    number: 3,
    title: 'THE MISSING WATCH',
    titleKey: 'm3.title',
    description: 'An expensive watch disappeared from the Showroom. Question staff and inspect clues to track it down.',
    descriptionKey: 'm3.desc',
    openingPhoneMessage: {
      sender: 'SHIFT MANAGER',
      senderKey: 'speaker.SHIFT MANAGER',
      text: 'Report from Showroom: an expensive watch vanished! Question staff and inspect clues to track it down.',
      textKey: 'm3.phone',
    },
    objectives: [
      {
        id: 'm3-reach-showroom',
        type: 'reach_location',
        title: 'Head to the IKEA Showroom',
        titleKey: 'm3.obj.reach',
        targetPos: WORLD_ANCHORS.showroomF2.livingRoom.position.clone(),
        floor: WORLD_ANCHORS.showroomF2.livingRoom.floor,
        radius: 2.8,
      },
      {
        id: 'm3-gather-clues',
        type: 'talk_npc',
        title: 'Question IKEA staff for clues about the missing watch',
        titleKey: 'm3.obj.clues',
        requiredCount: 2,
        targetIds: ['employee-danny', 'employee-maya', 'employee-yossi'],
        targetNpcPositions: {
          'employee-danny': WORLD_ANCHORS.showroom.danny.position.clone(),
          'employee-maya': WORLD_ANCHORS.showroom.maya.position.clone(),
          'employee-yossi': WORLD_ANCHORS.warehouse.yossi.position.clone(),
        },
        npcDialogues: {
          'employee-danny': [
            {
              speaker: 'DANNY (SHOWROOM)',
              speakerKey: 'speaker.DANNY (SHOWROOM)',
              text: 'Someone left an expensive watch near the MALM bed display earlier, then it vanished!',
              textKey: 'm3.danny.1',
            },
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'I will check the MALM bedroom display and ask around the floor.',
              textKey: 'm3.danny.2',
            },
          ],
          'employee-maya': [
            {
              speaker: 'MAYA (LIVING ROOM)',
              speakerKey: 'speaker.MAYA (LIVING ROOM)',
              text: 'I saw someone hurrying past the Living Room with an empty watch box near the MALM bed display. They looked hungry!',
              textKey: 'm3.maya.1',
            },
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'A watch box near the MALM bed, and whoever took it was hungry? Worth inspecting that box.',
              textKey: 'm3.maya.2',
            },
          ],
          'employee-yossi': [
            {
              speaker: 'YOSSI (WAREHOUSE)',
              speakerKey: 'speaker.YOSSI (WAREHOUSE)',
              text: 'Nobody carried a watch back here in the Warehouse. Check the MALM bedroom display in the Showroom!',
              textKey: 'm3.yossi.1',
            },
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'Rules out the Warehouse—heading to the bedroom display.',
              textKey: 'm3.yossi.2',
            },
          ],
        },
        npcDialogueResolver: {
          'employee-danny': (inv) =>
            inv.hasSpokenTo('employee-maya')
              ? [
                  {
                    speaker: 'DANNY (SHOWROOM)',
                    speakerKey: 'speaker.DANNY (SHOWROOM)',
                    text: 'Yes! The watch was near the MALM bed display before it vanished. If Maya saw someone hungry hurrying off with a velvet box, check the MALM display for clues!',
                    textKey: 'm3.dannyAfterMaya.1',
                  },
                  {
                    speaker: 'KFIR',
                    speakerKey: 'speaker.KFIR',
                    text: 'Two independent sightings pointing right to the MALM bedroom display. Inspecting it now.',
                    textKey: 'm3.dannyAfterMaya.2',
                  },
                ]
              : [
                  {
                    speaker: 'DANNY (SHOWROOM)',
                    speakerKey: 'speaker.DANNY (SHOWROOM)',
                    text: 'Someone left an expensive watch near the MALM bed display earlier, then it vanished!',
                    textKey: 'm3.danny.1',
                  },
                  {
                    speaker: 'KFIR',
                    speakerKey: 'speaker.KFIR',
                    text: 'I will check the MALM bedroom display and ask around the floor.',
                    textKey: 'm3.danny.2',
                  },
                ],
          'employee-maya': (inv) =>
            inv.hasSpokenTo('employee-danny')
              ? [
                  {
                    speaker: 'MAYA (LIVING ROOM)',
                    speakerKey: 'speaker.MAYA (LIVING ROOM)',
                    text: 'Matches what Danny told you—I saw someone hurrying past the Living Room with an empty watch box near the MALM bed display. They looked hungry!',
                    textKey: 'm3.maya.1',
                  },
                  {
                    speaker: 'KFIR',
                    speakerKey: 'speaker.KFIR',
                    text: 'So Danny reported it missing near the MALM bed, and whoever took it looked hungry? Worth inspecting that box.',
                    textKey: 'm3.maya.2',
                  },
                ]
              : [
                  {
                    speaker: 'MAYA (LIVING ROOM)',
                    speakerKey: 'speaker.MAYA (LIVING ROOM)',
                    text: 'I saw someone hurrying past the Living Room with an empty watch box from the MALM bed display. They looked hungry!',
                    textKey: 'm3.mayaBeforeDanny.1',
                  },
                  {
                    speaker: 'KFIR',
                    speakerKey: 'speaker.KFIR',
                    text: 'An empty velvet watch box near the MALM bed, and whoever took it was hungry? Worth inspecting that display—and checking with Danny too.',
                    textKey: 'm3.mayaBeforeDanny.2',
                  },
                ],
        },
      },
      {
        id: 'm3-inspect-watch-box',
        type: 'interact',
        title: 'Search the MALM bedroom display for clues',
        titleKey: 'm3.obj.box',
        hideMarker: true,
        targetId: 'm3-watch-box-clue',
        targetPos: WORLD_ANCHORS.showroom.malmWatchBox.position.clone(),
        floor: WORLD_ANCHORS.showroom.malmWatchBox.floor,
        completionDialogue: {
          speaker: 'Kfir',
          speakerKey: 'speaker.KFIR',
          lines: [
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'An empty velvet watch case... with a Swedish meatball napkin and receipt from the IKEA Restaurant counter! That is where it went!',
              textKey: 'm3.boxDone.1',
            },
          ],
        },
      },
      {
        id: 'm3-find-watch',
        type: 'collect',
        title: 'Follow the Restaurant clue to find the missing watch',
        titleKey: 'm3.obj.watch',
        hideMarker: true,
        targetId: 'm3-missing-watch',
        targetPos: WORLD_ANCHORS.restaurant.missingWatch.position.clone(),
        floor: WORLD_ANCHORS.restaurant.missingWatch.floor,
      },
      {
        id: 'm3-return-watch',
        type: 'talk_npc',
        title: 'Return the watch to Danny in the Showroom',
        titleKey: 'm3.obj.return',
        targetIds: ['employee-danny'],
        floor: WORLD_ANCHORS.showroom.danny.floor,
        targetNpcPositions: {
          'employee-danny': WORLD_ANCHORS.showroom.danny.position.clone(),
        },
        npcDialogues: {
          'employee-danny': [
            {
              speaker: 'DANNY (SHOWROOM)',
              speakerKey: 'speaker.DANNY (SHOWROOM)',
              text: 'You found it! Wait—it was just sitting by the Restaurant counter the whole time?',
              textKey: 'm3.return.1',
            },
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'All this trouble... for a watch?',
              textKey: 'm3.return.2',
            },
          ],
        },
      },
    ],
    reward: {
      money: 350,
      itemId: 'silver-guard-watch',
      itemName: 'Silver Guard Watch',
      itemNameKey: 'item.silver-guard-watch',
    },
    completionMessage: 'Mystery solved! The watch has been safely returned.',
    completionMessageKey: 'm3.complete',
  },
  {
    id: 'mission-04',
    number: 4,
    title: 'THE FORKLIFT CHASE',
    titleKey: 'm4.title',
    description: 'Forklift #2 is malfunctioning in the Warehouse! Hit the emergency stop switch!',
    descriptionKey: 'm4.desc',
    openingPhoneMessage: {
      sender: 'YOSSI',
      senderKey: 'speaker.YOSSI',
      text: 'EMERGENCY! Forklift #2 is out of control in the Warehouse! Get back here and hit the North wall Emergency Stop!',
      textKey: 'm4.phone',
    },
    objectives: [
      {
        id: 'm4-reach-forklift-area',
        type: 'reach_location',
        title: 'Rush to the Warehouse forklift area',
        titleKey: 'm4.obj.reach',
        targetPos: WORLD_ANCHORS.warehouse.m4Reach.position.clone(),
        floor: WORLD_ANCHORS.warehouse.m4Reach.floor,
        radius: 2.8,
        onCompleteEvent: 'm4_start_forklift',
      },
      {
        id: 'm4-follow-forklift',
        type: 'reach_location',
        title: 'Chase the runaway forklift through the Warehouse aisles',
        titleKey: 'm4.obj.follow',
        dynamicTargetKey: 'm4_forklift',
        chaseDistance: 5.5,
        minTravelDistance: 6,
        maxPlayerZ: -22,
        targetPos: new THREE.Vector3(21.0, 0, -33.5),
        floor: 1,
      },
      {
        id: 'm4-pull-emergency-switch',
        type: 'activate_switch',
        title: 'Activate the red Emergency Stop Switch on the North wall',
        titleKey: 'm4.obj.switch',
        targetId: 'm4-emergency-switch',
        targetPos: WORLD_ANCHORS.warehouse.m4EmergencySwitch.position.clone(),
        floor: WORLD_ANCHORS.warehouse.m4EmergencySwitch.floor,
        onCompleteEvent: 'm4_stop_forklift',
      },
      {
        id: 'm4-confirm-stopped',
        type: 'interact',
        title: 'Inspect the stopped Forklift #2',
        titleKey: 'm4.obj.confirm',
        dynamicTargetKey: 'm4_forklift',
        targetId: 'm4-forklift-inspect',
        targetPos: new THREE.Vector3(16.2, 0, -31.5),
        floor: 1,
        completionDialogue: {
          speaker: 'Yossi',
          speakerKey: 'speaker.YOSSI',
          lines: [
            {
              speaker: 'YOSSI (WAREHOUSE)',
              speakerKey: 'speaker.YOSSI (WAREHOUSE)',
              text: 'Power cut right in time! You just saved half our inventory, Kfir!',
              textKey: 'm4.confirmDone.1',
            },
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'Just another shift at IKEA.',
              textKey: 'm4.confirmDone.2',
            },
          ],
        },
      },
    ],
    reward: {
      money: 500,
      itemId: 'warehouse-hero-badge',
      itemName: 'Warehouse Hero Badge',
      itemNameKey: 'item.warehouse-hero-badge',
    },
    completionMessage: 'Forklift #2 shut down! Warehouse secured — ready for the next shift alert!',
    completionMessageKey: 'm4.complete',
  },
  {
    id: 'mission-05',
    number: 5,
    title: 'THE PERFUME HEIST',
    titleKey: 'm5.title',
    description:
      'A limited-edition bottle of MIDNIGHT NOIR vanished from the Showroom luxury display. Track down the clues and recover it.',
    descriptionKey: 'm5.desc',
    openingPhoneMessage: {
      sender: 'SHIFT MANAGER',
      senderKey: 'speaker.SHIFT MANAGER',
      text: 'Code Fragrance! Our limited-edition MIDNIGHT NOIR perfume disappeared from the Showroom display. Go inspect the stand!',
      textKey: 'm5.phone',
    },
    objectives: [
      {
        id: 'm5-reach-display',
        type: 'reach_location',
        title: 'Head to the Showroom luxury fragrance display',
        titleKey: 'm5.obj.reach',
        targetPos: WORLD_ANCHORS.showroom.m5Reach.position.clone(),
        floor: WORLD_ANCHORS.showroom.m5Reach.floor,
        radius: 2.8,
      },
      {
        id: 'm5-inspect-display',
        type: 'interact',
        title: 'Inspect the empty Midnight Noir display stand',
        titleKey: 'm5.obj.inspect',
        targetId: 'm5-empty-display',
        targetPos: WORLD_ANCHORS.showroom.m5EmptyDisplay.position.clone(),
        floor: WORLD_ANCHORS.showroom.m5EmptyDisplay.floor,
        completionDialogue: {
          speaker: 'Kfir',
          speakerKey: 'speaker.KFIR',
          lines: [
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'Empty velvet slot, tipped price card, and strong cedarwood cologne hanging in the air...',
              textKey: 'm5.inspectDone.1',
            },
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'Somebody sprayed half the tester on themselves while grabbing it. Let me question Danny and Maya.',
              textKey: 'm5.inspectDone.2',
            },
          ],
        },
      },
      {
        id: 'm5-interview-witnesses',
        type: 'talk_npc',
        title: 'Interview Showroom witnesses Danny and Maya',
        titleKey: 'm5.obj.witnesses',
        requiredCount: 2,
        targetIds: ['employee-danny', 'employee-maya'],
        targetNpcPositions: {
          'employee-danny': WORLD_ANCHORS.showroom.danny.position.clone(),
          'employee-maya': WORLD_ANCHORS.showroom.maya.position.clone(),
        },
        npcDialogues: {
          'employee-danny': [
            {
              speaker: 'DANNY (SHOWROOM)',
              speakerKey: 'speaker.DANNY (SHOWROOM)',
              text: 'A guy in a bright yellow hoodie bolted past here five minutes ago! I swear he smelled like expensive cedarwood!',
              textKey: 'm5.danny.1',
            },
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'Wait—you always blame guys in yellow hoodies when free coffee opens. Did Maya see anything?',
              textKey: 'm5.danny.2',
            },
            {
              speaker: 'DANNY (SHOWROOM)',
              speakerKey: 'speaker.DANNY (SHOWROOM)',
              text: 'Okay, maybe he was carrying a dark bottle, or maybe a thermos. Ask Maya!',
              textKey: 'm5.danny.3',
            },
          ],
          'employee-maya': [
            {
              speaker: 'MAYA (LIVING ROOM)',
              speakerKey: 'speaker.MAYA (LIVING ROOM)',
              text: 'Danny is guessing again. The yellow hoodie guy was delivery support—the real trail of Midnight Noir cologne went South toward the Checkout Hall!',
              textKey: 'm5.maya.1',
            },
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'Checkout Hall? Let me search down there for cologne clues.',
              textKey: 'm5.maya.2',
            },
          ],
        },
        npcDialogueResolver: {
          'employee-danny': (inv) =>
            inv.hasSpokenTo('employee-maya')
              ? [
                  {
                    speaker: 'DANNY (SHOWROOM)',
                    speakerKey: 'speaker.DANNY (SHOWROOM)',
                    text: 'I thought I saw someone in a yellow hoodie bolt past here, though Maya is right—the cedarwood cologne trail clearly went South toward the Checkout Hall.',
                    textKey: 'm5.dannyAfterMaya.1',
                  },
                  {
                    speaker: 'KFIR',
                    speakerKey: 'speaker.KFIR',
                    text: 'Both accounts confirm the Checkout Hall trail. Let me track down the bottle.',
                    textKey: 'm5.dannyAfterMaya.2',
                  },
                ]
              : [
                  {
                    speaker: 'DANNY (SHOWROOM)',
                    speakerKey: 'speaker.DANNY (SHOWROOM)',
                    text: 'A guy in a bright yellow hoodie bolted past here five minutes ago! I swear he smelled like expensive cedarwood!',
                    textKey: 'm5.danny.1',
                  },
                  {
                    speaker: 'KFIR',
                    speakerKey: 'speaker.KFIR',
                    text: 'Wait—you always blame guys in yellow hoodies when free coffee opens. Did Maya see anything?',
                    textKey: 'm5.danny.2',
                  },
                  {
                    speaker: 'DANNY (SHOWROOM)',
                    speakerKey: 'speaker.DANNY (SHOWROOM)',
                    text: 'Okay, maybe he was carrying a dark bottle, or maybe a thermos. Ask Maya!',
                    textKey: 'm5.danny.3',
                  },
                ],
          'employee-maya': (inv) =>
            inv.hasSpokenTo('employee-danny')
              ? [
                  {
                    speaker: 'MAYA (LIVING ROOM)',
                    speakerKey: 'speaker.MAYA (LIVING ROOM)',
                    text: 'Danny is guessing again. The yellow hoodie guy was delivery support—the real trail of Midnight Noir cologne went South toward the Checkout Hall!',
                    textKey: 'm5.maya.1',
                  },
                  {
                    speaker: 'KFIR',
                    speakerKey: 'speaker.KFIR',
                    text: 'Checkout Hall? Let me search down there for cologne clues.',
                    textKey: 'm5.maya.2',
                  },
                ]
              : [
                  {
                    speaker: 'MAYA (LIVING ROOM)',
                    speakerKey: 'speaker.MAYA (LIVING ROOM)',
                    text: 'If you are investigating the missing Midnight Noir cologne: the guy in the yellow hoodie was just delivery support—the real trail went South toward the Checkout Hall!',
                    textKey: 'm5.mayaBeforeDanny.1',
                  },
                  {
                    speaker: 'KFIR',
                    speakerKey: 'speaker.KFIR',
                    text: 'Checkout Hall? Let me search down there for cologne clues and check with Danny too.',
                    textKey: 'm5.mayaBeforeDanny.2',
                  },
                ],
        },
      },
      {
        id: 'm5-inspect-bag-clue',
        type: 'interact',
        title: 'Search the Checkout Hall for cologne clues',
        titleKey: 'm5.obj.bag',
        hideMarker: true,
        targetId: 'm5-clue-bag',
        targetPos: WORLD_ANCHORS.checkout.bagClue.position.clone(),
        floor: WORLD_ANCHORS.checkout.bagClue.floor,
        completionDialogue: {
          speaker: 'Kfir',
          speakerKey: 'speaker.KFIR',
          lines: [
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'A blue IKEA bag soaked in Midnight Noir... and a break-shift sticky note tucked inside:',
              textKey: 'm5.bagDone.1',
            },
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: '"Stashed the Midnight Noir bottle behind East Checkout Lane 4 until break time." Busted!',
              textKey: 'm5.bagDone.2',
            },
          ],
        },
      },
      {
        id: 'm5-recover-perfume',
        type: 'collect',
        title: 'Recover Midnight Noir behind East Checkout Lane 4',
        titleKey: 'm5.obj.recover',
        hideMarker: true,
        targetId: 'm5-midnight-noir-bottle',
        targetPos: WORLD_ANCHORS.checkout.midnightNoir.position.clone(),
        floor: WORLD_ANCHORS.checkout.midnightNoir.floor,
        onCompleteEvent: 'm5_collect_perfume',
        completionDialogue: {
          speaker: 'Kfir',
          speakerKey: 'speaker.KFIR',
          lines: [
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'Found it! Smells like smoky cedarwood and terrible getaway planning. Time to report back to Danny.',
              textKey: 'm5.recoverDone.1',
            },
          ],
        },
      },
      {
        id: 'm5-report-back',
        type: 'talk_npc',
        title: 'Report back to Danny in the Showroom',
        titleKey: 'm5.obj.report',
        targetIds: ['employee-danny'],
        floor: WORLD_ANCHORS.showroom.danny.floor,
        targetNpcPositions: {
          'employee-danny': WORLD_ANCHORS.showroom.danny.position.clone(),
        },
        npcDialogues: {
          'employee-danny': [
            {
              speaker: 'DANNY (SHOWROOM)',
              speakerKey: 'speaker.DANNY (SHOWROOM)',
              text: 'You recovered Midnight Noir! Good thing—the Shift Manager told me the promo tester actually belongs to Security now.',
              textKey: 'm5.report.1',
            },
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'Finally, a bonus that smells better than meatball gravy.',
              textKey: 'm5.report.2',
            },
          ],
        },
      },
    ],
    reward: {
      money: 600,
      itemId: 'perfume-midnight-noir',
      itemName: 'Midnight Noir',
      itemNameKey: 'item.perfume-midnight-noir',
    },
    completionMessage: 'Midnight Noir recovered and added to your Perfume Collection!',
    completionMessageKey: 'm5.complete',
  },
  {
    id: 'mission-06',
    number: 6,
    title: 'FIFA AT IKEA',
    titleKey: 'm6.title',
    description:
      'Spot a stray soccer ball in the Warehouse and challenge Yossi to a 1v1 Parking Lot pitch match.',
    descriptionKey: 'm6.desc',
    openingPhoneMessage: {
      sender: 'SHIFT MANAGER',
      senderKey: 'speaker.SHIFT MANAGER',
      text: 'Quick break window! Check the Warehouse doorway—someone left a soccer ball there. Winner of a Parking Lot 1v1 gets bragging rights.',
      textKey: 'm6.phone',
    },
    objectives: [
      {
        id: 'm6-find-ball',
        type: 'interact',
        title: 'Pick up the soccer ball near the Warehouse doorway',
        titleKey: 'm6.obj.findBall',
        dynamicTargetKey: 'm6_ball',
        targetId: 'm6-warehouse-ball',
        targetPos: WORLD_ANCHORS.warehouse.ballPickup.position.clone(),
        floor: WORLD_ANCHORS.warehouse.ballPickup.floor,
        completionDialogue: {
          speaker: 'Kfir',
          speakerKey: 'speaker.KFIR',
          lines: [
            {
              speaker: 'KFIR',
              speakerKey: 'speaker.KFIR',
              text: 'A match-grade low-poly football just sitting in the Warehouse. Time to set up goals with Yossi out in the Parking Lot!',
              textKey: 'm6.findDone.1',
            },
          ],
        },
      },
      {
        id: 'm6-start-match',
        type: 'interact',
        title: 'Head to the Parking Lot IKEA Mini-Pitch and challenge Yossi',
        titleKey: 'm6.obj.startMatch',
        targetId: 'm6-start-match',
        targetPos: WORLD_ANCHORS.parking.miniPitchCenter.position.clone(),
        floor: WORLD_ANCHORS.parking.miniPitchCenter.floor,
      },
      {
        id: 'm6-win-match',
        type: 'complete_minigame',
        title: 'Win the 1v1 football match (Kick: F · Pass: G)',
        titleKey: 'm6.obj.winMatch',
        targetId: 'fifa-at-ikea',
        targetPos: WORLD_ANCHORS.parking.miniPitchCenter.position.clone(),
        floor: WORLD_ANCHORS.parking.miniPitchCenter.floor,
      },
    ],
    reward: {
      money: 700,
      itemId: 'personal-football',
      itemName: 'Personal Football',
      itemNameKey: 'item.personal-football',
    },
    completionMessage: 'KFIR WINS! Personal Football unlocked for Parking Lot free play!',
    completionMessageKey: 'm6.complete',
  },
] as const;
