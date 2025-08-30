import { db } from "../db";
import {
  bibleCurriculum,
  bibleCurriculumPosition,
  type BibleCurriculum as BCRow,
} from "@shared/schema";
import { and, asc, eq, isNull } from "drizzle-orm";

// ——————————————————————————————————————————————
// Helpers
async function getOrCreatePosition(studentName: string) {
  const [pos] = await db
    .select()
    .from(bibleCurriculumPosition)
    .where(eq(bibleCurriculumPosition.studentName, studentName))
    .limit(1);
  if (pos) return pos;
  const [inserted] = await db
    .insert(bibleCurriculumPosition)
    .values({ studentName, currentWeek: 1, currentDay: 1 })
    .returning();
  return inserted;
}

async function getMemoryVerseForWeek(weekNumber: number) {
  const [mv] = await db
    .select()
    .from(bibleCurriculum)
    .where(
      and(
        eq(bibleCurriculum.weekNumber, weekNumber),
        eq(bibleCurriculum.readingType, "memory_verse"),
        isNull(bibleCurriculum.dayOfWeek)
      )
    )
    .limit(1);
  return mv ?? null;
}

async function getDailyReading(
  weekNumber: number,
  dayOfWeek: number
): Promise<BCRow | null> {
  const [row] = await db
    .select()
    .from(bibleCurriculum)
    .where(
      and(
        eq(bibleCurriculum.weekNumber, weekNumber),
        eq(bibleCurriculum.dayOfWeek, dayOfWeek),
        eq(bibleCurriculum.readingType, "daily_reading")
      )
    )
    .limit(1);
  return row ?? null;
}

// ——————————————————————————————————————————————
// Public API used by routes

/** Get Bible subject string for schedule display (used by routes). */
export async function getBibleSubjectForSchedule(studentName: string): Promise<string> {
  const result = await getNextBibleCurriculumForStudent(studentName);
  if (result.dailyReading) {
    return result.dailyReading.readingTitle || "Bible Reading";
  }
  return "Bible Reading"; // Fallback
}

/** Get the next Bible curriculum entry for a student (sequential). */
export async function getNextBibleCurriculumForStudent(studentName: string) {
  const pos = await getOrCreatePosition(studentName);
  let week = pos.currentWeek;
  let day = pos.currentDay;

  console.log(`📖 Bible Curriculum Debug: ${studentName} at Week ${week}, Day ${day}`);

  // Try current (week, day). If missing (e.g., not seeded), advance to next existing.
  let reading = await getDailyReading(week, day);
  console.log(`📖 getDailyReading(${week}, ${day}) result:`, reading ? reading.readingTitle : 'null');
  
  if (!reading) {
    console.log(`⚠️ No reading found for Week ${week}, Day ${day} - using fallback logic`);
    const rows = await db
      .select()
      .from(bibleCurriculum)
      .where(eq(bibleCurriculum.readingType, "daily_reading"))
      .orderBy(asc(bibleCurriculum.weekNumber), asc(bibleCurriculum.dayOfWeek));
    const next = rows.find(
      (r) => !r.completed && r.dayOfWeek != null && r.weekNumber != null
    );
    if (next) {
      console.log(`📖 Fallback found: Week ${next.weekNumber}, Day ${next.dayOfWeek} - ${next.readingTitle}`);
      week = next.weekNumber!;
      day = next.dayOfWeek!;
      reading = next;
      // realign pointer to the next unfinished slot
      await db
        .update(bibleCurriculumPosition)
        .set({ currentWeek: week, currentDay: day })
        .where(eq(bibleCurriculumPosition.studentName, studentName));
    } else {
      return { dailyReading: null, memoryVerse: null };
    }
  } else {
    console.log(`✅ Found correct reading: ${reading.readingTitle} (Week ${week}, Day ${day})`);
  }

  const memoryVerse = await getMemoryVerseForWeek(week);
  return {
    dailyReading: reading,
    memoryVerse,
  };
}

/** Mark a curriculum item completed, and advance pointer if daily reading. */
export async function markBibleCurriculumCompleted(
  weekNumber: number,
  dayOfWeek: number | null,
  readingType: "daily_reading" | "memory_verse",
  studentName?: string
) {
  if (readingType === "memory_verse") {
    // Mark MV for the week as completed (dayOfWeek is null)
    await db
      .update(bibleCurriculum)
      .set({ completed: true, completedAt: new Date() })
      .where(
        and(
          eq(bibleCurriculum.weekNumber, weekNumber),
          eq(bibleCurriculum.readingType, "memory_verse"),
          isNull(bibleCurriculum.dayOfWeek)
        )
      );
    return true;
  }

  if (dayOfWeek == null) return false;
  await db
    .update(bibleCurriculum)
    .set({ completed: true, completedAt: new Date() })
    .where(
      and(
        eq(bibleCurriculum.weekNumber, weekNumber),
        eq(bibleCurriculum.dayOfWeek, dayOfWeek),
        eq(bibleCurriculum.readingType, "daily_reading")
      )
    );

  // Advance pointer for the student if provided
  if (studentName) {
    const pos = await getOrCreatePosition(studentName);
    let nextWeek = pos.currentWeek;
    let nextDay = pos.currentDay + 1;
    // If next day doesn't exist, roll to the first day of the next available week
    const nextExists = await getDailyReading(nextWeek, nextDay);
    if (!nextExists) {
      nextWeek = pos.currentWeek + 1;
      nextDay = 1;
    }
    await db
      .update(bibleCurriculumPosition)
      .set({ currentWeek: nextWeek, currentDay: nextDay, lastUpdated: new Date() })
      .where(eq(bibleCurriculumPosition.studentName, studentName));
  }
  return true;
}

/** Weekly progress for UI (overview ribbons, etc.). */
export async function getWeeklyBibleProgress(weekNumber: number) {
  const rows = await db
    .select()
    .from(bibleCurriculum)
    .where(eq(bibleCurriculum.weekNumber, weekNumber))
    .orderBy(asc(bibleCurriculum.readingType), asc(bibleCurriculum.dayOfWeek));
  const total = rows.filter((r) => r.readingType === "daily_reading").length;
  const completed = rows.filter((r) => r.readingType === "daily_reading" && r.completed).length;
  return {
    weekNumber,
    completed,
    total,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    items: rows,
  };
}