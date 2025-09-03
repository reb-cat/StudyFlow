/**
 * Date utilities for StudyFlow - all dates use America/New_York timezone
 * UNIFIED TODAY CALCULATION - Always use School Timezone, never UTC for "today"
 */

export const TIMEZONE = 'America/New_York';

/**
 * Get current date in School Timezone (America/New_York) as YYYY-MM-DD string
 * This is the CANONICAL "today" function - use this everywhere instead of UTC-based calculations
 */
export function getTodayString(): string {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: TIMEZONE }); // en-CA gives YYYY-MM-DD format
}

/**
 * Convert any Date object to YYYY-MM-DD string in School Timezone
 * This replaces toISOString().split('T')[0] which uses UTC
 */
export function toSchoolDateString(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

/**
 * Get current date object in America/New_York timezone
 */
export function getToday(): Date {
  const now = new Date();
  const nyString = now.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  return new Date(nyString + 'T12:00:00.000Z'); // Noon UTC for consistent date handling
}

/**
 * Convert date string to Date object for consistent timezone handling
 */
export function parseDateString(dateString: string): Date {
  return new Date(dateString + 'T12:00:00.000Z'); // Noon UTC avoids timezone issues
}

/**
 * Format date for display in America/New_York timezone
 */
export function formatDateDisplay(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseDateString(date) : date;
  return dateObj.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    timeZone: TIMEZONE
  });
}

/**
 * Format date for short display in America/New_York timezone
 */
export function formatDateShort(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseDateString(date) : date;
  return dateObj.toLocaleDateString('en-US', { 
    timeZone: TIMEZONE
  });
}

/**
 * Get day name for date in America/New_York timezone
 */
export function getDayName(date: Date | string): string {
  const dateObj = typeof date === 'string' ? parseDateString(date) : date;
  return dateObj.toLocaleDateString('en-US', { 
    weekday: 'long',
    timeZone: TIMEZONE
  });
}

/**
 * Add days to a date string and return new date string in School Timezone
 */
export function addDays(dateString: string, days: number): string {
  const date = parseDateString(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return toSchoolDateString(date);
}

/**
 * Check if a date string is today in America/New_York timezone
 */
export function isToday(dateString: string): boolean {
  return dateString === getTodayString();
}

/**
 * Get ISO timestamp for current time
 */
export function getCurrentTimestamp(): string {
  return new Date().toISOString();
}