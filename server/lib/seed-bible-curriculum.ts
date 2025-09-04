// Production-safe Bible curriculum seeding system
// Idempotent seeding for StudyFlow Bible curriculum

import { logger } from './logger';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { withTransaction } from './db-utils';

// Define Bible curriculum template (first 4 weeks as sample)
// Based on development environment analysis
export const BIBLE_CURRICULUM_TEMPLATE = [
  // Week 1 - Daily Readings
  { weekNumber: 1, dayOfWeek: 1, readingTitle: 'Genesis 1-2', readingType: 'daily_reading' },
  { weekNumber: 1, dayOfWeek: 2, readingTitle: 'Genesis 3-4', readingType: 'daily_reading' },
  { weekNumber: 1, dayOfWeek: 3, readingTitle: 'Genesis 6-7', readingType: 'daily_reading' },
  { weekNumber: 1, dayOfWeek: 4, readingTitle: 'Genesis 8-9', readingType: 'daily_reading' },
  { weekNumber: 1, dayOfWeek: 5, readingTitle: 'Job 1-2', readingType: 'daily_reading' },
  // Week 1 - Memory Verse
  { weekNumber: 1, dayOfWeek: null, readingTitle: 'Genesis 1:1 - In the beginning God created the heavens and the earth', readingType: 'memory_verse' },
  
  // Week 2 - Daily Readings  
  { weekNumber: 2, dayOfWeek: 1, readingTitle: 'Job 38-39', readingType: 'daily_reading' },
  { weekNumber: 2, dayOfWeek: 2, readingTitle: 'Job 40-42', readingType: 'daily_reading' },
  { weekNumber: 2, dayOfWeek: 3, readingTitle: 'Genesis 11-12', readingType: 'daily_reading' },
  { weekNumber: 2, dayOfWeek: 4, readingTitle: 'Genesis 15', readingType: 'daily_reading' },
  { weekNumber: 2, dayOfWeek: 5, readingTitle: 'Genesis 16-17', readingType: 'daily_reading' },
  // Week 2 - Memory Verse
  { weekNumber: 2, dayOfWeek: null, readingTitle: 'Genesis 12:1 - The Lord had said to Abram, Leave your country...', readingType: 'memory_verse' },
  
  // Week 3 - Daily Readings
  { weekNumber: 3, dayOfWeek: 1, readingTitle: 'Genesis 18', readingType: 'daily_reading' },
  { weekNumber: 3, dayOfWeek: 2, readingTitle: 'Genesis 19', readingType: 'daily_reading' },
  { weekNumber: 3, dayOfWeek: 3, readingTitle: 'Genesis 21-22', readingType: 'daily_reading' },
  { weekNumber: 3, dayOfWeek: 4, readingTitle: 'Genesis 24', readingType: 'daily_reading' },
  { weekNumber: 3, dayOfWeek: 5, readingTitle: 'Genesis 25', readingType: 'daily_reading' },
  // Week 3 - Memory Verse  
  { weekNumber: 3, dayOfWeek: null, readingTitle: 'Genesis 22:14 - Abraham called that place The Lord Will Provide', readingType: 'memory_verse' },
  
  // Week 4 - Daily Readings
  { weekNumber: 4, dayOfWeek: 1, readingTitle: 'Genesis 27', readingType: 'daily_reading' },
  { weekNumber: 4, dayOfWeek: 2, readingTitle: 'Genesis 28', readingType: 'daily_reading' },
  { weekNumber: 4, dayOfWeek: 3, readingTitle: 'Genesis 29', readingType: 'daily_reading' },
  { weekNumber: 4, dayOfWeek: 4, readingTitle: 'Genesis 32', readingType: 'daily_reading' },
  { weekNumber: 4, dayOfWeek: 5, readingTitle: 'Genesis 37', readingType: 'daily_reading' },
  // Week 4 - Memory Verse
  { weekNumber: 4, dayOfWeek: null, readingTitle: 'Genesis 28:15 - I am with you and will watch over you wherever you go', readingType: 'memory_verse' }
];

