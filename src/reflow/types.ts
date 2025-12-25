/**
 * TypeScript type definitions for Production Schedule Reflow System
 * Following the exact structure from BE-technical-test.md
 */

/**
 * Base document structure
 * All documents follow this pattern
 */
export interface BaseDocument {
  docId: string;
  docType: string;
  data: any;
}

/**
 * Shift configuration for a work center
 * Defines when work can happen on specific days
 */
export interface Shift {
  dayOfWeek: number; // 0-6, Sunday = 0
  startHour: number; // 0-23
  endHour: number; // 0-23
}

/**
 * Maintenance window - blocked time period for a work center
 * No work can be scheduled during these times
 */
export interface MaintenanceWindow {
  startDate: string; // ISO 8601 format
  endDate: string; // ISO 8601 format
  reason?: string; // Optional description
}

/**
 * Work Center document
 * Represents a manufacturing line or station
 */
export interface WorkCenterDocument extends BaseDocument {
  docType: 'workCenter';
  data: {
    name: string;
    shifts: Shift[];
    maintenanceWindows: MaintenanceWindow[];
  };
}

/**
 * Work Order document
 * Represents a production task to be scheduled
 */
export interface WorkOrderDocument extends BaseDocument {
  docType: 'workOrder';
  data: {
    workOrderNumber: string;
    manufacturingOrderId: string;
    workCenterId: string;

    // Timing
    startDate: string; // ISO 8601 format
    endDate: string; // ISO 8601 format
    durationMinutes: number; // Total working time required

    // Constraints
    isMaintenance: boolean; // Cannot be rescheduled if true

    // Dependencies - all parents must complete before this starts
    dependsOnWorkOrderIds: string[];
  };
}

/**
 * Manufacturing Order document
 * Represents the overall order that contains work orders
 */
export interface ManufacturingOrderDocument extends BaseDocument {
  docType: 'manufacturingOrder';
  data: {
    manufacturingOrderNumber: string;
    itemId: string;
    quantity: number;
    dueDate: string; // ISO 8601 format
  };
}

/**
 * Input for the reflow algorithm
 */
export interface ReflowInput {
  workOrders: WorkOrderDocument[];
  workCenters: WorkCenterDocument[];
  manufacturingOrders: ManufacturingOrderDocument[];
}

/**
 * Description of a change made to a work order
 */
export interface WorkOrderChange {
  workOrderId: string;
  workOrderNumber: string;
  field: 'startDate' | 'endDate';
  oldValue: string;
  newValue: string;
  delayMinutes: number; // How much this order was delayed
  reason: string; // Human-readable explanation
}

/**
 * Result of the reflow algorithm
 */
export interface ReflowResult {
  updatedWorkOrders: WorkOrderDocument[];
  changes: WorkOrderChange[];
  explanation: string;
  isValid: boolean; // Whether the schedule is valid
  violations?: string[]; // List of constraint violations if any
}

/**
 * Constraint violation found during validation
 */
export interface ConstraintViolation {
  type: 'WORK_CENTER_OVERLAP' | 'DEPENDENCY_NOT_MET' | 'OUTSIDE_SHIFT' | 'DURING_MAINTENANCE';
  workOrderId: string;
  message: string;
  details?: any;
}
