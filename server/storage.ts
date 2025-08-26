import { type User, type InsertUser, type Assignment, type InsertAssignment, type UpdateAssignment } from "@shared/schema";
import { randomUUID } from "crypto";

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
}

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
      priority: data.priority || 'medium',
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
        priority: "high",
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
        priority: "medium",
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
        priority: "medium",
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
        priority: "low",
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
        priority: assignment.priority || 'medium',
        difficulty: assignment.difficulty || 'medium',
        timeSpent: assignment.timeSpent || 0,
        notes: assignment.notes || null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });
  }
}

export const storage = new MemStorage();
