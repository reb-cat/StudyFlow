// Data integrity utilities for production-safe operations
import { logger } from './logger';
import { withTransaction } from './db-utils';
import { db } from '../db';
import { eq, and, or, sql } from 'drizzle-orm';
import { assignments, dailyScheduleStatus } from '../../shared/schema';

interface SchedulingConflict {
  type: 'overlap' | 'impossible_duration' | 'resource_conflict';
  description: string;
  affectedItems: string[];
}

interface DataConsistencyOptions {
  fix?: boolean;
  dryRun?: boolean;
}

// Mutex for preventing concurrent schedule modifications
const scheduleMutex = new Map<string, Promise<void>>();

export async function withScheduleLock<T>(
  lockKey: string,
  operation: () => Promise<T>
): Promise<T> {
  // Wait for existing operation to complete
  if (scheduleMutex.has(lockKey)) {
    await scheduleMutex.get(lockKey);
  }

  // Create new promise for this operation
  const promise = operation()
    .finally(() => {
      scheduleMutex.delete(lockKey);
    });

  scheduleMutex.set(lockKey, promise.then(() => {}));
  return promise;
}

// Detect and resolve scheduling conflicts
export async function detectSchedulingConflicts(
  studentName: string,
  date: string
): Promise<SchedulingConflict[]> {
  const conflicts: SchedulingConflict[] = [];

  try {
    // Get all assignments for the date
    const schedule = await db
      .select()
      .from(dailyScheduleStatus)
      .where(
        and(
          eq(dailyScheduleStatus.studentName, studentName),
          eq(dailyScheduleStatus.date, date)
        )
      );

    // Check for impossible time allocations
    const totalAllocatedMinutes = schedule.reduce((total, block) => {
      if (block.blockType === 'assignment' && block.assignmentIds) {
        return total + (block.timeMinutes || 30); // Default 30 min if not specified
      }
      return total;
    }, 0);

    const availableMinutes = schedule.reduce((total, block) => {
      return total + (block.timeMinutes || 30);
    }, 0);

    if (totalAllocatedMinutes > availableMinutes) {
      conflicts.push({
        type: 'impossible_duration',
        description: `Total assignment time (${totalAllocatedMinutes} min) exceeds available time (${availableMinutes} min)`,
        affectedItems: schedule.map(b => b.blockId)
      });
    }

    // Check for duplicate assignments across blocks
    const assignmentCounts = new Map<string, string[]>();
    schedule.forEach(block => {
      if (block.assignmentIds) {
        block.assignmentIds.forEach(assignmentId => {
          if (!assignmentCounts.has(assignmentId)) {
            assignmentCounts.set(assignmentId, []);
          }
          assignmentCounts.get(assignmentId)!.push(block.blockId);
        });
      }
    });

    assignmentCounts.forEach((blockIds, assignmentId) => {
      if (blockIds.length > 1) {
        conflicts.push({
          type: 'resource_conflict',
          description: `Assignment ${assignmentId} appears in multiple blocks`,
          affectedItems: blockIds
        });
      }
    });

    logger.info('DataIntegrity', `Found ${conflicts.length} scheduling conflicts for ${studentName} on ${date}`);
    return conflicts;

  } catch (error: any) {
    logger.error('DataIntegrity', 'Error detecting scheduling conflicts', { 
      studentName, 
      date, 
      error: error.message 
    });
    throw error;
  }
}

