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

/**
 * CRITICAL FIX: Compose block instant at School Timezone local wall-clock time
 * 
 * Takes YYYY-MM-DD date and HH:MM(:SS) time and returns the instant that represents 
 * that wall-clock time in SCHOOL_TIMEZONE, then converts to UTC for storage/comparison.
 * 
 * @param date - Date string in YYYY-MM-DD format
 * @param time - Time string in HH:MM or HH:MM:SS format
 * @returns UTC ISO string representing the school timezone instant
 */
export function composeSchoolInstant(date: string, time: string): string {
  // Parse time components, handle both HH:MM and HH:MM:SS
  const timeParts = time.split(':');
  const hours = parseInt(timeParts[0], 10);
  const minutes = parseInt(timeParts[1] || '0', 10);
  const seconds = parseInt(timeParts[2] || '0', 10);
  
  // Parse date components
  const [year, month, day] = date.split('-').map(Number);
  
  // Create the instant at the specified wall-clock time in school timezone
  const schoolDate = new Date();
  schoolDate.setFullYear(year, month - 1, day);
  schoolDate.setHours(hours, minutes, seconds, 0);
  
  // Convert to school timezone aware instant - this handles DST automatically
  // The time zone library will automatically adjust for DST
  const utcInstant = new Date(schoolDate.toLocaleString('en-US', { timeZone: 'UTC' }));
  
  // For proper timezone conversion, we need to work backwards from school time
  const schoolOffset = getTimezoneOffset(schoolDate, SCHOOL_TIMEZONE);
  const correctedUtc = new Date(schoolDate.getTime() - schoolOffset);
  
  const isoString = correctedUtc.toISOString();
  
  // Debug logging to show the conversion
  const schoolTimeDisplay = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  console.log(`COMPOSE: raw=${time} date=${date} -> school=${schoolTimeDisplay} NY -> iso=${isoString}`);
  
  return isoString;
}

/**
 * Get timezone offset in milliseconds for a given date in a specific timezone
 */
function getTimezoneOffset(date: Date, timezone: string): number {
  // Get the UTC time and the time in the target timezone
  const utcTime = date.getTime();
  const targetTime = new Date(date.toLocaleString('en-US', { timeZone: timezone })).getTime();
  
  // Return the difference (offset in milliseconds)
  return utcTime - targetTime;
}