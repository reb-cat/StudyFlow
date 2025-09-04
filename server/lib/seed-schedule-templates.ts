// Production-safe schedule template seeding system
// Idempotent seeding for StudyFlow schedule templates

import { logger } from './logger';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { withTransaction } from './db-utils';

// Define the source of truth: Abigail's Thursday schedule (10 blocks)
// Based on development environment analysis - NORMALIZED TO HH:MM FORMAT
export const ABIGAIL_THURSDAY_TEMPLATE = [
  {
    studentName: 'Abigail',
    weekday: 'Thursday',
    blockNumber: null,
    startTime: '08:00',
    endTime: '08:20',
    subject: 'Bible',
    blockType: 'Bible'
  },
  {
    studentName: 'Abigail',
    weekday: 'Thursday',
    blockNumber: null,
    startTime: '08:20',
    endTime: '08:30',
    subject: 'Prep/Load',
    blockType: 'Prep/Load'
  },
  {
    studentName: 'Abigail',
    weekday: 'Thursday',
    blockNumber: null,
    startTime: '08:45',
    endTime: '09:15',
    subject: 'Travel to Co-op',
    blockType: 'Travel'
  },
  {
    studentName: 'Abigail',
    weekday: 'Thursday',
    blockNumber: null,
    startTime: '09:15',
    endTime: '10:15',
    subject: 'American Literature and Composition',
    blockType: 'Co-op'
  },
  {
    studentName: 'Abigail',
    weekday: 'Thursday',
    blockNumber: null,
    startTime: '10:20',
    endTime: '11:20',
    subject: 'Study Hall',
    blockType: 'Co-op'
  },
  {
    studentName: 'Abigail',
    weekday: 'Thursday',
    blockNumber: null,
    startTime: '11:25',
    endTime: '12:25',
    subject: 'Geometry (2x week) - L Cejas-Brown',
    blockType: 'Co-op'
  },
  {
    studentName: 'Abigail',
    weekday: 'Thursday',
    blockNumber: null,
    startTime: '12:25',
    endTime: '12:50',
    subject: 'Lunch',
    blockType: 'Lunch'
  },
  {
    studentName: 'Abigail',
    weekday: 'Thursday',
    blockNumber: null,
    startTime: '12:55',
    endTime: '13:55',
    subject: 'Photography - S Hughes',
    blockType: 'Co-op'
  },
  {
    studentName: 'Abigail',
    weekday: 'Thursday',
    blockNumber: null,
    startTime: '14:00',
    endTime: '15:00',
    subject: 'Yearbook - S Hughes',
    blockType: 'Co-op'
  },
  {
    studentName: 'Abigail',
    weekday: 'Thursday',
    blockNumber: null,
    startTime: '15:00',
    endTime: '15:30',
    subject: 'Travel Home',
    blockType: 'Travel'
  }
];

