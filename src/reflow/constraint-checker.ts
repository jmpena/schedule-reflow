/**
 * Constraint validation for work order schedules
 *
 * Validates that a schedule respects all hard constraints:
 * 1. Work Center: Only one order at a time (no overlaps)
 * 2. Dependencies: All parent orders must complete before child starts
 * 3. Shifts: Work only happens during shift hours
 * 4. Maintenance: No work during maintenance windows
 */

import {
  WorkOrderDocument,
  WorkCenterDocument,
  ConstraintViolation,
} from './types';
import { DateUtils } from '../utils/date-utils';
import { DependencyGraph } from './dependency-graph';

export class ConstraintChecker {
  /**
   * Validate a complete schedule against all constraints
   * Returns array of violations (empty if valid)
   */
  public static validate(
    workOrders: WorkOrderDocument[],
    workCenters: WorkCenterDocument[]
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // Create lookup maps for efficiency
    const workCenterMap = new Map(workCenters.map((wc) => [wc.docId, wc]));

    // 1. Check work center conflicts (no overlaps)
    violations.push(...this.checkWorkCenterConflicts(workOrders, workCenterMap));

    // 2. Check dependency constraints
    violations.push(...this.checkDependencies(workOrders));

    // 3. Check shift boundaries
    violations.push(...this.checkShiftBoundaries(workOrders, workCenterMap));

    // 4. Check maintenance windows
    violations.push(...this.checkMaintenanceConflicts(workOrders, workCenterMap));

    return violations;
  }

  /**
   * Check for overlapping work orders on the same work center
   * Rule: Only one order at a time per work center
   */
  private static checkWorkCenterConflicts(
    workOrders: WorkOrderDocument[],
    workCenterMap: Map<string, WorkCenterDocument>
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    // Group work orders by work center
    const byWorkCenter = new Map<string, WorkOrderDocument[]>();

    for (const wo of workOrders) {
      const wcId = wo.data.workCenterId;
      if (!byWorkCenter.has(wcId)) {
        byWorkCenter.set(wcId, []);
      }
      byWorkCenter.get(wcId)!.push(wo);
    }

    // Check each work center for overlaps
    for (const [wcId, orders] of byWorkCenter.entries()) {
      const workCenter = workCenterMap.get(wcId);

      // Sort by start date for easier overlap detection
      const sorted = orders.sort(
        (a, b) =>
          new Date(a.data.startDate).getTime() - new Date(b.data.startDate).getTime()
      );

      // Check consecutive orders for overlap
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];

        if (
          DateUtils.timePeriodsOverlap(
            current.data.startDate,
            current.data.endDate,
            next.data.startDate,
            next.data.endDate
          )
        ) {
          violations.push({
            type: 'WORK_CENTER_OVERLAP',
            workOrderId: next.docId,
            message: `Work order ${next.data.workOrderNumber} overlaps with ${current.data.workOrderNumber} on work center ${workCenter?.data.name || wcId}`,
            details: {
              conflictsWith: current.docId,
              workCenterId: wcId,
              overlap: {
                order1: {
                  id: current.docId,
                  number: current.data.workOrderNumber,
                  start: current.data.startDate,
                  end: current.data.endDate,
                },
                order2: {
                  id: next.docId,
                  number: next.data.workOrderNumber,
                  start: next.data.startDate,
                  end: next.data.endDate,
                },
              },
            },
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check that all parent dependencies complete before child starts
   * Rule: ALL parents must complete before child can start
   */
  private static checkDependencies(workOrders: WorkOrderDocument[]): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];
    const dag = new DependencyGraph(workOrders);

    // Create map for quick lookup
    const woMap = new Map(workOrders.map((wo) => [wo.docId, wo]));

    for (const workOrder of workOrders) {
      const parents = dag.getParents(workOrder.docId);
      const childStart = new Date(workOrder.data.startDate);

      for (const parent of parents) {
        const parentEnd = new Date(parent.data.endDate);

        if (parentEnd > childStart) {
          violations.push({
            type: 'DEPENDENCY_NOT_MET',
            workOrderId: workOrder.docId,
            message: `Work order ${workOrder.data.workOrderNumber} starts before its dependency ${parent.data.workOrderNumber} completes`,
            details: {
              parentId: parent.docId,
              parentNumber: parent.data.workOrderNumber,
              parentEnd: parent.data.endDate,
              childStart: workOrder.data.startDate,
              violationMinutes: (parentEnd.getTime() - childStart.getTime()) / 60000,
            },
          });
        }
      }
    }

    return violations;
  }

  /**
   * Check that work only happens during valid shift hours
   * Rule: Work pauses outside shifts, resumes in next shift
   */
  private static checkShiftBoundaries(
    workOrders: WorkOrderDocument[],
    workCenterMap: Map<string, WorkCenterDocument>
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const workOrder of workOrders) {
      const workCenter = workCenterMap.get(workOrder.data.workCenterId);
      if (!workCenter) continue;

      const shifts = workCenter.data.shifts;

      // Check start date
      if (!DateUtils.isDuringShift(workOrder.data.startDate, shifts)) {
        violations.push({
          type: 'OUTSIDE_SHIFT',
          workOrderId: workOrder.docId,
          message: `Work order ${workOrder.data.workOrderNumber} starts outside shift hours`,
          details: {
            startDate: workOrder.data.startDate,
            workCenterId: workCenter.docId,
            shifts,
          },
        });
      }

      // Check end date
      if (!DateUtils.isDuringShift(workOrder.data.endDate, shifts)) {
        violations.push({
          type: 'OUTSIDE_SHIFT',
          workOrderId: workOrder.docId,
          message: `Work order ${workOrder.data.workOrderNumber} ends outside shift hours`,
          details: {
            endDate: workOrder.data.endDate,
            workCenterId: workCenter.docId,
            shifts,
          },
        });
      }
    }

    return violations;
  }

  /**
   * Check that no work happens during maintenance windows
   * Rule: Maintenance windows block all work
   */
  private static checkMaintenanceConflicts(
    workOrders: WorkOrderDocument[],
    workCenterMap: Map<string, WorkCenterDocument>
  ): ConstraintViolation[] {
    const violations: ConstraintViolation[] = [];

    for (const workOrder of workOrders) {
      const workCenter = workCenterMap.get(workOrder.data.workCenterId);
      if (!workCenter) continue;

      const maintenanceWindows = workCenter.data.maintenanceWindows || [];

      if (
        DateUtils.overlapsMaintenance(
          workOrder.data.startDate,
          workOrder.data.endDate,
          maintenanceWindows
        )
      ) {
        violations.push({
          type: 'DURING_MAINTENANCE',
          workOrderId: workOrder.docId,
          message: `Work order ${workOrder.data.workOrderNumber} is scheduled during maintenance window`,
          details: {
            workOrderStart: workOrder.data.startDate,
            workOrderEnd: workOrder.data.endDate,
            maintenanceWindows,
          },
        });
      }
    }

    return violations;
  }

  /**
   * Quick check if a schedule is valid (no violations)
   */
  public static isValid(
    workOrders: WorkOrderDocument[],
    workCenters: WorkCenterDocument[]
  ): boolean {
    const violations = this.validate(workOrders, workCenters);
    return violations.length === 0;
  }
}
