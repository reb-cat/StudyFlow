import { 
  type Assignment, type InsertAssignment, type UpdateAssignment,
  type ScheduleTemplate, type InsertScheduleTemplate,
  type BibleCurriculum, type InsertBibleCurriculum,
  type StudentProfile, type InsertStudentProfile,
  type StudentStatus, type InsertStudentStatus,
  type DailyScheduleStatus, type InsertDailyScheduleStatus,
  type ChecklistItem, type InsertChecklistItem, type UpdateChecklistItem,
  type RewardProfile, type InsertRewardProfile,
  type Quest, type InsertQuest,
  type RewardCatalogItem, type InsertRewardCatalogItem,
  type RedemptionRequest, type InsertRedemptionRequest,
  type EarnEvent, type InsertEarnEvent,
  type RewardSettings, type InsertRewardSettings,
  assignments, scheduleTemplate, bibleCurriculum, studentProfiles, studentStatus, dailyScheduleStatus, checklistItems,
  rewardProfiles, quests, rewardCatalog, redemptionRequests, earnEvents, rewardSettings
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, sql, desc, inArray, isNull, isNotNull } from "drizzle-orm";
import { compareAssignmentTitles, extractUnitNumber } from './lib/assignmentIntelligence';

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // Assignment operations
  getAssignments(userId: string, date?: string, includeCompleted?: boolean): Promise<Assignment[]>;
  getAllAssignments(): Promise<Assignment[]>; // For print queue - gets all assignments across all users
  getAssignment(id: string): Promise<Assignment | undefined>;
  createAssignment(assignment: InsertAssignment & { userId: string }): Promise<Assignment>;
  updateAssignment(id: string, update: UpdateAssignment): Promise<Assignment | undefined>;
  updateAssignmentStatus(id: string, completionStatus: string): Promise<Assignment | undefined>;
  deleteAssignment(id: string): Promise<boolean>;
  markAssignmentDeleted(id: string): Promise<Assignment | undefined>; // Soft delete for Canvas sync
  getDeletedAssignments(): Promise<Assignment[]>; // Admin audit trail
  updateAdministrativeAssignments(): Promise<void>;
  
  // Schedule template operations
  getScheduleTemplate(studentName: string, weekday?: string): Promise<ScheduleTemplate[]>;
  createScheduleTemplate(template: InsertScheduleTemplate): Promise<ScheduleTemplate>;
  updateScheduleTemplate(studentName: string, weekday: string, blocks: ScheduleTemplate[], isAuthorizedAdmin?: boolean): Promise<void>;
  replaceScheduleTemplateFromCSV(csvData: any[]): Promise<void>;
  
  // Bible curriculum operations
  getBibleCurriculum(weekNumber?: number): Promise<BibleCurriculum[]>;
  getBibleCurrentWeek(): Promise<BibleCurriculum[]>;
  updateBibleCompletion(weekNumber: number, dayOfWeek: number, completed: boolean): Promise<BibleCurriculum | undefined>;
  
  // Student profile operations
  getStudentProfile(studentName: string): Promise<StudentProfile | undefined>;
  upsertStudentProfile(profile: InsertStudentProfile): Promise<StudentProfile>;
  getAllStudentProfiles(): Promise<StudentProfile[]>;
  updateStudentSaturdayScheduling(studentName: string, allowSaturday: boolean): Promise<StudentProfile | undefined>;
  
  // Student status operations for family dashboard
  getStudentStatus(studentName: string): Promise<StudentStatus | undefined>;
  upsertStudentStatus(status: InsertStudentStatus): Promise<StudentStatus>;
  updateStudentFlags(studentName: string, flags: { isStuck?: boolean; needsHelp?: boolean; isOvertimeOnTask?: boolean }): Promise<StudentStatus | undefined>;
  getFamilyDashboardData(): Promise<{
    students: Array<StudentStatus & { profile: StudentProfile | null }>;
    needsReview: Array<{ student: string; assignment: string; issue: string }>;
  }>;
  
  // Daily schedule status operations for Overview Mode
  getDailyScheduleStatus(studentName: string, date: string): Promise<Array<DailyScheduleStatus & { template: ScheduleTemplate }>>;
  updateBlockStatus(studentName: string, date: string, templateBlockId: string, status: string, flags?: object): Promise<DailyScheduleStatus | undefined>;
  initializeDailySchedule(studentName: string, date: string): Promise<void>;
  
  // Assignment allocation and scheduling helpers
  allocateAssignmentsToTemplate(studentName: string, date: string): Promise<void>;
  autoScheduleAssignmentsForDate(studentName: string, targetDate: string): Promise<{
    scheduled: number;
    total: number;
    assignments: Assignment[];
  }>;
  rescheduleNeedMoreTime(assignmentId: string, date: string): Promise<void>;
  markStuckWithUndo(assignmentId: string): Promise<void>;
  
  // Hybrid scheduler support methods
  getAssignmentsByStudentAndDate(studentName: string, date: string): Promise<Assignment[]>;
  getAssignmentsByBlock(studentName: string, weekday: string, blockNumber: number): Promise<Assignment[]>;
  
  // Checklist item operations
  getChecklistItems(studentName: string, subject?: string): Promise<ChecklistItem[]>;
  createChecklistItem(item: InsertChecklistItem): Promise<ChecklistItem>;
  updateChecklistItem(id: string, updates: UpdateChecklistItem): Promise<ChecklistItem | undefined>;
  deleteChecklistItem(id: string): Promise<boolean>;
  
  // RewardBank operations - gamification system
  getRewardProfile(userId: string): Promise<RewardProfile | undefined>;
  createRewardProfile(profile: InsertRewardProfile): Promise<RewardProfile>;
  updateRewardProfile(userId: string, pointsToAdd: number): Promise<RewardProfile>;
  getActiveQuests(userId: string): Promise<Quest[]>;
  createQuest(quest: InsertQuest): Promise<Quest>;
  completeQuest(questId: string): Promise<{ quest: Quest; pointsEarned: number; updatedProfile: RewardProfile }>;
  getRewardSettings(userId: string): Promise<RewardSettings | undefined>;
  updateRewardSettings(userId: string, settings: Partial<InsertRewardSettings>): Promise<RewardSettings>;
  checkEarningLimits(userId: string, pointsToAdd: number, settings: RewardSettings | null): Promise<{ allowed: boolean; reason?: string; limitType?: string }>;
  createEarnEvent(event: InsertEarnEvent): Promise<EarnEvent>;
  getEarnHistory(userId: string, limit?: number): Promise<EarnEvent[]>;
  getRewardCatalog(activeOnly?: boolean): Promise<RewardCatalogItem[]>;
  getRewardCatalogItem(id: string): Promise<RewardCatalogItem | undefined>;
  createRewardCatalogItem(item: InsertRewardCatalogItem): Promise<RewardCatalogItem>;
  updateRewardCatalogItem(id: string, updates: Partial<InsertRewardCatalogItem>): Promise<RewardCatalogItem | undefined>;
  createRedemptionRequest(request: InsertRedemptionRequest): Promise<RedemptionRequest>;
  getPendingRedemptionRequests(): Promise<Array<RedemptionRequest & { catalogItem: RewardCatalogItem }>>;
  getLastApprovedRedemption(userId: string): Promise<Date | undefined>;
  decideRedemptionRequest(id: string, decision: string, decidedBy: string, notes?: string): Promise<{ request: RedemptionRequest; pointsDeducted?: number }>;
}

// Database storage implementation using local Replit database
export class DatabaseStorage implements IStorage {

  async getAssignments(userId: string, date?: string, includeCompleted?: boolean): Promise<Assignment[]> {
    try {
      let result = await db.select().from(assignments).where(eq(assignments.userId, userId));
      let assignmentList = result || [];
      
      // For daily scheduling: exclude completed assignments and filter by date
      // This keeps the daily view focused while the database contains the full Canvas dataset
      // Admin mode can include completed assignments by setting includeCompleted = true
      
      // FIRST: ALWAYS filter out non-completable assignments (participation, attendance, etc.)
      // These represent ongoing classroom behavior rather than discrete homework tasks and should NEVER appear
      const beforeTypeFilter = assignmentList.length;
      assignmentList = assignmentList.filter((assignment: any) => {
        const title = (assignment.title || '').toLowerCase();
        const isParticipation = 
          title.includes('class participation') ||
          title.includes('participation') ||
          title.includes('attendance') ||
          title.includes('classroom participation') ||
          title.includes('class engagement') ||
          title.includes('daily participation') ||
          title.startsWith('cap:');
        
        // Filter out "bring" assignments - these are Prep/Load checklist items, not assignment work
        const isBringItem = title.startsWith('bring ');
        
        if (isParticipation) {
          console.log(`🚫 Excluding non-completable assignment: ${assignment.title}`);
          return false;
        }
        if (isBringItem) {
          console.log(`📦 Excluding prep/load item: ${assignment.title}`);
          return false;
        }
        return true;
      });
      console.log(`🎯 Type filtering: ${beforeTypeFilter} → ${assignmentList.length} assignments (excluded participation/attendance/bring-items)`);

      // SECOND: Exclude completed assignments from daily planning (unless admin mode)
      // Only show assignments that are actively workable (pending, needs_more_time, stuck)
      if (!includeCompleted) {
        const beforeCompletionFilter = assignmentList.length;
        assignmentList = assignmentList.filter((assignment: any) => 
          assignment.completionStatus !== 'completed'
        );
        console.log(`📝 Status filtering: ${beforeCompletionFilter} → ${assignmentList.length} assignments (excluded completed assignments)`);
      } else {
        console.log(`🔧 Admin mode: Including completed assignments (${assignmentList.length} total after type filtering)`);
      }
      
      // THIRD: Apply date filtering for daily scheduling
      if (date) {
        let pastLimit: Date, futureLimit: Date;
        
        // Check if this is a date range (comma-separated) or single date
        if (date.includes(',')) {
          // Parse date range: "startDate,endDate"
          const [startDate, endDate] = date.split(',');
          pastLimit = new Date(startDate);
          futureLimit = new Date(endDate);
          // Set futureLimit to end of day (23:59:59) to include assignments due anytime on endDate
          futureLimit.setHours(23, 59, 59, 999);
        } else {
          // Single date - use existing logic for daily scheduling
          const requestDate = new Date(date);
          futureLimit = new Date(requestDate);
          futureLimit.setDate(requestDate.getDate() + 21); // 3 weeks ahead for proper student planning
          
          // Allow overdue assignments up to 30 days back (for catch-up work)
          pastLimit = new Date(requestDate);
          pastLimit.setDate(requestDate.getDate() - 30);
        } 
        
        console.log(`🗓️ Date filtering: ${pastLimit.toISOString().split('T')[0]} to ${futureLimit.toISOString().split('T')[0]} (including overdue assignments)`);
        
        const beforeDateFilter = assignmentList.length;
        assignmentList = assignmentList.filter((assignment: any) => {
          // For assignments without due dates, include them (they're always relevant)
          if (!assignment.dueDate) {
            console.log(`✅ Including assignment (no due date): ${assignment.title}`);
            return true;
          }
          
          const dueDate = new Date(assignment.dueDate);
          // Include assignments due within our window (past or future)
          const isInRange = dueDate >= pastLimit && dueDate <= futureLimit;
          
          if (isInRange) {
            // For date ranges, check if overdue against current date
            const now = new Date();
            const isOverdue = dueDate < now;
            console.log(`✅ Including assignment due ${dueDate.toISOString().split('T')[0]}${isOverdue ? ' (overdue)' : ''}: ${assignment.title}`);
          } else {
            console.log(`❌ Excluding assignment due ${dueDate.toISOString().split('T')[0]} (outside range): ${assignment.title}`);
          }
          
          return isInRange;
        });
        
        console.log(`📊 Date filtering: ${beforeDateFilter} → ${assignmentList.length} assignments`);
      }
      
      return assignmentList;
    } catch (error) {
      console.error('Error getting assignments:', error);
      return [];
    }
  }

