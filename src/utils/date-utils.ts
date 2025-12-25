/**
 * Date utilities for handling shift boundaries and working time calculations
 *
 * Key concepts:
 * - Work pauses outside shift hours and resumes in the next shift
 * - Shifts are defined per day of week (0-6, Sunday = 0)
 * - Maintenance windows block all work during their duration
 *
 * Example: 120-min work order starts Mon 4PM, shift ends 5PM (Mon-Fri 8AM-5PM)
 * → Works 60 min Monday (4PM-5PM)
 * → Pauses overnight
 * → Resumes Tue 8AM
 * → Completes at Tue 9AM
 */

import { DateTime } from 'luxon';
import { Shift, MaintenanceWindow } from '../reflow/types';

export class DateUtils {
  /**
   * Calculate end date for a work order given its start date, duration, and shifts
   * This is the trickiest part of the algorithm!
   *
   * @param startDate - When the work order starts
   * @param durationMinutes - Total working minutes required
   * @param shifts - Available shifts for the work center
   * @param maintenanceWindows - Blocked time periods
   * @returns The end date when the work completes
   */
  public static calculateEndDate(
    startDate: string,
    durationMinutes: number,
    shifts: Shift[],
    maintenanceWindows: MaintenanceWindow[] = []
  ): string {
    let currentDate = DateTime.fromISO(startDate, { zone: 'utc' });
    let remainingMinutes = durationMinutes;

    // Safety limit to prevent infinite loops
    const maxDays = 365;
    let daysProcessed = 0;

    while (remainingMinutes > 0 && daysProcessed < maxDays) {
      daysProcessed++;

      // Check if current day has a shift
      const shift = this.getShiftForDay(currentDate.weekday, shifts);

      if (!shift) {
        // No shift today, move to next day at midnight
        currentDate = currentDate.plus({ days: 1 }).startOf('day');
        continue;
      }

      // Calculate shift boundaries for today
      const shiftStart = currentDate.set({
        hour: shift.startHour,
        minute: 0,
        second: 0,
        millisecond: 0,
      });

      const shiftEnd = currentDate.set({
        hour: shift.endHour,
        minute: 0,
        second: 0,
        millisecond: 0,
      });

      // Determine when work actually starts (either currentDate or shift start, whichever is later)
      let workStart = currentDate > shiftStart ? currentDate : shiftStart;

      // If we're already past shift end, move to next day
      if (workStart >= shiftEnd) {
        currentDate = currentDate.plus({ days: 1 }).startOf('day');
        continue;
      }

      // Check for maintenance windows during this shift
      const effectiveShiftEnd = this.getEffectiveShiftEnd(
        workStart,
        shiftEnd,
        maintenanceWindows
      );

      // Calculate available minutes in this shift segment
      const availableMinutes = effectiveShiftEnd.diff(workStart, 'minutes').minutes;

      if (availableMinutes <= 0) {
        // Maintenance blocks entire remaining shift
        currentDate = currentDate.plus({ days: 1 }).startOf('day');
        continue;
      }

      // Work during this shift segment
      const minutesToWork = Math.min(remainingMinutes, availableMinutes);
      remainingMinutes -= minutesToWork;

      if (remainingMinutes > 0) {
        // Still have work remaining, move to next day
        currentDate = currentDate.plus({ days: 1 }).startOf('day');
      } else {
        // Work completed!
        currentDate = workStart.plus({ minutes: minutesToWork });
      }
    }

    if (daysProcessed >= maxDays) {
      throw new Error(
        `Could not schedule work order within ${maxDays} days. Check shifts and maintenance windows.`
      );
    }

    return currentDate.toISO()!;
  }

  /**
   * Get the shift configuration for a specific day of week
   * Sunday = 0, Monday = 1, ..., Saturday = 6 (Luxon uses Monday = 1)
   */
  private static getShiftForDay(luxonWeekday: number, shifts: Shift[]): Shift | null {
    // Convert Luxon weekday (1-7, Monday = 1) to JavaScript weekday (0-6, Sunday = 0)
    const jsWeekday = luxonWeekday === 7 ? 0 : luxonWeekday;

    return shifts.find((shift) => shift.dayOfWeek === jsWeekday) || null;
  }

  /**
   * Get the effective shift end, accounting for maintenance windows
   * If maintenance starts during the shift, work must stop early
   */
  private static getEffectiveShiftEnd(
    shiftStart: DateTime,
    shiftEnd: DateTime,
    maintenanceWindows: MaintenanceWindow[]
  ): DateTime {
    let effectiveEnd = shiftEnd;

    for (const window of maintenanceWindows) {
      const maintenanceStart = DateTime.fromISO(window.startDate, { zone: 'utc' });
      const maintenanceEnd = DateTime.fromISO(window.endDate, { zone: 'utc' });

      // Check if maintenance overlaps with this shift
      if (maintenanceStart < shiftEnd && maintenanceEnd > shiftStart) {
        // Maintenance overlaps - find earliest conflict
        if (maintenanceStart > shiftStart && maintenanceStart < effectiveEnd) {
          effectiveEnd = maintenanceStart;
        }
      }
    }

    return effectiveEnd;
  }

