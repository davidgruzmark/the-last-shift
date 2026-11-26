export interface WorldProgressionState {
  activeMissionId: string | null;
  activeObjectiveId: string | null;
  completedMissions: ReadonlySet<string>;
  flags: ReadonlySet<string>;
}

export type WorldProgressionRule = (state: WorldProgressionState) => void;

/**
 * Lightweight, data-driven world progression coordinator.
 * Props and world elements subscribe declarative rules against mission state
 * and explicit world-event flags rather than scattering ad-hoc checks.
 */
export class WorldProgressionManager {
  private activeMissionId: string | null = null;
  private activeObjectiveId: string | null = null;
  private readonly completedMissions = new Set<string>();
  private readonly flags = new Set<string>();
  private readonly rules = new Map<string, WorldProgressionRule>();

  registerRule(id: string, rule: WorldProgressionRule): void {
    this.rules.set(id, rule);
    rule(this.getState());
  }

  setFlag(flag: string, value = true): void {
    if (value) {
      if (this.flags.has(flag)) return;
      this.flags.add(flag);
    } else {
      if (!this.flags.has(flag)) return;
      this.flags.delete(flag);
    }
    this.evaluate();
  }

  hasFlag(flag: string): boolean {
    return this.flags.has(flag);
  }

  sync(
    activeMissionId: string | null,
    activeObjectiveId: string | null,
    completedMissionIds: readonly string[] | ReadonlySet<string>,
  ): void {
    this.activeMissionId = activeMissionId;
    this.activeObjectiveId = activeObjectiveId;
    this.completedMissions.clear();
    for (const id of completedMissionIds) {
      this.completedMissions.add(id);
    }
    this.evaluate();
  }

  getState(): WorldProgressionState {
    return {
      activeMissionId: this.activeMissionId,
      activeObjectiveId: this.activeObjectiveId,
      completedMissions: this.completedMissions,
      flags: this.flags,
    };
  }

  evaluate(): void {
    const state = this.getState();
    for (const rule of this.rules.values()) {
      rule(state);
    }
  }
}