  async getAllAssignments(includeDeleted = false): Promise<Assignment[]> {
    try {
      // Get ALL assignments across all users for print queue
      let query = db.select().from(assignments);
      
      // Filter out soft-deleted assignments unless specifically requested
      if (!includeDeleted) {
        query = query.where(isNull(assignments.deletedAt));
      }
      
      const result = await query;
      return result || [];
    } catch (error) {
      console.error('Error getting all assignments:', error);
      return [];
    }
  }

  async getAssignment(id: string): Promise<Assignment | undefined> {
    try {
      const result = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
      return result[0] || undefined;
    } catch (error) {
      console.error('Error getting assignment:', error);
      return undefined;
    }
  }

  // Helper method to determine smart time estimates based on assignment type
  private getSmartTimeEstimate(title: string, studentName?: string): number {
    const lowerTitle = title.toLowerCase();
    
    // Get base category estimate first
    let baseMinutes = this.getCategoryTimeEstimate(lowerTitle);
    
    // Apply student-specific multipliers if student is provided
    if (studentName) {
      baseMinutes = this.applyStudentMultipliers(baseMinutes, lowerTitle, studentName);
    }
    
    return Math.round(baseMinutes);
  }

  // Category-specific base time estimates (proven from current system)
  private getCategoryTimeEstimate(lowerTitle: string): number {
    // Forensics labs - bumped from 60 to 85 minutes (user feedback)
    if (lowerTitle.includes('forensics lab') || lowerTitle.includes('forensic lab')) {
      return 85;
    }
    
    // Recipe reviews are quick - 10 minutes (proven)
    if (lowerTitle.includes('review recipe') || lowerTitle.includes('recipe review')) {
      return 10;
    }
    
    // Enhanced assignment type detection
    if (lowerTitle.includes('quiz') && !lowerTitle.includes('practice')) {
      return 15;
    }
    
    if (lowerTitle.includes('discussion post') || lowerTitle.includes('forum post')) {
      return 20;
    }
    
    // Reading assignments - estimate by content type
    if (this.isReadingAssignment(lowerTitle)) {
      const estimatedPages = this.estimatePages(lowerTitle);
      return estimatedPages * 4; // Base: 4 min/page
    }
    
    // Writing assignments - estimate by word count/type
    if (this.isWritingAssignment(lowerTitle)) {
      const estimatedWords = this.estimateWords(lowerTitle);
      return (estimatedWords / 100) * 14; // Base: 14 min/100 words
    }
    
    // Math/problem assignments
    if (this.isMathAssignment(lowerTitle)) {
      const estimatedProblems = this.estimateProblems(lowerTitle);
      return estimatedProblems * 5; // Base: 5 min/problem
    }
    
    // Default for everything else
    return 30;
  }

  // Apply student-specific learning multipliers
  private applyStudentMultipliers(baseMinutes: number, lowerTitle: string, studentName: string): number {
    const studentKey = studentName.toLowerCase();
    
    // Student profiles based on user guidance:
    // - Khalil: Dyslexia (reading 1.35x), writing challenges
    // - Abigail: EF slowness (global 1.25x), not dyslexia
    
    let multiplier = 1.0;
    
    if (studentKey === 'khalil') {
      // Khalil has dyslexia - stronger reading impact, general learning challenges
      multiplier = 1.2; // Global base
      
      if (this.isReadingAssignment(lowerTitle)) {
        multiplier = 1.35; // Dyslexia reading multiplier
      } else if (this.isWritingAssignment(lowerTitle)) {
        multiplier = 1.35; // Writing also challenging
      }
      
    } else if (studentKey === 'abigail') {
      // Abigail has EF challenges - general slowness but not dyslexia
      multiplier = 1.25; // EF global multiplier
      
      if (this.isWritingAssignment(lowerTitle)) {
        multiplier = 1.4; // Writing particularly challenging for EF
      }
    }
    
    return baseMinutes * multiplier;
  }

  // Assignment type detection helpers
  private isReadingAssignment(lowerTitle: string): boolean {
    const readingPatterns = [
      'read chapter', 'reading assignment', 'textbook reading', 'article reading',
      'study guide', 'reading', 'chapter', 'pages'
    ];
    return readingPatterns.some(pattern => lowerTitle.includes(pattern));
  }

  private isWritingAssignment(lowerTitle: string): boolean {
    const writingPatterns = [
      'essay', 'writing prompt', 'journal entry', 'written assignment',
      'composition', 'report', 'paper', 'write'
    ];
    return writingPatterns.some(pattern => lowerTitle.includes(pattern));
  }

  private isMathAssignment(lowerTitle: string): boolean {
    const mathPatterns = [
      'math problems', 'practice problems', 'solve equations', 'calculations',
      'word problems', 'homework', 'worksheet'
    ];
    return mathPatterns.some(pattern => lowerTitle.includes(pattern));
  }

  // Smart content estimation
  private estimatePages(lowerTitle: string): number {
    // Look for explicit page mentions
    const pageMatch = lowerTitle.match(/(\d+)\s*pages?/);
    if (pageMatch) return parseInt(pageMatch[1]);
    
    const chapterMatch = lowerTitle.match(/chapter\s*(\d+)/);
    if (chapterMatch) return 12; // Average chapter length
    
    return 5; // Conservative default
  }

  private estimateWords(lowerTitle: string): number {
    if (lowerTitle.includes('essay') || lowerTitle.includes('report')) {
      return 300; // Standard essay
    }
    if (lowerTitle.includes('journal')) {
      return 150; // Journal entry
    }
    return 200; // Default writing task
  }

  private estimateProblems(lowerTitle: string): number {
    const problemMatch = lowerTitle.match(/(\d+)\s*problems?/);
    if (problemMatch) return parseInt(problemMatch[1]);
    
    if (lowerTitle.includes('worksheet')) return 15;
    if (lowerTitle.includes('homework')) return 10;
    
    return 8; // Default problem set
  }

  async createAssignment(data: InsertAssignment & { userId: string }): Promise<Assignment> {
    try {
      // Check if this is an administrative assignment that shouldn't be scheduled
      const isAdministrative = data.title.toLowerCase().includes('fee') || 
                              data.title.toLowerCase().includes('supply') ||
                              data.title.toLowerCase().includes('syllabus') ||
                              data.title.toLowerCase().includes('honor code');
      
      const assignmentData = {
        userId: data.userId,
        title: data.title,
        dueDate: data.dueDate || null,
        subject: data.subject || null,
        courseName: data.courseName || null,
        instructions: data.instructions || null,
        // Canvas integration fields - CRITICAL for print queue Canvas links!
        canvasId: data.canvasId || null,
        canvasCourseId: data.canvasCourseId || null,
        canvasInstance: data.canvasInstance || null,
        isCanvasImport: data.isCanvasImport || false,
        // Additional Canvas metadata
        scheduledDate: data.scheduledDate || null,
        scheduledBlock: data.scheduledBlock || null,
        blockStart: data.blockStart || null,
        blockEnd: data.blockEnd || null,
        actualEstimatedMinutes: data.actualEstimatedMinutes || this.getSmartTimeEstimate(data.title, data.userId),
        completionStatus: data.completionStatus || 'pending',
        blockType: data.blockType || 'assignment',
        isAssignmentBlock: data.isAssignmentBlock !== undefined ? data.isAssignmentBlock : true,
        priority: data.priority || 'B',
        difficulty: data.difficulty || 'medium',
        timeSpent: data.timeSpent || 0,
        notes: data.notes || null,
        // Additional Canvas fields
        canvasCategory: data.canvasCategory || null,
        submissionTypes: data.submissionTypes || [],
        pointsValue: data.pointsValue || null,
        availableFrom: data.availableFrom || null,
        availableUntil: data.availableUntil || null,
        isRecurring: data.isRecurring || false,
        academicYear: data.academicYear || null,
        confidenceScore: data.confidenceScore || null,
        // Print queue fields
        needsPrinting: data.needsPrinting || false,
        printStatus: data.printStatus || 'not_needed',
        printReason: data.printReason || null,
        printedAt: data.printedAt || null,
        canvasUrl: data.canvasUrl || null,
        // CO-OP WORKFLOW: Analyze and set assignment portability
        isPortable: data.isPortable,
        portabilityReason: data.portabilityReason
      };

      // Auto-analyze portability if not provided
      if (data.isPortable === undefined) {
        const { analyzeAssignmentPortability } = await import('./lib/assignmentIntelligence');
        const portability = analyzeAssignmentPortability(data.title, data.instructions || '');
        assignmentData.isPortable = portability.isPortable;
        assignmentData.portabilityReason = portability.reason;
        
        console.log(`📱 Auto-analyzed portability for "${data.title}": ${portability.isPortable ? 'PORTABLE' : 'NON-PORTABLE'} - ${portability.reason}`);
      }
      
      const result = await db.insert(assignments).values(assignmentData).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating assignment:', error);
      throw new Error('Failed to create assignment');
    }
  }

  async updateAssignment(id: string, update: UpdateAssignment): Promise<Assignment | undefined> {
    try {
      // Make creation_source "sticky" - once set to 'canvas_sync', it cannot be changed
      let finalUpdate = update;
      if (update.creationSource && update.creationSource !== 'canvas_sync') {
        const existing = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
        if (existing[0] && existing[0].creationSource === 'canvas_sync') {
          console.log(`🔒 Protecting canvas_sync source for "${existing[0].title}" - ignoring attempt to change to "${update.creationSource}"`);
          // Create new update object without creationSource to preserve canvas_sync
          const { creationSource, ...protectedUpdate } = update;
          finalUpdate = protectedUpdate;
        }
      }
      
      const result = await db.update(assignments).set(finalUpdate).where(eq(assignments.id, id)).returning();
      return result[0] || undefined;
    } catch (error) {
      console.error('Error updating assignment:', error);
      return undefined;
    }
  }

  async updateAssignmentStatus(id: string, completionStatus: string): Promise<Assignment | undefined> {
    try {
      const result = await db.update(assignments)
        .set({ 
          completionStatus: completionStatus as Assignment['completionStatus'],
          updatedAt: new Date()
        })
        .where(eq(assignments.id, id))
        .returning();
      return result[0] || undefined;
    } catch (error) {
      console.error('Error updating assignment status:', error);
      return undefined;
    }
  }

  // Bulk update assignment scheduling
  async updateAssignmentScheduling(id: string, scheduling: {
    scheduledDate: string;
    scheduledBlock: number | null;
    blockStart?: string | null;
    blockEnd?: string | null;
  }): Promise<Assignment | undefined> {
    try {
      const result = await db.update(assignments)
        .set({ 
          scheduledDate: scheduling.scheduledDate,
          scheduledBlock: scheduling.scheduledBlock,
          blockStart: scheduling.blockStart || null,
          blockEnd: scheduling.blockEnd || null,
          updatedAt: new Date()
        })
        .where(eq(assignments.id, id))
        .returning();
      return result[0] || undefined;
    } catch (error) {
      console.error('Error updating assignment scheduling:', error);
      return undefined;
    }
  }

