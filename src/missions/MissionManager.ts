import * as THREE from 'three';
import type { CollectibleManager } from '../collectibles/CollectibleManager';
import type { EventBus, GameEvents } from '../core/EventBus';
import { i18n } from '../i18n/LocalizationManager';
import type { DialogueManager } from '../npcs/DialogueManager';
import type { NPCInteraction } from '../npcs/NPCInteraction';
import type { FloorState } from '../player/PlayerController';
import { CALL_SCENARIOS, type PhoneManager } from '../ui/PhoneManager';
import type {
  InvestigationState,
  MissionDefinition,
  MissionObjectiveDef,
} from './MissionObjectives';

export type CampaignStatus = 'idle' | 'active' | 'completed_screen' | 'campaign_complete';

export interface MissionSnapshot {
  missionId: string | null;
  missionNumber: number;
  title: string;
  objectiveTitle: string;
  progressText: string;
  money: number;
  status: CampaignStatus;
  completedMissions: string[];
}

/**
 * Centralized, data-driven Mission Manager executing campaign missions sequentially.
 * Completely decoupled from mission data so Missions 5-9 can be appended without core rewrites.
 */
export class MissionManager {
  private readonly missions: readonly MissionDefinition[];
  private readonly eventBus: EventBus<GameEvents>;
  private readonly dialogue: DialogueManager;
  private readonly phone: PhoneManager;
  private readonly collectibles?: CollectibleManager;
  private readonly npcs = new Map<string, NPCInteraction>();

  private missionIndex = -1;
  private objectiveIndex = 0;
  private status: CampaignStatus = 'idle';
  private money = 0;
  private readonly completedMissionIds = new Set<string>();
  private readonly completedSubTargets = new Set<string>();
  private deferredAction: (() => void) | null = null;
  private dynamicMarkerResolver?: (obj: MissionObjectiveDef) => THREE.Vector3 | null;
  private dynamicTravelGetter?: (key: string) => number;

  constructor(
    missions: readonly MissionDefinition[],
    eventBus: EventBus<GameEvents>,
    dialogue: DialogueManager,
    phone: PhoneManager,
    collectibles?: CollectibleManager,
  ) {
    this.missions = missions;
    this.eventBus = eventBus;
    this.dialogue = dialogue;
    this.phone = phone;
    this.collectibles = collectibles;
    this.eventBus.on('language:changed', () => this.emitState());
  }

  private localize(key: string | undefined, fallback: string): string {
    return key ? i18n.t(key) : fallback;
  }

  registerNpcs(npcs: readonly NPCInteraction[]): void {
    for (const npc of npcs) {
      this.npcs.set(npc.id, npc);
    }
  }

  setDynamicMarkerResolver(resolver: (obj: MissionObjectiveDef) => THREE.Vector3 | null): void {
    this.dynamicMarkerResolver = resolver;
  }

  setDynamicTravelGetter(getter: (key: string) => number): void {
    this.dynamicTravelGetter = getter;
  }

  startCampaign(startIndex = 0): void {
    if (this.status !== 'idle' || this.missions.length === 0) return;
    const clamped = Math.max(0, Math.min(startIndex, this.missions.length - 1));
    for (let i = 0; i < clamped; i++) {
      this.completedMissionIds.add(this.missions[i].id);
    }
    this.activateMission(clamped);
  }

  /**
   * Re-applies campaign progress loaded from a save file before the campaign is
   * started. Restores wallet + completed missions; when every mission is already
   * done the campaign resumes directly in its completed state.
   */
  restoreProgress(money: number, completedMissionIds: readonly string[]): void {
    if (this.status !== 'idle') return;
    this.money = Math.max(0, Math.floor(money));
    const validIds = new Set(this.missions.map((mission) => mission.id));
    for (const id of completedMissionIds) {
      if (validIds.has(id)) {
        this.completedMissionIds.add(id);
      }
    }
    if (
      this.missions.length > 0 &&
      this.missions.every((mission) => this.completedMissionIds.has(mission.id))
    ) {
      this.status = 'campaign_complete';
      this.emitState();
    }
  }

  getStatus(): CampaignStatus {
    return this.status;
  }

  hasCompletedMission(missionId: string): boolean {
    return this.completedMissionIds.has(missionId);
  }

  getInvestigationState(): InvestigationState {
    const spokeTo = new Set(this.completedSubTargets);
    return {
      spokeTo,
      hasSpokenTo: (npcId: string) => spokeTo.has(npcId),
    };
  }

  getActiveMission(): MissionDefinition | null {
    if (this.missionIndex < 0 || this.missionIndex >= this.missions.length) return null;
    return this.missions[this.missionIndex];
  }

