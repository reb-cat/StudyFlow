import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: varchar("role", { length: 20 }).default("student"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Tasks table for student productivity
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  isCompleted: boolean("is_completed").default(false),
  priority: text("priority", { enum: ["low", "medium", "high"] }).default("medium"),
  dueDate: timestamp("due_date"),
  estimatedMinutes: text("estimated_minutes"),
  category: text("category"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Study sessions table
export const studySessions = pgTable("study_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  taskId: uuid("task_id").references(() => tasks.id),
  duration: text("duration").notNull(), // in minutes
  sessionType: text("session_type", { enum: ["pomodoro", "deep_work", "break"] }).default("pomodoro"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  notes: text("notes"),
});

// User preferences table
export const userPreferences = pgTable("user_preferences", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull().unique(),
  pomodoroMinutes: text("pomodoro_minutes").default("25"),
  shortBreakMinutes: text("short_break_minutes").default("5"),
  longBreakMinutes: text("long_break_minutes").default("15"),
  notificationsEnabled: boolean("notifications_enabled").default(true),
  theme: text("theme", { enum: ["light", "dark", "system"] }).default("system"),
  timezone: text("timezone").default("UTC"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schema for user registration/login
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  email: z.string().email(),
  password: z.string().min(8),
});

// Schema for user registration with password confirmation
export const registerUserSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export const loginUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Schema for tasks
export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateTaskSchema = insertTaskSchema.partial();

// Schema for study sessions
export const insertStudySessionSchema = createInsertSchema(studySessions).omit({
  id: true,
  userId: true,
  startedAt: true,
});

// Schema for user preferences
export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

// Advanced assignment management (integrated from learning-schedule)
export const assignments = pgTable("assignments", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(), // Changed to text to support student names like "khalil", "abigail"
  title: text("title").notNull(),
  subject: text("subject"),
  courseName: text("course_name"),
  instructions: text("instructions"),
  dueDate: timestamp("due_date"),
  scheduledDate: text("scheduled_date"), // yyyy-mm-dd format
  scheduledBlock: integer("scheduled_block"),
  blockStart: text("block_start"), // HH:mm format
  blockEnd: text("block_end"), // HH:mm format
  actualEstimatedMinutes: integer("actual_estimated_minutes").default(30),
  completionStatus: text("completion_status", { 
    enum: ["pending", "completed", "needs_more_time", "stuck"] 
  }).default("pending"),
  blockType: text("block_type").default("assignment"), // assignment, co-op, travel, prep, etc.
  isAssignmentBlock: boolean("is_assignment_block").default(true),
  priority: text("priority", { enum: ["A", "B", "C"] }).default("B"), // A=Critical, B=Important, C=Flexible
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).default("medium"),
  timeSpent: integer("time_spent").default(0), // actual minutes spent
  notes: text("notes"),
  // Canvas integration fields
  canvasId: integer("canvas_id"), // Canvas assignment ID for sync tracking
  canvasCourseId: integer("canvas_course_id"), // Canvas course ID for building URLs
  canvasInstance: integer("canvas_instance"), // 1 or 2 for multi-instance support
  isCanvasImport: boolean("is_canvas_import").default(false), // Track Canvas vs manual assignments
  
  // Enhanced Canvas metadata fields (safe additions to existing schema)
  canvasCategory: text("canvas_category"), // 'assignments' | 'discussions' | 'quizzes' | 'syllabus' | 'other'
  submissionTypes: text("submission_types").array().default(sql`ARRAY[]::text[]`),
  pointsValue: integer("points_value"),
  availableFrom: timestamp("available_from"),
  availableUntil: timestamp("available_until"),
  isRecurring: boolean("is_recurring").default(false),
  academicYear: text("academic_year"),
  confidenceScore: text("confidence_score"), // Store as text to avoid precision issues
  
  // Print Queue Management for Parent Dashboard
  needsPrinting: boolean("needs_printing").default(false), // Detected automatically
  printStatus: text("print_status", { 
    enum: ["not_needed", "needs_printing", "printed", "skipped"] 
  }).default("not_needed"),
  printReason: text("print_reason"), // Why it needs printing: "long_instructions", "contains_table", "worksheet", etc.
  printedAt: timestamp("printed_at"), // When parent marked as printed
  canvasUrl: text("canvas_url"), // Direct Canvas assignment link for easy printing
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schedule template table - fixed schedule blocks (uploaded via CSV)
export const scheduleTemplate = pgTable("schedule_template", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentName: text("student_name").notNull(), // "Abigail" or "Khalil" - maps to student_name column
  weekday: text("weekday").notNull(), // "Monday", "Tuesday", etc.
  blockNumber: integer("block_number"), // null for fixed blocks, 1,2,3... for assignment blocks
  startTime: text("start_time").notNull(), // "09:00:00" format
  endTime: text("end_time").notNull(), // "09:30:00" format
  subject: text("subject").notNull(), // "Bible", "Assignment", "Math", etc.
  blockType: text("block_type", {
    enum: ["Bible", "Assignment", "Travel", "Co-op", "Prep/Load", "Movement", "Lunch"]
  }).notNull(),
});

// Bible curriculum - week/day progression
export const bibleCurriculum = pgTable("bible_curriculum", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  weekNumber: integer("week_number").notNull(),
  dayOfWeek: integer("day_of_week"), // 1-5 for Mon-Fri, null for weekly memory verses
  readingTitle: text("reading_title"),
  readingType: text("reading_type"), // "daily_reading", "memory_verse", etc.
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
});

