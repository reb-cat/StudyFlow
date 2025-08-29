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
import { eq, and, sql, desc } from "drizzle-orm";

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
      let result = await db.select().from(assignments).where(eq(assignments.userId, userId));
      let assignmentList = result || [];
      
      // For daily scheduling: exclude completed assignments and filter by date
      // This keeps the daily view focused while the database contains the full Canvas dataset
      // Admin mode can include completed assignments by setting includeCompleted = true
      
      // FIRST: Exclude completed assignments from daily planning (unless admin mode)
      // Only show assignments that are actively workable (pending, needs_more_time, stuck)
      if (!includeCompleted) {
        const beforeCompletionFilter = assignmentList.length;
        assignmentList = assignmentList.filter((assignment: any) => 
          assignment.completionStatus !== 'completed'
        );
        console.log(`📝 Status filtering: ${beforeCompletionFilter} → ${assignmentList.length} assignments (excluded completed assignments)`);
        
        // SECOND: Filter out non-completable assignments (participation, attendance, etc.)
        // These represent ongoing classroom behavior rather than discrete homework tasks
        const beforeTypeFilter = assignmentList.length;
        assignmentList = assignmentList.filter((assignment: any) => {
          const title = (assignment.title || '').toLowerCase();
          const isParticipation = 
            title.includes('class participation') ||
            title.includes('participation') ||
            title.includes('attendance') ||
            title.includes('classroom participation') ||
            title.includes('class engagement') ||
            title.includes('daily participation');
          
          if (isParticipation) {
            console.log(`🚫 Excluding non-completable assignment: ${assignment.title}`);
            return false;
          }
          return true;
        });
        console.log(`🎯 Type filtering: ${beforeTypeFilter} → ${assignmentList.length} assignments (excluded participation/attendance)`);
      } else {
        console.log(`🔧 Admin mode: Including all assignments (${assignmentList.length} total)`);
      }
      
      // THIRD: Apply date filtering for daily scheduling
      if (date) {
        const requestDate = new Date(date);
        const futureLimit = new Date(requestDate);
        futureLimit.setDate(requestDate.getDate() + 21); // 3 weeks ahead
        
        // Allow overdue assignments up to 30 days back (for catch-up work)
        const pastLimit = new Date(requestDate);
        pastLimit.setDate(requestDate.getDate() - 30); 
        
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
            const isOverdue = dueDate < requestDate;
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

  async getAllAssignments(): Promise<Assignment[]> {
    try {
      // Get ALL assignments across all users for print queue
      const result = await db.select().from(assignments);
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
        actualEstimatedMinutes: data.actualEstimatedMinutes || 30,
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
        canvasUrl: data.canvasUrl || null
      };
      
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

  async updateAdministrativeAssignments(): Promise<void> {
    try {
      // Get all assignments and update administrative ones
      const allAssignments = await db.select().from(assignments);
      
      for (const assignment of allAssignments) {
        const isAdministrative = assignment.title.toLowerCase().includes('fee') ||
                                assignment.title.toLowerCase().includes('supply') ||
                                assignment.title.toLowerCase().includes('syllabus') ||
                                assignment.title.toLowerCase().includes('honor code');
        
        if (isAdministrative) {
          await db.update(assignments)
            .set({ completionStatus: 'completed' })
            .where(eq(assignments.id, assignment.id));
          
          console.log(`Updated admin assignment: ${assignment.title}`);
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
    } catch (error) {
      console.error('Error initializing daily schedule:', error);
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
    
    // Add sample assignments for demo
    this.initializeSampleData();
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
      isQuizAssignment: data.isQuizAssignment || null,
      isDiscussionAssignment: data.isDiscussionAssignment || null,
      originalCanvasUrl: data.originalCanvasUrl || null,
      canvasPointsPossible: data.canvasPointsPossible || null,
      canvasSubmissionTypes: data.canvasSubmissionTypes || null,
      canvasGradingType: data.canvasGradingType || null,
      canvasWorkflowState: data.canvasWorkflowState || null,
      canvasPublished: data.canvasPublished || null,
      canvasLockAt: data.canvasLockAt || null,
      canvasUnlockAt: data.canvasUnlockAt || null,
      canvasAllowedAttempts: data.canvasAllowedAttempts || null,
      canvasGroupCategoryId: data.canvasGroupCategoryId || null,
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
        isQuizAssignment: null,
        isDiscussionAssignment: null,
        originalCanvasUrl: null,
        canvasPointsPossible: null,
        canvasSubmissionTypes: null,
        canvasGradingType: null,
        canvasWorkflowState: null,
        canvasPublished: null,
        canvasLockAt: null,
        canvasUnlockAt: null,
        canvasAllowedAttempts: null,
        canvasGroupCategoryId: null,
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
