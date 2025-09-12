import { queryClient } from './queryClient';

/**
 * Comprehensive atomic cache invalidation utilities for StudyFlow
 * 
 * These utilities ensure that when schedule-affecting changes occur,
 * all related query caches are invalidated atomically to prevent UI inconsistencies.
 */

/**
 * Invalidates all assignment-related queries for a specific student and date
 * Includes assignments, schedule status, bible curriculum, and progress tracking
 */
export async function invalidateAssignmentRelatedQueries(studentName: string, date?: string) {
  const invalidations = [
    // All assignment queries (with and without date filters)
    queryClient.invalidateQueries({ queryKey: ['/api/assignments'] }),
    
    // Student-specific assignment queries
    ...(date ? [
      queryClient.invalidateQueries({ queryKey: ['/api/assignments', date, studentName] }),
      queryClient.invalidateQueries({ queryKey: ['/api/assignments', studentName, date] }),
    ] : []),
    
    // Schedule status queries (dependent on assignment completion)
    ...(date ? [
      queryClient.invalidateQueries({ queryKey: ['/api/schedule', studentName, date, 'status'] }),
    ] : [
      queryClient.invalidateQueries({ queryKey: ['/api/schedule', studentName], exact: false }),
    ]),
    
    // Bible curriculum (completion affects scheduling)
    queryClient.invalidateQueries({ queryKey: ['/api/bible-curriculum/current', studentName] }),
    queryClient.invalidateQueries({ queryKey: ['/api/bible-curriculum', studentName] }),
    queryClient.invalidateQueries({ queryKey: ['/api/bible-curriculum'] }),
    
    // Print queue (assignments affect what needs printing)
    queryClient.invalidateQueries({ queryKey: ['/api/print-queue'] }),
    
    // Student profiles (progress affects dashboard)
    queryClient.invalidateQueries({ queryKey: ['/api/students', studentName, 'profile'] }),
    queryClient.invalidateQueries({ queryKey: ['/api/students/profiles'] }),
  ];

  await Promise.all(invalidations);
  console.log(`🔄 Invalidated assignment-related queries for ${studentName}${date ? ` on ${date}` : ''}`);
}

/**
 * Invalidates all schedule-related queries for a specific student and date
 * Includes schedule templates, daily schedules, assignments, and status tracking
 */
export async function invalidateScheduleRelatedQueries(studentName: string, date?: string) {
  const invalidations = [
    // Schedule template queries
    queryClient.invalidateQueries({ queryKey: ['/api/schedule-template'] }),
    
    // Daily schedule queries
    ...(date ? [
      queryClient.invalidateQueries({ queryKey: ['/api/schedule', studentName, date] }),
      queryClient.invalidateQueries({ queryKey: ['/api/schedule', studentName, date, 'status'] }),
      queryClient.invalidateQueries({ queryKey: ['schedule-preview', studentName, date] }),
    ] : [
      queryClient.invalidateQueries({ queryKey: ['/api/schedule', studentName], exact: false }),
      queryClient.invalidateQueries({ queryKey: ['schedule-preview', studentName], exact: false }),
    ]),
    
    // Assignment queries (scheduling affects assignments)
    queryClient.invalidateQueries({ queryKey: ['/api/assignments'] }),
    ...(date ? [
      queryClient.invalidateQueries({ queryKey: ['/api/assignments', date, studentName] }),
      queryClient.invalidateQueries({ queryKey: ['/api/assignments', studentName, date] }),
    ] : []),
    
    // Bible curriculum (schedule affects bible block timing)
    queryClient.invalidateQueries({ queryKey: ['/api/bible-curriculum/current', studentName] }),
    
    // Saturday settings (affects scheduling)
    queryClient.invalidateQueries({ queryKey: ['/api/students/profiles/saturday-settings'] }),
  ];

  await Promise.all(invalidations);
  console.log(`🔄 Invalidated schedule-related queries for ${studentName}${date ? ` on ${date}` : ''}`);
}

/**
 * Invalidates all Bible curriculum-related queries
 * Includes current progress, weekly data, and related schedule impacts
 */
export async function invalidateBibleRelatedQueries(studentName: string) {
  const invalidations = [
    // Bible curriculum queries
    queryClient.invalidateQueries({ queryKey: ['/api/bible-curriculum/current', studentName] }),
    queryClient.invalidateQueries({ queryKey: ['/api/bible-curriculum', studentName] }),
    queryClient.invalidateQueries({ queryKey: ['/api/bible-curriculum'] }),
    
    // Schedule status (bible completion affects daily progress)
    queryClient.invalidateQueries({ queryKey: ['/api/schedule', studentName], exact: false }),
    
    // Assignment queries (bible affects assignment scheduling)
    queryClient.invalidateQueries({ queryKey: ['/api/assignments'] }),
  ];

  await Promise.all(invalidations);
  console.log(`🔄 Invalidated Bible-related queries for ${studentName}`);
}

