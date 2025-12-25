/**
 * Production Schedule Reflow Service
 *
 * Main algorithm for rescheduling work orders when disruptions occur.
 *
 * Algorithm approach:
 * 1. Build dependency graph (DAG) and detect cycles
 * 2. Topological sort to get valid ordering
 * 3. Schedule each work order in dependency order:
 *    - Wait for all parent dependencies to complete
 *    - Find earliest available time on work center
 *    - Calculate end date considering shifts and maintenance
 * 4. Validate final schedule
 * 5. Generate change report
 */

import {
  ReflowInput,
  ReflowResult,
  WorkOrderDocument,
  WorkOrderChange,
  WorkCenterDocument,
} from './types';
import { DependencyGraph } from './dependency-graph';
import { ConstraintChecker } from './constraint-checker';
import { DateUtils } from '../utils/date-utils';
import { DateTime } from 'luxon';

export class ReflowService {
  /**
   * Execute the reflow algorithm
   *
   * Takes current work orders and reschedules them to respect all constraints
   */
  public reflow(input: ReflowInput): ReflowResult {
    try {
      // Step 1: Build dependency graph
      const dag = new DependencyGraph(input.workOrders);

      // Check for circular dependencies
      if (dag.hasCycles()) {
        const cycle = dag.getCycle();
        return {
          updatedWorkOrders: [],
          changes: [],
          explanation: `Cannot create valid schedule: Circular dependency detected (${cycle?.join(' → ')})`,
          isValid: false,
          violations: [`Circular dependency: ${cycle?.join(' → ')}`],
        };
      }

      // Step 2: Get work orders in dependency order (topological sort)
      const orderedWorkOrders = dag.topologicalSort();

      // Step 3: Create work center map for lookup
      const workCenterMap = new Map(input.workCenters.map((wc) => [wc.docId, wc]));

      // Step 4: Track work center availability (when each work center becomes free)
      const workCenterAvailability = new Map<string, string>();

      // Initialize with earliest possible time (now or first shift)
      for (const wc of input.workCenters) {
        const now = DateTime.utc().toISO()!;
        const nextShift = DateUtils.findNextShiftStart(now, wc.data.shifts);
        workCenterAvailability.set(wc.docId, nextShift);
      }

      // Step 5: Schedule each work order
      const updatedWorkOrders: WorkOrderDocument[] = [];
      const changes: WorkOrderChange[] = [];

      for (const workOrder of orderedWorkOrders) {
        // Skip maintenance work orders (cannot be rescheduled)
        if (workOrder.data.isMaintenance) {
          updatedWorkOrders.push(workOrder);
          continue;
        }

        const workCenter = workCenterMap.get(workOrder.data.workCenterId);
        if (!workCenter) {
          throw new Error(`Work center ${workOrder.data.workCenterId} not found`);
        }

        // Get parent dependencies
        const parents = dag.getParents(workOrder.docId);
        const parentEndTimes = parents.map((p) => {
          // Find the updated version of the parent
          const updated = updatedWorkOrders.find((wo) => wo.docId === p.docId);
          return updated ? updated.data.endDate : p.data.endDate;
        });

        // Add a default early time if no parents
        if (parentEndTimes.length === 0) {
          parentEndTimes.push('1970-01-01T00:00:00.000Z');
        }

        // Get work center availability
        const wcAvailable = workCenterAvailability.get(workCenter.docId) || DateTime.utc().toISO()!;

        // Calculate earliest start time
        const newStartDate = DateUtils.getEarliestStartTime(
          parentEndTimes,
          wcAvailable,
          workCenter.data.shifts
        );

        // Calculate end date considering shifts and maintenance
        const newEndDate = DateUtils.calculateEndDate(
          newStartDate,
          workOrder.data.durationMinutes,
          workCenter.data.shifts,
          workCenter.data.maintenanceWindows
        );

        // Update work center availability
        workCenterAvailability.set(workCenter.docId, newEndDate);

        // Create updated work order
        const updatedWorkOrder: WorkOrderDocument = {
          ...workOrder,
          data: {
            ...workOrder.data,
            startDate: newStartDate,
            endDate: newEndDate,
          },
        };

        updatedWorkOrders.push(updatedWorkOrder);

        // Track changes
        if (
          workOrder.data.startDate !== newStartDate ||
          workOrder.data.endDate !== newEndDate
        ) {
          const oldStart = DateTime.fromISO(workOrder.data.startDate);
          const newStart = DateTime.fromISO(newStartDate);
          const delayMinutes = newStart.diff(oldStart, 'minutes').minutes;

          changes.push({
            workOrderId: workOrder.docId,
            workOrderNumber: workOrder.data.workOrderNumber,
            field: 'startDate',
            oldValue: workOrder.data.startDate,
            newValue: newStartDate,
            delayMinutes,
            reason: this.getChangeReason(workOrder, parents, wcAvailable),
          });

          changes.push({
            workOrderId: workOrder.docId,
            workOrderNumber: workOrder.data.workOrderNumber,
            field: 'endDate',
            oldValue: workOrder.data.endDate,
            newValue: newEndDate,
            delayMinutes,
            reason: this.getChangeReason(workOrder, parents, wcAvailable),
          });
        }
      }

      // Step 6: Validate the final schedule
      const violations = ConstraintChecker.validate(updatedWorkOrders, input.workCenters);
      const isValid = violations.length === 0;

      // Step 7: Generate explanation
      const explanation = this.generateExplanation(
        input.workOrders.length,
        changes.length / 2, // Divide by 2 since we track start and end separately
        isValid,
        violations
      );

      return {
        updatedWorkOrders,
        changes,
        explanation,
        isValid,
        violations: violations.map((v) => v.message),
      };
    } catch (error) {
      return {
        updatedWorkOrders: [],
        changes: [],
        explanation: `Reflow failed: ${error instanceof Error ? error.message : String(error)}`,
        isValid: false,
        violations: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Generate human-readable reason for why a work order was rescheduled
   */
  private getChangeReason(
    workOrder: WorkOrderDocument,
    parents: WorkOrderDocument[],
    wcAvailable: string
  ): string {
    const reasons: string[] = [];

    if (parents.length > 0) {
      const parentNumbers = parents.map((p) => p.data.workOrderNumber).join(', ');
      reasons.push(`waiting for dependencies: ${parentNumbers}`);
    }

    const wcTime = DateTime.fromISO(wcAvailable);
    const now = DateTime.utc();
    if (wcTime > now) {
      reasons.push('work center occupied');
    }

    return reasons.length > 0 ? reasons.join('; ') : 'optimizing schedule';
  }

  /**
   * Generate summary explanation of the reflow
   */
  private generateExplanation(
    totalOrders: number,
    changedOrders: number,
    isValid: boolean,
    violations: any[]
  ): string {
    let explanation = `Reflow completed: ${totalOrders} work orders processed.\n`;
    explanation += `${changedOrders} work orders rescheduled.\n`;

    if (isValid) {
      explanation += `✓ Schedule is valid - all constraints satisfied.\n`;
    } else {
      explanation += `✗ Schedule has ${violations.length} constraint violations.\n`;
      violations.slice(0, 5).forEach((v) => {
        explanation += `  - ${v.message}\n`;
      });
      if (violations.length > 5) {
        explanation += `  ... and ${violations.length - 5} more violations\n`;
      }
    }

    return explanation;
  }
}