  /**
   * Check if a time period overlaps with any maintenance window
   */
  public static overlapsMaintenance(
    startDate: string,
    endDate: string,
    maintenanceWindows: MaintenanceWindow[]
  ): boolean {
    const start = DateTime.fromISO(startDate, { zone: 'utc' });
    const end = DateTime.fromISO(endDate, { zone: 'utc' });

    for (const window of maintenanceWindows) {
      const maintenanceStart = DateTime.fromISO(window.startDate, { zone: 'utc' });
      const maintenanceEnd = DateTime.fromISO(window.endDate, { zone: 'utc' });

      // Check if time periods overlap
      if (start < maintenanceEnd && end > maintenanceStart) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if work is happening during valid shift hours
   */
  public static isDuringShift(
    date: string,
    shifts: Shift[]
  ): boolean {
    const dt = DateTime.fromISO(date, { zone: 'utc' });
    const shift = this.getShiftForDay(dt.weekday, shifts);

    if (!shift) return false;

    const hour = dt.hour;
    return hour >= shift.startHour && hour < shift.endHour;
  }

  /**
   * Check if two time periods overlap
   */
  public static timePeriodsOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const s1 = DateTime.fromISO(start1, { zone: 'utc' });
    const e1 = DateTime.fromISO(end1, { zone: 'utc' });
    const s2 = DateTime.fromISO(start2, { zone: 'utc' });
    const e2 = DateTime.fromISO(end2, { zone: 'utc' });

    return s1 < e2 && e1 > s2;
  }

  /**
   * Find the next available shift start time from a given date
   */
  public static findNextShiftStart(
    fromDate: string,
    shifts: Shift[]
  ): string {
    let currentDate = DateTime.fromISO(fromDate, { zone: 'utc' });

    // Look ahead up to 30 days
    for (let i = 0; i < 30; i++) {
      const shift = this.getShiftForDay(currentDate.weekday, shifts);

      if (shift) {
        const shiftStart = currentDate.set({
          hour: shift.startHour,
          minute: 0,
          second: 0,
          millisecond: 0,
        });

        if (shiftStart > currentDate) {
          return shiftStart.toISO()!;
        }
      }

      currentDate = currentDate.plus({ days: 1 }).startOf('day');
    }

    throw new Error('No shift found in the next 30 days');
  }

  /**
   * Get the earliest time a work order can start, considering:
   * - Parent dependencies (all must be complete)
   * - Work center availability
   * - Shift schedule
   */
  public static getEarliestStartTime(
    parentEndTimes: string[],
    workCenterAvailableFrom: string,
    shifts: Shift[]
  ): string {
    // Start after all dependencies complete
    const latestParentEnd = parentEndTimes.reduce((latest, current) => {
      const currentDt = DateTime.fromISO(current, { zone: 'utc' });
      const latestDt = DateTime.fromISO(latest, { zone: 'utc' });
      return currentDt > latestDt ? current : latest;
    }, '1970-01-01T00:00:00.000Z');

    // Also consider work center availability
    const wcAvailable = DateTime.fromISO(workCenterAvailableFrom, { zone: 'utc' });
    const parentsDone = DateTime.fromISO(latestParentEnd, { zone: 'utc' });

    const earliestPossible = wcAvailable > parentsDone ? wcAvailable : parentsDone;

    // Find next shift that starts at or after earliest possible time
    const shift = this.getShiftForDay(earliestPossible.weekday, shifts);

    if (!shift) {
      // No shift today, find next shift start
      return this.findNextShiftStart(earliestPossible.toISO()!, shifts);
    }

    const shiftStart = earliestPossible.set({
      hour: shift.startHour,
      minute: 0,
      second: 0,
      millisecond: 0,
    });

    const shiftEnd = earliestPossible.set({
      hour: shift.endHour,
      minute: 0,
      second: 0,
      millisecond: 0,
    });

    // If earliest possible is before shift start, use shift start
    if (earliestPossible < shiftStart) {
      return shiftStart.toISO()!;
    }

    // If earliest possible is during shift, use it
    if (earliestPossible < shiftEnd) {
      return earliestPossible.toISO()!;
    }

    // Otherwise, find next shift
    return this.findNextShiftStart(earliestPossible.toISO()!, shifts);
  }
}