  getActiveObjective(): MissionObjectiveDef | null {
    const mission = this.getActiveMission();
    if (!mission || this.status !== 'active') return null;
    return mission.objectives[this.objectiveIndex] ?? null;
  }

  getCurrentMarkerPosition(): THREE.Vector3 | null {
    const obj = this.getActiveObjective();
    if (!obj || obj.hideMarker) return null;

    if (obj.dynamicTargetKey && this.dynamicMarkerResolver) {
      return this.dynamicMarkerResolver(obj) ?? obj.targetPos ?? null;
    }

    if (obj.type === 'talk_npc' && obj.targetIds) {
      for (const npcId of obj.targetIds) {
        if (!this.completedSubTargets.has(npcId)) {
          const liveNpc = this.npcs.get(npcId);
          if (liveNpc) return liveNpc.getWorldPosition();
          if (obj.targetNpcPositions?.[npcId]) return obj.targetNpcPositions[npcId];
        }
      }
    }

    return obj.targetPos ?? null;
  }

  getSnapshot(): MissionSnapshot {
    const mission = this.getActiveMission();
    const obj = this.getActiveObjective();
    let progressText = '';
    if (obj?.targetIds) {
      const needed = obj.requiredCount ?? obj.targetIds.length;
      if (needed > 1) {
        const doneCount = Math.min(
          needed,
          obj.targetIds.filter((id) => this.completedSubTargets.has(id)).length,
        );
        progressText = `${doneCount}/${needed}`;
      }
    }

    return {
      missionId: mission?.id ?? null,
      missionNumber: mission?.number ?? 0,
      title:
        this.status === 'campaign_complete'
          ? i18n.t('mission.campaignComplete.title')
          : mission
            ? this.localize(mission.titleKey, mission.title)
            : i18n.t('mission.noActive'),
      objectiveTitle:
        this.status === 'campaign_complete'
          ? i18n.t('mission.campaignComplete.obj')
          : obj
            ? this.localize(obj.titleKey, obj.title)
            : '',
      progressText,
      money: this.money,
      status: this.status,
      completedMissions: Array.from(this.completedMissionIds),
    };
  }

  update(_dt: number, playerPos: THREE.Vector3, playerFloor?: FloorState): void {
    if (this.status !== 'active') return;
    const obj = this.getActiveObjective();
    if (!obj) return;

    if (obj.type === 'reach_location') {
      if (obj.minPlayerZ !== undefined && playerPos.z < obj.minPlayerZ) return;
      if (obj.maxPlayerZ !== undefined && playerPos.z > obj.maxPlayerZ) return;
      if (
        obj.floor !== undefined &&
        playerFloor &&
        !playerFloor.onTransition &&
        playerFloor.committedFloor !== obj.floor
      ) {
        return;
      }

      if (obj.dynamicTargetKey && this.dynamicMarkerResolver) {
        if (
          obj.minTravelDistance !== undefined &&
          (this.dynamicTravelGetter?.(obj.dynamicTargetKey) ?? 0) < obj.minTravelDistance
        ) {
          return;
        }
        const livePos = this.dynamicMarkerResolver(obj);
        if (!livePos) return;
        if (Math.abs(playerPos.y - livePos.y) > 2.2) return;
        const dist = Math.hypot(playerPos.x - livePos.x, playerPos.z - livePos.z);
        if (dist <= (obj.chaseDistance ?? obj.radius ?? 3.5)) {
          this.completeCurrentObjective();
        }
        return;
      }

      if (obj.targetPos) {
        if (Math.abs(playerPos.y - obj.targetPos.y) > 2.2) return;
        const radius = obj.radius ?? 2.5;
        const dist = Math.hypot(playerPos.x - obj.targetPos.x, playerPos.z - obj.targetPos.z);
        if (dist <= radius) {
          this.completeCurrentObjective();
        }
      }
    }
  }

  notifyCameraInspected(camIndex: number): void {
    if (this.status !== 'active') return;
    const obj = this.getActiveObjective();
    if (!obj || obj.type !== 'inspect_camera') return;
    if (obj.targetCamIndex === camIndex) {
      this.completeCurrentObjective();
    }
  }

  notifyMinigameComplete(minigameId: string): void {
    if (this.status !== 'active') return;
    const obj = this.getActiveObjective();
    if (!obj || obj.type !== 'complete_minigame') return;
    if (obj.targetId === minigameId) {
      this.completeCurrentObjective();
    }
  }