  // Auto-schedule assignments for a specific student and date
  async autoScheduleAssignmentsForDate(studentName: string, targetDate: string): Promise<{
    scheduled: number;
    total: number;
    assignments: Assignment[];
  }> {
    try {
      console.log(`🔍 SCHEDULE PLANNER DEBUG: Starting for student=${studentName} date=${targetDate}`);
      const userId = `${studentName.toLowerCase()}-user`;
      
      // Get ALL assignments (including completed) for prerequisite checking
      const allUserAssignments = await this.getAssignments(userId, targetDate, true);
      console.log(`📊 ALL TASKS: ${allUserAssignments.length} assignments found for ${studentName} (including completed)`);
      
      // Get unscheduled assignments (excluding completed) for actual scheduling
      const userAssignments = await this.getAssignments(userId, targetDate);
      console.log(`📊 SCHEDULABLE TASKS: ${userAssignments.length} assignments found for ${studentName}`);
      
      // Count assignments due today
      const targetDateOnly = targetDate.split('T')[0]; // Handle both date and datetime formats
      const dueToday = userAssignments.filter(a => {
        if (!a.dueDate) return false;
        const dueDateOnly = typeof a.dueDate === 'string' ? a.dueDate.split('T')[0] : a.dueDate.toISOString().split('T')[0];
        return dueDateOnly === targetDateOnly;
      });
      console.log(`📅 DUE TODAY: ${dueToday.length} assignments due on ${targetDate}`);
      
      const unscheduledAssignments = userAssignments.filter(a => {
        // CRITICAL FIX: Only exclude completed assignments from TODAY
        // All other pending assignments should be available for rescheduling on refresh!
        
        // First filter: must be pending (never reschedule completed assignments)
        if (a.completionStatus !== 'pending') {
          return false;
        }
        
        // Second filter: NEVER reschedule assignments completed TODAY
        if (a.completionStatus === 'completed' && a.scheduledDate === targetDate) {
          console.log(`🔒 Preserving completed assignment from today: ${a.title}`);
          return false;
        }
        
        // OTHERWISE: ALL pending assignments are eligible for rescheduling
        // This includes assignments scheduled for other days, other blocks, etc.
        // The scheduler should redistribute workload dynamically on every refresh!
        
        // CRITICAL: Exclude parent/administrative assignments AND Bible assignments from student scheduling
        const title = a.title.toLowerCase();
        const subject = (a.subject || '').toLowerCase();
        const isParentTask = title.includes('fee') || 
                            title.includes('supply') || 
                            title.includes('permission') || 
                            title.includes('form') ||
                            title.includes('waiver') ||
                            title.includes('registration') ||
                            title.includes('syllabus') ||
                            title.includes('honor code');
        
        const isBibleAssignment = title.includes('bible') || 
                                 subject.includes('bible') ||
                                 title.includes('scripture') ||
                                 subject.includes('scripture');
        
        if (isParentTask) {
          console.log(`🚫 Excluding parent task from student scheduling: ${a.title}`);
          return false;
        }
        
        if (isBibleAssignment) {
          console.log(`📖 Excluding Bible assignment from regular scheduling (Bible blocks only): ${a.title}`);
          return false;
        }
        
        return true;
      });
      
      console.log(`🔍 FILTERED: ${unscheduledAssignments.length} assignments after filtering out completed/parent/bible tasks`);
      
      
      // SMART CLEARING: Only clear unworked assignments, preserve completed/marked work
      // This preserves "Need More Time", completed, and in-progress assignments
      console.log(`🧹 SMART CLEARING: Removing only unworked scheduled assignments for ${studentName} on ${targetDate}`);
      
      const clearedAssignments = await db.update(assignments)
        .set({ 
          scheduledDate: null, 
          scheduledBlock: null,
          blockStart: null,
          blockEnd: null
        })
        .where(
          and(
            eq(assignments.userId, userId),
            eq(assignments.scheduledDate, targetDate),
            // CRITICAL: Only clear assignments that haven't been worked on
            eq(assignments.completionStatus, 'pending')
            // This preserves: completed, needMoreTime, inProgress, stuck, etc.
          )
        )
        .returning();
        
      console.log(`🧹 CLEARED: ${clearedAssignments.length} unworked assignments cleared from ${targetDate} (preserving completed/marked work)`);
      
      // NEED MORE TIME LOGIC: Move "needs_more_time" assignments to next day
      const needMoreTimeAssignments = userAssignments.filter(a => 
        a.completionStatus === 'needs_more_time' && a.scheduledDate === targetDate
      );
      
      if (needMoreTimeAssignments.length > 0) {
        console.log(`⏭️ NEED MORE TIME: Moving ${needMoreTimeAssignments.length} assignments to next day`);
        
        const nextDate = new Date(targetDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateString = nextDate.toISOString().split('T')[0];
        
        for (const assignment of needMoreTimeAssignments) {
          await db.update(assignments)
            .set({ 
              scheduledDate: nextDateString,
              scheduledBlock: null, // Will be rescheduled by next day's scheduler
              blockStart: null,
              blockEnd: null
            })
            .where(eq(assignments.id, assignment.id));
            
          console.log(`⏭️ MOVED: "${assignment.title}" → ${nextDateString} (Need More Time)`);
        }
      }
      
      
      // Now get ALL available assignments for rescheduling (fresh start)
      const assignmentsToSchedule = unscheduledAssignments.filter(a => {
        // Additional sequence validation - don't even consider out-of-sequence assignments
        const candidateUnit = extractUnitNumber(a.title);
        
        
        // SEQUENCE LOGIC REMOVED: Don't block assignments, just ensure proper ordering during scheduling
        
        return true;
      });
      
      // Get schedule template blocks
      const targetDateObj = new Date(targetDate);
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const weekday = weekdays[targetDateObj.getDay()];
      const scheduleBlocks = await this.getScheduleTemplate(studentName, weekday);
      
      // Check for Co-op Day detection
      const studyHallBlocks = scheduleBlocks.filter(block => block.blockType === 'Study Hall');
      let assignmentBlocks = scheduleBlocks.filter(block => block.blockType === 'Assignment');
      const isCoopDay = studyHallBlocks.length > 0;
      console.log(`🏫 CO-OP DAY CHECK: ${isCoopDay ? 'YES' : 'NO'} - ${assignmentBlocks.length} home blocks + ${studyHallBlocks.length} study hall blocks on ${weekday}`);
      
      // PLANNER FIX: Create default Assignment blocks if none exist and assignments are due today
      if (assignmentBlocks.length === 0 && dueToday.length > 0) {
        console.log(`🔧 PLANNER FIX: No assignment blocks found but ${dueToday.length} assignments due today - creating default blocks`);
        
        const defaultBlocks = [
          {
            id: `temp-1-${studentName}-${weekday}`,
            studentName: studentName,
            weekday: weekday,
            blockNumber: 1,
            startTime: '09:00',
            endTime: '10:00',
            subject: 'Assignment',
            blockType: 'Assignment' as const
          },
          {
            id: `temp-2-${studentName}-${weekday}`,
            studentName: studentName,
            weekday: weekday,
            blockNumber: 2,
            startTime: '10:00',
            endTime: '11:00',
            subject: 'Assignment',
            blockType: 'Assignment' as const
          },
          {
            id: `temp-3-${studentName}-${weekday}`,
            studentName: studentName,
            weekday: weekday,
            blockNumber: 3,
            startTime: '11:00',
            endTime: '12:00',
            subject: 'Assignment',
            blockType: 'Assignment' as const
          }
        ];
        
        assignmentBlocks = defaultBlocks;
        console.log(`✅ Created ${defaultBlocks.length} temporary assignment blocks for scheduling`);
      }
      
      console.log(`🎯 Using SINGLE-DAY SCHEDULER (Generic for ANY day) for ${studentName}`);
      console.log(`📚 Assignments to schedule: ${assignmentsToSchedule.length}`);
      console.log(`🏫 Available blocks: ${assignmentBlocks.length} Assignment + ${studyHallBlocks.length} Study Hall`);
      
      // CORE PRINCIPLE: Work generically for ANY target date, no day-of-week dependencies
      // Simply fill available blocks on THIS specific date with prioritized assignments
      const allAvailableBlocks = [...assignmentBlocks, ...studyHallBlocks]
        .sort((a, b) => {
          // Sort blocks by start time 
          const timeA = a.startTime || '00:00';
          const timeB = b.startTime || '00:00';
          return timeA.localeCompare(timeB);
        });
      
      console.log(`📅 GENERIC SCHEDULING: Filling ${allAvailableBlocks.length} blocks on ${targetDate}`);
      
      // ENHANCED ASSIGNMENT PRIORITIZATION with urgency-based bumping
      const prioritizedAssignments = assignmentsToSchedule.sort((a, b) => {
        // Priority 1: URGENT - Overdue assignments (must be scheduled today)
        const aOverdue = a.dueDate && new Date(a.dueDate) < new Date(targetDate);
        const bOverdue = b.dueDate && new Date(b.dueDate) < new Date(targetDate);
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        
        // Priority 2: HIGH - Due TODAY (must be scheduled today) 
        const aDueToday = a.dueDate && new Date(a.dueDate).toISOString().split('T')[0] === targetDateOnly;
        const bDueToday = b.dueDate && new Date(b.dueDate).toISOString().split('T')[0] === targetDateOnly;
        if (aDueToday && !bDueToday) return -1;
        if (!aDueToday && bDueToday) return 1;
        
        // Priority 3: MEDIUM - Due within 2 days (can be moved if needed)
        if (a.dueDate && b.dueDate) {
          const dateDiff = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
          if (Math.abs(dateDiff) > 172800000) return dateDiff; // More than 2 days difference
        }
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        
        // Priority 4: Use intelligent sequence sorting (Unit 2 → Unit 3)
        return compareAssignmentTitles(a.title || '', b.title || '');
      });
      
      // URGENCY CLASSIFICATION: Separate critical vs moveable assignments
      const urgentAssignments = prioritizedAssignments.filter(a => {
        const isOverdue = a.dueDate && new Date(a.dueDate) < new Date(targetDate);
        const isDueToday = a.dueDate && new Date(a.dueDate).toISOString().split('T')[0] === targetDateOnly;
        return isOverdue || isDueToday;
      });
      
      const moveableAssignments = prioritizedAssignments.filter(a => {
        const isOverdue = a.dueDate && new Date(a.dueDate) < new Date(targetDate);
        const isDueToday = a.dueDate && new Date(a.dueDate).toISOString().split('T')[0] === targetDateOnly;
        return !isOverdue && !isDueToday;
      });
      
      console.log(`🚨 URGENT: ${urgentAssignments.length} assignments must be scheduled today (overdue/due today)`);
      console.log(`📅 MOVEABLE: ${moveableAssignments.length} assignments can be moved to next day if needed`);

      // SIMPLE SEQUENTIAL SCHEDULING: Assign sorted assignments to blocks in order
      const schedulingResults = new Map();
      const scheduledAssignments: any[] = [];
      
      // Take assignments in the exact order they were prioritized and sorted
      const assignmentsToAssign = [...prioritizedAssignments];
      const blocksToFill = [...allAvailableBlocks];
      
      // Simple assignment: first sorted assignment → first block, second → second block, etc.
      for (let i = 0; i < Math.min(assignmentsToAssign.length, blocksToFill.length); i++) {
        const assignment = assignmentsToAssign[i];
        const block = blocksToFill[i];
        
        // Check if urgent (must be scheduled today)
        const isOverdue = assignment.dueDate && new Date(assignment.dueDate) < new Date(targetDate);
        const isDueToday = assignment.dueDate && new Date(assignment.dueDate).toISOString().split('T')[0] === targetDateOnly;
        const isUrgent = isOverdue || isDueToday;
        
        schedulingResults.set(assignment.id, {
          scheduledDate: targetDate,
          scheduledBlock: block.blockNumber,
          blockStart: block.startTime,
          blockEnd: block.endTime
        });
        
        scheduledAssignments.push(assignment);
        console.log(`📍 SCHEDULED: "${assignment.title}" → Block ${block.blockNumber} (${isUrgent ? 'URGENT' : 'MOVEABLE'})`);
      }
      
      // OVERFLOW HANDLING: Move unscheduled MOVEABLE assignments to next day
      const unscheduledMoveable = availableAssignments.filter(a => moveableAssignments.includes(a));
      if (unscheduledMoveable.length > 0) {
        console.log(`⏭️ OVERFLOW: Moving ${unscheduledMoveable.length} non-urgent assignments to next day`);
        
        const nextDate = new Date(targetDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateString = nextDate.toISOString().split('T')[0];
        
        for (const assignment of unscheduledMoveable) {
          await db.update(assignments)
            .set({ scheduledDate: nextDateString })
            .where(eq(assignments.id, assignment.id));
            
          console.log(`⏭️ MOVED: "${assignment.title}" → ${nextDateString} (overflow)`);
        }
      }
      
      console.log(`📊 SCHEDULED: ${schedulingResults.size} assignments scheduled by the planner`);
      
      // Update assignments in database
      const updatedAssignments: Assignment[] = [];
      let scheduledCount = 0;
      
      for (const [assignmentId, result] of Array.from(schedulingResults.entries())) {
        console.log(`🔧 UPDATING assignment ${assignmentId}: scheduledDate=${result.scheduledDate}, scheduledBlock=${result.scheduledBlock}`);
        
        const updated = await this.updateAssignmentScheduling(assignmentId, {
          scheduledDate: result.scheduledDate,
          scheduledBlock: result.scheduledBlock,
          blockStart: result.blockStart,
          blockEnd: result.blockEnd
        });
        
        if (updated) {
          console.log(`✅ UPDATED assignment ${updated.title}: block=${updated.scheduledBlock}`);
          updatedAssignments.push(updated);
          scheduledCount++;
        } else {
          console.log(`❌ FAILED to update assignment ${assignmentId}`);
        }
      }
      
      console.log(`🎯 Auto-Scheduling Complete: ${scheduledCount}/${unscheduledAssignments.length} assignments scheduled for ${studentName} on ${targetDate}`);
      
      return {
        scheduled: scheduledCount,
        total: unscheduledAssignments.length,
        assignments: updatedAssignments
      };
      
    } catch (error) {
      console.error('Error auto-scheduling assignments:', error);
      throw new Error('Failed to auto-schedule assignments');
    }
  }

  async updateAdministrativeAssignments(): Promise<void> {
    try {
      // Get all assignments and update administrative ones
      const allAssignments = await db.select().from(assignments);
      
      for (const assignment of allAssignments) {
        const title = assignment.title.toLowerCase();
        
        // Use word boundaries and more precise matching to avoid false positives
        // Only match whole words, not substrings
        const isAdministrative = /\b(fee|supply|permission|waiver|registration)\b/.test(title) ||
                                title.includes('syllabus') ||
                                title.includes('honor code') ||
                                title.includes('copy fee') ||
                                title.includes('class fee') ||
                                title.includes('supply fee') ||
                                title.includes('lab fee') ||
                                (title.includes('form') && !title.includes('information') && !title.includes('transform') && !title.includes('format') && !title.includes('perform'));
        
        if (isAdministrative) {
          await db.update(assignments)
            .set({ 
              notes: assignment.notes ? `${assignment.notes} [PARENT TASK]` : '[PARENT TASK]' // Mark as parent task but keep manual completion
            })
            .where(eq(assignments.id, assignment.id));
          
          console.log(`🏷️ Identified parent task (manual completion required): ${assignment.title}`);
        }
      }
    } catch (error) {
      console.error('Error updating administrative assignments:', error);
    }
  }

  async deleteAssignment(id: string): Promise<boolean> {
    try {
      await db.delete(assignments).where(eq(assignments.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting assignment:', error);
      return false;
    }
  }

  async markAssignmentDeleted(id: string): Promise<Assignment | undefined> {
    try {
      // Soft delete: set deletedAt timestamp instead of removing from database
      const result = await db.update(assignments)
        .set({ deletedAt: new Date() })
        .where(eq(assignments.id, id))
        .returning();
      return result[0] || undefined;
    } catch (error) {
      console.error('Error marking assignment as deleted:', error);
      return undefined;
    }
  }

  async getDeletedAssignments(): Promise<Assignment[]> {
    try {
      // Get all assignments that have been soft deleted (deletedAt is not null)
      const result = await db.select().from(assignments).where(isNotNull(assignments.deletedAt));
      return result || [];
    } catch (error) {
      console.error('Error getting deleted assignments:', error);
      return [];
    }
  }

  // Schedule template operations
  async getScheduleTemplate(studentName: string, weekday?: string): Promise<ScheduleTemplate[]> {
    try {
      let whereCondition = eq(scheduleTemplate.studentName, studentName);
      
      if (weekday) {
        whereCondition = and(eq(scheduleTemplate.studentName, studentName), eq(scheduleTemplate.weekday, weekday))!;
      }
      
      const result = await db.select().from(scheduleTemplate).where(whereCondition).orderBy(sql`${scheduleTemplate.startTime}::time`);
      
      return result || [];
    } catch (error) {
      console.error('Error getting schedule template:', error);
      return [];
    }
  }

  async createScheduleTemplate(template: InsertScheduleTemplate): Promise<ScheduleTemplate> {
    try {
      const result = await db.insert(scheduleTemplate).values(template).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating schedule template:', error);
      throw new Error('Failed to create schedule template');
    }
  }

  async updateScheduleTemplate(studentName: string, weekday: string, blocks: ScheduleTemplate[], isAuthorizedAdmin: boolean = false): Promise<void> {
    if (!isAuthorizedAdmin) {
      throw new Error('PROTECTED: Schedule template modifications only allowed from authorized admin interface');
    }
    
    try {
      console.log(`🔍 DEBUG: About to delete existing blocks for ${studentName} ${weekday}`);
      
      // Delete existing blocks for this student/weekday
      const deleteResult = await db.delete(scheduleTemplate).where(
        and(
          eq(scheduleTemplate.studentName, studentName),
          eq(scheduleTemplate.weekday, weekday)
        )
      );
      
      console.log(`🔍 DEBUG: Delete completed, attempting insert of ${blocks.length} blocks`);

      // Insert new blocks with corrected student name
      if (blocks.length > 0) {
        const insertBlocks = blocks.map(block => ({
          studentName: studentName, // Force use the correct studentName parameter
          weekday: weekday, // Force use the correct weekday parameter
          blockNumber: block.blockNumber,
          startTime: block.startTime,
          endTime: block.endTime,
          subject: block.subject,
          blockType: block.blockType
        }));
        
        console.log(`🔍 DEBUG: Insert data preview:`, insertBlocks.slice(0, 3));
        console.log(`🔍 DEBUG: Block numbers being inserted:`, insertBlocks.map(b => b.blockNumber));
        
        await db.insert(scheduleTemplate).values(insertBlocks);
      }
      
      console.log(`✅ AUTHORIZED: Updated schedule template for ${studentName} on ${weekday} with ${blocks.length} blocks`);
    } catch (error) {
      const errorObj = error as Error;
      console.error('Error updating schedule template:', {
        message: errorObj.message,
        stack: errorObj.stack,
        studentName,
        weekday,
        blocksCount: blocks.length,
        sampleBlock: blocks[0] ? {
          studentName: blocks[0].studentName,
          weekday: blocks[0].weekday,
          blockNumber: blocks[0].blockNumber,
          subject: blocks[0].subject,
          blockType: blocks[0].blockType
        } : 'No blocks'
      });
      throw new Error(`Failed to update schedule template: ${errorObj.message}`);
    }
  }

  // Replace entire schedule template from CSV data
  async replaceScheduleTemplateFromCSV(csvData: any[]): Promise<void> {
    try {
      console.log(`🔒 AUTHORIZED: Replacing entire schedule_template with ${csvData.length} CSV records`);
      
      // Delete all existing schedule template records
      await db.delete(scheduleTemplate);
      console.log(`🗂️ Cleared all existing schedule template records`);
      
      if (csvData.length > 0) {
        // Transform CSV data to match database schema and auto-generate missing block numbers
        const insertBlocks = csvData.map(row => ({
          id: row.id || undefined, // Use CSV ID if provided, otherwise let DB generate
          studentName: row.student_name,
          weekday: row.weekday,
          blockNumber: row.block_number ? parseInt(row.block_number) : null,
          startTime: row.start_time,
          endTime: row.end_time,
          subject: row.subject,
          blockType: row.block_type as 'Bible' | 'Assignment' | 'Travel' | 'Co-op' | 'Study Hall' | 'Prep/Load' | 'Movement' | 'Lunch'
        }));

        // Auto-generate block numbers only for block types that should have them
        const blockTypesWithNumbers = ['Bible', 'Assignment', 'Co-op', 'Study Hall'];
        const blockNumberMap = new Map<string, number>(); // key: "studentName-weekday"
        
        insertBlocks.forEach(block => {
          if (block.blockNumber === null && blockTypesWithNumbers.includes(block.blockType)) {
            const key = `${block.studentName}-${block.weekday}`;
            if (!blockNumberMap.has(key)) {
              // Find the highest existing block number for this student/weekday
              const maxExisting = Math.max(0, ...insertBlocks
                .filter(b => b.studentName === block.studentName && b.weekday === block.weekday && b.blockNumber !== null)
                .map(b => b.blockNumber || 0)
              );
              blockNumberMap.set(key, maxExisting + 1);
            }
            block.blockNumber = blockNumberMap.get(key)!;
            blockNumberMap.set(key, blockNumberMap.get(key)! + 1);
          }
          // Leave block.blockNumber as null for Travel, Movement, Lunch, etc.
        });

        // Deduplicate records to prevent constraint violations
        // Use more specific key that includes time to avoid removing valid null blocks
        const uniqueBlocks = new Map();
        const deduplicatedBlocks = [];
        
        for (const block of insertBlocks) {
          const key = `${block.studentName}-${block.weekday}-${block.blockNumber}-${block.startTime}-${block.endTime}`;
          if (!uniqueBlocks.has(key)) {
            uniqueBlocks.set(key, true);
            deduplicatedBlocks.push(block);
          } else {
            console.log(`🚫 DUPLICATE REMOVED: ${block.studentName} ${block.weekday} Block ${block.blockNumber} (${block.subject})`);
          }
        }
        
        console.log(`📝 Inserting ${deduplicatedBlocks.length} deduplicated records (${insertBlocks.length - deduplicatedBlocks.length} duplicates removed)`);
        console.log(`🔍 Sample records:`, deduplicatedBlocks.slice(0, 3));
        
        // Insert new records in batches to avoid query size limits
        const batchSize = 50;
        for (let i = 0; i < deduplicatedBlocks.length; i += batchSize) {
          const batch = deduplicatedBlocks.slice(i, i + batchSize);
          await db.insert(scheduleTemplate).values(batch);
        }
      }
      
      console.log(`✅ AUTHORIZED: Successfully replaced schedule template with ${csvData.length} records from CSV`);
    } catch (error) {
      const errorObj = error as Error;
      console.error('Error replacing schedule template from CSV:', error);
      throw new Error(`Failed to replace schedule template from CSV: ${errorObj.message}`);
    }
  }

  // Bible curriculum operations
  async getBibleCurriculum(weekNumber?: number): Promise<BibleCurriculum[]> {
    try {
      let whereCondition = weekNumber !== undefined ? eq(bibleCurriculum.weekNumber, weekNumber) : sql`1=1`;
      
      const result = await db.select().from(bibleCurriculum)
        .where(whereCondition)
        .orderBy(bibleCurriculum.weekNumber, bibleCurriculum.dayOfWeek);
      
      return result || [];
    } catch (error) {
      console.error('Error getting bible curriculum:', error);
      return [];
    }
  }

  async getBibleCurrentWeek(): Promise<BibleCurriculum[]> {
    try {
      // Calculate current week based on school year start date
      const schoolYearStart = new Date('2025-08-26'); // Typical school year start
      const today = new Date();
      
      // Calculate weeks since school started
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksSinceStart = Math.floor((today.getTime() - schoolYearStart.getTime()) / msPerWeek) + 1;
      
      // Ensure we stay within the 52-week curriculum bounds
      const currentWeek = Math.max(1, Math.min(weeksSinceStart, 52));
      
      return this.getBibleCurriculum(currentWeek);
    } catch (error) {
      console.error('Error getting current bible week:', error);
      // Fallback to week 1 if calculation fails
      return this.getBibleCurriculum(1);
    }
  }

  async updateBibleCompletion(weekNumber: number, dayOfWeek: number, completed: boolean): Promise<BibleCurriculum | undefined> {
    try {
      const updateData = {
        completed,
        completedAt: completed ? new Date() : null
      };
      
      const result = await db.update(bibleCurriculum)
        .set(updateData)
        .where(and(eq(bibleCurriculum.weekNumber, weekNumber), eq(bibleCurriculum.dayOfWeek, dayOfWeek)))
        .returning();
      
      return result[0] || undefined;
    } catch (error) {
      console.error('Error updating bible completion:', error);
      return undefined;
    }
  }

  // Student profile operations
  async getStudentProfile(studentName: string): Promise<StudentProfile | undefined> {
    try {
      // CASE FIX: Convert to lowercase to match database storage format
      const normalizedName = studentName.toLowerCase();
      const result = await db.select().from(studentProfiles).where(eq(studentProfiles.studentName, normalizedName)).limit(1);
      
      return result[0] || undefined;
    } catch (error) {
      console.error('Error getting student profile:', error);
      return undefined;
    }
  }

  async upsertStudentProfile(profile: InsertStudentProfile): Promise<StudentProfile> {
    try {
      const existing = await this.getStudentProfile(profile.studentName);
      
      if (existing) {
        // Update existing profile
        const result = await db
          .update(studentProfiles)
          .set({
            ...profile,
            profileImageUrl: profile.profileImageUrl || null,
            themeColor: profile.themeColor || null,
            updatedAt: new Date()
          })
          .where(eq(studentProfiles.studentName, profile.studentName))
          .returning();
        return result[0];
      } else {
        // Create new profile
        const result = await db.insert(studentProfiles).values({
          ...profile,
          profileImageUrl: profile.profileImageUrl || null
        }).returning();
        return result[0];
      }
    } catch (error) {
      console.error('Error upserting student profile:', error);
      throw new Error('Failed to update student profile');
    }
  }

  async getAllStudentProfiles(): Promise<StudentProfile[]> {
    try {
      const result = await db.select().from(studentProfiles);
      return result;
    } catch (error) {
      console.error('Error getting all student profiles:', error);
      return [];
    }
  }

  async updateStudentSaturdayScheduling(studentName: string, allowSaturday: boolean): Promise<StudentProfile | undefined> {
    try {
      const [result] = await db
        .update(studentProfiles)
        .set({
          allowSaturdayScheduling: allowSaturday,
          updatedAt: new Date()
        })
        .where(eq(studentProfiles.studentName, studentName))
        .returning();
      
      return result;
    } catch (error) {
      console.error('Error updating Saturday scheduling preference:', error);
      return undefined;
    }
  }

  // Student status operations for family dashboard
  async getStudentStatus(studentName: string): Promise<StudentStatus | undefined> {
    try {
      const result = await db.select().from(studentStatus).where(eq(studentStatus.studentName, studentName)).limit(1);
      return result[0] || undefined;
    } catch (error) {
      console.error('Error getting student status:', error);
      return undefined;
    }
  }

  async upsertStudentStatus(status: InsertStudentStatus): Promise<StudentStatus> {
    try {
      console.log(`📊 Upserting student status for: ${status.studentName}`);
      
      const [result] = await db
        .insert(studentStatus)
        .values({
          ...status,
          currentAssignmentId: status.currentAssignmentId || null,
          currentMode: status.currentMode || null,
          currentAssignmentTitle: status.currentAssignmentTitle || null,
          sessionStartTime: status.sessionStartTime || null,
          estimatedEndTime: status.estimatedEndTime || null,
          isStuck: status.isStuck || null,
          stuckSince: status.stuckSince || null,
          needsHelp: status.needsHelp || null,
          isOvertimeOnTask: status.isOvertimeOnTask || null,
          completedToday: status.completedToday || null,
          totalToday: status.totalToday || null,
          minutesWorkedToday: status.minutesWorkedToday || null,
          targetMinutesToday: status.targetMinutesToday || null,
          lastActivity: status.lastActivity || null,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: studentStatus.studentName,
          set: {
            ...status,
            currentAssignmentId: status.currentAssignmentId || null,
            currentMode: status.currentMode || null,
            currentAssignmentTitle: status.currentAssignmentTitle || null,
            sessionStartTime: status.sessionStartTime || null,
            estimatedEndTime: status.estimatedEndTime || null,
            isStuck: status.isStuck || null,
            stuckSince: status.stuckSince || null,
            needsHelp: status.needsHelp || null,
            isOvertimeOnTask: status.isOvertimeOnTask || null,
            completedToday: status.completedToday || null,
            totalToday: status.totalToday || null,
            minutesWorkedToday: status.minutesWorkedToday || null,
            targetMinutesToday: status.targetMinutesToday || null,
            lastActivity: status.lastActivity || null,
            updatedAt: new Date()
          }
        })
        .returning();

      return result;
    } catch (error) {
      console.error('Error upserting student status:', error);
      throw new Error('Failed to upsert student status');
    }
  }

  async updateStudentFlags(studentName: string, flags: { isStuck?: boolean; needsHelp?: boolean; isOvertimeOnTask?: boolean }): Promise<StudentStatus | undefined> {
    try {
      const updateData: any = { updatedAt: new Date() };
      
      if (flags.isStuck !== undefined) {
        updateData.isStuck = flags.isStuck;
        updateData.stuckSince = flags.isStuck ? new Date() : null;
      }
      if (flags.needsHelp !== undefined) updateData.needsHelp = flags.needsHelp;
      if (flags.isOvertimeOnTask !== undefined) updateData.isOvertimeOnTask = flags.isOvertimeOnTask;

      const [result] = await db
        .update(studentStatus)
        .set(updateData)
        .where(eq(studentStatus.studentName, studentName))
        .returning();

      return result;
    } catch (error) {
      console.error('Error updating student flags:', error);
      return undefined;
    }
  }

  async getFamilyDashboardData(): Promise<{
    students: Array<StudentStatus & { profile: StudentProfile | null }>;
    needsReview: Array<{ student: string; assignment: string; issue: string }>;
  }> {
    try {
      // Get all student statuses with their profiles
      const statusResults = await db
        .select()
        .from(studentStatus);

      const studentsData = [];
      
      for (const status of statusResults) {
        const profile = await this.getStudentProfile(status.studentName);
        studentsData.push({
          ...status,
          profile: profile || null
        });
      }

      // Get assignments that need parent attention
      const today = new Date().toISOString().split('T')[0];
      const needsReviewAssignments = await db
        .select()
        .from(assignments)
        .where(
          and(
            eq(assignments.completionStatus, 'stuck')
          )
        );

      const needsReview = needsReviewAssignments.map(assignment => {
        // Map user ID to student name
        const studentName = assignment.userId === 'abigail-user' ? 'Abigail' : 
                            assignment.userId === 'khalil-user' ? 'Khalil' : assignment.userId;
        
        return {
          student: studentName,
          assignment: assignment.title,
          issue: 'Marked as stuck - needs assistance'
        };
      });

      return {
        students: studentsData,
        needsReview
      };
    } catch (error) {
      console.error('Error getting family dashboard data:', error);
      return {
        students: [],
        needsReview: []
      };
    }
  }

  // Daily schedule status operations for Overview Mode
  async getDailyScheduleStatus(studentName: string, date: string): Promise<Array<DailyScheduleStatus & { template: ScheduleTemplate }>> {
    try {
      // First initialize the daily schedule if it doesn't exist
      await this.initializeDailySchedule(studentName, date);

      // Get status records with template details
      const result = await db
        .select({
          id: dailyScheduleStatus.id,
          studentName: dailyScheduleStatus.studentName,
          date: dailyScheduleStatus.date,
          templateBlockId: dailyScheduleStatus.templateBlockId,
          status: dailyScheduleStatus.status,
          completedAt: dailyScheduleStatus.completedAt,
          startedAt: dailyScheduleStatus.startedAt,
          currentAssignmentId: dailyScheduleStatus.currentAssignmentId,
          flags: dailyScheduleStatus.flags,
          createdAt: dailyScheduleStatus.createdAt,
          updatedAt: dailyScheduleStatus.updatedAt,
          template: scheduleTemplate
        })
        .from(dailyScheduleStatus)
        .innerJoin(scheduleTemplate, eq(dailyScheduleStatus.templateBlockId, scheduleTemplate.id))
        .where(and(
          eq(dailyScheduleStatus.studentName, studentName),
          eq(dailyScheduleStatus.date, date)
        ))
        .orderBy(scheduleTemplate.startTime);

      return result;
    } catch (error) {
      console.error('Error getting daily schedule status:', error);
      return [];
    }
  }

  async updateBlockStatus(studentName: string, date: string, templateBlockId: string, status: string, flags?: object): Promise<DailyScheduleStatus | undefined> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      // Set timestamps based on status
      if (status === 'in-progress') {
        updateData.startedAt = new Date();
      } else if (status === 'complete') {
        updateData.completedAt = new Date();
      }

      const result = await db
        .update(dailyScheduleStatus)
        .set(updateData)
        .where(and(
          eq(dailyScheduleStatus.studentName, studentName),
          eq(dailyScheduleStatus.date, date),
          eq(dailyScheduleStatus.templateBlockId, templateBlockId)
        ))
        .returning();

      return result[0] || undefined;
    } catch (error) {
      console.error('Error updating block status:', error);
      return undefined;
    }
  }

  async initializeDailySchedule(studentName: string, date: string): Promise<void> {
    try {
      // Get current weekday (0 = Sunday, 1 = Monday, etc.)
      const targetDate = new Date(date);
      const weekday = targetDate.getDay();
      const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const weekdayName = weekdayNames[weekday];
      
      // Get all schedule template blocks for this student and weekday
      const templateBlocks = await this.getScheduleTemplate(studentName, weekdayName);

      // Check which blocks already have status records
      const existingStatuses = await db
        .select()
        .from(dailyScheduleStatus)
        .where(and(
          eq(dailyScheduleStatus.studentName, studentName),
          eq(dailyScheduleStatus.date, date)
        ));

      const existingBlockIds = new Set(existingStatuses.map(s => s.templateBlockId));

      // Create status records for missing blocks
      const missingBlocks = templateBlocks.filter(block => !existingBlockIds.has(block.id));

      if (missingBlocks.length > 0) {
        const statusRecords = missingBlocks.map(block => ({
          studentName,
          date,
          templateBlockId: block.id,
          status: 'not-started' as const,
        }));

        await db.insert(dailyScheduleStatus).values(statusRecords);
      }
      
      // After creating missing daily schedule status rows, allocate assignments to template
      await this.allocateAssignmentsToTemplate(studentName, date);
    } catch (error) {
      console.error('Error initializing daily schedule:', error);
    }
  }

  // Allocate assignments to template blocks using sophisticated scheduling system
  async allocateAssignmentsToTemplate(studentName: string, date: string): Promise<void> {
    try {
      console.log(`🔍 SOPHISTICATED SCHEDULER: Starting for student=${studentName} date=${date}`);
      
      // Get current weekday
      const targetDate = new Date(date);
      const weekday = targetDate.getDay();
      const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const weekdayName = weekdayNames[weekday];
      
      // Check if this is Saturday and if Saturday scheduling is enabled
      if (weekday === 6) { // Saturday
        const studentProfile = await this.getStudentProfile(studentName);
        
        if (!studentProfile?.allowSaturdayScheduling) {
          console.log(`🗓️ Saturday scheduling disabled for ${studentName} - skipping assignment allocation`);
          return; // Skip Saturday scheduling entirely when disabled
        }
        console.log(`🗓️ Saturday scheduling enabled for ${studentName} - proceeding with assignment allocation`);
      }
      
      // Get all template blocks for validation
      const templateBlocks = await this.getScheduleTemplate(studentName, weekdayName);
      
      // Safety check for template completeness (reduced requirement for Saturday)
      const minBlocks = weekday === 6 ? 3 : 6; // Saturday needs at least 3 blocks, weekdays need 6
      if (templateBlocks.length < minBlocks) {
        console.error(`❌ TEMPLATE ERROR: Template incomplete for ${studentName} on ${weekdayName} - only ${templateBlocks.length} blocks found (minimum ${minBlocks})`);
        throw new Error(JSON.stringify({
          error: {
            code: "TEMPLATE_INCOMPLETE", 
            message: "Schedule template incomplete for this day"
          }
        }));
      }
      
      console.log(`✅ Template validated: ${templateBlocks.length} blocks found for ${weekdayName}`);
      
      // Use the sophisticated hybrid scheduler with student intelligence
      console.log(`🚀 Delegating to sophisticated hybrid scheduler system...`);
      const result = await this.autoScheduleAssignmentsForDate(studentName, date);
      
      console.log(`✅ SOPHISTICATED SCHEDULER: Completed for ${studentName} - ${result.scheduled}/${result.total} assignments scheduled`);
      
    } catch (error) {
      console.error('Error in sophisticated scheduler:', error);
      throw error;
    }
  }

  // Reschedule assignment that needs more time
  async rescheduleNeedMoreTime(assignmentId: string, date: string): Promise<void> {
    try {
      console.log(`⏰ Rescheduling assignment ${assignmentId} from ${date}`);
      
      // Get the assignment and clear its current scheduling
      const assignment = await this.getAssignment(assignmentId);
      if (!assignment) {
        throw new Error(`Assignment ${assignmentId} not found`);
      }
      
      // Clear current scheduling
      await this.updateAssignmentScheduling(assignmentId, {
        scheduledDate: null,
        scheduledBlock: null,
        blockStart: null,
        blockEnd: null
      });
      
      // Set status to needs_more_time
      await this.updateAssignmentStatus(assignmentId, 'needs_more_time');
      
      console.log(`✅ Assignment ${assignment.title} rescheduled and marked as needs more time`);
      
    } catch (error) {
      console.error('Error rescheduling assignment:', error);
      throw error;
    }
  }

  // Mark assignment as stuck with undo capability
  async markStuckWithUndo(assignmentId: string): Promise<void> {
    try {
      console.log(`🚩 Marking assignment ${assignmentId} as stuck`);
      
      // Update assignment status to stuck
      await this.updateAssignmentStatus(assignmentId, 'stuck');
      
      // Clear any current scheduling to remove it from today's plan
      await this.updateAssignmentScheduling(assignmentId, {
        scheduledDate: null,
        scheduledBlock: null,
        blockStart: null,
        blockEnd: null
      });
      
      console.log(`✅ Assignment marked as stuck and removed from schedule`);
      
    } catch (error) {
      console.error('Error marking assignment as stuck:', error);
      throw error;
    }
  }

  // Support methods for hybrid scheduler
  async getAssignmentsByStudentAndDate(studentName: string, date: string): Promise<Assignment[]> {
    try {
      const userId = `${studentName.toLowerCase()}-user`;
      // CRITICAL: Get only assignments scheduled for THIS SPECIFIC DATE
      const result = await db.select()
        .from(assignments)
        .where(and(
          eq(assignments.userId, userId),
          eq(assignments.scheduledDate, date)
        ));
      return result || [];
    } catch (error) {
      console.error('Error getting assignments by student and date:', error);
      return [];
    }
  }

  async getAssignmentsByBlock(studentName: string, weekday: string, blockNumber: number): Promise<Assignment[]> {
    try {
      const userId = `${studentName.toLowerCase()}-user`;
      
      // CRITICAL: We need to find assignments scheduled for this specific weekday
      // Get the current week's date for this weekday
      const today = new Date();
      const currentWeekday = today.getDay(); // 0 = Sunday
      const weekdayMap: Record<string, number> = {
        'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
        'Thursday': 4, 'Friday': 5, 'Saturday': 6
      };
      const targetWeekday = weekdayMap[weekday];
      const daysDiff = targetWeekday - currentWeekday;
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysDiff);
      const dateString = targetDate.toISOString().split('T')[0];
      
      const result = await db.select()
        .from(assignments)
        .where(and(
          eq(assignments.userId, userId),
          eq(assignments.scheduledBlock, blockNumber),
          eq(assignments.scheduledDate, dateString)
        ));
      
      return result || [];
    } catch (error) {
      console.error('Error getting assignments by block:', error);
      return [];
    }
  }



  // Checklist item operations
  async getChecklistItems(studentName: string, subject?: string): Promise<ChecklistItem[]> {
    try {
      let conditions = [
        eq(checklistItems.studentName, studentName),
        eq(checklistItems.isActive, true)
      ];
      
      if (subject) {
        conditions.push(eq(checklistItems.subject, subject));
      }
      
      const items = await db.select()
        .from(checklistItems)
        .where(and(...conditions))
        .orderBy(checklistItems.category, checklistItems.sortOrder, checklistItems.itemName);
      
      return items || [];
    } catch (error) {
      console.error('❌ Error fetching checklist items:', error);
      return [];
    }
  }

  async createChecklistItem(item: InsertChecklistItem): Promise<ChecklistItem> {
    try {
      const [newItem] = await db.insert(checklistItems).values(item).returning();
      return newItem;
    } catch (error) {
      console.error('❌ Error creating checklist item:', error);
      throw error;
    }
  }

  async updateChecklistItem(id: string, updates: UpdateChecklistItem): Promise<ChecklistItem | undefined> {
    try {
      const [updatedItem] = await db.update(checklistItems)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(checklistItems.id, id))
        .returning();
      return updatedItem;
    } catch (error) {
      console.error('❌ Error updating checklist item:', error);
      return undefined;
    }
  }

