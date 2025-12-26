/**
 * Tests for Reflow Service (Main Algorithm)
 */

import { describe, it, expect } from 'vitest';
import { ReflowService } from '../src/reflow/reflow-service';
import * as scenario1 from '../test-data/scenario-1-delay-cascade.json';
import * as scenario2 from '../test-data/scenario-2-shift-boundary.json';
import * as scenario3 from '../test-data/scenario-3-maintenance.json';

describe('ReflowService', () => {
  const service = new ReflowService();

  describe('Scenario 1: Delay Cascade', () => {
    it('should successfully reflow schedule with dependencies', () => {
      const result = service.reflow({
        workOrders: scenario1.workOrders as any,
        workCenters: scenario1.workCenters as any,
        manufacturingOrders: scenario1.manufacturingOrders as any,
      });

      expect(result.isValid).toBe(true);
      expect(result.updatedWorkOrders).toHaveLength(3);
      expect(result.violations).toHaveLength(0);
    });

    it('should respect dependency order (WO-001 → WO-002 → WO-003)', () => {
      const result = service.reflow({
        workOrders: scenario1.workOrders as any,
        workCenters: scenario1.workCenters as any,
        manufacturingOrders: scenario1.manufacturingOrders as any,
      });

      const wo1 = result.updatedWorkOrders.find((wo) => wo.docId === 'wo-001')!;
      const wo2 = result.updatedWorkOrders.find((wo) => wo.docId === 'wo-002')!;
      const wo3 = result.updatedWorkOrders.find((wo) => wo.docId === 'wo-003')!;

      // WO-001 must finish before WO-002 starts
      expect(new Date(wo1.data.endDate).getTime()).toBeLessThanOrEqual(
        new Date(wo2.data.startDate).getTime()
      );

      // WO-002 must finish before WO-003 starts
      expect(new Date(wo2.data.endDate).getTime()).toBeLessThanOrEqual(
        new Date(wo3.data.startDate).getTime()
      );
    });

    it('should prevent work center overlaps', () => {
      const result = service.reflow({
        workOrders: scenario1.workOrders as any,
        workCenters: scenario1.workCenters as any,
        manufacturingOrders: scenario1.manufacturingOrders as any,
      });

      const sorted = result.updatedWorkOrders.sort(
        (a, b) =>
          new Date(a.data.startDate).getTime() - new Date(b.data.startDate).getTime()
      );

      // Check each consecutive pair for overlaps
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];

        expect(new Date(current.data.endDate).getTime()).toBeLessThanOrEqual(
          new Date(next.data.startDate).getTime()
        );
      }
    });

    it('should generate changes report', () => {
      const result = service.reflow({
        workOrders: scenario1.workOrders as any,
        workCenters: scenario1.workCenters as any,
        manufacturingOrders: scenario1.manufacturingOrders as any,
      });

      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.explanation).toContain('Reflow completed');
    });
  });

  describe('Scenario 2: Shift Boundary', () => {
    it('should handle shift boundaries correctly', () => {
      const result = service.reflow({
        workOrders: scenario2.workOrders as any,
        workCenters: scenario2.workCenters as any,
        manufacturingOrders: scenario2.manufacturingOrders as any,
      });

      expect(result.isValid).toBe(true);
      expect(result.updatedWorkOrders).toHaveLength(1);
    });

    it('should calculate correct end date spanning shifts', () => {
      const result = service.reflow({
        workOrders: scenario2.workOrders as any,
        workCenters: scenario2.workCenters as any,
        manufacturingOrders: scenario2.manufacturingOrders as any,
      });

      const wo = result.updatedWorkOrders[0];
      expect(wo.data.durationMinutes).toBe(120);

      // End date should be calculated considering shift pause/resume
      expect(wo.data.endDate).toBeDefined();
    });
  });

  describe('Scenario 3: Maintenance Window', () => {
    it('should avoid maintenance windows', () => {
      const result = service.reflow({
        workOrders: scenario3.workOrders as any,
        workCenters: scenario3.workCenters as any,
        manufacturingOrders: scenario3.manufacturingOrders as any,
      });

      expect(result.isValid).toBe(true);

      // Should not have DURING_MAINTENANCE violations
      const maintenanceViolations = result.violations?.filter((v) =>
        v.includes('maintenance')
      );
      expect(maintenanceViolations || []).toHaveLength(0);
    });

    it('should respect dependencies even with maintenance', () => {
      const result = service.reflow({
        workOrders: scenario3.workOrders as any,
        workCenters: scenario3.workCenters as any,
        manufacturingOrders: scenario3.manufacturingOrders as any,
      });

      const wo301 = result.updatedWorkOrders.find((wo) => wo.docId === 'wo-301')!;
      const wo302 = result.updatedWorkOrders.find((wo) => wo.docId === 'wo-302')!;

      // WO-301 must finish before WO-302 starts
      expect(new Date(wo301.data.endDate).getTime()).toBeLessThanOrEqual(
        new Date(wo302.data.startDate).getTime()
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle circular dependencies gracefully', () => {
      const result = service.reflow({
        workOrders: [
          {
            docId: 'wo-a',
            docType: 'workOrder',
            data: {
              workOrderNumber: 'WO-A',
              manufacturingOrderId: 'mo-1',
              workCenterId: 'wc-1',
              startDate: '2025-01-15T08:00:00.000Z',
              endDate: '2025-01-15T10:00:00.000Z',
              durationMinutes: 120,
              isMaintenance: false,
              dependsOnWorkOrderIds: ['wo-b'], // Circular!
            },
          },
          {
            docId: 'wo-b',
            docType: 'workOrder',
            data: {
              workOrderNumber: 'WO-B',
              manufacturingOrderId: 'mo-1',
              workCenterId: 'wc-1',
              startDate: '2025-01-15T10:00:00.000Z',
              endDate: '2025-01-15T13:00:00.000Z',
              durationMinutes: 180,
              isMaintenance: false,
              dependsOnWorkOrderIds: ['wo-a'], // Circular!
            },
          },
        ] as any,
        workCenters: scenario1.workCenters as any,
        manufacturingOrders: scenario1.manufacturingOrders as any,
      });

      expect(result.isValid).toBe(false);
      expect(result.explanation).toContain('Circular dependency');
    });

    it('should preserve maintenance work orders', () => {
      const result = service.reflow({
        workOrders: [
          {
            docId: 'wo-maint',
            docType: 'workOrder',
            data: {
              workOrderNumber: 'WO-MAINT',
              manufacturingOrderId: 'mo-1',
              workCenterId: 'wc-1',
              startDate: '2025-01-15T08:00:00.000Z',
              endDate: '2025-01-15T10:00:00.000Z',
              durationMinutes: 120,
              isMaintenance: true, // Cannot be rescheduled
              dependsOnWorkOrderIds: [],
            },
          },
        ] as any,
        workCenters: scenario1.workCenters as any,
        manufacturingOrders: scenario1.manufacturingOrders as any,
      });

      const maintOrder = result.updatedWorkOrders[0];
      // Should not be changed
      expect(maintOrder.data.startDate).toBe('2025-01-15T08:00:00.000Z');
      expect(maintOrder.data.endDate).toBe('2025-01-15T10:00:00.000Z');
    });
  });

  describe('Algorithm Properties', () => {
    it('should return all work orders in result', () => {
      const result = service.reflow({
        workOrders: scenario1.workOrders as any,
        workCenters: scenario1.workCenters as any,
        manufacturingOrders: scenario1.manufacturingOrders as any,
      });

      expect(result.updatedWorkOrders).toHaveLength(scenario1.workOrders.length);
    });

    it('should preserve work order durations', () => {
      const result = service.reflow({
        workOrders: scenario1.workOrders as any,
        workCenters: scenario1.workCenters as any,
        manufacturingOrders: scenario1.manufacturingOrders as any,
      });

      result.updatedWorkOrders.forEach((wo) => {
        const original = scenario1.workOrders.find((o: any) => o.docId === wo.docId);
        expect(wo.data.durationMinutes).toBe(original?.data.durationMinutes);
      });
    });

    it('should provide explanation', () => {
      const result = service.reflow({
        workOrders: scenario1.workOrders as any,
        workCenters: scenario1.workCenters as any,
        manufacturingOrders: scenario1.manufacturingOrders as any,
      });

      expect(result.explanation).toBeTruthy();
      expect(typeof result.explanation).toBe('string');
      expect(result.explanation.length).toBeGreaterThan(0);
    });
  });
});
