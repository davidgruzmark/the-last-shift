import * as THREE from 'three';
import type { SurfaceFloorTag } from './CollisionManager';

export type NavNodeKind =
  | 'floor'
  | 'door'
  | 'stair_entry'
  | 'stair_mid'
  | 'stair_exit'
  | 'escalator'
  | 'chair_approach'
  | 'chair_seat';

export type NavEdgeKind = 'walk' | 'stair' | 'escalator' | 'door';

export interface NavNode {
  readonly id: string;
  readonly position: THREE.Vector3;
  readonly floor: SurfaceFloorTag;
  readonly kind: NavNodeKind;
  readonly doorId?: string;
}

export interface NavEdge {
  readonly from: string;
  readonly to: string;
  readonly kind: NavEdgeKind;
  readonly directed?: boolean;
  readonly requiresAuth?: boolean;
  readonly costMultiplier?: number;
}

export interface NavPathOptions {
  authorizedForControlRoom?: boolean;
  startFloorHint?: SurfaceFloorTag;
  goalFloorHint?: SurfaceFloorTag;
}

/**
 * Multi-floor waypoint navigation graph supporting directed escalators,
 * bidirectional stairs, authorization-gated Control Room doors, and fast A* routing.
 */
export class NavGraph {
  private readonly nodes = new Map<string, NavNode>();
  private readonly adjacency = new Map<string, NavEdge[]>();

  addNode(node: NavNode): void {
    this.nodes.set(node.id, {
      ...node,
      position: node.position.clone(),
    });
    if (!this.adjacency.has(node.id)) {
      this.adjacency.set(node.id, []);
    }
  }

  addEdge(edge: NavEdge): void {
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) {
      throw new Error(`NavGraph.addEdge: missing node (${edge.from} -> ${edge.to})`);
    }
    this.adjacency.get(edge.from)!.push(edge);
    if (!edge.directed) {
      this.adjacency.get(edge.to)!.push({
        from: edge.to,
        to: edge.from,
        kind: edge.kind,
        directed: true,
        requiresAuth: edge.requiresAuth,
        costMultiplier: edge.costMultiplier,
      });
    }
  }

  getNode(id: string): NavNode | undefined {
    return this.nodes.get(id);
  }

  getNodes(): readonly NavNode[] {
    return Array.from(this.nodes.values());
  }

  clear(): void {
    this.nodes.clear();
    this.adjacency.clear();
  }

  findNearestNode(pos: THREE.Vector3, floorHint?: SurfaceFloorTag): NavNode | null {
    let best: NavNode | null = null;
    let bestScore = Infinity;

    for (const node of this.nodes.values()) {
      const dist3d = pos.distanceTo(node.position);
      const floorPenalty =
        floorHint && node.floor !== floorHint && node.floor !== 'transition' ? 12 : 0;
      const yPenalty = Math.abs(pos.y - node.position.y) * 2.5;
      const score = dist3d + floorPenalty + yPenalty;
      if (score < bestScore) {
        bestScore = score;
        best = node;
      }
    }
    return best;
  }

  /**
   * Computes a multi-floor A* path between two world positions or node IDs.
   * Respects directed escalators and authorization-gated doors.
   */
  findPath(
    start: string | THREE.Vector3,
    goal: string | THREE.Vector3,
    options: NavPathOptions = {},
  ): NavNode[] {
    const startNode =
      typeof start === 'string'
        ? this.nodes.get(start) ?? null
        : this.findNearestNode(start, options.startFloorHint);
    const goalNode =
      typeof goal === 'string'
        ? this.nodes.get(goal) ?? null
        : this.findNearestNode(goal, options.goalFloorHint);

    if (!startNode || !goalNode) return [];
    if (startNode.id === goalNode.id) return [startNode];

    const authorized = options.authorizedForControlRoom ?? false;
    const openSet = new Set<string>([startNode.id]);
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>([[startNode.id, 0]]);
    const fScore = new Map<string, number>([
      [startNode.id, this.heuristic(startNode, goalNode)],
    ]);

    while (openSet.size > 0) {
      let currentId = '';
      let lowestF = Infinity;
      for (const id of openSet) {
        const f = fScore.get(id) ?? Infinity;
        if (f < lowestF) {
          lowestF = f;
          currentId = id;
        }
      }

      if (!currentId) break;
      if (currentId === goalNode.id) {
        const path: NavNode[] = [];
        let trace: string | undefined = currentId;
        while (trace) {
          const n = this.nodes.get(trace);
          if (n) path.unshift(n);
          trace = cameFrom.get(trace);
        }
        return path;
      }

      openSet.delete(currentId);
      const currentNode = this.nodes.get(currentId)!;
      const edges = this.adjacency.get(currentId) ?? [];

      for (const edge of edges) {
        if (edge.requiresAuth && !authorized) continue;
        const neighbor = this.nodes.get(edge.to);
        if (!neighbor) continue;

        const baseDist = currentNode.position.distanceTo(neighbor.position);
        const stepCost = Math.max(0.1, baseDist) * (edge.costMultiplier ?? 1);
        const tentativeG = (gScore.get(currentId) ?? Infinity) + stepCost;

        if (tentativeG < (gScore.get(neighbor.id) ?? Infinity)) {
          cameFrom.set(neighbor.id, currentId);
          gScore.set(neighbor.id, tentativeG);
          fScore.set(neighbor.id, tentativeG + this.heuristic(neighbor, goalNode));
          openSet.add(neighbor.id);
        }
      }
    }

    return [];
  }

  private heuristic(a: NavNode, b: NavNode): number {
    const floorBonus = a.floor !== b.floor ? 2.0 : 0;
    return a.position.distanceTo(b.position) + floorBonus;
  }
}

