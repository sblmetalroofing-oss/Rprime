import { format, parseISO, isValid } from 'date-fns';

/**
 * Centralized date formatting utilities for consistent date display across the app.
 * 
 * Standard formats:
 * - Long: "3 February 2026" - For documents, formal display
 * - Short: "03 Feb 2026" - For lists, tables, compact display
 * - DateTime: "03 Feb 2026, 2:30 PM" - For timestamps with time
 * - Time: "2:30 PM" - For time-only display
 * - Input: "2026-02-03" - For HTML date inputs (yyyy-MM-dd)
 */

/**
 * Safely parse a date string to a Date object.
 * Handles timezone issues by treating yyyy-MM-dd as local date, not UTC.
 */
export function parseDate(dateStr: string | Date | null | undefined): Date | null {
  if (!dateStr) return null;
  
  if (dateStr instanceof Date) {
    return isValid(dateStr) ? dateStr : null;
  }
  
  // For yyyy-MM-dd format, parse as local date to avoid timezone shifts
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return isValid(date) ? date : null;
  }
  
  // For ISO strings or other formats, use parseISO
  try {
    const date = parseISO(dateStr);
    return isValid(date) ? date : null;
  } catch {
    return null;
  }
}

/**
 * Format date for documents and formal display.
 * Example: "3 February 2026"
 */
export function formatDateLong(dateStr: string | Date | null | undefined): string {
  const date = parseDate(dateStr);
  if (!date) return '-';
  return format(date, 'd MMMM yyyy');
}

/**
 * Format date for lists, tables, and compact display.
 * Example: "03 Feb 2026"
 */
export function formatDateShort(dateStr: string | Date | null | undefined): string {
  const date = parseDate(dateStr);
  if (!date) return '-';
  return format(date, 'dd MMM yyyy');
}

/**
 * Format date with time for timestamps.
 * Example: "03 Feb 2026, 2:30 PM"
 */
export function formatDateTime(dateStr: string | Date | null | undefined): string {
  const date = parseDate(dateStr);
  if (!date) return '-';
  return format(date, 'dd MMM yyyy, h:mm a');
}

/**
 * Format time only.
 * Example: "2:30 PM"
 */
export function formatTime(dateStr: string | Date | null | undefined): string {
  const date = parseDate(dateStr);
  if (!date) return '-';
  return format(date, 'h:mm a');
}

/**
 * Format time in 24-hour format.
 * Example: "14:30"
 */
export function formatTime24(dateStr: string | Date | null | undefined): string {
  const date = parseDate(dateStr);
  if (!date) return '-';
  return format(date, 'HH:mm');
}

/**
 * Format date for HTML date inputs (yyyy-MM-dd).
 * Example: "2026-02-03"
 */
export function formatDateInput(dateStr: string | Date | null | undefined): string {
  const date = parseDate(dateStr);
  if (!date) return '';
  return format(date, 'yyyy-MM-dd');
}

/**
 * Format date with day of week for dashboards.
 * Example: "Monday, February 3"
 */
export function formatDateWithDay(dateStr: string | Date | null | undefined): string {
  const date = parseDate(dateStr);
  if (!date) return '-';
  return format(date, 'EEEE, MMMM d');
}

/**
 * Get today's date formatted for inputs.
 * Example: "2026-02-03"
 */
export function getTodayInput(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Get a future date formatted for inputs.
 * Example: getFutureDateInput(7) returns date 7 days from now
 */
export function getFutureDateInput(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return format(date, 'yyyy-MM-dd');
}

/**
 * Format relative time for chat/notifications.
 * Example: "2:30 PM" for today, "Yesterday 2:30 PM", "Feb 3, 2:30 PM"
 */
export function formatRelativeDateTime(dateStr: string | Date | null | undefined): string {
  const date = parseDate(dateStr);
  if (!date) return '-';
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (dateOnly.getTime() === today.getTime()) {
    return format(date, 'h:mm a');
  }
  if (dateOnly.getTime() === yesterday.getTime()) {
    return 'Yesterday ' + format(date, 'h:mm a');
  }
  return format(date, 'MMM d, h:mm a');
}