  notifyInteract(targetId: string): void {
    if (this.status !== 'active') return;
    const mission = this.getActiveMission();
    const obj = this.getActiveObjective();
    if (!mission || !obj) return;

    if (
      (obj.type === 'interact' || obj.type === 'collect' || obj.type === 'activate_switch') &&
      obj.targetId === targetId
    ) {
      this.completeCurrentObjective();
      return;
    }

    // Investigative discovery in Mission 03: finding a physical clue early skips remaining interviews
    if (mission.id === 'mission-03') {
      if (targetId === 'm3-watch-box-clue' && obj.id === 'm3-gather-clues') {
        const idx = mission.objectives.findIndex((o) => o.id === 'm3-inspect-watch-box');
        if (idx >= 0) {
          this.clearAllNpcOverrides();
          this.completedSubTargets.clear();
          this.objectiveIndex = idx;
          this.completeCurrentObjective();
        }
        return;
      }

      if (
        targetId === 'm3-missing-watch' &&
        (obj.id === 'm3-gather-clues' || obj.id === 'm3-inspect-watch-box')
      ) {
        const idx = mission.objectives.findIndex((o) => o.id === 'm3-find-watch');
        if (idx >= 0) {
          this.clearAllNpcOverrides();
          this.completedSubTargets.clear();
          this.objectiveIndex = idx;
          this.completeCurrentObjective();
        }
      }
    }
  }

  notifyNpcTalked(npcId: string): void {
    if (this.status !== 'active') return;
    const obj = this.getActiveObjective();
    if (!obj || obj.type !== 'talk_npc' || !obj.targetIds) return;
    if (!obj.targetIds.includes(npcId) || this.completedSubTargets.has(npcId)) return;

    this.completedSubTargets.add(npcId);
    // Clear override for this NPC immediately so completed mission dialogue never repeats
    this.npcs.get(npcId)?.setMissionDialogue(null, null);

    const needed = obj.requiredCount ?? obj.targetIds.length;
    const doneCount = obj.targetIds.filter((id) => this.completedSubTargets.has(id)).length;
    if (doneCount >= needed) {
      this.completeCurrentObjective();
    } else {
      this.eventBus.emit('mission:notification', {
        kind: 'objective_done',
        title: i18n.t('mission.banner.clueGathered', { done: doneCount, needed }),
        subtitle: this.localize(obj.titleKey, obj.title),
      });
      this.emitState();
    }
  }

  continueAfterCompletion(): void {
    if (this.status !== 'completed_screen') return;
    this.eventBus.emit('mission:completionModal', {
      open: false,
      title: '',
      message: '',
      moneyReward: 0,
      isCampaignEnd: false,
    });

    const nextIndex = this.missionIndex + 1;
    if (nextIndex < this.missions.length) {
      this.activateMission(nextIndex);
    } else {
      this.status = 'campaign_complete';
      this.clearAllNpcOverrides();
      this.emitState();
    }
  }

  private activateMission(index: number): void {
    const mission = this.missions[index];
    if (!mission || this.completedMissionIds.has(mission.id)) return;

    this.missionIndex = index;
    this.objectiveIndex = 0;
    this.status = 'active';
    this.completedSubTargets.clear();
    this.clearAllNpcOverrides();

    if (mission.openingPhoneMessage) {
      this.phone.receiveMessage(
        this.localize(mission.openingPhoneMessage.senderKey, mission.openingPhoneMessage.sender),
        this.localize(mission.openingPhoneMessage.textKey, mission.openingPhoneMessage.text),
        undefined,
        true,
        'work',
        mission.openingPhoneMessage.textKey,
        mission.openingPhoneMessage.senderKey,
      );
    }

    if (mission.id === 'mission-05') {
      this.phone.triggerIncomingCall({
        ...CALL_SCENARIOS.shift_manager,
        onAnswer: () => {
          this.phone.setActiveThread('work');
        },
      });
    }

    if (mission.openingDialogue && !this.dialogue.isActive()) {
      this.dialogue.start(
        this.localize(mission.openingDialogue.titleKey, mission.openingDialogue.title),
        mission.openingDialogue.lines,
      );
    }

    this.eventBus.emit('mission:notification', {
      kind: 'started',
      title: i18n.t('mission.banner.started', { num: mission.number }),
      subtitle: this.localize(mission.titleKey, mission.title),
    });

    this.setupObjectiveHooks();
    this.emitState();
  }

