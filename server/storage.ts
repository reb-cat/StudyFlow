import { 
  type User, type InsertUser, 
  type Assignment, type InsertAssignment, type UpdateAssignment,
  type ScheduleTemplate, type InsertScheduleTemplate,
  type BibleCurriculum, type InsertBibleCurriculum 
} from "@shared/schema";
import { randomUUID } from "crypto";
import { supabase } from "./lib/supabase";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Assignment operations
  getAssignments(userId: string, date?: string): Promise<Assignment[]>;
  getAssignment(id: string): Promise<Assignment | undefined>;
  createAssignment(assignment: InsertAssignment & { userId: string }): Promise<Assignment>;
  updateAssignment(id: string, update: UpdateAssignment): Promise<Assignment | undefined>;
  deleteAssignment(id: string): Promise<boolean>;
  
  // Schedule template operations
  getScheduleTemplate(studentName: string, weekday?: string): Promise<ScheduleTemplate[]>;
  createScheduleTemplate(template: InsertScheduleTemplate): Promise<ScheduleTemplate>;
  
  // Bible curriculum operations
  getBibleCurriculum(weekNumber?: number): Promise<BibleCurriculum[]>;
  getBibleCurrentWeek(): Promise<BibleCurriculum[]>;
  updateBibleCompletion(weekNumber: number, dayOfWeek: number, completed: boolean): Promise<BibleCurriculum | undefined>;
}

// Database storage implementation using Supabase
export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    try {
      const result = await db.select().from(users).where(eq(users.id, id));
      return result[0] as User | undefined;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
      
      if (error) {
        console.error('Error getting user by username:', error);
        return undefined;
      }
      return data as User;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return undefined;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert(insertUser)
        .select()
        .single();
      
      if (error) {
        console.error('Error creating user:', error);
        throw new Error('Failed to create user');
      }
      return data as User;
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  async getAssignments(userId: string, date?: string): Promise<Assignment[]> {
    try {
      let query = supabase
        .from('assignments')
        .select('*')
        .eq('user_id', userId);
      
      if (date) {
        query = query.eq('scheduled_date', date);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error getting assignments:', error);
        return [];
      }
      
      return (data || []) as Assignment[];
    } catch (error) {
      console.error('Error getting assignments:', error);
      return [];
    }
  }

  async getAssignment(id: string): Promise<Assignment | undefined> {
    try {
      const result = await db.select().from(assignments).where(eq(assignments.id, id));
      return result[0] as Assignment | undefined;
    } catch (error) {
      console.error('Error getting assignment:', error);
      return undefined;
    }
  }

  async createAssignment(data: InsertAssignment & { userId: string }): Promise<Assignment> {
    try {
      const assignmentData = {
        id: randomUUID(),
        user_id: data.userId,
        title: data.title,
        subject: data.subject || null,
        course_name: data.courseName || null,
        instructions: data.instructions || null,
        due_date: data.dueDate || null,
        scheduled_date: data.scheduledDate || null,
        scheduled_block: data.scheduledBlock || null,
        block_start: data.blockStart || null,
        block_end: data.blockEnd || null,
        actual_estimated_minutes: data.actualEstimatedMinutes || 30,
        completion_status: data.completionStatus || 'pending',
        block_type: data.blockType || 'assignment',
        is_assignment_block: data.isAssignmentBlock ?? true,
        priority: data.priority || 'B',
        difficulty: data.difficulty || 'medium',
        time_spent: data.timeSpent || 0,
        notes: data.notes || null,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const { data: assignment, error } = await supabase
        .from('assignments')
        .insert(assignmentData)
        .select()
        .single();
      
      if (error) {
        console.error('Error creating assignment:', error);
        throw new Error('Failed to create assignment');
      }
      
      return assignment as Assignment;
    } catch (error) {
      console.error('Error creating assignment:', error);
      throw new Error('Failed to create assignment');
    }
  }

  async updateAssignment(id: string, update: UpdateAssignment): Promise<Assignment | undefined> {
    try {
      const result = await db.update(assignments).set(update).where(eq(assignments.id, id)).returning();
      return result[0] as Assignment | undefined;
    } catch (error) {
      console.error('Error updating assignment:', error);
      return undefined;
    }
  }

  async deleteAssignment(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting assignment:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting assignment:', error);
      return false;
    }
  }

  // Schedule template operations
  async getScheduleTemplate(studentName: string, weekday?: string): Promise<ScheduleTemplate[]> {
    try {
      let query = supabase
        .from('schedule_template')
        .select('*')
        .eq('student_name', studentName);
      
      if (weekday) {
        query = query.eq('weekday', weekday);
      }
      
      const { data, error } = await query.order('start_time');
      
      if (error) {
        console.error('Error getting schedule template:', error);
        return [];
      }
      
      return (data || []) as ScheduleTemplate[];
    } catch (error) {
      console.error('Error getting schedule template:', error);
      return [];
    }
  }

  async createScheduleTemplate(template: InsertScheduleTemplate): Promise<ScheduleTemplate> {
    try {
      const result = await db.insert(scheduleTemplate).values(template).returning();
      return result[0] as ScheduleTemplate;
    } catch (error) {
      console.error('Error creating schedule template:', error);
      throw new Error('Failed to create schedule template');
    }
  }

  // Bible curriculum operations
  async getBibleCurriculum(weekNumber?: number): Promise<BibleCurriculum[]> {
    try {
      if (weekNumber !== undefined) {
        const result = await db.select().from(bibleCurriculum).where(
          eq(bibleCurriculum.weekNumber, weekNumber)
        ).orderBy(bibleCurriculum.weekNumber, bibleCurriculum.dayOfWeek);
        return result as BibleCurriculum[];
      } else {
        const result = await db.select().from(bibleCurriculum).orderBy(bibleCurriculum.weekNumber, bibleCurriculum.dayOfWeek);
        return result as BibleCurriculum[];
      }
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
        .where(and(
          eq(bibleCurriculum.weekNumber, weekNumber),
          eq(bibleCurriculum.dayOfWeek, dayOfWeek)
        ))
        .returning();
      
      return result[0] as BibleCurriculum | undefined;
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

  async deleteAssignment(id: string): Promise<boolean> {
    return this.assignments.delete(id);
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
        completionStatus: "in_progress",
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
