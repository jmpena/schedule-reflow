/**
 * Directed Acyclic Graph (DAG) implementation for managing work order dependencies
 *
 * This class provides:
 * - Topological sort: Orders work orders in a valid execution sequence
 * - Cycle detection: Identifies circular dependencies (impossible to schedule)
 * - Dependency validation: Checks if all dependencies can be satisfied
 */

import { WorkOrderDocument } from './types';

export class DependencyGraph {
  private adjacencyList: Map<string, Set<string>>; // workOrderId -> Set of dependent workOrderIds
  private inDegree: Map<string, number>; // workOrderId -> number of parents
  private workOrders: Map<string, WorkOrderDocument>;

  constructor(workOrders: WorkOrderDocument[]) {
    this.adjacencyList = new Map();
    this.inDegree = new Map();
    this.workOrders = new Map();

    // Build the graph
    this.buildGraph(workOrders);
  }

  /**
   * Build the dependency graph from work orders
   */
  private buildGraph(workOrders: WorkOrderDocument[]): void {
    // Initialize all nodes
    for (const workOrder of workOrders) {
      const id = workOrder.docId;
      this.workOrders.set(id, workOrder);
      this.adjacencyList.set(id, new Set());
      this.inDegree.set(id, 0);
    }

    // Build edges based on dependencies
    for (const workOrder of workOrders) {
      const childId = workOrder.docId;
      const parentIds = workOrder.data.dependsOnWorkOrderIds || [];

      // Set in-degree (number of parents)
      this.inDegree.set(childId, parentIds.length);

      // Add edges from parents to this child
      for (const parentId of parentIds) {
        if (!this.adjacencyList.has(parentId)) {
          throw new Error(
            `Work order ${childId} depends on ${parentId}, but ${parentId} does not exist`
          );
        }
        this.adjacencyList.get(parentId)!.add(childId);
      }
    }
  }

  /**
   * Detect if there are any cycles in the dependency graph
   * Returns true if cycles exist (circular dependencies)
   */
  public hasCycles(): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = this.adjacencyList.get(nodeId) || new Set();
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          if (dfs(neighborId)) {
            return true;
          }
        } else if (recursionStack.has(neighborId)) {
          // Back edge found - cycle detected
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const nodeId of this.workOrders.keys()) {
      if (!visited.has(nodeId)) {
        if (dfs(nodeId)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get the cycle path if one exists
   * Returns the work order IDs forming the cycle, or null if no cycle
   */
  public getCycle(): string[] | null {
    const visited = new Set<string>();
    const recursionStack: string[] = [];
    const parent = new Map<string, string>();

    const dfs = (nodeId: string): string[] | null => {
      visited.add(nodeId);
      recursionStack.push(nodeId);

      const neighbors = this.adjacencyList.get(nodeId) || new Set();
      for (const neighborId of neighbors) {
        if (!visited.has(neighborId)) {
          parent.set(neighborId, nodeId);
          const cycle = dfs(neighborId);
          if (cycle) return cycle;
        } else if (recursionStack.includes(neighborId)) {
          // Cycle found - build the cycle path
          const cycleStart = recursionStack.indexOf(neighborId);
          return recursionStack.slice(cycleStart);
        }
      }

      recursionStack.pop();
      return null;
    };

    for (const nodeId of this.workOrders.keys()) {
      if (!visited.has(nodeId)) {
        const cycle = dfs(nodeId);
        if (cycle) return cycle;
      }
    }

    return null;
  }

  /**
   * Perform topological sort using Kahn's algorithm
   * Returns work orders in an order where all dependencies come before dependents
   * Throws error if cycle exists
   */
  public topologicalSort(): WorkOrderDocument[] {
    if (this.hasCycles()) {
      const cycle = this.getCycle();
      throw new Error(
        `Circular dependency detected: ${cycle?.join(' → ')}. Cannot create valid schedule.`
      );
    }

    const result: WorkOrderDocument[] = [];
    const queue: string[] = [];
    const inDegreeClone = new Map(this.inDegree);

    // Start with nodes that have no dependencies
    for (const [nodeId, degree] of inDegreeClone.entries()) {
      if (degree === 0) {
        queue.push(nodeId);
      }
    }

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const workOrder = this.workOrders.get(nodeId)!;
      result.push(workOrder);

      // Reduce in-degree for all children
      const children = this.adjacencyList.get(nodeId) || new Set();
      for (const childId of children) {
        const newDegree = inDegreeClone.get(childId)! - 1;
        inDegreeClone.set(childId, newDegree);

        if (newDegree === 0) {
          queue.push(childId);
        }
      }
    }

    // If we didn't process all nodes, there's a cycle
    if (result.length !== this.workOrders.size) {
      throw new Error('Cycle detected in dependency graph');
    }

    return result;
  }

  /**
   * Get all parent work orders for a given work order
   */
  public getParents(workOrderId: string): WorkOrderDocument[] {
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) {
      throw new Error(`Work order ${workOrderId} not found`);
    }

    const parentIds = workOrder.data.dependsOnWorkOrderIds || [];
    return parentIds
      .map((id) => this.workOrders.get(id))
      .filter((wo): wo is WorkOrderDocument => wo !== undefined);
  }

  /**
   * Get all children work orders for a given work order
   */
  public getChildren(workOrderId: string): WorkOrderDocument[] {
    const childIds = this.adjacencyList.get(workOrderId) || new Set();
    return Array.from(childIds)
      .map((id) => this.workOrders.get(id))
      .filter((wo): wo is WorkOrderDocument => wo !== undefined);
  }

  /**
   * Check if a work order can start given a set of completed work orders
   */
  public canStart(workOrderId: string, completedWorkOrderIds: Set<string>): boolean {
    const parents = this.getParents(workOrderId);
    return parents.every((parent) => completedWorkOrderIds.has(parent.docId));
  }
}
