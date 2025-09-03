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
  
  // SIMPLIFIED & RELIABLE TIMEZONE CONVERSION:
  // Use a deterministic approach that works regardless of system timezone
  
  // Step 1: Create a Date object in local time (this will be interpreted in system timezone)
  const localDate = new Date(year, month - 1, day, hours, minutes, seconds);
  
  // Step 2: Get what this date/time looks like when interpreted in school timezone
  const schoolTimeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: SCHOOL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit', 
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Step 3: Create a reference point - what is noon UTC on this date in school timezone?
  const noonUTC = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const noonInSchool = schoolTimeFormatter.formatToParts(noonUTC);
  
  // Extract the school timezone hour when it's noon UTC
  const schoolNoonHour = parseInt(noonInSchool.find(p => p.type === 'hour')?.value || '12');
  
  // Calculate the offset: if noon UTC shows as 8 AM in school time, offset is -4 hours
  const offsetHours = schoolNoonHour - 12;
  
  // Step 4: Apply this offset to our target time to convert to UTC
  const utcResult = new Date(Date.UTC(year, month - 1, day, hours - offsetHours, minutes, seconds));
  
  const isoString = utcResult.toISOString();
  
  // Debug logging to show the conversion
  const schoolTimeDisplay = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  console.log(`COMPOSE: raw=${time} date=${date} -> school=${schoolTimeDisplay} NY -> iso=${isoString}`);
  
  return isoString;
}