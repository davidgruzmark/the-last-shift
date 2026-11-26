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
