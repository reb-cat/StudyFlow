import { 
  type User, type InsertUser, 
  type Assignment, type InsertAssignment, type UpdateAssignment,
  type ScheduleTemplate, type InsertScheduleTemplate,
  type BibleCurriculum, type InsertBibleCurriculum,
  type StudentProfile, type InsertStudentProfile,
  type StudentStatus, type InsertStudentStatus,
  type DailyScheduleStatus, type InsertDailyScheduleStatus,
  users, assignments, scheduleTemplate, bibleCurriculum, studentProfiles, studentStatus, dailyScheduleStatus
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, or, sql, desc, inArray, isNull, isNotNull } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
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
  
  // Bible curriculum operations
  getBibleCurriculum(weekNumber?: number): Promise<BibleCurriculum[]>;
  getBibleCurrentWeek(): Promise<BibleCurriculum[]>;
  updateBibleCompletion(weekNumber: number, dayOfWeek: number, completed: boolean): Promise<BibleCurriculum | undefined>;
  
  // Student profile operations
  getStudentProfile(studentName: string): Promise<StudentProfile | undefined>;
  upsertStudentProfile(profile: InsertStudentProfile): Promise<StudentProfile>;
  
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
  rescheduleNeedMoreTime(assignmentId: string, date: string): Promise<void>;
  markStuckWithUndo(assignmentId: string): Promise<void>;
}