// Progress tracking for executive function support
export const progressSessions = pgTable("progress_sessions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").references(() => users.id).notNull(),
  assignmentId: uuid("assignment_id").references(() => assignments.id),
  sessionType: text("session_type", { 
    enum: ["focus", "break", "stuck_help", "continuation"] 
  }).default("focus"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  timeSpent: integer("time_spent"), // minutes
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }),
  notes: text("notes"),
  needsHelp: boolean("needs_help").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Assignment schemas
export const insertAssignmentSchema = createInsertSchema(assignments).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const updateAssignmentSchema = insertAssignmentSchema.partial();

// Schedule template schemas
export const insertScheduleTemplateSchema = createInsertSchema(scheduleTemplate).omit({
  id: true,
});

// Simple position tracking for sequential curriculum progression
export const bibleCurriculumPosition = pgTable("bible_curriculum_position", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentName: text("student_name").notNull().unique(),
  currentWeek: integer("current_week").notNull().default(1),
  currentDay: integer("current_day").notNull().default(1),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Bible curriculum schemas
export const insertBibleCurriculumSchema = createInsertSchema(bibleCurriculum).omit({
  id: true,
  completedAt: true,
});

export const insertBibleCurriculumPositionSchema = createInsertSchema(bibleCurriculumPosition).omit({
  id: true,
  lastUpdated: true,
});

// Progress session schemas
export const insertProgressSessionSchema = createInsertSchema(progressSessions).omit({
  id: true,
  userId: true,
  createdAt: true,
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type RegisterUser = z.infer<typeof registerUserSchema>;
export type LoginUser = z.infer<typeof loginUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type UpdateTask = z.infer<typeof updateTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export type InsertStudySession = z.infer<typeof insertStudySessionSchema>;
export type StudySession = typeof studySessions.$inferSelect;

export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;

// New advanced types
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type UpdateAssignment = z.infer<typeof updateAssignmentSchema>;
export type Assignment = typeof assignments.$inferSelect;

export type InsertScheduleTemplate = z.infer<typeof insertScheduleTemplateSchema>;
export type ScheduleTemplate = typeof scheduleTemplate.$inferSelect;

export type InsertBibleCurriculum = z.infer<typeof insertBibleCurriculumSchema>;
export type BibleCurriculum = typeof bibleCurriculum.$inferSelect;

export type InsertBibleCurriculumPosition = z.infer<typeof insertBibleCurriculumPositionSchema>;
export type BibleCurriculumPosition = typeof bibleCurriculumPosition.$inferSelect;

export type InsertProgressSession = z.infer<typeof insertProgressSessionSchema>;
export type ProgressSession = typeof progressSessions.$inferSelect;
