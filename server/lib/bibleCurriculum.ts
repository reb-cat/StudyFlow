import { db } from '../db';
import { bibleCurriculum } from '@shared/schema';
import { eq, and, asc } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

/**
 * Bible Curriculum Integration System - SIMPLIFIED SEQUENTIAL APPROACH
 * Replaces generic 'Bible' schedule entries with specific daily readings
 * Uses simple sequential progression through 52-week curriculum
 */

/**
 * Get or create position tracking for a student
 * @param studentName - Student name
 * @returns Current position object
 */
async function getStudentPosition(studentName: string): Promise<{week: number, day: number}> {
  try {
    // Try to get existing position
    const result = await db.execute(sql`
      SELECT current_week, current_day 
      FROM bible_curriculum_position 
      WHERE student_name = ${studentName}
    `);
    
    if (result.rows.length > 0) {
      const row = result.rows[0] as any;
      return { week: row.current_week, day: row.current_day };
    }
    
    // Create new position starting at Week 1, Day 1
    await db.execute(sql`
      INSERT INTO bible_curriculum_position (student_name, current_week, current_day)
      VALUES (${studentName}, 1, 1)
      ON CONFLICT (student_name) DO NOTHING
    `);
    
    return { week: 1, day: 1 };
  } catch (error) {
    console.error('Error getting student position:', error);
    return { week: 1, day: 1 }; // Fallback
  }
}

/**
 * Advance student to next curriculum position
 * @param studentName - Student name
 */
async function advanceStudentPosition(studentName: string): Promise<void> {
  try {
    const current = await getStudentPosition(studentName);
    let nextWeek = current.week;
    let nextDay = current.day + 1;
    
    // If we completed day 5, move to next week
    if (nextDay > 5) {
      nextWeek = current.week + 1;
      nextDay = 1;
      
      // If we completed week 52, restart or stop
      if (nextWeek > 52) {
        nextWeek = 1; // Restart curriculum
      }
    }
    
    await db.execute(sql`
      UPDATE bible_curriculum_position 
      SET current_week = ${nextWeek}, 
          current_day = ${nextDay},
          last_updated = CURRENT_TIMESTAMP
      WHERE student_name = ${studentName}
    `);
  } catch (error) {
    console.error('Error advancing student position:', error);
  }
}

/**
 * Get Bible curriculum content for a specific week and day (SEQUENTIAL VERSION)
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
 * Get next Bible curriculum for a student (SEQUENTIAL APPROACH)
 * Uses student's current position, regardless of calendar date
 * @param studentName - Student name (like "Abigail" or "Khalil")
 * @returns Current curriculum reading for this student
 */
export async function getNextBibleCurriculumForStudent(studentName: string) {
  try {
    const position = await getStudentPosition(studentName);
    return await getBibleCurriculumForDay(position.week, position.day);
  } catch (error) {
    console.error('Error getting next Bible curriculum for student:', error);
    return { dailyReading: null, memoryVerse: null };
  }
}

/**
 * Generate a display-friendly Bible subject for schedule blocks (SEQUENTIAL VERSION)
 * @param studentName - Student name to get position for
 * @returns Formatted subject string or fallback to "Bible"
 */
export async function getBibleSubjectForSchedule(studentName: string = "Abigail"): Promise<string> {
  const curriculum = await getNextBibleCurriculumForStudent(studentName);
  
  if (!curriculum?.dailyReading) {
    return 'Bible'; // Fallback to generic
  }
  
  // Primary: Use daily reading
  let subject = curriculum.dailyReading.readingTitle;
  
  // Optional: Include memory verse info if desired
  if (curriculum.memoryVerse && curriculum.memoryVerse.readingTitle) {
    subject += ` + Memory: ${curriculum.memoryVerse.readingTitle}`;
  }
  
  return subject;
}

/**
 * Mark current reading as complete and advance student position
 * @param studentName - Student name
 */
export async function completeBibleReadingAndAdvance(studentName: string): Promise<boolean> {
  try {
    const position = await getStudentPosition(studentName);
    
    // Mark current reading as completed
    await markBibleCurriculumCompleted(position.week, position.day, 'daily_reading');
    
    // Advance to next position
    await advanceStudentPosition(studentName);
    
    return true;
  } catch (error) {
    console.error('Error completing Bible reading:', error);
    return false;
  }
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