// Calculate checksum for seed data integrity
function calculateSeedChecksum(curriculum: any[]): string {
  const content = JSON.stringify(curriculum);
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// Check if seed has already been applied
async function isSeedApplied(seedName: string, version: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT 1 FROM seed_status 
      WHERE seed_name = ${seedName} AND seed_version = ${version}
    `);
    return result.rows.length > 0;
  } catch (error: any) {
    // If seed_status table doesn't exist, migration hasn't run yet
    if (error.message?.includes('relation "seed_status" does not exist')) {
      return false;
    }
    throw error;
  }
}

// Record seed application for future idempotency checks
async function recordSeedApplication(
  seedName: string, 
  version: string, 
  rowsInserted: number, 
  rowsSkipped: number,
  checksum: string
): Promise<void> {
  await db.execute(sql`
    INSERT INTO seed_status (seed_name, seed_version, rows_inserted, rows_skipped, checksum)
    VALUES (${seedName}, ${version}, ${rowsInserted}, ${rowsSkipped}, ${checksum})
    ON CONFLICT (seed_name) DO UPDATE SET
      seed_version = EXCLUDED.seed_version,
      applied_at = CURRENT_TIMESTAMP,
      rows_inserted = EXCLUDED.rows_inserted,
      rows_skipped = EXCLUDED.rows_skipped,
      checksum = EXCLUDED.checksum
  `);
}

// Main seeding function - idempotent and production-safe
export async function seedBibleCurriculum(): Promise<{
  inserted: number;
  updated: number;
  skipped: number;
  message: string;
}> {
  const seedName = 'bible_curriculum_foundation';
  const seedVersion = 'v3'; // Updated for proper UPSERT functionality
  const checksum = calculateSeedChecksum(BIBLE_CURRICULUM_TEMPLATE);

  try {
    // Check if already applied
    if (await isSeedApplied(seedName, seedVersion)) {
      logger.info('Seed', `Seed '${seedName}' v${seedVersion} already applied, skipping`);
      return {
        inserted: 0,
        updated: 0,
        skipped: BIBLE_CURRICULUM_TEMPLATE.length,
        message: `Seed '${seedName}' already applied, skipped ${BIBLE_CURRICULUM_TEMPLATE.length} curriculum items`
      };
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    try {
      // Try with transaction first (for databases that support it)
      await withTransaction(async (tx) => {
        for (const item of BIBLE_CURRICULUM_TEMPLATE) {
          try {
            // Use proper UPSERT with ON CONFLICT UPDATE to handle replacing incorrect rows
            const result = await tx.execute(sql`
              INSERT INTO bible_curriculum (week_number, day_of_week, reading_title, reading_type, completed)
              VALUES (${item.weekNumber}, ${item.dayOfWeek}, ${item.readingTitle}, ${item.readingType}, false)
              ON CONFLICT (week_number, day_of_week, reading_type) DO UPDATE SET
                reading_title = EXCLUDED.reading_title,
                completed = EXCLUDED.completed
              RETURNING (xmax = 0) AS inserted
            `);
            
            // PostgreSQL returns (xmax = 0) as true for INSERT, false for UPDATE
            if (result.rows[0] && result.rows[0].inserted) {
              insertedCount++;
            } else {
              updatedCount++;
            }
          } catch (error: any) {
            logger.warn('Seed', 'Curriculum item already exists or conflict', { 
              week: item.weekNumber, 
              day: item.dayOfWeek,
              type: item.readingType,
              error: error.message 
            });
            skippedCount++;
          }
        }
      });
    } catch (transactionError: any) {
      logger.warn('Database', 'Transaction failed, falling back to non-transactional', { 
        error: transactionError.message 
      });
      
      // Fallback: Non-transactional seeding
      logger.warn('Seed', 'Falling back to non-transactional seeding', { seedName });
      logger.info('Seed', `Applying seed '${seedName}' v${seedVersion} (non-transactional)`, {
        items: BIBLE_CURRICULUM_TEMPLATE.length,
        checksum
      });

      for (const item of BIBLE_CURRICULUM_TEMPLATE) {
        try {
          // Use proper UPSERT with ON CONFLICT UPDATE to handle replacing incorrect rows (non-transactional)
          const result = await db.execute(sql`
            INSERT INTO bible_curriculum (week_number, day_of_week, reading_title, reading_type, completed)
            VALUES (${item.weekNumber}, ${item.dayOfWeek}, ${item.readingTitle}, ${item.readingType}, false)
            ON CONFLICT (week_number, day_of_week, reading_type) DO UPDATE SET
              reading_title = EXCLUDED.reading_title,
              completed = EXCLUDED.completed
            RETURNING (xmax = 0) AS inserted
          `);
          
          // PostgreSQL returns (xmax = 0) as true for INSERT, false for UPDATE
          if (result.rows[0] && result.rows[0].inserted) {
            insertedCount++;
          } else {
            updatedCount++;
          }
        } catch (error: any) {
          logger.warn('Seed', 'Curriculum item upsert failed', { 
            week: item.weekNumber, 
            day: item.dayOfWeek,
            type: item.readingType,
            error: error.message 
          });
          skippedCount++;
        }
      }
    }

    // Record successful seed application
    await recordSeedApplication(seedName, seedVersion, insertedCount + updatedCount, skippedCount, checksum);
    
    logger.info('Seed', `Seed '${seedName}' applied: ${insertedCount} inserted, ${skippedCount} skipped`, {
      seedName,
      version: seedVersion,
      inserted: insertedCount,
      skipped: skippedCount,
      total: BIBLE_CURRICULUM_TEMPLATE.length
    });

    return {
      inserted: insertedCount,
      updated: updatedCount,
      skipped: skippedCount,
      message: `Seed '${seedName}' applied: ${insertedCount} inserted, ${updatedCount} updated, ${skippedCount} skipped`
    };

  } catch (error: any) {
    logger.error('Seed', 'Bible curriculum seeding failed', { 
      seedName, 
      version: seedVersion, 
      error: error.message,
      stack: error.stack
    });
    throw new Error(`Seed application failed: ${error.message}`);
  }
}

export async function getBibleCurriculumStatus(): Promise<{
  count: number;
  sampleItems: any[];
}> {
  try {
    // Get total count
    const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM bible_curriculum`);
    const count = Number(countResult.rows[0]?.count || 0);

    // Get sample items
    const sampleResult = await db.execute(sql`
      SELECT week_number, day_of_week, reading_type, reading_title
      FROM bible_curriculum 
      ORDER BY week_number, day_of_week, reading_type 
      LIMIT 5
    `);

    return {
      count,
      sampleItems: sampleResult.rows
    };
  } catch (error: any) {
    logger.error('Seed', 'Failed to get Bible curriculum status', { error: error.message });
    throw error;
  }
}