  async deleteChecklistItem(id: string): Promise<boolean> {
    try {
      const [deletedItem] = await db.update(checklistItems)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(checklistItems.id, id))
        .returning();
      return !!deletedItem;
    } catch (error) {
      console.error('❌ Error deleting checklist item:', error);
      return false;
    }
  }

  // REWARDBANK STORAGE IMPLEMENTATIONS
  // Gamification and rewards system methods

  async getRewardProfile(userId: string): Promise<RewardProfile | undefined> {
    try {
      const [profile] = await db.select().from(rewardProfiles).where(eq(rewardProfiles.userId, userId));
      return profile;
    } catch (error) {
      console.error('❌ Error getting reward profile:', error);
      return undefined;
    }
  }

  async createRewardProfile(profile: InsertRewardProfile): Promise<RewardProfile> {
    try {
      const [newProfile] = await db.insert(rewardProfiles).values(profile).returning();
      return newProfile;
    } catch (error) {
      console.error('❌ Error creating reward profile:', error);
      throw error;
    }
  }

  async updateRewardProfile(userId: string, pointsToAdd: number): Promise<RewardProfile> {
    try {
      // Get current profile or create one
      let profile = await this.getRewardProfile(userId);
      if (!profile) {
        profile = await this.createRewardProfile({ 
          userId, 
          points: 0, 
          lifetimePoints: 0, 
          level: 1, 
          streakDays: 0 
        });
      }

      const newPoints = profile.points + pointsToAdd;
      const newLifetimePoints = profile.lifetimePoints + pointsToAdd;
      const newLevel = Math.floor(newLifetimePoints / 2500) + 1; // Level up every 2,500 lifetime points

      const [updatedProfile] = await db.update(rewardProfiles)
        .set({ 
          points: newPoints, 
          lifetimePoints: newLifetimePoints,
          level: newLevel,
          updatedAt: new Date() 
        })
        .where(eq(rewardProfiles.userId, userId))
        .returning();

      return updatedProfile;
    } catch (error) {
      console.error('❌ Error updating reward profile:', error);
      throw error;
    }
  }

  async getActiveQuests(userId: string): Promise<Quest[]> {
    try {
      const result = await db.select().from(quests)
        .where(and(
          eq(quests.userId, userId),
          eq(quests.isCompleted, false)
        ))
        .orderBy(quests.expiresAt);
      return result;
    } catch (error) {
      console.error('❌ Error getting active quests:', error);
      return [];
    }
  }

  async createQuest(quest: InsertQuest): Promise<Quest> {
    try {
      const [newQuest] = await db.insert(quests).values(quest).returning();
      return newQuest;
    } catch (error) {
      console.error('❌ Error creating quest:', error);
      throw error;
    }
  }

  async completeQuest(questId: string): Promise<{ quest: Quest; pointsEarned: number; updatedProfile: RewardProfile }> {
    try {
      // Get quest details
      const [quest] = await db.select().from(quests).where(eq(quests.id, questId));
      if (!quest || quest.isCompleted) {
        throw new Error('Quest not found or already completed');
      }

      // Mark quest as completed
      const [completedQuest] = await db.update(quests)
        .set({ isCompleted: true, completedAt: new Date() })
        .where(eq(quests.id, questId))
        .returning();

      // Award points
      const updatedProfile = await this.updateRewardProfile(quest.userId, quest.rewardPoints);

      // Create earn event
      await this.createEarnEvent({
        userId: quest.userId,
        type: 'Quest',
        amount: quest.rewardPoints,
        sourceId: questId,
        sourceDetails: quest.title
      });

      return { quest: completedQuest, pointsEarned: quest.rewardPoints, updatedProfile };
    } catch (error) {
      console.error('❌ Error completing quest:', error);
      throw error;
    }
  }

  async getRewardSettings(userId: string): Promise<RewardSettings | undefined> {
    try {
      const [settings] = await db.select().from(rewardSettings).where(eq(rewardSettings.userId, userId));
      return settings;
    } catch (error) {
      console.error('❌ Error getting reward settings:', error);
      return undefined;
    }
  }

  async updateRewardSettings(userId: string, settingsUpdate: Partial<InsertRewardSettings>): Promise<RewardSettings> {
    try {
      const existing = await this.getRewardSettings(userId);
      
      if (existing) {
        const [updated] = await db.update(rewardSettings)
          .set({ ...settingsUpdate, updatedAt: new Date() })
          .where(eq(rewardSettings.userId, userId))
          .returning();
        return updated;
      } else {
        const [created] = await db.insert(rewardSettings)
          .values({ userId, ...settingsUpdate })
          .returning();
        return created;
      }
    } catch (error) {
      console.error('❌ Error updating reward settings:', error);
      throw error;
    }
  }

  async checkEarningLimits(userId: string, pointsToAdd: number, settings: RewardSettings | null): Promise<{ allowed: boolean; reason?: string; limitType?: string }> {
    try {
      const dailyCap = settings?.dailyEarnCapPoints || 10000;
      const weeklyCap = settings?.weeklyEarnCapPoints || 40000;

      // Get today's earnings
      const today = new Date().toISOString().split('T')[0];
      const todayStart = new Date(`${today}T00:00:00Z`);
      const todayEnd = new Date(`${today}T23:59:59Z`);
      
      const todayEarnings = await db.select().from(earnEvents)
        .where(and(
          eq(earnEvents.userId, userId),
          sql`${earnEvents.createdAt} >= ${todayStart}`,
          sql`${earnEvents.createdAt} <= ${todayEnd}`
        ));

      const todayTotal = todayEarnings.reduce((sum, event) => sum + event.amount, 0);

      if (todayTotal + pointsToAdd > dailyCap) {
        return {
          allowed: false,
          reason: `You've hit today's point limit of ${dailyCap}`,
          limitType: 'daily'
        };
      }

      // Check weekly limit
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      const weekEarnings = await db.select().from(earnEvents)
        .where(and(
          eq(earnEvents.userId, userId),
          sql`${earnEvents.createdAt} >= ${weekStart}`,
          sql`${earnEvents.createdAt} <= ${weekEnd}`
        ));

      const weekTotal = weekEarnings.reduce((sum, event) => sum + event.amount, 0);

      if (weekTotal + pointsToAdd > weeklyCap) {
        return {
          allowed: false,
          reason: `You've hit this week's point limit of ${weeklyCap}`,
          limitType: 'weekly'
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('❌ Error checking earning limits:', error);
      return { allowed: false, reason: 'Error checking limits' };
    }
  }

  async createEarnEvent(event: InsertEarnEvent): Promise<EarnEvent> {
    try {
      const [newEvent] = await db.insert(earnEvents).values(event).returning();
      return newEvent;
    } catch (error) {
      console.error('❌ Error creating earn event:', error);
      throw error;
    }
  }

  async getEarnHistory(userId: string, limit: number = 50): Promise<EarnEvent[]> {
    try {
      const result = await db.select().from(earnEvents)
        .where(eq(earnEvents.userId, userId))
        .orderBy(desc(earnEvents.createdAt))
        .limit(limit);
      return result;
    } catch (error) {
      console.error('❌ Error getting earn history:', error);
      return [];
    }
  }

  async getRewardCatalog(activeOnly?: boolean): Promise<RewardCatalogItem[]> {
    try {
      let whereCondition = activeOnly ? eq(rewardCatalog.isActive, true) : sql`1=1`;
      
      const result = await db.select().from(rewardCatalog)
        .where(whereCondition)
        .orderBy(rewardCatalog.costPoints, rewardCatalog.title);
      return result;
    } catch (error) {
      console.error('❌ Error getting reward catalog:', error);
      return [];
    }
  }

  async getRewardCatalogItem(id: string): Promise<RewardCatalogItem | undefined> {
    try {
      const [item] = await db.select().from(rewardCatalog).where(eq(rewardCatalog.id, id));
      return item;
    } catch (error) {
      console.error('❌ Error getting reward catalog item:', error);
      return undefined;
    }
  }

  async createRewardCatalogItem(item: InsertRewardCatalogItem): Promise<RewardCatalogItem> {
    try {
      const [newItem] = await db.insert(rewardCatalog).values(item).returning();
      return newItem;
    } catch (error) {
      console.error('❌ Error creating reward catalog item:', error);
      throw error;
    }
  }

  async updateRewardCatalogItem(id: string, updates: Partial<InsertRewardCatalogItem>): Promise<RewardCatalogItem | undefined> {
    try {
      const [updated] = await db.update(rewardCatalog)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(rewardCatalog.id, id))
        .returning();
      return updated;
    } catch (error) {
      console.error('❌ Error updating reward catalog item:', error);
      return undefined;
    }
  }

  async createRedemptionRequest(request: InsertRedemptionRequest): Promise<RedemptionRequest> {
    try {
      const [newRequest] = await db.insert(redemptionRequests).values(request).returning();
      return newRequest;
    } catch (error) {
      console.error('❌ Error creating redemption request:', error);
      throw error;
    }
  }

  async getPendingRedemptionRequests(): Promise<Array<RedemptionRequest & { catalogItem: RewardCatalogItem }>> {
    try {
      const result = await db.select({
        id: redemptionRequests.id,
        userId: redemptionRequests.userId,
        catalogItemId: redemptionRequests.catalogItemId,
        pointsSpent: redemptionRequests.pointsSpent,
        status: redemptionRequests.status,
        requestedAt: redemptionRequests.requestedAt,
        decidedAt: redemptionRequests.decidedAt,
        decidedBy: redemptionRequests.decidedBy,
        parentNotes: redemptionRequests.parentNotes,
        createdAt: redemptionRequests.createdAt,
        catalogItem: rewardCatalog
      })
      .from(redemptionRequests)
      .innerJoin(rewardCatalog, eq(redemptionRequests.catalogItemId, rewardCatalog.id))
      .where(eq(redemptionRequests.status, 'Pending'))
      .orderBy(redemptionRequests.requestedAt);

      return result as Array<RedemptionRequest & { catalogItem: RewardCatalogItem }>;
    } catch (error) {
      console.error('❌ Error getting pending redemption requests:', error);
      return [];
    }
  }

  async getLastApprovedRedemption(userId: string): Promise<Date | undefined> {
    try {
      const [result] = await db.select({ decidedAt: redemptionRequests.decidedAt })
        .from(redemptionRequests)
        .where(and(
          eq(redemptionRequests.userId, userId),
          eq(redemptionRequests.status, 'Approved')
        ))
        .orderBy(desc(redemptionRequests.decidedAt))
        .limit(1);
      
      return result?.decidedAt || undefined;
    } catch (error) {
      console.error('❌ Error getting last approved redemption:', error);
      return undefined;
    }
  }

  async decideRedemptionRequest(id: string, decision: string, decidedBy: string, notes?: string): Promise<{ request: RedemptionRequest; pointsDeducted?: number }> {
    try {
      // Get the request details
      const [request] = await db.select().from(redemptionRequests).where(eq(redemptionRequests.id, id));
      if (!request || request.status !== 'Pending') {
        throw new Error('Request not found or already processed');
      }

      // Update the request
      const [updatedRequest] = await db.update(redemptionRequests)
        .set({
          status: decision as 'Approved' | 'Denied',
          decidedAt: new Date(),
          decidedBy,
          parentNotes: notes || null
        })
        .where(eq(redemptionRequests.id, id))
        .returning();

      let pointsDeducted = 0;

      // If approved, deduct points from student's profile
      if (decision === 'Approved') {
        const [profile] = await db.update(rewardProfiles)
          .set({
            points: sql`${rewardProfiles.points} - ${request.pointsSpent}`,
            updatedAt: new Date()
          })
          .where(eq(rewardProfiles.userId, request.userId))
          .returning();

        pointsDeducted = request.pointsSpent;

        // Create negative earn event for the redemption
        await this.createEarnEvent({
          userId: request.userId,
          type: 'Manual', // Redemption type
          amount: -request.pointsSpent,
          sourceId: id,
          sourceDetails: `Redeemed reward: ${request.catalogItemId}`
        });

        // Update catalog item usage counter
        await db.update(rewardCatalog)
          .set({
            timesRedeemed: sql`${rewardCatalog.timesRedeemed} + 1`,
            updatedAt: new Date()
          })
          .where(eq(rewardCatalog.id, request.catalogItemId));
      }

      return { request: updatedRequest, pointsDeducted };
    } catch (error) {
      console.error('❌ Error deciding redemption request:', error);
      throw error;
    }
  }
}