  private setupObjectiveHooks(): void {
    this.clearAllNpcOverrides();
    const obj = this.getActiveObjective();
    if (!obj) return;

    if (obj.onStartEvent) {
      this.eventBus.emit('mission:scriptEvent', { eventId: obj.onStartEvent });
    }

    if (obj.type === 'talk_npc' && obj.targetIds) {
      for (const npcId of obj.targetIds) {
        const npc = this.npcs.get(npcId);
        if (!npc) continue;
        const resolver = obj.npcDialogueResolver?.[npcId];
        const staticLines = obj.npcDialogues?.[npcId] ?? null;
        const dialogueSource = resolver
          ? () => resolver(this.getInvestigationState())
          : staticLines;
        npc.setMissionDialogue(dialogueSource, (id) => {
          this.notifyNpcTalked(id);
        });
      }
    }
  }

  private completeCurrentObjective(): void {
    const mission = this.getActiveMission();
    const obj = this.getActiveObjective();
    if (!mission || !obj || this.status !== 'active') return;

    if (obj.onCompleteEvent) {
      if (obj.onCompleteEvent === 'm5_collect_perfume') {
        this.collectibles?.grantRewardItem(
          'perfume-jpg-le-male',
          i18n.t('item.perfume-jpg-le-male'),
        );
      }
      this.eventBus.emit('mission:scriptEvent', { eventId: obj.onCompleteEvent });
    }

    const advanceOrFinish = (): void => {
      this.completedSubTargets.clear();
      if (this.objectiveIndex + 1 < mission.objectives.length) {
        this.objectiveIndex += 1;
        const nextObj = this.getActiveObjective();
        const nextTitle = nextObj ? this.localize(nextObj.titleKey, nextObj.title) : '';
        this.eventBus.emit('mission:notification', {
          kind: 'new_objective',
          title: i18n.t('mission.banner.objectiveDone'),
          subtitle: nextObj ? i18n.t('mission.banner.nextPrefix', { title: nextTitle }) : '',
        });
        this.setupObjectiveHooks();
        this.emitState();
      } else {
        this.completeActiveMission();
      }
    };

    if (obj.completionDialogue) {
      // Wait for story dialogue to finish cleanly before advancing/showing completion modal
      this.deferredAction = advanceOrFinish;
      this.dialogue.start(
        this.localize(obj.completionDialogue.speakerKey, obj.completionDialogue.speaker),
        obj.completionDialogue.lines,
        () => {
          const action = this.deferredAction;
          this.deferredAction = null;
          action?.();
        },
      );
      return;
    }

    advanceOrFinish();
  }

  private completeActiveMission(): void {
    const mission = this.getActiveMission();
    if (!mission || this.completedMissionIds.has(mission.id)) return;

    this.completedMissionIds.add(mission.id);
    this.clearAllNpcOverrides();

    const missionTitle = this.localize(mission.titleKey, mission.title);
    const completionMsg = this.localize(mission.completionMessageKey, mission.completionMessage);
    const itemName = mission.reward.itemName
      ? this.localize(mission.reward.itemNameKey, mission.reward.itemName)
      : undefined;

    // Grant rewards exactly once
    this.money += mission.reward.money;
    if (mission.reward.itemId && itemName) {
      this.collectibles?.grantRewardItem(mission.reward.itemId, itemName);
    }

    // Milestone-triggered Shiran & Friends Group Chat updates
    if (mission.id === 'mission-02') {
      this.phone.deliverShiranMilestone('m2-complete');
      this.phone.deliverFriendsMilestone('m2-complete');
    } else if (mission.id === 'mission-03') {
      this.phone.deliverFriendsMilestone('m3-daytona');
    } else if (mission.id === 'mission-04') {
      this.phone.deliverShiranMilestone('m4-complete');
    } else if (mission.id === 'mission-05') {
      this.phone.deliverShiranMilestone('m5-complete');
    } else if (mission.id === 'mission-06') {
      this.phone.deliverFriendsMilestone('m6-complete');
    }

    const isCampaignEnd = this.missionIndex + 1 >= this.missions.length;
    this.status = 'completed_screen';

    this.eventBus.emit('mission:notification', {
      kind: 'completed',
      title: i18n.t('mission.banner.completed', { num: mission.number }),
      subtitle: missionTitle,
    });

    this.eventBus.emit('mission:completionModal', {
      open: true,
      title: i18n.t('mission.modal.title', { num: mission.number, title: missionTitle }),
      message: completionMsg,
      moneyReward: mission.reward.money,
      itemReward: itemName,
      isCampaignEnd,
    });

    this.emitState();
  }

  private clearAllNpcOverrides(): void {
    for (const npc of this.npcs.values()) {
      npc.setMissionDialogue(null, null);
    }
  }

  private emitState(): void {
    this.eventBus.emit('mission:stateChanged', this.getSnapshot());
  }
}
