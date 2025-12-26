/**
 * Tests for Dependency Graph (DAG) implementation
 */

import { describe, it, expect } from 'vitest';
import { DependencyGraph } from '../src/reflow/dependency-graph';
import { WorkOrderDocument } from '../src/reflow/types';

describe('DependencyGraph', () => {
  describe('Basic Graph Construction', () => {
    it('should build graph from work orders', () => {
      const workOrders: WorkOrderDocument[] = [
        {
          docId: 'wo-1',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-001',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T08:00:00.000Z',
            endDate: '2025-01-15T10:00:00.000Z',
            durationMinutes: 120,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
      ];

      const dag = new DependencyGraph(workOrders);
      expect(dag).toBeDefined();
    });

    it('should handle work orders with dependencies', () => {
      const workOrders: WorkOrderDocument[] = [
        {
          docId: 'wo-1',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-001',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T08:00:00.000Z',
            endDate: '2025-01-15T10:00:00.000Z',
            durationMinutes: 120,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
        {
          docId: 'wo-2',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-002',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T10:00:00.000Z',
            endDate: '2025-01-15T13:00:00.000Z',
            durationMinutes: 180,
            isMaintenance: false,
            dependsOnWorkOrderIds: ['wo-1'],
          },
        },
      ];

      const dag = new DependencyGraph(workOrders);
      const parents = dag.getParents('wo-2');
      expect(parents).toHaveLength(1);
      expect(parents[0].docId).toBe('wo-1');
    });
  });

  describe('Cycle Detection', () => {
    it('should detect no cycles in valid DAG', () => {
      const workOrders: WorkOrderDocument[] = [
        {
          docId: 'wo-1',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-001',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T08:00:00.000Z',
            endDate: '2025-01-15T10:00:00.000Z',
            durationMinutes: 120,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
        {
          docId: 'wo-2',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-002',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T10:00:00.000Z',
            endDate: '2025-01-15T13:00:00.000Z',
            durationMinutes: 180,
            isMaintenance: false,
            dependsOnWorkOrderIds: ['wo-1'],
          },
        },
      ];

      const dag = new DependencyGraph(workOrders);
      expect(dag.hasCycles()).toBe(false);
    });

    it('should detect cycles in invalid DAG', () => {
      const workOrders: WorkOrderDocument[] = [
        {
          docId: 'wo-1',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-001',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T08:00:00.000Z',
            endDate: '2025-01-15T10:00:00.000Z',
            durationMinutes: 120,
            isMaintenance: false,
            dependsOnWorkOrderIds: ['wo-2'], // Circular!
          },
        },
        {
          docId: 'wo-2',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-002',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T10:00:00.000Z',
            endDate: '2025-01-15T13:00:00.000Z',
            durationMinutes: 180,
            isMaintenance: false,
            dependsOnWorkOrderIds: ['wo-1'], // Circular!
          },
        },
      ];

      const dag = new DependencyGraph(workOrders);
      expect(dag.hasCycles()).toBe(true);
    });
  });

  describe('Topological Sort', () => {
    it('should return work orders in dependency order', () => {
      const workOrders: WorkOrderDocument[] = [
        {
          docId: 'wo-3',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-003',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T13:00:00.000Z',
            endDate: '2025-01-15T16:00:00.000Z',
            durationMinutes: 180,
            isMaintenance: false,
            dependsOnWorkOrderIds: ['wo-2'],
          },
        },
        {
          docId: 'wo-1',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-001',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T08:00:00.000Z',
            endDate: '2025-01-15T10:00:00.000Z',
            durationMinutes: 120,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
        {
          docId: 'wo-2',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-002',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T10:00:00.000Z',
            endDate: '2025-01-15T13:00:00.000Z',
            durationMinutes: 180,
            isMaintenance: false,
            dependsOnWorkOrderIds: ['wo-1'],
          },
        },
      ];

      const dag = new DependencyGraph(workOrders);
      const sorted = dag.topologicalSort();

      expect(sorted).toHaveLength(3);
      expect(sorted[0].docId).toBe('wo-1');
      expect(sorted[1].docId).toBe('wo-2');
      expect(sorted[2].docId).toBe('wo-3');
    });

    it('should throw error for cyclic dependencies', () => {
      const workOrders: WorkOrderDocument[] = [
        {
          docId: 'wo-1',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-001',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T08:00:00.000Z',
            endDate: '2025-01-15T10:00:00.000Z',
            durationMinutes: 120,
            isMaintenance: false,
            dependsOnWorkOrderIds: ['wo-2'],
          },
        },
        {
          docId: 'wo-2',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-002',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T10:00:00.000Z',
            endDate: '2025-01-15T13:00:00.000Z',
            durationMinutes: 180,
            isMaintenance: false,
            dependsOnWorkOrderIds: ['wo-1'],
          },
        },
      ];

      const dag = new DependencyGraph(workOrders);
      expect(() => dag.topologicalSort()).toThrow(/circular dependency/i);
    });
  });

  describe('canStart', () => {
    it('should return true if all parents are completed', () => {
      const workOrders: WorkOrderDocument[] = [
        {
          docId: 'wo-1',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-001',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T08:00:00.000Z',
            endDate: '2025-01-15T10:00:00.000Z',
            durationMinutes: 120,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
        {
          docId: 'wo-2',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-002',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T10:00:00.000Z',
            endDate: '2025-01-15T13:00:00.000Z',
            durationMinutes: 180,
            isMaintenance: false,
            dependsOnWorkOrderIds: ['wo-1'],
          },
        },
      ];

      const dag = new DependencyGraph(workOrders);
      const completed = new Set(['wo-1']);

      expect(dag.canStart('wo-2', completed)).toBe(true);
    });

    it('should return false if parents not completed', () => {
      const workOrders: WorkOrderDocument[] = [
        {
          docId: 'wo-1',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-001',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T08:00:00.000Z',
            endDate: '2025-01-15T10:00:00.000Z',
            durationMinutes: 120,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
        {
          docId: 'wo-2',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-002',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T10:00:00.000Z',
            endDate: '2025-01-15T13:00:00.000Z',
            durationMinutes: 180,
            isMaintenance: false,
            dependsOnWorkOrderIds: ['wo-1'],
          },
        },
      ];

      const dag = new DependencyGraph(workOrders);
      const completed = new Set<string>(); // Empty - wo-1 not complete

      expect(dag.canStart('wo-2', completed)).toBe(false);
    });
  });
});