// Fix data inconsistencies
export async function fixDataInconsistencies(
  options: DataConsistencyOptions = {}
): Promise<{ fixed: number; issues: string[] }> {
  const { fix = false, dryRun = true } = options;
  const issues: string[] = [];
  let fixedCount = 0;

  try {
    return await withTransaction(async (tx) => {
      // 1. Check for orphaned assignment references
      const orphanedRefs = await tx
        .select({
          blockId: dailyScheduleStatus.blockId,
          assignmentIds: dailyScheduleStatus.assignmentIds
        })
        .from(dailyScheduleStatus)
        .where(sql`${dailyScheduleStatus.assignmentIds} IS NOT NULL`);

      for (const block of orphanedRefs) {
        if (block.assignmentIds) {
          for (const assignmentId of block.assignmentIds) {
            const assignment = await tx
              .select({ id: assignments.id })
              .from(assignments)
              .where(eq(assignments.id, assignmentId))
              .limit(1);

            if (assignment.length === 0) {
              issues.push(`Orphaned assignment reference: ${assignmentId} in block ${block.blockId}`);
              
              if (fix && !dryRun) {
                // Remove orphaned reference
                const updatedIds = block.assignmentIds.filter(id => id !== assignmentId);
                await tx
                  .update(dailyScheduleStatus)
                  .set({ 
                    assignmentIds: updatedIds.length > 0 ? updatedIds : null 
                  })
                  .where(eq(dailyScheduleStatus.blockId, block.blockId));
                fixedCount++;
              }
            }
          }
        }
      }

      // 2. Check for assignments with inconsistent completion status
      const inconsistentAssignments = await tx
        .select({
          assignmentId: assignments.id,
          assignmentCompleted: assignments.completed,
          blockCompleted: dailyScheduleStatus.status
        })
        .from(assignments)
        .leftJoin(
          dailyScheduleStatus,
          sql`${assignments.id} = ANY(${dailyScheduleStatus.assignmentIds})`
        )
        .where(
          and(
            sql`${dailyScheduleStatus.assignmentIds} IS NOT NULL`,
            or(
              and(
                eq(assignments.completed, true),
                eq(dailyScheduleStatus.status, 'not-started')
              ),
              and(
                eq(assignments.completed, false),
                eq(dailyScheduleStatus.status, 'complete')
              )
            )
          )
        );

      for (const inconsistent of inconsistentAssignments) {
        issues.push(`Status mismatch: Assignment ${inconsistent.assignmentId} completed=${inconsistent.assignmentCompleted} but block status=${inconsistent.blockCompleted}`);
        
        if (fix && !dryRun) {
          // Sync assignment completion with block status
          const shouldBeCompleted = inconsistent.blockCompleted === 'complete';
          await tx
            .update(assignments)
            .set({ completed: shouldBeCompleted })
            .where(eq(assignments.id, inconsistent.assignmentId));
          fixedCount++;
        }
      }

      // 3. Check for blocks with impossible time allocations
      const timeInconsistencies = await tx
        .select()
        .from(dailyScheduleStatus)
        .where(
          and(
            sql`${dailyScheduleStatus.assignmentIds} IS NOT NULL`,
            sql`array_length(${dailyScheduleStatus.assignmentIds}, 1) > 0`,
            or(
              sql`${dailyScheduleStatus.timeMinutes} < 10`, // Minimum reasonable time
              sql`${dailyScheduleStatus.timeMinutes} > 240` // Maximum reasonable time (4 hours)
            )
          )
        );

      for (const block of timeInconsistencies) {
        issues.push(`Time inconsistency: Block ${block.blockId} has ${block.timeMinutes} minutes allocated`);
        
        if (fix && !dryRun) {
          // Set reasonable default time based on assignment count
          const assignmentCount = block.assignmentIds?.length || 1;
          const reasonableTime = Math.min(Math.max(assignmentCount * 30, 30), 120);
          
          await tx
            .update(dailyScheduleStatus)
            .set({ timeMinutes: reasonableTime })
            .where(eq(dailyScheduleStatus.blockId, block.blockId));
          fixedCount++;
        }
      }

      logger.info('DataIntegrity', `Data consistency check completed`, {
        issuesFound: issues.length,
        fixedCount,
        dryRun
      });

      return { fixed: fixedCount, issues };
    });

  } catch (error: any) {
    logger.error('DataIntegrity', 'Error fixing data inconsistencies', { 
      error: error.message 
    });
    throw error;
  }
}

// Validate assignment scheduling for a specific day
export async function validateDaySchedule(
  studentName: string,
  date: string,
  autoFix = false
): Promise<{ valid: boolean; issues: string[]; fixed?: number }> {
  return withScheduleLock(`${studentName}-${date}`, async () => {
    const conflicts = await detectSchedulingConflicts(studentName, date);
    const consistencyCheck = await fixDataInconsistencies({ 
      fix: autoFix,
      dryRun: !autoFix 
    });

    const allIssues = [
      ...conflicts.map(c => c.description),
      ...consistencyCheck.issues
    ];

    const result = {
      valid: allIssues.length === 0,
      issues: allIssues,
      ...(autoFix && { fixed: consistencyCheck.fixed })
    };

    if (!result.valid) {
      logger.warn('DataIntegrity', `Schedule validation failed for ${studentName} on ${date}`, {
        issueCount: allIssues.length,
        conflicts: conflicts.length,
        inconsistencies: consistencyCheck.issues.length
      });
    }

    return result;
  });
}

// Background job for periodic data integrity checks
export async function runDataIntegrityCheck(): Promise<void> {
  logger.info('DataIntegrity', 'Starting periodic data integrity check');

  try {
    const result = await fixDataInconsistencies({ 
      fix: true, 
      dryRun: false 
    });

    if (result.issues.length > 0) {
      logger.warn('DataIntegrity', 'Data integrity issues found and fixed', {
        issuesFound: result.issues.length,
        issuesFixed: result.fixed,
        issues: result.issues.slice(0, 10) // Log first 10 issues
      });
    } else {
      logger.info('DataIntegrity', 'Data integrity check passed - no issues found');
    }

  } catch (error: any) {
    logger.error('DataIntegrity', 'Data integrity check failed', { 
      error: error.message 
    });
  }
}