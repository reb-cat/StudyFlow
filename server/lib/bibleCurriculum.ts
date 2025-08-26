import { db } from '../db';
import { bibleCurriculum } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';

/**
 * Bible Curriculum Integration System
 * Replaces generic 'Bible' schedule entries with specific daily readings and memory verses
 * Based on 52-week curriculum progression tied to school year
 */

// School year configuration - adjust as needed
const SCHOOL_YEAR_START_DATE = new Date('2025-08-14'); // Typical school start date

/**
 * Calculate which week of the curriculum we're currently in
 * @param targetDate - The date to calculate the week for (defaults to today)
 * @returns Week number (1-52) or null if outside school year
 */
export function getCurrentCurriculumWeek(targetDate: Date = new Date()): number | null {
  const startDate = new Date(SCHOOL_YEAR_START_DATE);
  const diffTime = targetDate.getTime() - startDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  // Calculate week number (1-based)
  const weekNumber = Math.floor(diffDays / 7) + 1;
  
  // Ensure we're within the 52-week curriculum
  if (weekNumber < 1 || weekNumber > 52) {
    return null;
  }
  
  return weekNumber;
}

/**
 * Get day of week as number (1 = Monday, 5 = Friday)
 * @param date - The date to get day of week for
 * @returns Day number 1-5, or null if weekend
 */
export function getSchoolDayOfWeek(date: Date): number | null {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Convert to school days (1 = Monday through 5 = Friday)
  if (dayOfWeek >= 1 && dayOfWeek <= 5) {
    return dayOfWeek; // Monday = 1, Tuesday = 2, ..., Friday = 5
  }
  
  return null; // Weekend
}

/**
 * Get Bible curriculum content for a specific week and day
 * @param weekNumber - Curriculum week (1-52)
 * @param dayOfWeek - School day (1-5, Monday-Friday)
 * @returns Daily reading and memory verse for the week
 */
export async function getBibleCurriculumForDay(
  weekNumber: number, 
  dayOfWeek: number
): Promise<{
  dailyReading: any | null;
  memoryVerse: any | null;
}> {
  try {
    // Get the daily reading for this specific day
    const [dailyReading] = await db
      .select()
      .from(bibleCurriculum)
      .where(
        and(
          eq(bibleCurriculum.weekNumber, weekNumber),
          eq(bibleCurriculum.dayOfWeek, dayOfWeek),
          eq(bibleCurriculum.readingType, 'daily_reading')
        )
      )
      .limit(1);

    // Get the memory verse for this week (memory verses are weekly, not daily)
    const [memoryVerse] = await db
      .select()
      .from(bibleCurriculum)
      .where(
        and(
          eq(bibleCurriculum.weekNumber, weekNumber),
          eq(bibleCurriculum.readingType, 'memory_verse')
        )
      )
      .limit(1);

    return {
      dailyReading: dailyReading || null,
      memoryVerse: memoryVerse || null
    };
  } catch (error) {
    console.error('Error fetching Bible curriculum:', error);
    return {
      dailyReading: null,
      memoryVerse: null
    };
  }
}

/**
 * Get Bible curriculum content for current date
 * @param targetDate - Date to get curriculum for (defaults to today)
 * @returns Curriculum content or null if no school day
 */
export async function getCurrentBibleCurriculum(targetDate: Date = new Date()) {
  const weekNumber = getCurrentCurriculumWeek(targetDate);
  const dayOfWeek = getSchoolDayOfWeek(targetDate);
  
  if (!weekNumber || !dayOfWeek) {
    return null;
  }
  
  return await getBibleCurriculumForDay(weekNumber, dayOfWeek);
}

/**
 * Generate a display-friendly Bible subject for schedule blocks
 * @param targetDate - Date to get content for
 * @returns Formatted subject string or fallback to "Bible"
 */
export async function getBibleSubjectForSchedule(targetDate: Date = new Date()): Promise<string> {
  const curriculum = await getCurrentBibleCurriculum(targetDate);
  
  if (!curriculum?.dailyReading) {
    return 'Bible'; // Fallback to generic
  }
  
  // Primary: Use daily reading
  let subject = curriculum.dailyReading.readingTitle;
  
  // Optional: Include memory verse info if desired
  if (curriculum.memoryVerse && curriculum.memoryVerse.readingTitle) {
    subject += ` + ${curriculum.memoryVerse.readingTitle}`;
  }
  
  return subject;
}

/**
 * Mark a Bible curriculum item as completed
 * @param weekNumber - Week number (1-52)
 * @param dayOfWeek - Day of week (1-5) or null for memory verses
 * @param readingType - 'daily_reading' or 'memory_verse'
 */
export async function markBibleCurriculumCompleted(
  weekNumber: number,
  dayOfWeek: number | null,
  readingType: 'daily_reading' | 'memory_verse'
): Promise<boolean> {
  try {
    const whereConditions = [
      eq(bibleCurriculum.weekNumber, weekNumber),
      eq(bibleCurriculum.readingType, readingType)
    ];
    
    if (dayOfWeek !== null) {
      whereConditions.push(eq(bibleCurriculum.dayOfWeek, dayOfWeek));
    }
    
    await db
      .update(bibleCurriculum)
      .set({
        completed: true,
        completedAt: new Date()
      })
      .where(and(...whereConditions));
    
    return true;
  } catch (error) {
    console.error('Error marking Bible curriculum completed:', error);
    return false;
  }
}

/**
 * Get curriculum progress for a specific week
 * @param weekNumber - Week to check (1-52)
 * @returns Progress summary
 */
export async function getWeeklyBibleProgress(weekNumber: number) {
  try {
    const weekCurriculum = await db
      .select()
      .from(bibleCurriculum)
      .where(eq(bibleCurriculum.weekNumber, weekNumber));
    
    const completed = weekCurriculum.filter(item => item.completed).length;
    const total = weekCurriculum.length;
    
    return {
      weekNumber,
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      items: weekCurriculum
    };
  } catch (error) {
    console.error('Error getting weekly Bible progress:', error);
    return null;
  }
}

export { SCHOOL_YEAR_START_DATE };