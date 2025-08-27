import { 
  type User, type InsertUser, 
  type Assignment, type InsertAssignment, type UpdateAssignment,
  type ScheduleTemplate, type InsertScheduleTemplate,
  type BibleCurriculum, type InsertBibleCurriculum,
  users, assignments, scheduleTemplate, bibleCurriculum
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, sql, desc } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Assignment operations
  getAssignments(userId: string, date?: string, includeCompleted?: boolean): Promise<Assignment[]>;
  getScheduledAssignments(userId: string, date?: string, scheduleBlocks?: ScheduleTemplate[]): Promise<Assignment[]>; // NEW: Intelligent block distribution
  getAllAssignments(): Promise<Assignment[]>; // For print queue - gets all assignments across all users
  getAssignment(id: string): Promise<Assignment | undefined>;
  createAssignment(assignment: InsertAssignment & { userId: string }): Promise<Assignment>;
  updateAssignment(id: string, update: UpdateAssignment): Promise<Assignment | undefined>;
  updateAssignmentStatus(id: string, completionStatus: string): Promise<Assignment | undefined>;
  deleteAssignment(id: string): Promise<boolean>;
  updateAdministrativeAssignments(): Promise<void>;
  getAssignmentStats(): Promise<{
    activeStudents: number;
    completed: number;
    inProgress: number;
    needSupport: number;
  }>;
  
  // Schedule template operations
  getScheduleTemplate(studentName: string, weekday?: string): Promise<ScheduleTemplate[]>;
  createScheduleTemplate(template: InsertScheduleTemplate): Promise<ScheduleTemplate>;
  
  // Bible curriculum operations
  getBibleCurriculum(weekNumber?: number): Promise<BibleCurriculum[]>;
  getBibleCurrentWeek(): Promise<BibleCurriculum[]>;
  updateBibleCompletion(weekNumber: number, dayOfWeek: number, completed: boolean): Promise<BibleCurriculum | undefined>;
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

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return result[0] || undefined;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const result = await db.insert(users).values(insertUser).returning();
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
      
      // Admin mode: return all assignments without intelligent processing
      if (includeCompleted) {
        console.log(`🔧 Admin mode: Returning all ${assignmentList.length} assignments (no filtering)`);
        return assignmentList;
      }

      // INTELLIGENT SCHEDULING MODE - Complete rebuild of filtering algorithm
      console.log(`🤖 INTELLIGENT SCHEDULING: Processing ${assignmentList.length} raw assignments for optimal daily schedule`);
      
      // STEP 1: Remove exact duplicates by title (fix Canvas import duplicates)
      const beforeDuplicateFilter = assignmentList.length;
      const uniqueTitles = new Set();
      assignmentList = assignmentList.filter((assignment: any) => {
        if (uniqueTitles.has(assignment.title)) {
          console.log(`🔄 Removing duplicate: "${assignment.title}"`);
          return false;
        }
        uniqueTitles.add(assignment.title);
        return true;
      });
      console.log(`📋 Duplicate removal: ${beforeDuplicateFilter} → ${assignmentList.length} assignments`);

      // STEP 2: Exclude completed assignments from daily planning
      const beforeCompletionFilter = assignmentList.length;
      assignmentList = assignmentList.filter((assignment: any) => 
        assignment.completionStatus !== 'completed'
      );
      console.log(`✅ Status filtering: ${beforeCompletionFilter} → ${assignmentList.length} assignments (excluded completed)`);

      // STEP 3: Filter out administrative tasks and inappropriate assignments
      const beforeAdminFilter = assignmentList.length;
      assignmentList = assignmentList.filter((assignment: any) => {
        const title = assignment.title.toLowerCase();
        
        // Filter out administrative/system tasks
        if (title.includes('roll call') || 
            title.includes('attendance') ||
            title.includes('syllabus') ||
            title.includes('course introduction') ||
            title.includes('honor code') ||
            title.includes('parent contact') ||
            title.includes('zoom') ||
            title.includes('meet and greet')) {
          console.log(`🚫 Filtering administrative task: "${assignment.title}"`);
          return false;
        }
        
        return true;
      });
      console.log(`🧹 Administrative filtering: ${beforeAdminFilter} → ${assignmentList.length} assignments`);

      // STEP 4: Smart due date filtering (3-7 day window only)
      if (date) {
        const requestDate = new Date(date);
        const earliestDate = new Date(requestDate);
        earliestDate.setDate(requestDate.getDate() - 1); // Include today and yesterday (overdue)
        const latestDate = new Date(requestDate);
        latestDate.setDate(requestDate.getDate() + 7); // 7 days ahead max
        
        console.log(`📅 SMART Date filtering: ${earliestDate.toISOString().split('T')[0]} to ${latestDate.toISOString().split('T')[0]}`);
        
        const beforeDateFilter = assignmentList.length;
        assignmentList = assignmentList.filter((assignment: any) => {
          // Always include assignments without due dates (ongoing work)
          if (!assignment.dueDate) {
            console.log(`📝 Including ongoing assignment: "${assignment.title}"`);
            return true;
          }
          
          const dueDate = new Date(assignment.dueDate);
          const isInRange = dueDate >= earliestDate && dueDate <= latestDate;
          
          if (isInRange) {
            const daysDiff = Math.ceil((dueDate.getTime() - requestDate.getTime()) / (1000 * 60 * 60 * 24));
            if (daysDiff <= 0) {
              console.log(`🔥 Including OVERDUE assignment: "${assignment.title}" (due ${dueDate.toISOString().split('T')[0]})`);
            } else {
              console.log(`✅ Including assignment: "${assignment.title}" (due in ${daysDiff} days)`);
            }
          } else {
            console.log(`⏭️ Excluding assignment too far out: "${assignment.title}" (due ${dueDate.toISOString().split('T')[0]})`);
          }
          
          return isInRange;
        });
        
        console.log(`📊 Smart date filtering: ${beforeDateFilter} → ${assignmentList.length} assignments`);
      }

      // STEP 5: Assignment prioritization by urgency and importance
      assignmentList.sort((a: any, b: any) => {
        const now = new Date();
        
        // Priority 1: Overdue assignments first
        const aOverdue = a.dueDate && new Date(a.dueDate) < now;
        const bOverdue = b.dueDate && new Date(b.dueDate) < now;
        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;
        
        // Priority 2: Sort by due date (earliest first)
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        
        // Priority 3: Assignments without due dates go last
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;
        
        // Priority 4: Alphabetical by title
        return a.title.localeCompare(b.title);
      });

      console.log(`🎯 INTELLIGENT SCHEDULING COMPLETE: ${assignmentList.length} optimized assignments ready for daily schedule`);
      
      return assignmentList;
    } catch (error) {
      console.error('Error getting assignments:', error);
      return [];
    }
  }

  async getScheduledAssignments(userId: string, date?: string, scheduleBlocks?: ScheduleTemplate[]): Promise<Assignment[]> {
    try {
      // Get intelligently filtered assignments
      let assignments = await this.getAssignments(userId, date, false);
      
      if (!scheduleBlocks || scheduleBlocks.length === 0) {
        console.log(`📅 No schedule blocks provided, returning ${assignments.length} assignments without block distribution`);
        return assignments.slice(0, 6); // Limit to 6 assignments max
      }

      // ENHANCED INTELLIGENT SCHEDULING with A/B/C Priority Classification
      console.log(`🎯 ENHANCED INTELLIGENT SCHEDULING: Processing ${assignments.length} assignments`);
      
      // Step 1: Classify assignments with A/B/C priority based on due dates
      assignments = assignments.map(assignment => ({
        ...assignment,
        priority: this.classifyAssignmentPriority(assignment),
        difficulty: this.detectAssignmentDifficulty(assignment),
        estimatedMinutes: this.estimateAssignmentTime(assignment)
      }));
      
      // Step 2: Sort by priority (A first), then difficulty (heavy first), then due date
      assignments.sort((a: any, b: any) => {
        // Priority: A > B > C
        const priorityOrder = { 'A': 0, 'B': 1, 'C': 2 };
        const priorityDiff = priorityOrder[a.priority as keyof typeof priorityOrder] - priorityOrder[b.priority as keyof typeof priorityOrder];
        if (priorityDiff !== 0) return priorityDiff;
        
        // Within same priority: Heavy tasks first (mental effort distribution)
        if (a.difficulty === 'hard' && b.difficulty !== 'hard') return -1;
        if (a.difficulty !== 'hard' && b.difficulty === 'hard') return 1;
        
        // Then by due date
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        return 0;
      });
      
      console.log(`📊 Priority distribution: A=${assignments.filter(a => a.priority === 'A').length}, B=${assignments.filter(a => a.priority === 'B').length}, C=${assignments.filter(a => a.priority === 'C').length}`);
      
      // Step 3: Detect student-specific needs
      const studentName = this.getStudentNameFromUserId(userId);
      const isKhalil = studentName.toLowerCase() === 'khalil';
      
      // Step 4: Group assignments by subject for diversity logic
      const assignmentsBySubject = new Map<string, any[]>();
      for (const assignment of assignments) {
        const subject = this.getAssignmentSubject(assignment);
        if (!assignmentsBySubject.has(subject)) {
          assignmentsBySubject.set(subject, []);
        }
        assignmentsBySubject.get(subject)?.push(assignment);
      }

      console.log(`📚 Subject groups:`, Array.from(assignmentsBySubject.keys()));

      // Step 5: Get assignment blocks and apply student-specific preferences
      let assignmentBlocks = scheduleBlocks.filter(block => 
        block.blockType === 'Assignment' && block.blockNumber
      ).sort((a, b) => (a.blockNumber || 0) - (b.blockNumber || 0));
      
      // Khalil preference: Use fewer blocks for shorter focused sessions
      if (isKhalil && assignmentBlocks.length > 4) {
        assignmentBlocks = assignmentBlocks.slice(0, 4); // Limit Khalil to 4 blocks max
        console.log(`👦 Khalil preference: Limited to ${assignmentBlocks.length} blocks for shorter focus sessions`);
      }

      console.log(`🏗️ Available assignment blocks: ${assignmentBlocks.length}`);

      // Step 6: SMART BLOCK FILLING with Mental Effort Distribution
      const scheduledAssignments: any[] = [];
      const usedSubjects: string[] = [];

      for (let i = 0; i < assignmentBlocks.length && scheduledAssignments.length < assignments.length; i++) {
        const block = assignmentBlocks[i];
        const isEarlyBlock = i < Math.ceil(assignmentBlocks.length / 2); // First half = early blocks
        let assignmentAssigned = false;

        // Early blocks: Prefer heavy/difficult assignments (mental effort distribution)
        // Later blocks: Prefer lighter assignments
        let candidateAssignments = [];
        
        if (isEarlyBlock) {
          // Early blocks: Prioritize A-priority and heavy assignments
          candidateAssignments = assignments.filter(a => 
            (a.priority === 'A' || a.difficulty === 'hard') && 
            !scheduledAssignments.includes(a)
          );
        }
        
        if (candidateAssignments.length === 0) {
          // Fallback: Any unscheduled assignment
          candidateAssignments = assignments.filter(a => !scheduledAssignments.includes(a));
        }

        // PRAGMATIC SUBJECT DIVERSITY - Prefer filled blocks over perfect spacing
        let bestAssignment = null;
        let diversityScore = -1;
        
        for (const assignment of candidateAssignments) {
          const subject = this.getAssignmentSubject(assignment);
          const lastSubject = usedSubjects[usedSubjects.length - 1];
          const secondLastSubject = usedSubjects[usedSubjects.length - 2];
          
          // Calculate diversity score (higher = better)
          let score = 0;
          if (subject !== lastSubject) score += 10; // Different from last = good
          if (subject !== secondLastSubject) score += 5; // Different from second-last = bonus
          
          // Priority bonus (A > B > C)
          if (assignment.priority === 'A') score += 3;
          if (assignment.priority === 'B') score += 1;
          
          // Early block prefers harder assignments
          if (isEarlyBlock && assignment.difficulty === 'hard') score += 2;
          
          if (score > diversityScore) {
            diversityScore = score;
            bestAssignment = assignment;
          }
        }
        
        // Always assign SOMETHING if assignments are available - no empty blocks for perfectionism
        if (bestAssignment) {
          scheduledAssignments.push(bestAssignment);
          usedSubjects.push(this.getAssignmentSubject(bestAssignment));
          assignmentAssigned = true;
          
          const blockLabel = isEarlyBlock ? '🌅 Early' : '🌆 Later';
          const diversityLabel = diversityScore >= 10 ? '🎯 Diverse' : '📚 Same-subject';
          console.log(`📍 Block ${block.blockNumber} ${blockLabel} ${diversityLabel}: "${bestAssignment.title}" [${bestAssignment.priority}-priority, ${bestAssignment.difficulty}]`);
        }

        // Only leave block empty if NO assignments are available
        if (!assignmentAssigned) {
          console.log(`⚪ Block ${block.blockNumber}: No assignments available`);
        }
      }

      console.log(`🎯 ENHANCED SCHEDULING COMPLETE: ${scheduledAssignments.length} intelligently distributed assignments`);
      console.log(`📋 Subject sequence: ${usedSubjects.join(' → ')}`);
      console.log(`🧠 Mental effort distribution: Heavy tasks in early blocks, lighter tasks later`);

      return scheduledAssignments;
    } catch (error) {
      console.error('Error getting scheduled assignments:', error);
      return [];
    }
  }

  private getAssignmentSubject(assignment: any): string {
    // Extract subject from assignment data for diversity grouping
    if (assignment.subject) return assignment.subject;
    if (assignment.courseName) return assignment.courseName;
    
    // Extract subject from title patterns
    const title = assignment.title.toLowerCase();
    
    if (title.includes('math') || title.includes('geometry') || title.includes('algebra') || 
        title.includes('calculus') || title.includes('unit') || title.includes('hmwk')) {
      return 'Mathematics';
    }
    if (title.includes('english') || title.includes('writing') || title.includes('grammar') || 
        title.includes('essay') || title.includes('literature') || title.includes('vocab')) {
      return 'English';
    }
    if (title.includes('science') || title.includes('biology') || title.includes('chemistry') || 
        title.includes('physics') || title.includes('lab')) {
      return 'Science';
    }
    if (title.includes('history') || title.includes('social') || title.includes('government') || 
        title.includes('civics')) {
      return 'History';
    }
    if (title.includes('spanish') || title.includes('french') || title.includes('language')) {
      return 'Language';
    }
    if (title.includes('recipe') || title.includes('cooking') || title.includes('culinary')) {
      return 'Culinary';
    }
    if (title.includes('art') || title.includes('music') || title.includes('creative')) {
      return 'Arts';
    }
    
    // Default grouping by course name or generic
    return assignment.courseName || 'General';
  }
  
  private classifyAssignmentPriority(assignment: any): 'A' | 'B' | 'C' {
    const now = new Date();
    const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
    
    if (!dueDate) return 'C'; // No due date = flexible
    
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // A Priority: Overdue or due today/tomorrow (Critical)
    if (daysUntilDue <= 1) return 'A';
    
    // B Priority: Due this week (Important)
    if (daysUntilDue <= 7) return 'B';
    
    // C Priority: Due later (Flexible)
    return 'C';
  }
  
  private detectAssignmentDifficulty(assignment: any): 'easy' | 'medium' | 'hard' {
    const title = assignment.title.toLowerCase();
    const subject = this.getAssignmentSubject(assignment).toLowerCase();
    const instructions = (assignment.instructions || '').toLowerCase();
    
    // Hard: Math/Science subjects are cognitively demanding
    if (subject.includes('math') || subject.includes('science') || subject.includes('geometry')) {
      return 'hard';
    }
    
    // Hard: Complex assignments based on keywords
    if (title.includes('essay') || title.includes('research') || title.includes('analysis') || 
        title.includes('project') || instructions.length > 500) {
      return 'hard';
    }
    
    // Easy: Short tasks like recipes, reading, simple worksheets
    if (title.includes('recipe') || title.includes('read') || title.includes('vocabulary') || 
        (instructions.length > 0 && instructions.length < 100)) {
      return 'easy';
    }
    
    // Default to medium
    return 'medium';
  }
  
  private estimateAssignmentTime(assignment: any): number {
    // Use existing estimate if available
    if (assignment.actualEstimatedMinutes && assignment.actualEstimatedMinutes > 0) {
      return assignment.actualEstimatedMinutes;
    }
    
    const title = assignment.title.toLowerCase();
    const subject = this.getAssignmentSubject(assignment).toLowerCase();
    const difficulty = this.detectAssignmentDifficulty(assignment);
    
    // Recipe assignments: 5-7 minutes (can share blocks)
    if (title.includes('recipe')) return 7;
    
    // Math/Science: Longer focused work
    if (subject.includes('math') || subject.includes('science')) {
      return difficulty === 'hard' ? 45 : 30;
    }
    
    // Reading assignments
    if (title.includes('read')) return 15;
    
    // Writing assignments
    if (title.includes('writing') || title.includes('essay')) {
      return difficulty === 'hard' ? 40 : 25;
    }
    
    // Worksheets
    if (title.includes('worksheet')) return 20;
    
    // Default estimates by difficulty
    switch (difficulty) {
      case 'easy': return 15;
      case 'hard': return 40;
      default: return 25;
    }
  }
  
  private getStudentNameFromUserId(userId: string): string {
    if (userId === 'abigail-user') return 'Abigail';
    if (userId === 'khalil-user') return 'Khalil';
    return 'Unknown';
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
        subject: data.subject,
        courseName: data.courseName,
        instructions: data.instructions,
        // Canvas integration fields - CRITICAL for print queue Canvas links!
        canvasId: data.canvasId || null,
        canvasCourseId: data.canvasCourseId || null,
        canvasInstance: data.canvasInstance || null,
        // Additional Canvas metadata
        scheduledDate: data.scheduledDate || null,
        actualEstimatedMinutes: data.actualEstimatedMinutes || 30,
        completionStatus: data.completionStatus || 'pending',
        priority: data.priority || 'B',
        difficulty: data.difficulty || 'medium'
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

  async getAssignmentStats(): Promise<{
    activeStudents: number;
    completed: number;
    inProgress: number;
    needSupport: number;
  }> {
    try {
      // Get all assignments across all students
      const allAssignments = await db.select().from(assignments);
      
      // Get today's date for filtering (start and end of day)
      const today = new Date();
      const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      
      // Count assignments by status - only count completed assignments from today
      const completed = allAssignments.filter(a => {
        if (a.completionStatus !== 'completed') return false;
        if (!a.updatedAt) return false;
        const updatedDate = new Date(a.updatedAt);
        return updatedDate >= startOfToday && updatedDate < endOfToday;
      }).length;
      
      // For in-progress and need support, show current status regardless of date
      const inProgress = allAssignments.filter(a => a.completionStatus === 'needs_more_time').length;
      const needSupport = allAssignments.filter(a => a.completionStatus === 'stuck').length;
      
      // Count unique active students (students with assignments)
      const uniqueStudents = new Set(allAssignments.map(a => a.userId));
      const activeStudents = uniqueStudents.size;
      
      return {
        activeStudents,
        completed,
        inProgress,
        needSupport
      };
    } catch (error) {
      console.error('Error getting assignment stats:', error);
      return {
        activeStudents: 2, // Fallback: Abigail + Khalil
        completed: 0,
        inProgress: 0,
        needSupport: 0
      };
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
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });
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