// Calculate checksum for seed data integrity
function calculateSeedChecksum(blocks: any[]): string {
  const content = JSON.stringify(blocks);
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
export async function seedAbigailThursdayTemplate(): Promise<{
  inserted: number;
  skipped: number;
  message: string;
}> {
  const seedName = 'abigail_thursday_template';
  const seedVersion = 'v2'; // Updated for HH:MM time format normalization
  const checksum = calculateSeedChecksum(ABIGAIL_THURSDAY_TEMPLATE);

  try {
    // Check if already applied
    if (await isSeedApplied(seedName, seedVersion)) {
      logger.info('Seed', `Seed '${seedName}' v${seedVersion} already applied, skipping`);
      return {
        inserted: 0,
        skipped: ABIGAIL_THURSDAY_TEMPLATE.length,
        message: `Seed '${seedName}' already applied, skipped ${ABIGAIL_THURSDAY_TEMPLATE.length} blocks`
      };
    }

    let insertedCount = 0;
    let skippedCount = 0;

    try {
      // Try with transaction first (for databases that support it)
      await withTransaction(async (tx) => {
        logger.info('Seed', `Applying seed '${seedName}' v${seedVersion} (with transaction)`, {
          blocks: ABIGAIL_THURSDAY_TEMPLATE.length,
          checksum
        });

        // Insert each block with conflict resolution
        for (const block of ABIGAIL_THURSDAY_TEMPLATE) {
          try {
            const result = await tx.execute(sql`
              INSERT INTO schedule_template (
                student_name, weekday, block_number, start_time, end_time, subject, block_type
              ) VALUES (
                ${block.studentName}, ${block.weekday}, ${block.blockNumber}, 
                ${block.startTime}, ${block.endTime}, ${block.subject}, ${block.blockType}
              )
              ON CONFLICT (student_name, weekday, start_time, end_time) DO NOTHING
            `);
            
            // Check if row was actually inserted (PostgreSQL specific)
            if (result.rowCount && result.rowCount > 0) {
              insertedCount++;
            } else {
              skippedCount++;
            }
          } catch (error: any) {
            logger.warn('Seed', `Failed to insert block ${block.subject} at ${block.startTime}`, {
              error: error.message
            });
            skippedCount++;
          }
        }

        // Record the seed application
        await recordSeedApplication(seedName, seedVersion, insertedCount, skippedCount, checksum);
      });
    } catch (error: any) {
      // Fallback to non-transactional approach (for Neon HTTP driver)
      if (error.message?.includes('No transactions support')) {
        logger.warn('Seed', `Falling back to non-transactional seeding`, { seedName });
        
        insertedCount = 0;
        skippedCount = 0;

        logger.info('Seed', `Applying seed '${seedName}' v${seedVersion} (non-transactional)`, {
          blocks: ABIGAIL_THURSDAY_TEMPLATE.length,
          checksum
        });

        // Insert each block with conflict resolution (without transaction)
        for (const block of ABIGAIL_THURSDAY_TEMPLATE) {
          try {
            const result = await db.execute(sql`
              INSERT INTO schedule_template (
                student_name, weekday, block_number, start_time, end_time, subject, block_type
              ) VALUES (
                ${block.studentName}, ${block.weekday}, ${block.blockNumber}, 
                ${block.startTime}, ${block.endTime}, ${block.subject}, ${block.blockType}
              )
              ON CONFLICT (student_name, weekday, start_time, end_time) DO NOTHING
            `);
            
            // Check if row was actually inserted (PostgreSQL specific)
            if (result.rowCount && result.rowCount > 0) {
              insertedCount++;
            } else {
              skippedCount++;
            }
          } catch (error: any) {
            logger.warn('Seed', `Failed to insert block ${block.subject} at ${block.startTime}`, {
              error: error.message
            });
            skippedCount++;
          }
        }

        // Record the seed application (without transaction)
        await db.execute(sql`
          INSERT INTO seed_status (seed_name, seed_version, rows_inserted, rows_skipped, checksum)
          VALUES (${seedName}, ${seedVersion}, ${insertedCount}, ${skippedCount}, ${checksum})
          ON CONFLICT (seed_name) DO UPDATE SET
            seed_version = EXCLUDED.seed_version,
            applied_at = CURRENT_TIMESTAMP,
            rows_inserted = EXCLUDED.rows_inserted,
            rows_skipped = EXCLUDED.rows_skipped,
            checksum = EXCLUDED.checksum
        `);
      } else {
        throw error;
      }
    }

    const message = `Seed '${seedName}' applied: ${insertedCount} inserted, ${skippedCount} skipped`;
    logger.info('Seed', message, {
      seedName,
      version: seedVersion,
      inserted: insertedCount,
      skipped: skippedCount,
      total: ABIGAIL_THURSDAY_TEMPLATE.length
    });

    return {
      inserted: insertedCount,
      skipped: skippedCount,
      message
    };

  } catch (error: any) {
    logger.error('Seed', `Failed to apply seed '${seedName}'`, {
      error: error.message,
      stack: error.stack
    });
    throw new Error(`Seed application failed: ${error.message}`);
  }
}

// Development helper: Get current template status for comparison
export async function getTemplateStatus(studentName: string, weekday: string): Promise<{
  count: number;
  blocks: any[];
}> {
  try {
    const result = await db.execute(sql`
      SELECT 
        student_name, weekday, block_number, start_time, end_time, subject, block_type
      FROM schedule_template 
      WHERE student_name = ${studentName} AND weekday = ${weekday}
      ORDER BY start_time
    `);

    return {
      count: result.rows.length,
      blocks: result.rows
    };
  } catch (error: any) {
    logger.error('Seed', 'Failed to get template status', { error: error.message });
    throw error;
  }
}