/**
 * Builds the main two-floor store navigation graph connecting F1 Market Hall,
 * Up/Down Escalators (directed), Wide Staircase (bidirectional), F2 Showroom, and Restaurant.
 */
export function createStoreNavGraph(): NavGraph {
  const g = new NavGraph();
  g.addNode({ id: 'f1-ctrl-exit', position: new THREE.Vector3(9.2, 0, 3.6), floor: 1, kind: 'floor' });
  g.addNode({ id: 'f1-market-center', position: new THREE.Vector3(17.5, 0, 4.0), floor: 1, kind: 'floor' });
  g.addNode({ id: 'f1-esc-up-bottom', position: new THREE.Vector3(21.6, 0, 12.6), floor: 1, kind: 'escalator' });
  g.addNode({ id: 'f1-esc-down-bottom', position: new THREE.Vector3(24.4, 0, 12.6), floor: 1, kind: 'escalator' });
  g.addNode({ id: 'f1-stairs-bottom', position: new THREE.Vector3(27.9, 0, 12.6), floor: 1, kind: 'stair_entry' });
  g.addNode({ id: 'stairs-mid', position: new THREE.Vector3(27.9, 2.9, 7.0), floor: 'transition', kind: 'stair_mid' });
  g.addNode({ id: 'f2-esc-up-top', position: new THREE.Vector3(21.6, 5.8, 1.4), floor: 2, kind: 'escalator' });
  g.addNode({ id: 'f2-esc-down-top', position: new THREE.Vector3(24.4, 5.8, 1.4), floor: 2, kind: 'escalator' });
  g.addNode({ id: 'f2-stairs-top', position: new THREE.Vector3(27.9, 5.8, 1.4), floor: 2, kind: 'stair_exit' });
  g.addNode({ id: 'f2-living', position: new THREE.Vector3(14.0, 5.8, 6.0), floor: 2, kind: 'floor' });
  g.addNode({ id: 'f2-kitchens', position: new THREE.Vector3(36.5, 5.8, 10.5), floor: 2, kind: 'floor' });
  g.addNode({ id: 'f2-restaurant', position: new THREE.Vector3(36.8, 5.8, -5.5), floor: 2, kind: 'floor' });

  g.addEdge({ from: 'f1-ctrl-exit', to: 'f1-market-center', kind: 'walk' });
  g.addEdge({ from: 'f1-market-center', to: 'f1-esc-up-bottom', kind: 'walk' });
  g.addEdge({ from: 'f1-esc-up-bottom', to: 'f1-esc-down-bottom', kind: 'walk' });
  g.addEdge({ from: 'f1-esc-down-bottom', to: 'f1-stairs-bottom', kind: 'walk' });

  // Directed escalators + bidirectional wide stairs
  g.addEdge({ from: 'f1-esc-up-bottom', to: 'f2-esc-up-top', kind: 'escalator', directed: true });
  g.addEdge({ from: 'f2-esc-down-top', to: 'f1-esc-down-bottom', kind: 'escalator', directed: true });
  g.addEdge({ from: 'f1-stairs-bottom', to: 'stairs-mid', kind: 'stair' });
  g.addEdge({ from: 'stairs-mid', to: 'f2-stairs-top', kind: 'stair' });

  g.addEdge({ from: 'f2-esc-up-top', to: 'f2-esc-down-top', kind: 'walk' });
  g.addEdge({ from: 'f2-esc-down-top', to: 'f2-stairs-top', kind: 'walk' });
  g.addEdge({ from: 'f2-esc-up-top', to: 'f2-living', kind: 'walk' });
  g.addEdge({ from: 'f2-stairs-top', to: 'f2-restaurant', kind: 'walk' });
  g.addEdge({ from: 'f2-restaurant', to: 'f2-kitchens', kind: 'walk' });
  return g;
}
