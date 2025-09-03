/**
 * School Timezone Policy for Consistent Weekday Determination
 * Ensures same student/date yields same weekday regardless of server timezone
 */

// School timezone policy - all weekday decisions use this
export const SCHOOL_TIMEZONE = 'America/New_York';

/**
 * Get timezone-aware weekday name for school scheduling
 * Uses School Timezone policy to ensure consistent weekday determination
 * 
 * @param date - Date string (YYYY-MM-DD) or Date object
 * @returns Weekday name ('Sunday', 'Monday', etc.) in School Timezone
 */
export function getSchoolWeekdayName(date: string | Date): string {
  let dateObj: Date;
  
  if (typeof date === 'string') {
    // UTC hardening: Parse date-only as UTC to avoid local timezone shifts
    dateObj = new Date(date + 'T00:00:00.000Z');
  } else {
    dateObj = date;
  }
  
  // Get weekday name in school timezone (not server local time or raw UTC)
  return dateObj.toLocaleDateString('en-US', { 
    weekday: 'long',
    timeZone: SCHOOL_TIMEZONE
  });
}

/**
 * Get timezone-aware weekday number for school scheduling
 * Uses School Timezone policy to ensure consistent weekday determination
 * 
 * @param date - Date string (YYYY-MM-DD) or Date object  
 * @returns Weekday number (0=Sunday, 1=Monday, etc.) in School Timezone
 */
export function getSchoolWeekdayNumber(date: string | Date): number {
  let dateObj: Date;
  
  if (typeof date === 'string') {
    // UTC hardening: Parse date-only as UTC to avoid local timezone shifts
    dateObj = new Date(date + 'T00:00:00.000Z');
  } else {
    dateObj = date;
  }
  
  // Get weekday in school timezone, then extract day number
  const weekdayName = dateObj.toLocaleDateString('en-US', { 
    weekday: 'long',
    timeZone: SCHOOL_TIMEZONE
  });
  
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return weekdays.indexOf(weekdayName);
}

/**
 * Check if date is weekend in school timezone
 * 
 * @param date - Date string (YYYY-MM-DD) or Date object
 * @returns true if Saturday or Sunday in School Timezone
 */
export function isSchoolWeekend(date: string | Date): boolean {
  const weekdayNum = getSchoolWeekdayNumber(date);
  return weekdayNum === 0 || weekdayNum === 6; // Sunday or Saturday
}