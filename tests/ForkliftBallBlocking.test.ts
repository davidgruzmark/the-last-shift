import * as THREE from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import { PLAYER_CONFIG, WAREHOUSE_BALL_PICKUP_ZONE } from '../src/config/constants';
import { AssetManager } from '../src/core/AssetManager';
import { EventBus, type GameEvents } from '../src/core/EventBus';
import { i18n } from '../src/i18n/LocalizationManager';
import { InteractionManager } from '../src/interaction/InteractionManager';
import { FootballMiniGame } from '../src/minigames/FootballMiniGame';
import { CAMPAIGN_MISSIONS } from '../src/missions/MissionDefinitions';
import { MissionManager } from '../src/missions/MissionManager';
import { MissionPropsController } from '../src/missions/MissionPropsController';
import { DialogueManager } from '../src/npcs/DialogueManager';
import { PhoneManager } from '../src/ui/PhoneManager';
import { CollisionManager } from '../src/world/CollisionManager';
import { WorldManager } from '../src/world/WorldManager';
import { WorldProgressionManager } from '../src/world/WorldProgressionManager';

function buildFullWarehouseScenario(startMissionIndex = 3) {
  const assets = new AssetManager();
  const bus = new EventBus<GameEvents>();
  const collision = new CollisionManager();
  const dialogue = new DialogueManager(bus);
  const phone = new PhoneManager(bus, false);
  const interactions = new InteractionManager(bus, collision);
  const world = new WorldManager(assets, collision);
  const handles = world.populateInteractions(interactions, dialogue, bus);
  const progression = new WorldProgressionManager();

  const mm = new MissionManager(CAMPAIGN_MISSIONS, bus, dialogue, phone, handles.collectibles);
  mm.registerNpcs(handles.npcs);

  const props = new MissionPropsController(world.palette, interactions, mm, collision, progression);
  const football = new FootballMiniGame(world.palette, interactions, mm, bus, collision);

  mm.setDynamicMarkerResolver((obj) => {
    if (obj.id === 'm6-find-ball') return football.getWarehouseBallPosition();
    return props.getDynamicMarkerPosition(obj);
  });
  mm.setDynamicTravelGetter((key) => props.getDynamicTravelDistance(key));
  bus.on('mission:scriptEvent', ({ eventId }) => props.handleScriptEvent(eventId));

  mm.startCampaign(startMissionIndex);
  props.update(0.016);
  football.update(0.016, new THREE.Vector3(21, 0, -15), new THREE.Vector3());

  return { bus, collision, dialogue, interactions, mm, props, football };
}