/**
 * Invalidates all checklist-related queries for a student
 */
export async function invalidateChecklistRelatedQueries(studentName: string) {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: [`/api/checklist/${studentName}`] }),
    queryClient.invalidateQueries({ queryKey: ['/api/checklist', studentName] }),
  ];

  await Promise.all(invalidations);
  console.log(`🔄 Invalidated checklist queries for ${studentName}`);
}

/**
 * Invalidates all family dashboard and cross-student queries
 */
export async function invalidateFamilyDashboardQueries() {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: ['/api/family/dashboard'] }),
    queryClient.invalidateQueries({ queryKey: ['/api/family/student'], exact: false }),
    queryClient.invalidateQueries({ queryKey: ['/api/students/profiles'] }),
    queryClient.invalidateQueries({ queryKey: ['/api/rewards/profile'], exact: false }),
  ];

  await Promise.all(invalidations);
  console.log(`🔄 Invalidated family dashboard queries`);
}

/**
 * Invalidates all print queue related queries
 */
export async function invalidatePrintQueueQueries() {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: ['/api/print-queue'] }),
  ];

  await Promise.all(invalidations);
  console.log(`🔄 Invalidated print queue queries`);
}

/**
 * Comprehensive invalidation for all student-related data
 * Use this for major changes that affect multiple aspects of a student's data
 */
export async function invalidateAllStudentData(studentName: string, date?: string) {
  await Promise.all([
    invalidateAssignmentRelatedQueries(studentName, date),
    invalidateScheduleRelatedQueries(studentName, date),
    invalidateBibleRelatedQueries(studentName),
    invalidateChecklistRelatedQueries(studentName),
    invalidateFamilyDashboardQueries(),
  ]);
  
  console.log(`🔄 Comprehensive invalidation completed for ${studentName}${date ? ` on ${date}` : ''}`);
}

/**
 * Invalidates auth and profile related queries
 */
export async function invalidateAuthQueries() {
  const invalidations = [
    queryClient.invalidateQueries({ queryKey: ['/api/auth/status'] }),
    queryClient.invalidateQueries({ queryKey: ['/api/students/profiles'] }),
  ];

  await Promise.all(invalidations);
  console.log(`🔄 Invalidated auth queries`);
}

/**
 * Utility function to safely extract student name and date from various contexts
 */
export function extractCacheContext(context: any): { studentName?: string; date?: string } {
  const studentName = context?.studentName || context?.student || context?.name;
  const date = context?.date || context?.selectedDate || context?.scheduledDate;
  
  return { studentName, date };
}

/**
 * Smart invalidation based on mutation context
 * Automatically determines which caches to invalidate based on the operation type
 */
export async function invalidateByMutationType(
  mutationType: 'assignment' | 'schedule' | 'bible' | 'checklist' | 'profile' | 'comprehensive',
  context: { studentName?: string; date?: string; } = {}
) {
  const { studentName, date } = context;
  
  switch (mutationType) {
    case 'assignment':
      if (studentName) {
        await invalidateAssignmentRelatedQueries(studentName, date);
      } else {
        await queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      }
      break;
      
    case 'schedule':
      if (studentName) {
        await invalidateScheduleRelatedQueries(studentName, date);
      } else {
        await queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      }
      break;
      
    case 'bible':
      if (studentName) {
        await invalidateBibleRelatedQueries(studentName);
      } else {
        await queryClient.invalidateQueries({ queryKey: ['/api/bible-curriculum'] });
      }
      break;
      
    case 'checklist':
      if (studentName) {
        await invalidateChecklistRelatedQueries(studentName);
      }
      break;
      
    case 'profile':
      await invalidateFamilyDashboardQueries();
      if (studentName) {
        await queryClient.invalidateQueries({ queryKey: ['/api/students', studentName] });
      }
      break;
      
    case 'comprehensive':
      if (studentName) {
        await invalidateAllStudentData(studentName, date);
      } else {
        // Global comprehensive invalidation
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['/api/assignments'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/schedule'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/bible-curriculum'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/checklist'] }),
          invalidateFamilyDashboardQueries(),
        ]);
      }
      break;
  }
}