// Database storage implementation using local Replit database
export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0] || undefined;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
      return result[0] || undefined;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const result = await db.insert(users).values({
        ...insertUser,
        profileImageUrl: insertUser.profileImageUrl || null
      }).returning();
      return result[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  async getAssignments(userId: string, date?: string, includeCompleted?: boolean): Promise<Assignment[]> {
    try {
      // CRITICAL: Filter out soft-deleted assignments to prevent confusion for students with executive function needs
      let result = await db.select().from(assignments).where(
        and(
          eq(assignments.userId, userId),
          or(
            eq(assignments.isDeleted, false),
            isNull(assignments.isDeleted)
          )
        )
      );
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
        
        if (isParticipation) {
          console.log(`🚫 Excluding non-completable assignment: ${assignment.title}`);
          return false;
        }
        return true;
      });
      console.log(`🎯 Type filtering: ${beforeTypeFilter} → ${assignmentList.length} assignments (excluded participation/attendance)`);

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
        } else {
          // Single date - apply 3-day focus window for daily scheduling
          const requestDate = new Date(date);
          futureLimit = new Date(requestDate);
          futureLimit.setDate(requestDate.getDate() + 3); // Only 3 days ahead for daily focus
          
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
      // CRITICAL: Filter out soft-deleted assignments unless explicitly requested
      const result = includeDeleted 
        ? await db.select().from(assignments)
        : await db.select().from(assignments).where(
            or(
              eq(assignments.isDeleted, false),
              isNull(assignments.isDeleted)
            )
          );
      return result || [];
    } catch (error) {
      console.error('Error getting all assignments:', error);
      return [];
    }
  }

  async getAssignment(id: string): Promise<Assignment | undefined> {
    try {
      // CRITICAL: Filter out soft-deleted assignments to prevent access to deleted items
      const result = await db.select().from(assignments).where(
        and(
          eq(assignments.id, id),
          or(
            eq(assignments.isDeleted, false),
            isNull(assignments.isDeleted)
          )
        )
      ).limit(1);
      return result[0] || undefined;
    } catch (error) {
      console.error('Error getting assignment:', error);
      return undefined;
    }
  }

  // Helper method to determine smart time estimates based on assignment type
  private getSmartTimeEstimate(title: string): number {
    const lowerTitle = title.toLowerCase();
    
    // Forensics labs need substantial time - 60 minutes
    if (lowerTitle.includes('forensics lab') || lowerTitle.includes('forensic lab')) {
      return 60;
    }
    
    // Recipe reviews are quick - 10 minutes max
    if (lowerTitle.includes('review recipe') || lowerTitle.includes('recipe review')) {
      return 10;
    }
    
    // Other quick tasks
    if (lowerTitle.includes('quiz') && !lowerTitle.includes('practice')) {
      return 15;
    }
    
    if (lowerTitle.includes('discussion post') || lowerTitle.includes('forum post')) {
      return 20;
    }
    
    // Default for everything else
    return 30;
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
        actualEstimatedMinutes: data.actualEstimatedMinutes || this.getSmartTimeEstimate(data.title),
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
      const result = await db.update(assignments).set(update).where(eq(assignments.id, id)).returning();
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
      const userId = `${studentName.toLowerCase()}-user`;
      
      // Get unscheduled assignments - EXCLUDE PARENT TASKS
      const userAssignments = await this.getAssignments(userId);
      const unscheduledAssignments = userAssignments.filter(a => {
        // First filter: must be pending and not scheduled
        if (a.completionStatus !== 'pending' || (a.scheduledDate && a.scheduledBlock)) {
          return false;
        }
        
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
                            title.includes('honor code') ||
                            a.priority === 'parent';
        
        const isBibleAssignment = title.includes('bible') || 
                                 subject.includes('bible') ||
                                 title.includes('scripture') ||
                                 subject.includes('scripture') ||
                                 a.creationSource === 'bible_curriculum';
        
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
      
      // SCHOOL TIMEZONE: Use timezone-aware weekday for consistent schedule selection
      const { getSchoolWeekdayName } = await import('./lib/schoolTimezone');
      const weekday = getSchoolWeekdayName(targetDate);
      const scheduleBlocks = await this.getScheduleTemplate(studentName, weekday);
      
      // Use auto-scheduler
      const { autoScheduleAssignments } = await import('./lib/assignmentIntelligence');
      
      const assignmentsToSchedule = unscheduledAssignments.map(a => ({
        id: a.id,
        title: a.title,
        priority: a.priority as 'A' | 'B' | 'C',
        dueDate: a.dueDate ? new Date(a.dueDate) : null,
        difficulty: a.difficulty as 'easy' | 'medium' | 'hard',
        actualEstimatedMinutes: a.actualEstimatedMinutes || 60,
        completionStatus: a.completionStatus || 'pending',
        scheduledDate: a.scheduledDate,
        scheduledBlock: a.scheduledBlock
      }));
      
      const scheduleBlocksFormatted = scheduleBlocks.map(b => ({
        id: b.id,
        studentName: b.studentName,
        weekday: b.weekday,
        blockNumber: b.blockNumber,
        startTime: b.startTime,
        endTime: b.endTime,
        subject: b.subject,
        blockType: b.blockType
      }));
      
      const schedulingResults = await autoScheduleAssignments(
        assignmentsToSchedule,
        scheduleBlocksFormatted,
        studentName,
        date,
        'America/New_York'
      );
      
      // Update assignments in database
      const updatedAssignments: Assignment[] = [];
      let scheduledCount = 0;
      
      for (const [assignmentId, result] of Array.from(schedulingResults.entries())) {
        const updated = await this.updateAssignmentScheduling(assignmentId, {
          scheduledDate: result.scheduledDate,
          scheduledBlock: result.scheduledBlock,
          blockStart: result.blockStart,
          blockEnd: result.blockEnd
        });
        
        if (updated) {
          updatedAssignments.push(updated);
          scheduledCount++;
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
      // Get all active assignments and update administrative ones (exclude soft-deleted)
      const allAssignments = await db.select().from(assignments).where(
        or(
          eq(assignments.isDeleted, false),
          isNull(assignments.isDeleted)
        )
      );
      
      for (const assignment of allAssignments) {
        const title = assignment.title.toLowerCase();
        const isAdministrative = title.includes('fee') ||
                                title.includes('supply') ||
                                title.includes('permission') ||
                                title.includes('form') ||
                                title.includes('waiver') ||
                                title.includes('registration') ||
                                title.includes('syllabus') ||
                                title.includes('honor code');
        
        if (isAdministrative) {
          await db.update(assignments)
            .set({ 
              completionStatus: 'completed',
              priority: 'parent' // Mark as parent task
            })
            .where(eq(assignments.id, assignment.id));
          
          console.log(`✅ Marked parent task as completed: ${assignment.title}`);
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

  // Soft delete for Canvas sync - prevents showing deleted assignments to students
  async markAssignmentDeleted(id: string): Promise<Assignment | undefined> {
    try {
      const result = await db.update(assignments)
        .set({ 
          isDeleted: true,
          deletedAt: new Date()
        })
        .where(eq(assignments.id, id))
        .returning();
      return result[0] || undefined;
    } catch (error) {
      console.error('Error soft deleting assignment:', error);
      return undefined;
    }
  }

  // Get deleted assignments for admin audit trail
  async getDeletedAssignments(): Promise<Assignment[]> {
    try {
      return await db.select()
        .from(assignments)
        .where(eq(assignments.isDeleted, true))
        .orderBy(desc(assignments.deletedAt));
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
      
      const result = await db.select().from(scheduleTemplate).where(whereCondition).orderBy(scheduleTemplate.startTime);
      
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
      // Get the current week based on date - for now, use week 1
      // TODO: Implement proper week calculation based on start date
      const currentWeek = 1;
      return this.getBibleCurriculum(currentWeek);
    } catch (error) {
      console.error('Error getting current bible week:', error);
      return [];
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
      const result = await db.select().from(studentProfiles).where(eq(studentProfiles.studentName, studentName)).limit(1);
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
      // SCHOOL TIMEZONE: Use timezone-aware weekday for consistent schedule selection
      const { getSchoolWeekdayName } = await import('./lib/schoolTimezone');
      const weekdayName = getSchoolWeekdayName(date);
      
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

  // Allocate assignments to template blocks with sophisticated scoring
  async allocateAssignmentsToTemplate(studentName: string, date: string): Promise<void> {
    try {
      console.log(`🎯 Allocating assignments for ${studentName} on ${date}`);
      
      // SCHOOL TIMEZONE: Use timezone-aware weekday for consistent schedule selection
      const { getSchoolWeekdayName } = await import('./lib/schoolTimezone');
      const weekdayName = getSchoolWeekdayName(date);
      
      // Get assignment blocks (blockType = 'Assignment')
      const templateBlocks = await this.getScheduleTemplate(studentName, weekdayName);
      const assignmentBlocks = templateBlocks.filter(block => 
        block.blockType === 'Assignment' || block.subject === 'Assignment'
      ).sort((a, b) => a.startTime.localeCompare(b.startTime));

      // CRITICAL: Get existing daily schedule status to preserve completed blocks
      const existingStatuses = await db
        .select()
        .from(dailyScheduleStatus)
        .where(and(
          eq(dailyScheduleStatus.studentName, studentName),
          eq(dailyScheduleStatus.date, date)
        ));

      const completedBlockIds = new Set(
        existingStatuses
          .filter(status => status.status === 'complete')
          .map(status => status.templateBlockId)
      );

      // CRITICAL: Only allocate to blocks that are NOT completed
      const availableAssignmentBlocks = assignmentBlocks.filter(block => 
        !completedBlockIds.has(block.id)
      );

      console.log(`🔒 Found ${completedBlockIds.size} completed blocks that will be preserved`);
      console.log(`📝 Found ${availableAssignmentBlocks.length} available assignment blocks for allocation`);

      if (availableAssignmentBlocks.length === 0) {
        console.log(`📝 No available assignment blocks found for ${studentName} on ${weekdayName} (all completed or none exist)`);
        return;
      }
      
      // DEBUG LOGGING: Import debug utilities
      const { logOrderTrace, assertStrictOrder } = await import('@shared/debug');
      
      // Log template order
      logOrderTrace('SERVER', 'templateOrder', templateBlocks.map(block => ({
        blockId: block.id,
        blockType: block.blockType,
        startMinute: null, // Will be computed from startTime
        endMinute: null,
        startTime: block.startTime,
        endTime: block.endTime,
        label: block.subject || `Block ${block.blockNumber}`
      })));
      
      // Log assignment slots (only available ones)
      logOrderTrace('SERVER', 'assignmentSlots', availableAssignmentBlocks.map(block => ({
        blockId: block.id,
        blockType: 'assignment-slot',
        startTime: block.startTime,
        endTime: block.endTime,
        label: `Assignment Block ${block.blockNumber || 'N/A'}`
      })));
      
      // Assert template order
      assertStrictOrder('SERVER_TEMPLATE', templateBlocks);
      
      // Clear any existing scheduling ONLY for available (non-completed) assignment blocks
      const availableBlockNumbers = availableAssignmentBlocks
        .map(block => block.blockNumber)
        .filter(blockNumber => blockNumber !== null);
      
      if (availableBlockNumbers.length > 0) {
        await db.update(assignments)
          .set({
            scheduledDate: null,
            scheduledBlock: null,
            blockStart: null,
            blockEnd: null
          })
          .where(and(
            eq(assignments.scheduledDate, date),
            inArray(assignments.scheduledBlock, availableBlockNumbers)
          ));
        console.log(`🔄 Cleared existing scheduling for ${availableBlockNumbers.length} available blocks`);
      }
      
      // Get candidate assignments with ±7 day window and not completed
      const userId = `${studentName.toLowerCase()}-user`;
      const windowStart = new Date(date + 'T00:00:00.000Z');
      windowStart.setDate(windowStart.getDate() - 7);
      const windowEnd = new Date(date + 'T00:00:00.000Z');
      windowEnd.setDate(windowEnd.getDate() + 7);
      
      const allAssignments = await this.getAssignments(userId);
      const candidateAssignments = allAssignments.filter(assignment => {
        // Include assignments that are workable: pending, needs_more_time, stuck
        // EXCLUDE only truly completed assignments
        const workableStatuses = ['pending', 'needs_more_time', 'stuck', 'in_progress'];
        if (!workableStatuses.includes(assignment.completionStatus)) {
          console.log(`🚫 Excluding non-workable assignment: ${assignment.title} (status: ${assignment.completionStatus})`);
          return false;
        }
        
        // Allow re-scheduling: Remove the scheduledDate check that was blocking allocation
        // This allows flexible assignment distribution and rescheduling as needed
        
        // Within window or no due date
        if (!assignment.dueDate) return true;
        
        const dueDate = new Date(assignment.dueDate);
        return dueDate >= windowStart && dueDate <= windowEnd;
      });
      
      if (candidateAssignments.length === 0) {
        console.log(`📝 No candidate assignments found for allocation`);
        return;
      }
      
      // Score assignments: A=100/B=50/C=10 + overdue + due-soon, but extra credit gets lower priority
      const scoredAssignments = candidateAssignments.map(assignment => {
        let score = 0;
        
        // Check if this is an extra credit assignment
        const isExtraCredit = assignment.title.toLowerCase().includes('extra credit') ||
                              assignment.title.toLowerCase().includes('extra-credit') ||
                              assignment.title.toLowerCase().includes('bonus');
        
        // Priority score
        switch (assignment.priority) {
          case 'A': score += 100; break;
          case 'B': score += 50; break;
          case 'C': score += 10; break;
          default: score += 50; break;
        }
        
        // Extra credit penalty - reduce priority but keep them schedulable
        if (isExtraCredit) {
          score = Math.max(score * 0.3, 5); // Reduce to 30% of original score, minimum 5 points
          console.log(`📝 Extra credit detected: "${assignment.title}" - reduced priority (score: ${score})`);
        }
        
        // Overdue bonus (still applies to extra credit to encourage timely completion)
        if (assignment.dueDate) {
          const dueDate = new Date(assignment.dueDate);
          const today = new Date(date);
          const daysDiff = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysDiff < 0) {
            // Overdue - high priority (but extra credit gets smaller bonus)
            const overdueBonus = Math.abs(daysDiff) * (isExtraCredit ? 5 : 20);
            score += overdueBonus;
          } else if (daysDiff <= 2) {
            // Due soon - medium priority (but extra credit gets smaller bonus)
            const dueSoonBonus = (3 - daysDiff) * (isExtraCredit ? 3 : 10);
            score += dueSoonBonus;
          }
        }
        
        return { assignment, score };
      });
      
      // Sort by score (highest first) with curriculum sequence awareness
      scoredAssignments.sort((a, b) => {
        // First sort by score
        if (Math.abs(b.score - a.score) > 5) {
          return b.score - a.score;
        }
        
        // Within similar scores, handle curriculum sequences
        const aTitle = a.assignment.title.toLowerCase();
        const bTitle = b.assignment.title.toLowerCase();
        
        // Extract sequence numbers from titles (Week 1, Chapter 2, Part 3, etc.)
        const extractSequenceNumber = (title: string) => {
          const sequencePatterns = [
            /week\s+(\d+)/i,
            /chapter\s+(\d+)/i,
            /part\s+(\d+)/i,
            /lesson\s+(\d+)/i,
            /unit\s+(\d+)/i,
            /section\s+(\d+)/i,
            /module\s+(\d+)/i
          ];
          
          for (const pattern of sequencePatterns) {
            const match = title.match(pattern);
            if (match) {
              return { type: pattern.source.split('\\')[0], number: parseInt(match[1], 10) };
            }
          }
          return null;
        };
        
        const aSeq = extractSequenceNumber(aTitle);
        const bSeq = extractSequenceNumber(bTitle);
        
        // If both have sequences of the same type, sort by sequence number
        if (aSeq && bSeq && aSeq.type === bSeq.type) {
          // Check if they're from the same base assignment (remove sequence part)
          const aBase = aTitle.replace(new RegExp(aSeq.type + '\\s+\\d+', 'i'), '').trim();
          const bBase = bTitle.replace(new RegExp(bSeq.type + '\\s+\\d+', 'i'), '').trim();
          
          if (aBase === bBase || aBase.includes(bBase) || bBase.includes(aBase)) {
            console.log(`📚 Curriculum sequence detected: "${a.assignment.title}" (${aSeq.number}) vs "${b.assignment.title}" (${bSeq.number})`);
            return aSeq.number - bSeq.number; // Lower numbers first (Week 2 before Week 3)
          }
        }
        
        // No sequence relationship, maintain score order
        return b.score - a.score;
      });
      
      // INTELLIGENT SUBJECT DISTRIBUTION for optimal learning experience
      console.log(`🎨 Optimizing subject distribution across ${availableAssignmentBlocks.length} assignment blocks`);
      
      // Group assignments by subject for better distribution
      const assignmentsBySubject = new Map<string, typeof scoredAssignments>();
      scoredAssignments.forEach(scoredAssignment => {
        const subject = scoredAssignment.assignment.subject || 'General';
        if (!assignmentsBySubject.has(subject)) {
          assignmentsBySubject.set(subject, []);
        }
        assignmentsBySubject.get(subject)!.push(scoredAssignment);
      });
      
      // Create optimized assignment sequence with subject distribution
      const optimizedSequence: typeof scoredAssignments = [];
      const subjectKeys = Array.from(assignmentsBySubject.keys());
      let subjectIndex = 0;
      
      // Distribute assignments ensuring subject variety throughout the day
      while (optimizedSequence.length < Math.min(scoredAssignments.length, availableAssignmentBlocks.length)) {
        let assigned = false;
        
        // Try each subject starting from current index to distribute evenly
        for (let i = 0; i < subjectKeys.length; i++) {
          const currentSubjectIndex = (subjectIndex + i) % subjectKeys.length;
          const subject = subjectKeys[currentSubjectIndex];
          const subjectAssignments = assignmentsBySubject.get(subject)!;
          
          if (subjectAssignments.length > 0) {
            const assignment = subjectAssignments.shift()!; // Take highest priority from this subject
            optimizedSequence.push(assignment);
            console.log(`📝 Block ${optimizedSequence.length}: ${subject} - ${assignment.assignment.title}`);
            assigned = true;
            subjectIndex = (currentSubjectIndex + 1) % subjectKeys.length; // Move to next subject
            break;
          }
        }
        
        // Safety check to prevent infinite loop
        if (!assigned) break;
      }
      
      console.log(`✨ Subject distribution complete: ${optimizedSequence.length} assignments across ${subjectKeys.length} subjects`);
      
      // Smart assignment allocation: match assignment duration to block capacity
      const assignedAssignments: string[] = [];
      
      // Calculate block durations and sort by duration (longest first for smart allocation)
      const blocksWithDuration = availableAssignmentBlocks.map(block => {
        const startTime = new Date(`2000-01-01T${block.startTime}`);
        const endTime = new Date(`2000-01-01T${block.endTime}`);
        const blockMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
        
        // SCHED: Debug final block time calculations (UTC HARDENING: explicit UTC parsing)
        const blockStartISO = new Date(`${date}T${block.startTime}Z`).toISOString();
        const blockEndISO = new Date(`${date}T${block.endTime}Z`).toISOString();
        console.log(`SCHED: Block ${block.blockNumber} - start: ${blockStartISO}, end: ${blockEndISO}, durationMin: ${blockMinutes}`);
        
        return { block, blockMinutes };
      }).sort((a, b) => b.blockMinutes - a.blockMinutes); // Longest blocks first
      
      // Prepare assignment pool with time estimates
      const assignmentPool = optimizedSequence.map(({ assignment }) => ({
        assignment,
        assignmentMinutes: assignment.actualEstimatedMinutes || 30,
        assigned: false
      })).sort((a, b) => b.assignmentMinutes - a.assignmentMinutes); // Longest assignments first
      
      // Phase 1: Smart allocation - try to fit assignments optimally
      for (const { block, blockMinutes } of blocksWithDuration) {
        let bestFit = null;
        let bestFitIndex = -1;
        
        // Find the best fitting unassigned assignment
        for (let i = 0; i < assignmentPool.length; i++) {
          const item = assignmentPool[i];
          if (item.assigned) continue;
          
          // Allow assignments that are up to 30 minutes longer than the block (increased from 15)
          const timeBuffer = 30;
          const allowableTime = blockMinutes + timeBuffer;
          
          if (item.assignmentMinutes <= allowableTime) {
            // Prefer assignments that fit exactly, then longer ones that utilize the block well
            if (!bestFit || 
                (item.assignmentMinutes <= blockMinutes && bestFit.assignmentMinutes > blockMinutes) ||
                (item.assignmentMinutes > bestFit.assignmentMinutes && bestFit.assignmentMinutes <= blockMinutes)) {
              bestFit = item;
              bestFitIndex = i;
            }
          }
        }
        
        if (bestFit) {
          // Schedule the best fitting assignment
          bestFit.assigned = true;
          
          await this.updateAssignmentScheduling(bestFit.assignment.id, {
            scheduledDate: date,
            scheduledBlock: block.blockNumber,
            blockStart: block.startTime,
            blockEnd: block.endTime
          });
          
          assignedAssignments.push(bestFit.assignment.title);
          
          if (bestFit.assignmentMinutes > blockMinutes) {
            console.log(`📋 Scheduled ${bestFit.assignmentMinutes}min assignment in ${blockMinutes}min block (${bestFit.assignmentMinutes - blockMinutes}min overflow): ${bestFit.assignment.title}`);
          } else {
            console.log(`✅ Scheduled ${bestFit.assignmentMinutes}min assignment in ${blockMinutes}min block: ${bestFit.assignment.title}`);
          }
        }
      }
      
      // Phase 2: Force-schedule ANY remaining assignments - NO ASSIGNMENTS LEFT BEHIND!
      const unassigned = assignmentPool.filter(item => !item.assigned);
      if (unassigned.length > 0) {
        console.log(`🚀 Force-scheduling ${unassigned.length} remaining assignments - NO ASSIGNMENTS LEFT BEHIND!`);
        
        // Find available blocks that can accommodate with very generous overflow
        const availableBlocks = blocksWithDuration.filter(({ block }) => 
          !assignmentPool.some(item => item.assigned && item.assignment.id && 
            assignedAssignments.includes(item.assignment.title))
        );
        
        // If we have more assignments than available blocks, reuse the longest blocks
        let blockIndex = 0;
        for (const assignment of unassigned) {
          const targetBlock = blocksWithDuration[blockIndex % blocksWithDuration.length];
          assignment.assigned = true;
          
          await this.updateAssignmentScheduling(assignment.assignment.id, {
            scheduledDate: date,
            scheduledBlock: targetBlock.block.blockNumber,
            blockStart: targetBlock.block.startTime,
            blockEnd: targetBlock.block.endTime
          });
          
          assignedAssignments.push(assignment.assignment.title);
          console.log(`🎯 Force-scheduled: ${assignment.assignment.title} (${assignment.assignmentMinutes}min) in block ${targetBlock.block.blockNumber} (${targetBlock.blockMinutes}min)`);
          
          blockIndex++;
        }
      }
      
      // Final verification - ensure ALL assignments are scheduled
      const finalUnassigned = assignmentPool.filter(item => !item.assigned);
      if (finalUnassigned.length === 0) {
        console.log(`✅ SUCCESS: All ${assignmentPool.length} assignments have been scheduled!`);
      } else {
        console.log(`❌ ERROR: ${finalUnassigned.length} assignments still unscheduled - this should not happen!`);
      }
      
      // Apply normalization to assignment titles for logging
      const { normalizeAssignment: normalizeAssignmentNew } = await import('@shared/normalize');
      const normalizedAssignments = assignedAssignments.map(title => {
        // Find the assignment object to get full details for normalization
        const assignment = candidateAssignments.find(a => a.title === title);
        if (!assignment) return title;
        
        const normalized = normalizeAssignmentNew({
          id: assignment.id,
          title: assignment.title,
          course: assignment.courseName,
          instructions: assignment.instructions,
          dueAt: assignment.dueDate ? assignment.dueDate.toISOString() : null
        });
        
        return normalized.displayTitle || title;
      });
      
      console.log(`✅ Allocated ${assignedAssignments.length} assignments:`, normalizedAssignments);
      
      // DEBUG LOGGING: Show filled assignments (using assignment titles as strings)
      logOrderTrace('SERVER', 'filledAssignments', assignedAssignments.map((assignmentTitle, index) => ({
        slotBlockId: `block-${index}`,
        assignmentId: `assignment-${index}`,
        assignmentTitle: assignmentTitle,
        startTime: null, // Will be computed from block
        startMinute: null
      })));
      
    } catch (error) {
      console.error('Error allocating assignments to template:', error);
    }
  }

  // Reschedule assignment that needs more time
  async rescheduleNeedMoreTime(assignmentId: string, date: string): Promise<void> {
    try {
      console.log(`⏰ Rescheduling assignment ${assignmentId} from ${date}`);
      
      const assignment = await this.getAssignment(assignmentId);
      if (!assignment) {
        throw new Error(`Assignment ${assignmentId} not found`);
      }
      
      // UTC HARDENING: Parse date-only string as UTC midnight, not local time
      const targetDate = new Date(date + 'T00:00:00.000Z');
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      targetDate.setUTCHours(0, 0, 0, 0);
      
      console.log(`SCHED: [RESCHEDULE-UTC-HARDENED] Input date: ${date} -> UTC: ${targetDate.toISOString()}, Today UTC: ${today.toISOString()}`);
      
      const isDueToday = assignment.dueDate && new Date(assignment.dueDate).getTime() === targetDate.getTime();
      const isOverdue = assignment.dueDate && new Date(assignment.dueDate) < targetDate;
      
      if (isDueToday || isOverdue) {
        // SCHOOL TIMEZONE: Use timezone-aware weekday for consistent schedule selection
        const { getSchoolWeekdayName } = await import('./lib/schoolTimezone');
        const weekdayName = getSchoolWeekdayName(date);
        
        const templateBlocks = await this.getScheduleTemplate(assignment.userId.replace('-user', ''), weekdayName);
        const assignmentBlocks = templateBlocks.filter(block => 
          block.blockType === 'Assignment' || block.subject === 'Assignment'
        ).sort((a, b) => a.startTime.localeCompare(b.startTime));
        
        // Find available block
        const userId = assignment.userId;
        const todayAssignments = await this.getAssignments(userId, date);
        const scheduledBlocks = new Set(todayAssignments.map(a => a.scheduledBlock).filter(Boolean));
        
        const availableBlock = assignmentBlocks.find(block => !scheduledBlocks.has(block.blockNumber));
        
        if (availableBlock) {
          // Schedule in available block
          await this.updateAssignmentScheduling(assignmentId, {
            scheduledDate: date,
            scheduledBlock: availableBlock.blockNumber,
            blockStart: availableBlock.startTime,
            blockEnd: availableBlock.endTime
          });
        } else {
          // Bump lowest-priority C assignment to tomorrow
          const todayScheduled = todayAssignments.filter(a => a.priority === 'C' && a.scheduledDate === date);
          if (todayScheduled.length > 0) {
            const lowestPriority = todayScheduled[0];
            const tomorrow = new Date(targetDate);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            await this.updateAssignmentScheduling(lowestPriority.id, {
              scheduledDate: tomorrow.toISOString().split('T')[0],
              scheduledBlock: null,
              blockStart: null,
              blockEnd: null
            });
            
            // Schedule current assignment in freed block
            await this.updateAssignmentScheduling(assignmentId, {
              scheduledDate: date,
              scheduledBlock: lowestPriority.scheduledBlock,
              blockStart: lowestPriority.blockStart,
              blockEnd: lowestPriority.blockEnd
            });
          }
        }
      } else {
        // Due later this week - just reschedule without creating Split Auto
        console.log(`ℹ️ Assignment due later this week, no Split Auto needed: ${assignment.title}`);
      }
      
      console.log(`✅ Rescheduled assignment ${assignment.title}`);
      
    } catch (error) {
      console.error('Error rescheduling assignment:', error);
    }
  }

  // Mark assignment as stuck and add to needs review list
  async markStuckWithUndo(assignmentId: string): Promise<void> {
    try {
      console.log(`🚩 Marking assignment ${assignmentId} as stuck`);
      
      const assignment = await this.getAssignment(assignmentId);
      if (!assignment) {
        throw new Error(`Assignment ${assignmentId} not found`);
      }
      
      // Set completion status to 'stuck'
      await this.updateAssignmentStatus(assignmentId, 'stuck');
      
      // Update student flags to mark as stuck
      const studentName = assignment.userId.replace('-user', '');
      await this.updateStudentFlags(studentName, { 
        isStuck: true,
        needsHelp: true 
      });
      
      console.log(`✅ Marked assignment "${assignment.title}" as stuck for ${studentName}`);
      
    } catch (error) {
      console.error('Error marking assignment as stuck:', error);
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
      priority: data.priority || 'B',
      difficulty: data.difficulty || 'medium',
      timeSpent: data.timeSpent || 0,
      notes: data.notes || null,
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
      needsPrinting: data.needsPrinting || null,
      printStatus: data.printStatus || null,
      printReason: data.printReason || null,
      printedAt: data.printedAt || null,
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
        createdAt: new Date(),
        updatedAt: new Date()
      },
      'khalil': {
        id: 'khalil-profile',
        studentName: 'khalil',
        displayName: 'Khalil',
        profileImageUrl: null,
        themeColor: '#3B86D1',
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
      createdAt: new Date(),
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

  // Daily schedule status operations (stub methods for MemStorage)
  async getDailyScheduleStatus(studentName: string, date: string): Promise<Array<DailyScheduleStatus & { template: ScheduleTemplate }>> {
    // Stub implementation - return empty array
    return [];
  }

  async updateBlockStatus(studentName: string, date: string, templateBlockId: string, status: string, flags?: object): Promise<DailyScheduleStatus | undefined> {
    // Stub implementation - return undefined
    return undefined;
  }

  async initializeDailySchedule(studentName: string, date: string): Promise<void> {
    // Stub implementation - do nothing
  }

  // Assignment allocation and scheduling helpers (stub implementations)
  async allocateAssignmentsToTemplate(studentName: string, date: string): Promise<void> {
    // Stub implementation - do nothing
  }

  async rescheduleNeedMoreTime(assignmentId: string, date: string): Promise<void> {
    // Stub implementation - do nothing
  }

  async markStuckWithUndo(assignmentId: string): Promise<void> {
    // Stub implementation - do nothing
  }

  async getAllAssignments(): Promise<Assignment[]> {
    // Return all assignments for print queue functionality
    return Array.from(this.assignments.values());
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