describe('Urgent Hotfix — Forklift Cannot Block M06 Warehouse Ball Pickup', () => {
  afterEach(() => {
    i18n.setLanguage('en');
  });

  it('never stops Forklift #2 inside the reserved Warehouse ball pickup zone even when Emergency Stop fires directly on top of it', () => {
    const s = buildFullWarehouseScenario(3); // Mission 04

    // Start Forklift #2 running in M04
    s.mm.update(0.016, CAMPAIGN_MISSIONS[3].objectives[0].targetPos!);
    expect(s.props.getForkliftState()).toBe('running');

    // Chase the forklift until m4-follow-forklift completes (chaseDistance <= 5.5, player z <= -22)
    for (let i = 0; i < 200 && s.mm.getActiveObjective()?.id === 'm4-follow-forklift'; i++) {
      s.props.update(0.05);
      const fp = s.props.getForkliftPosition();
      s.mm.update(0.05, new THREE.Vector3(fp.x, 0, Math.min(-22.5, fp.z)));
    }
    expect(s.mm.getActiveObjective()?.id).toBe('m4-pull-emergency-switch');

    // Now wait until Forklift #2 drives across (21.0, -16.8) inside WAREHOUSE_BALL_PICKUP_ZONE
    let enteredZone = false;
    for (let i = 0; i < 400; i++) {
      s.props.update(0.05);
      const fp = s.props.getForkliftPosition();
      const dist = Math.hypot(
        fp.x - WAREHOUSE_BALL_PICKUP_ZONE.x,
        fp.z - WAREHOUSE_BALL_PICKUP_ZONE.z,
      );
      if (dist < 0.7) {
        enteredZone = true;
        break;
      }
    }
    expect(enteredZone).toBe(true);

    // Hit Emergency Stop while Forklift #2 is right inside the ball pickup zone
    s.mm.notifyInteract('m4-emergency-switch');
    expect(s.props.getForkliftState()).toBe('braking');

    let prevPos = s.props.getForkliftPosition();
    for (let i = 0; i < 120; i++) {
      s.props.update(0.05);
      const curr = s.props.getForkliftPosition();
      // Confirm continuous smooth rolling (never teleporting)
      expect(curr.distanceTo(prevPos)).toBeLessThan(0.6);
      prevPos = curr;
      if (s.props.getForkliftState() === 'stopped') break;
    }

    expect(s.props.getForkliftState()).toBe('stopped');
    const stoppedPos = s.props.getForkliftPosition();
    const stoppedDist = Math.hypot(
      stoppedPos.x - WAREHOUSE_BALL_PICKUP_ZONE.x,
      stoppedPos.z - WAREHOUSE_BALL_PICKUP_ZONE.z,
    );
    expect(stoppedDist).toBeGreaterThanOrEqual(WAREHOUSE_BALL_PICKUP_ZONE.noStopRadius);
  });

  it('recovers smoothly if a stopped forklift ever overlaps the reserved ball zone and preserves solid collision', () => {
    const s = buildFullWarehouseScenario(3);
    s.mm.update(0.016, CAMPAIGN_MISSIONS[3].objectives[0].targetPos!);
    for (let i = 0; i < 200 && s.mm.getActiveObjective()?.id === 'm4-follow-forklift'; i++) {
      s.props.update(0.05);
      const fp = s.props.getForkliftPosition();
      s.mm.update(0.05, new THREE.Vector3(fp.x, 0, Math.min(-22.5, fp.z)));
    }
    expect(s.mm.getActiveObjective()?.id).toBe('m4-pull-emergency-switch');
    s.mm.notifyInteract('m4-emergency-switch');
    for (let i = 0; i < 80; i++) s.props.update(0.05);
    expect(s.props.getForkliftState()).toBe('stopped');

    // Forcibly place the stopped forklift right onto (21.0, 0, -16.8) to test recovery
    const fObj = s.props.group.children.find(
      (c) =>
        Math.abs(c.position.x - s.props.getForkliftPosition().x) < 0.05 &&
        Math.abs(c.position.z - s.props.getForkliftPosition().z) < 0.05 &&
        c.visible,
    )!;
    fObj.position.set(WAREHOUSE_BALL_PICKUP_ZONE.x, 0, WAREHOUSE_BALL_PICKUP_ZONE.z);
    s.props.update(0.05);
    expect(s.props.getForkliftState()).toBe('braking');

    for (let i = 0; i < 120; i++) {
      s.props.update(0.05);
      if (s.props.getForkliftState() === 'stopped') break;
    }
    expect(s.props.getForkliftState()).toBe('stopped');
    const finalPos = s.props.getForkliftPosition();
    expect(
      Math.hypot(finalPos.x - WAREHOUSE_BALL_PICKUP_ZONE.x, finalPos.z - WAREHOUSE_BALL_PICKUP_ZONE.z),
    ).toBeGreaterThanOrEqual(WAREHOUSE_BALL_PICKUP_ZONE.noStopRadius);

    // Forklift remains physically solid (player cannot walk through it)
    const solidCheck = s.collision.isPositionClear(finalPos, PLAYER_CONFIG.radius, PLAYER_CONFIG.height);
    expect(solidCheck).toBe(false);
  });

  it('guarantees M06 ball never spawns inside an occupied forklift collider and remains collectable nearby', () => {
    const s = buildFullWarehouseScenario(5); // Mission 06 (M04 already completed, forklift visible & solid)

    // Scenario A: Forklift is parked cleanly outside reserved zone -> primary ball spot is clear & collectable
    const primaryBallPos = s.football.getWarehouseBallPosition();
    expect(s.collision.isPositionClear(primaryBallPos, 0.5, 1.0)).toBe(true);

    // Confirm real InteractionManager targets and collects ball with forklift nearby
    const standPos = new THREE.Vector3(primaryBallPos.x, 0, primaryBallPos.z + 1.25);
    s.interactions.update(0.016, standPos, Math.PI);
    expect(s.interactions.getActiveTarget()?.id).toBe('m6-warehouse-ball');
    expect(s.interactions.interact()).toBe(true);
    while (s.dialogue.isActive()) s.dialogue.advance();
    expect(s.mm.getActiveObjective()?.id).toBe('m6-start-match');

    // Scenario B: Fresh M06 instance where m4-forklift-col forcibly occupies (21.0, 0, -16.8) -> ball safely relocates to unobstructed fallback!
    const s2 = buildFullWarehouseScenario(5);
    s2.collision.updateOrientedBox(
      'm4-forklift-col',
      new THREE.Vector3(WAREHOUSE_BALL_PICKUP_ZONE.x, 1.05, WAREHOUSE_BALL_PICKUP_ZONE.z),
      new THREE.Vector3(0.82, 1.05, 1.25),
      0,
    );
    s2.football.update(0.016, new THREE.Vector3(21, 0, -15), new THREE.Vector3());
    const relocatedPos = s2.football.getWarehouseBallPosition();

    expect(
      Math.hypot(
        relocatedPos.x - WAREHOUSE_BALL_PICKUP_ZONE.x,
        relocatedPos.z - WAREHOUSE_BALL_PICKUP_ZONE.z,
      ),
    ).toBeGreaterThan(1.0);
    expect(s2.collision.isPositionClear(relocatedPos, 0.5, 1.0)).toBe(true);
    expect(s2.mm.getCurrentMarkerPosition()?.distanceTo(relocatedPos)).toBeLessThan(0.05);

    const playerApproach = new THREE.Vector3(relocatedPos.x, 0, relocatedPos.z + 1.15);
    s2.interactions.update(0.016, playerApproach, Math.PI);
    expect(s2.interactions.getActiveTarget()?.id).toBe('m6-warehouse-ball');
    expect(s2.interactions.interact()).toBe(true);
    while (s2.dialogue.isActive()) s2.dialogue.advance();
    expect(s2.mm.getActiveObjective()?.id).toBe('m6-start-match');
  });
});
