/**
 * Tests for Constraint Checker
 */

import { describe, it, expect } from 'vitest';
import { ConstraintChecker } from '../src/reflow/constraint-checker';
import { WorkOrderDocument, WorkCenterDocument } from '../src/reflow/types';

describe('ConstraintChecker', () => {
  const workCenter: WorkCenterDocument = {
    docId: 'wc-1',
    docType: 'workCenter',
    data: {
      name: 'Test Line',
      shifts: [
        { dayOfWeek: 1, startHour: 8, endHour: 17 },
        { dayOfWeek: 2, startHour: 8, endHour: 17 },
        { dayOfWeek: 3, startHour: 8, endHour: 17 },
        { dayOfWeek: 4, startHour: 8, endHour: 17 },
        { dayOfWeek: 5, startHour: 8, endHour: 17 },
      ],
      maintenanceWindows: [],
    },
  };

  describe('Work Center Overlap Detection', () => {
    it('should detect overlapping work orders', () => {
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
            startDate: '2025-01-15T09:00:00.000Z', // Overlaps with WO-001!
            endDate: '2025-01-15T11:00:00.000Z',
            durationMinutes: 120,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
      ];

      const violations = ConstraintChecker.validate(workOrders, [workCenter]);

      const overlapViolations = violations.filter(
        (v) => v.type === 'WORK_CENTER_OVERLAP'
      );
      expect(overlapViolations.length).toBeGreaterThan(0);
    });

    it('should not detect overlaps for non-overlapping orders', () => {
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
            startDate: '2025-01-15T10:00:00.000Z', // Starts when WO-001 ends
            endDate: '2025-01-15T13:00:00.000Z',
            durationMinutes: 180,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
      ];

      const violations = ConstraintChecker.validate(workOrders, [workCenter]);

      const overlapViolations = violations.filter(
        (v) => v.type === 'WORK_CENTER_OVERLAP'
      );
      expect(overlapViolations).toHaveLength(0);
    });
  });

  describe('Dependency Validation', () => {
    it('should detect when child starts before parent ends', () => {
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
            startDate: '2025-01-15T09:00:00.000Z', // Starts before parent ends!
            endDate: '2025-01-15T11:00:00.000Z',
            durationMinutes: 120,
            isMaintenance: false,
            dependsOnWorkOrderIds: ['wo-1'],
          },
        },
      ];

      const violations = ConstraintChecker.validate(workOrders, [workCenter]);

      const depViolations = violations.filter((v) => v.type === 'DEPENDENCY_NOT_MET');
      expect(depViolations.length).toBeGreaterThan(0);
    });

    it('should pass when dependencies are satisfied', () => {
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
            startDate: '2025-01-15T10:00:00.000Z', // Starts after parent ends
            endDate: '2025-01-15T13:00:00.000Z',
            durationMinutes: 180,
            isMaintenance: false,
            dependsOnWorkOrderIds: ['wo-1'],
          },
        },
      ];

      const violations = ConstraintChecker.validate(workOrders, [workCenter]);

      const depViolations = violations.filter((v) => v.type === 'DEPENDENCY_NOT_MET');
      expect(depViolations).toHaveLength(0);
    });
  });

  describe('Maintenance Window Validation', () => {
    it('should detect work during maintenance', () => {
      const wcWithMaintenance: WorkCenterDocument = {
        ...workCenter,
        data: {
          ...workCenter.data,
          maintenanceWindows: [
            {
              startDate: '2025-01-15T10:00:00.000Z',
              endDate: '2025-01-15T12:00:00.000Z',
              reason: 'Scheduled maintenance',
            },
          ],
        },
      };

      const workOrders: WorkOrderDocument[] = [
        {
          docId: 'wo-1',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-001',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T09:00:00.000Z',
            endDate: '2025-01-15T11:00:00.000Z', // Overlaps with maintenance!
            durationMinutes: 120,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
      ];

      const violations = ConstraintChecker.validate(workOrders, [wcWithMaintenance]);

      const maintViolations = violations.filter(
        (v) => v.type === 'DURING_MAINTENANCE'
      );
      expect(maintViolations.length).toBeGreaterThan(0);
    });

    it('should pass when work avoids maintenance', () => {
      const wcWithMaintenance: WorkCenterDocument = {
        ...workCenter,
        data: {
          ...workCenter.data,
          maintenanceWindows: [
            {
              startDate: '2025-01-15T10:00:00.000Z',
              endDate: '2025-01-15T12:00:00.000Z',
              reason: 'Scheduled maintenance',
            },
          ],
        },
      };

      const workOrders: WorkOrderDocument[] = [
        {
          docId: 'wo-1',
          docType: 'workOrder',
          data: {
            workOrderNumber: 'WO-001',
            manufacturingOrderId: 'mo-1',
            workCenterId: 'wc-1',
            startDate: '2025-01-15T08:00:00.000Z',
            endDate: '2025-01-15T10:00:00.000Z', // Ends before maintenance
            durationMinutes: 120,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
      ];

      const violations = ConstraintChecker.validate(workOrders, [wcWithMaintenance]);

      const maintViolations = violations.filter(
        (v) => v.type === 'DURING_MAINTENANCE'
      );
      expect(maintViolations).toHaveLength(0);
    });
  });

  describe('isValid helper', () => {
    it('should return true for valid schedule', () => {
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

      const isValid = ConstraintChecker.isValid(workOrders, [workCenter]);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid schedule', () => {
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
            startDate: '2025-01-15T09:00:00.000Z', // Overlaps!
            endDate: '2025-01-15T11:00:00.000Z',
            durationMinutes: 120,
            isMaintenance: false,
            dependsOnWorkOrderIds: [],
          },
        },
      ];

      const isValid = ConstraintChecker.isValid(workOrders, [workCenter]);
      expect(isValid).toBe(false);
    });
  });
});