// Keep MemStorage for fallback
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private assignments: Map<string, Assignment>;

  constructor() {
    this.users = new Map();
    this.assignments = new Map();
    
    // REMOVED: Sample data initialization to prevent contamination of real student data
    // this.initializeSampleData(); // DISABLED - was creating mock data automatically
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const user: User = { 
      ...insertUser, 
      id,
      firstName: insertUser.firstName ?? null,
      lastName: insertUser.lastName ?? null,
      profileImageUrl: insertUser.profileImageUrl ?? null,
      isActive: insertUser.isActive ?? true,
      createdAt: now,
      updatedAt: now
    };
    this.users.set(id, user);
    return user;
  }

  // Assignment methods
  async getAssignments(userId: string, date?: string): Promise<Assignment[]> {
    const allAssignments = Array.from(this.assignments.values())
      .filter(a => a.userId === userId);
    
    if (date) {
      return allAssignments.filter(a => a.scheduledDate === date);
    }
    return allAssignments;
  }

  async getAssignment(id: string): Promise<Assignment | undefined> {
    return this.assignments.get(id);
  }

  async createAssignment(data: InsertAssignment & { userId: string }): Promise<Assignment> {
    const id = randomUUID();
    const now = new Date();
    const assignment: Assignment = {
      id,
      userId: data.userId,
      title: data.title,
      subject: data.subject || null,
      courseName: data.courseName || null,
      instructions: data.instructions || null,
      dueDate: data.dueDate || null,
      scheduledDate: data.scheduledDate || null,
      scheduledBlock: data.scheduledBlock || null,
      blockStart: data.blockStart || null,
      blockEnd: data.blockEnd || null,
      actualEstimatedMinutes: data.actualEstimatedMinutes || 30,
      completionStatus: data.completionStatus || 'pending',
      blockType: data.blockType || 'assignment',
      isAssignmentBlock: data.isAssignmentBlock ?? true,
      isPortable: data.isPortable ?? true,
      portabilityReason: data.portabilityReason || null,
      priority: data.priority || 'B',
      difficulty: data.difficulty || 'medium',
      timeSpent: data.timeSpent || 0,
      notes: data.notes || null,
      completedAt: data.completedAt || null,
      gradingDelayDetectedAt: data.gradingDelayDetectedAt || null,
      creationSource: data.creationSource || 'manual',
      canvasId: data.canvasId || null,
      canvasCourseId: data.canvasCourseId || null,
      canvasInstance: data.canvasInstance || null,
      canvasUrl: data.canvasUrl || null,
      isCanvasImport: data.isCanvasImport || null,
      canvasCategory: data.canvasCategory || null,
      submissionTypes: data.submissionTypes || [],
      pointsValue: data.pointsValue || null,
      availableFrom: data.availableFrom || null,
      availableUntil: data.availableUntil || null,
      isRecurring: data.isRecurring || null,
      academicYear: data.academicYear || null,
      confidenceScore: data.confidenceScore || null,
      needsPrinting: data.needsPrinting || false,
      printStatus: data.printStatus || 'not_needed',
      printReason: data.printReason || null,
      printedAt: data.printedAt || null,
      needsManualDueDate: data.needsManualDueDate || false,
      suggestedDueDate: data.suggestedDueDate || null,
      deletedAt: data.deletedAt || null,
      canvasGradeStatus: data.canvasGradeStatus || null,
      createdAt: now,
      updatedAt: now
    };
    this.assignments.set(id, assignment);
    return assignment;
  }

  async updateAssignment(id: string, update: UpdateAssignment): Promise<Assignment | undefined> {
    const existing = this.assignments.get(id);
    if (!existing) return undefined;
    
    const updated: Assignment = {
      ...existing,
      ...update,
      updatedAt: new Date()
    };
    this.assignments.set(id, updated);
    return updated;
  }

  async updateAssignmentStatus(id: string, completionStatus: string): Promise<Assignment | undefined> {
    const existing = this.assignments.get(id);
    if (!existing) return undefined;
    
    const updated: Assignment = {
      ...existing,
      completionStatus: completionStatus as Assignment['completionStatus'],
      updatedAt: new Date()
    };
    this.assignments.set(id, updated);
    return updated;
  }

  async deleteAssignment(id: string): Promise<boolean> {
    return this.assignments.delete(id);
  }

  async updateAdministrativeAssignments(): Promise<void> {
    // Mark administrative assignments as completed for in-memory storage
    const assignmentArray = Array.from(this.assignments.values());
    for (const assignment of assignmentArray) {
      const isAdministrative = assignment.title.toLowerCase().includes('fee') ||
                              assignment.title.toLowerCase().includes('supply') ||
                              assignment.title.toLowerCase().includes('syllabus') ||
                              assignment.title.toLowerCase().includes('honor code');
      
      if (isAdministrative) {
        assignment.completionStatus = 'completed';
        console.log(`Updated admin assignment: ${assignment.title}`);
      }
    }
  }

  // Schedule template operations (MemStorage stub)
  async getScheduleTemplate(studentName: string, weekday?: string): Promise<ScheduleTemplate[]> {
    return [];
  }

  async createScheduleTemplate(template: InsertScheduleTemplate): Promise<ScheduleTemplate> {
    const scheduleTemplate: ScheduleTemplate = {
      id: randomUUID(),
      studentName: template.studentName,
      weekday: template.weekday,
      blockNumber: template.blockNumber ?? null,
      startTime: template.startTime,
      endTime: template.endTime,
      subject: template.subject,
      blockType: template.blockType
    };
    return scheduleTemplate;
  }

  // Bible curriculum operations (MemStorage stub)
  async getBibleCurriculum(weekNumber?: number): Promise<BibleCurriculum[]> {
    return [];
  }

  async getBibleCurrentWeek(): Promise<BibleCurriculum[]> {
    return [];
  }

  async updateBibleCompletion(weekNumber: number, dayOfWeek: number, completed: boolean): Promise<BibleCurriculum | undefined> {
    return undefined;
  }

  private initializeSampleData() {
    const sampleUserId = "demo-user-1";
    const today = new Date().toISOString().split('T')[0];
    
    // Create demo user
    const demoUser: User = {
      id: sampleUserId,
      username: "demo-student",
      email: "demo@studyflow.com",
      password: "demo",
      firstName: "Demo",
      lastName: "Student",
      profileImageUrl: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.users.set(sampleUserId, demoUser);
    
    // Create sample assignments with your executive function features
    const sampleAssignments: (InsertAssignment & { userId: string; id: string })[] = [
      {
        id: randomUUID(),
        userId: sampleUserId,
        title: "Math Practice - Algebra Review",
        subject: "Mathematics",
        courseName: "Algebra II",
        instructions: "Complete problems 1-15 on page 84. Focus on quadratic equations and show your work clearly.",
        scheduledDate: today,
        scheduledBlock: 1,
        blockStart: "09:00",
        blockEnd: "09:45",
        actualEstimatedMinutes: 45,
        completionStatus: "pending",
        priority: "A",
        difficulty: "medium"
      },
      {
        id: randomUUID(),
        userId: sampleUserId,
        title: "English Essay - Character Analysis",
        subject: "English Literature",
        courseName: "English 11",
        instructions: "Write a 500-word character analysis of Elizabeth Bennet from Pride and Prejudice. Include specific examples from chapters 1-10.",
        scheduledDate: today,
        scheduledBlock: 2,
        blockStart: "10:00",
        blockEnd: "11:30",
        actualEstimatedMinutes: 90,
        completionStatus: "pending",
        priority: "B",
        difficulty: "hard"
      },
      {
        id: randomUUID(),
        userId: sampleUserId,
        title: "Science Lab Report",
        subject: "Chemistry",
        courseName: "Chemistry I",
        instructions: "Complete the lab report on chemical reactions. Include hypothesis, observations, and conclusion.",
        scheduledDate: today,
        scheduledBlock: 3,
        blockStart: "13:00",
        blockEnd: "13:30",
        actualEstimatedMinutes: 30,
        completionStatus: "pending",
        priority: "B",
        difficulty: "medium"
      },
      {
        id: randomUUID(),
        userId: sampleUserId,
        title: "History Reading Assignment",
        subject: "History",
        courseName: "World History",
        instructions: "Read Chapter 12: The Industrial Revolution. Take notes on key inventions and their impact on society.",
        scheduledDate: today,
        scheduledBlock: 4,
        blockStart: "14:00",
        blockEnd: "14:45",
        actualEstimatedMinutes: 45,
        completionStatus: "pending",
        priority: "C",
        difficulty: "easy"
      }
    ];
    
    sampleAssignments.forEach(assignment => {
      this.assignments.set(assignment.id, {
        id: assignment.id,
        userId: assignment.userId,
        title: assignment.title,
        subject: assignment.subject || null,
        courseName: assignment.courseName || null,
        instructions: assignment.instructions || null,
        dueDate: assignment.dueDate || null,
        scheduledDate: assignment.scheduledDate || null,
        scheduledBlock: assignment.scheduledBlock || null,
        blockStart: assignment.blockStart || null,
        blockEnd: assignment.blockEnd || null,
        actualEstimatedMinutes: assignment.actualEstimatedMinutes || 30,
        completionStatus: assignment.completionStatus || 'pending',
        blockType: assignment.blockType || 'assignment',
        isAssignmentBlock: assignment.isAssignmentBlock ?? true,
        priority: assignment.priority || 'B',
        difficulty: assignment.difficulty || 'medium',
        timeSpent: assignment.timeSpent || 0,
        notes: assignment.notes || null,
        canvasId: null,
        canvasCourseId: null,
        canvasInstance: null,
        canvasUrl: null,
        isCanvasImport: null,
        canvasCategory: null,
        submissionTypes: [],
        pointsValue: null,
        availableFrom: null,
        availableUntil: null,
        isRecurring: null,
        academicYear: null,
        confidenceScore: null,
        needsPrinting: null,
        printStatus: null,
        printReason: null,
        printedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });
  }

  // Student profile operations (stub methods for MemStorage)
  async getStudentProfile(studentName: string): Promise<StudentProfile | undefined> {
    // Stub implementation - return default profiles
    const defaultProfiles: Record<string, StudentProfile> = {
      'abigail': {
        id: 'abigail-profile',
        studentName: 'abigail',
        displayName: 'Abigail',
        profileImageUrl: null,
        themeColor: '#844FC1',
        allowSaturdayScheduling: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      'khalil': {
        id: 'khalil-profile',
        studentName: 'khalil',
        displayName: 'Khalil',
        profileImageUrl: null,
        themeColor: '#3B86D1',
        allowSaturdayScheduling: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    };
    return defaultProfiles[studentName];
  }

  async upsertStudentProfile(profile: InsertStudentProfile): Promise<StudentProfile> {
    // Stub implementation - just return the profile with generated fields
    return {
      id: 'temp-' + profile.studentName,
      ...profile,
      profileImageUrl: profile.profileImageUrl || null,
      themeColor: profile.themeColor || null,
      allowSaturdayScheduling: profile.allowSaturdayScheduling || false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async getAllStudentProfiles(): Promise<StudentProfile[]> {
    // Stub implementation - return both profiles
    const abigail = await this.getStudentProfile('abigail');
    const khalil = await this.getStudentProfile('khalil');
    return [abigail, khalil].filter(Boolean) as StudentProfile[];
  }

  async updateStudentSaturdayScheduling(studentName: string, allowSaturday: boolean): Promise<StudentProfile | undefined> {
    // Stub implementation - just return updated profile
    const profile = await this.getStudentProfile(studentName);
    if (!profile) return undefined;
    
    return {
      ...profile,
      allowSaturdayScheduling: allowSaturday,
      updatedAt: new Date()
    };
  }

  // Student status operations (stub methods for MemStorage)
  async getStudentStatus(studentName: string): Promise<StudentStatus | undefined> {
    // Stub implementation - return default status
    return {
      id: 'status-' + studentName,
      studentName,
      currentMode: 'overview',
      currentAssignmentId: null,
      currentAssignmentTitle: null,
      sessionStartTime: null,
      estimatedEndTime: null,
      isStuck: false,
      stuckSince: null,
      needsHelp: false,
      isOvertimeOnTask: false,
      completedToday: 0,
      totalToday: 0,
      minutesWorkedToday: 0,
      targetMinutesToday: 180,
      lastActivity: new Date(),
      updatedAt: new Date()
    };
  }

  async upsertStudentStatus(status: InsertStudentStatus): Promise<StudentStatus> {
    // Stub implementation - return status with generated fields
    return {
      id: 'status-' + status.studentName,
      ...status,
      currentMode: status.currentMode || null,
      currentAssignmentId: status.currentAssignmentId || null,
      currentAssignmentTitle: status.currentAssignmentTitle || null,
      sessionStartTime: status.sessionStartTime || null,
      estimatedEndTime: status.estimatedEndTime || null,
      isStuck: status.isStuck || null,
      stuckSince: status.stuckSince || null,
      needsHelp: status.needsHelp || null,
      isOvertimeOnTask: status.isOvertimeOnTask || null,
      completedToday: status.completedToday || null,
      totalToday: status.totalToday || null,
      minutesWorkedToday: status.minutesWorkedToday || null,
      targetMinutesToday: status.targetMinutesToday || null,
      lastActivity: status.lastActivity || null,
      updatedAt: new Date()
    };
  }

  async updateStudentFlags(studentName: string, flags: { isStuck?: boolean; needsHelp?: boolean; isOvertimeOnTask?: boolean }): Promise<StudentStatus | undefined> {
    // Stub implementation - return updated status
    return {
      id: 'status-' + studentName,
      studentName,
      currentMode: 'overview',
      currentAssignmentId: null,
      currentAssignmentTitle: null,
      sessionStartTime: null,
      estimatedEndTime: null,
      isStuck: flags.isStuck || false,
      stuckSince: flags.isStuck ? new Date() : null,
      needsHelp: flags.needsHelp || false,
      isOvertimeOnTask: flags.isOvertimeOnTask || false,
      completedToday: 0,
      totalToday: 0,
      minutesWorkedToday: 0,
      targetMinutesToday: 180,
      lastActivity: new Date(),
      updatedAt: new Date()
    };
  }

  async getFamilyDashboardData(): Promise<{
    students: Array<StudentStatus & { profile: StudentProfile | null }>;
    needsReview: Array<{ student: string; assignment: string; issue: string }>;
  }> {
    // Stub implementation - return sample data
    const abigailProfile = await this.getStudentProfile('abigail');
    const khalilProfile = await this.getStudentProfile('khalil');
    
    return {
      students: [
        {
          ...(await this.getStudentStatus('abigail'))!,
          profile: abigailProfile || null,
          completedToday: 2,
          totalToday: 6,
          currentAssignmentTitle: 'Math - Algebra Practice'
        },
        {
          ...(await this.getStudentStatus('khalil'))!,
          profile: khalilProfile || null,
          completedToday: 1,
          totalToday: 5,
          currentAssignmentTitle: 'Science Lab Report',
          isStuck: true,
          isOvertimeOnTask: true
        }
      ],
      needsReview: [
        { student: 'Khalil', assignment: 'Science Lab Report', issue: 'Marked as stuck for 20+ minutes' },
        { student: 'Abigail', assignment: 'History Essay', issue: 'Due tomorrow - not started' }
      ]
    };
  }

  // Daily schedule status operations (not implemented in MemStorage)
  async getDailyScheduleStatus(studentName: string, date: string): Promise<Array<DailyScheduleStatus & { template: ScheduleTemplate }>> {
    return [];
  }

  async updateBlockStatus(studentName: string, date: string, templateBlockId: string, status: string, flags?: object): Promise<DailyScheduleStatus | undefined> {
    return undefined;
  }

  async initializeDailySchedule(studentName: string, date: string): Promise<void> {
    console.warn('MemStorage does not support daily schedule initialization');
  }

  async allocateAssignmentsToTemplate(studentName: string, date: string): Promise<void> {
    console.warn('MemStorage does not support assignment allocation');
  }

  async rescheduleNeedMoreTime(assignmentId: string, date: string): Promise<void> {
    console.warn('MemStorage does not support rescheduling');
  }

  async markStuckWithUndo(assignmentId: string): Promise<void> {
    console.warn('MemStorage does not support stuck marking');
  }

  async getAllAssignments(): Promise<Assignment[]> {
    // Return all assignments for print queue functionality
    return Array.from(this.assignments.values());
  }

  // Checklist item stub methods
  async getChecklistItems(studentName: string, subject?: string): Promise<ChecklistItem[]> {
    return [];
  }

  async createChecklistItem(item: InsertChecklistItem): Promise<ChecklistItem> {
    const newItem: ChecklistItem = {
      id: randomUUID(),
      studentName: item.studentName,
      subject: item.subject,
      itemName: item.itemName,
      category: item.category,
      isActive: item.isActive ?? true,
      sortOrder: item.sortOrder ?? 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    return newItem;
  }

  async updateChecklistItem(id: string, updates: UpdateChecklistItem): Promise<ChecklistItem | undefined> {
    return undefined;
  }

  async deleteChecklistItem(id: string): Promise<boolean> {
    return false;
  }
}

// Use real database storage when available, fallback to memory for now
let storage: IStorage;
try {
  storage = new DatabaseStorage();
  console.log('✓ Using database storage');
} catch (error) {
  console.warn('⚠ Database connection failed, using memory storage:', error instanceof Error ? error.message : String(error));
  storage = new MemStorage();
}

export { storage };

// Keep MemStorage as backup
export const memStorage = new MemStorage();
