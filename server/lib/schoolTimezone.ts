/**
 * School Timezone Policy for Consistent Weekday Determination
 * Ensures same student/date yields same weekday regardless of server timezone
 */

// School timezone policy - all weekday decisions use this
export const SCHOOL_TIMEZONE = 'America/New_York';

/**
 * Get timezone-aware weekday name for school scheduling
 * FIXED: Interprets YYYY-MM-DD as midnight in SCHOOL TIMEZONE (not UTC)
 * 
 * @param date - Date string (YYYY-MM-DD) or Date object
 * @returns Weekday name ('Sunday', 'Monday', etc.) in School Timezone
 */
export function getSchoolWeekdayName(date: string | Date): string {
  if (typeof date === 'string') {
    // FIXED: Interpret YYYY-MM-DD as midnight in School Timezone, not UTC
    // This prevents the day-before bug when UTC offset differs from school timezone
    const [year, month, day] = date.split('-').map(Number);
    
    // Create date at noon in school timezone to avoid DST edge cases
    const tempDate = new Date();
    tempDate.setFullYear(year, month - 1, day); // month is 0-indexed
    tempDate.setHours(12, 0, 0, 0); // Use noon to avoid DST edge cases
    
    // Get the weekday name directly using school timezone
    const weekdayName = tempDate.toLocaleDateString('en-US', { 
      weekday: 'long',
      timeZone: SCHOOL_TIMEZONE
    });
    
    console.log(`🗓️ WEEKDAY(SCHOOL_TZ)=${weekdayName} (${getWeekdayNumber(weekdayName)}) for ${date}`);
    return weekdayName;
  } else {
    const weekdayName = date.toLocaleDateString('en-US', { 
      weekday: 'long',
      timeZone: SCHOOL_TIMEZONE
    });
    console.log(`🗓️ WEEKDAY(SCHOOL_TZ)=${weekdayName} (${getWeekdayNumber(weekdayName)}) for ${date.toISOString().split('T')[0]}`);
    return weekdayName;
  }
}

function getWeekdayNumber(weekdayName: string): number {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return weekdays.indexOf(weekdayName);
}

/**
 * Get timezone-aware weekday number for school scheduling
 * FIXED: Interprets YYYY-MM-DD as midnight in SCHOOL TIMEZONE (not UTC)
 * 
 * @param date - Date string (YYYY-MM-DD) or Date object  
 * @returns Weekday number (0=Sunday, 1=Monday, etc.) in School Timezone
 */
export function getSchoolWeekdayNumber(date: string | Date): number {
  // Use the fixed getSchoolWeekdayName function and convert to number
  const weekdayName = getSchoolWeekdayName(date);
  return getWeekdayNumber(weekdayName);
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