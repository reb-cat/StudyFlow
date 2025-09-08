import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, uuid, integer, date, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Note: Removed unused user/task tables that don't exist in database
// Current app uses family password authentication, not individual user accounts

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
    enum: ["pending", "completed", "needs_more_time", "stuck", "grading_delay"] 
  }).default("pending"),
  blockType: text("block_type").default("assignment"), // assignment, co-op, travel, prep, etc.
  isAssignmentBlock: boolean("is_assignment_block").default(true),
  isPortable: boolean("is_portable").default(true), // Can be done during study hall at co-op
  portabilityReason: text("portability_reason"), // Why it's portable/non-portable
  priority: text("priority", { enum: ["A", "B", "C"] }).default("B"), // A=Critical, B=Important, C=Flexible
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard"] }).default("medium"),
  timeSpent: integer("time_spent").default(0), // actual minutes spent
  notes: text("notes"),
  completedAt: timestamp("completed_at"), // When student marked it complete
  gradingDelayDetectedAt: timestamp("grading_delay_detected_at"), // When we detected grading delay
  creationSource: text("creation_source", { 
    enum: ["manual", "canvas_sync", "auto_split", "student_need_more_time"] 
  }).default("manual"), // Track assignment origin
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
  
  // Smart fallback for missing dates
  needsManualDueDate: boolean("needs_manual_due_date").default(false), // Flag for assignments missing Canvas dates
  suggestedDueDate: timestamp("suggested_due_date"), // AI-suggested due date from related assignments
  
  // Bidirectional Canvas sync fields - ENABLED FOR PRODUCTION
  deletedAt: timestamp("deleted_at"), // When assignment was removed from Canvas  
  canvasGradeStatus: text("canvas_grade_status"), // Canvas grading status for completion sync
  
  // Manual sub-assignment system - Using notes field for parent relationships
  // Format: "PARENT_ID:uuid|PARENT_CANVAS_ID:123|ORDER:1"
  
  // Canvas grading notification system - Executive function support
  // TEMPORARY: Commented out until database migration completes
  // canvasGradingDetected: boolean("canvas_grading_detected").default(false), // Canvas shows graded but StudyFlow still pending
  // canvasGradingReason: text("canvas_grading_reason"), // Why Canvas shows it as graded (for transparency)
  // canvasGradingDetectedAt: timestamp("canvas_grading_detected_at"), // When we detected the grading discrepancy
  
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
    enum: ["Bible", "Assignment", "Travel", "Co-op", "Study Hall", "Prep/Load", "Movement", "Lunch"]
  }).notNull(),
});

// ENHANCED: Daily schedule block status tracking for Overview Mode
export const dailyScheduleStatus = pgTable("daily_schedule_status", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentName: text("student_name").notNull(), // "Abigail" or "Khalil"
  date: date("date").notNull(), // "2025-08-29" format
  templateBlockId: uuid("template_block_id").notNull(), // References scheduleTemplate.id
  status: text("status", {
    enum: ["not-started", "in-progress", "complete", "stuck", "overtime"]
  }).notNull().default("not-started"),
  completedAt: timestamp("completed_at"), // When marked complete
  startedAt: timestamp("started_at"), // When started working
  flags: jsonb("flags").default(sql`'{}'::jsonb`), // { neededMoreTime: false, wasStuck: false }
  currentAssignmentId: uuid("current_assignment_id"), // Link to actual assignment being worked on
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  // Unique constraint: one status record per student/date/block
  index("daily_schedule_unique").on(table.studentName, table.date, table.templateBlockId)
]);

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
  studentName: text("student_name").notNull(), // Use student name instead of user ID
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

export const updateAssignmentSchema = insertAssignmentSchema.partial().extend({
  updatedAt: z.date().optional(), // Allow updatedAt field in updates
});

// Schedule template schemas
export const insertScheduleTemplateSchema = createInsertSchema(scheduleTemplate).omit({
  id: true,
});

// Daily schedule status schemas
export const insertDailyScheduleStatusSchema = createInsertSchema(dailyScheduleStatus).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateDailyScheduleStatusSchema = insertDailyScheduleStatusSchema.partial();

// Simple position tracking for sequential curriculum progression
export const bibleCurriculumPosition = pgTable("bible_curriculum_position", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentName: text("student_name").notNull().unique(),
  currentWeek: integer("current_week").notNull().default(1),
  currentDay: integer("current_day").notNull().default(1),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

// Student profiles for managing avatars and personal settings
export const studentProfiles = pgTable("student_profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentName: text("student_name").notNull().unique(), // "abigail", "khalil"
  displayName: text("display_name").notNull(), // "Abigail", "Khalil"
  profileImageUrl: text("profile_image_url"), // URL to profile image in object storage
  themeColor: text("theme_color").default("#844FC1"), // Student's theme color
  allowSaturdayScheduling: boolean("allow_saturday_scheduling").default(false), // Admin toggle for Saturday overflow
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


// Student status for real-time family dashboard
export const studentStatus = pgTable("student_status", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentName: text("student_name").notNull().unique(), // "abigail", "khalil"
  currentMode: text("current_mode", { 
    enum: ["overview", "guided"] 
  }).default("overview"),
  currentAssignmentId: uuid("current_assignment_id").references(() => assignments.id),
  currentAssignmentTitle: text("current_assignment_title"), // Cache for performance
  sessionStartTime: timestamp("session_start_time"),
  estimatedEndTime: timestamp("estimated_end_time"),
  // Real-time flags
  isStuck: boolean("is_stuck").default(false),
  stuckSince: timestamp("stuck_since"),
  needsHelp: boolean("needs_help").default(false),
  isOvertimeOnTask: boolean("is_overtime_on_task").default(false), // Calculated field
  // Daily stats
  completedToday: integer("completed_today").default(0),
  totalToday: integer("total_today").default(0),
  minutesWorkedToday: integer("minutes_worked_today").default(0),
  targetMinutesToday: integer("target_minutes_today").default(0),
  lastActivity: timestamp("last_activity").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Sessions table is managed by connect-pg-simple middleware - do not define in schema
// Format: sid (varchar), sess (json), expire (timestamp)

// Custom checklist items for co-op prep - allows students to manage their own specific items
export const checklistItems = pgTable("checklist_items", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  studentName: text("student_name").notNull(), // "Khalil", "Abigail"
  subject: text("subject").notNull(), // "health", "art", "english", etc.
  itemName: text("item_name").notNull(), // "Watercolor paints", "Health folder", etc.
  category: text("category", {
    enum: ["books", "materials", "general"]
  }).notNull(), // Classification for organization
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").default(0), // For custom ordering
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

// Student profile schemas
export const insertStudentProfileSchema = createInsertSchema(studentProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateStudentProfileSchema = insertStudentProfileSchema.partial();

// Session schemas
// Sessions schema removed - managed by connect-pg-simple

// Checklist item schemas
export const insertChecklistItemSchema = createInsertSchema(checklistItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateChecklistItemSchema = insertChecklistItemSchema.partial();


// Progress session schemas
export const insertProgressSessionSchema = createInsertSchema(progressSessions).omit({
  id: true,
  studentName: true,
  createdAt: true,
});

// REWARDBANK SYSTEM TABLES
// Gamification and rewards system for StudyFlow engagement

// Student reward profiles - track points, levels, streaks
export const rewardProfiles = pgTable("reward_profiles", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().unique(), // "khalil-user", "abigail-user"
  points: integer("points").default(0), // Current point balance
  lifetimePoints: integer("lifetime_points").default(0), // Total points ever earned (for levels)
  level: integer("level").default(1), // Current level based on lifetime points
  streakDays: integer("streak_days").default(0), // Current consecutive study days
  lastStreakDate: date("last_streak_date"), // Last date streak was updated
  lastClaimedDate: timestamp("lastclaimeddate"), // Last time student claimed any reward
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Student quests - rotating mini-goals for engagement
export const quests = pgTable("quests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(), // "khalil-user", "abigail-user"
  title: text("title").notNull(), // "Complete 2 tasks today"
  goalType: text("goaltype", {
    enum: ["Tasks", "Minutes", "Streak", "Sessions"]
  }).notNull(), // Type of goal to track
  target: integer("target_value").notNull(), // Goal target (e.g., 2 for "complete 2 tasks")
  progress: integer("current_progress").default(0), // Current progress toward goal
  rewardPoints: integer("reward_points").notNull(), // Points awarded when completed
  expiresAt: timestamp("expires_at").notNull(), // When quest expires
  isCompleted: boolean("is_completed").default(false), // Whether quest was completed
  completedAt: timestamp("completed_at"), // When quest was completed
  createdAt: timestamp("created_at").defaultNow(),
});

// Parent-defined rewards catalog
export const rewardCatalog = pgTable("reward_catalog", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: text("owner_id").notNull(), // Parent user ID who created the reward
  title: text("title").notNull(), // "30 min Game Time"
  costPoints: integer("cost_points").notNull(), // Point cost to redeem
  description: text("description"), // Optional detailed description
  notes: text("notes"), // Internal notes for parent
  isActive: boolean("is_active").default(true), // Whether students can see/redeem this
  timesRedeemed: integer("times_redeemed").default(0), // Usage tracking
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Redemption requests - student requests, parent approval flow
export const redemptionRequests = pgTable("redemption_requests", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(), // Student making the request
  catalogItemId: uuid("catalog_item_id").notNull().references(() => rewardCatalog.id),
  pointsSpent: integer("points_spent").notNull(), // Points deducted (stored for audit)
  status: text("status", {
    enum: ["Pending", "Approved", "Denied"]
  }).default("Pending"),
  requestedAt: timestamp("requested_at").defaultNow(),
  decidedAt: timestamp("decided_at"), // When parent approved/denied
  decidedBy: text("decided_by"), // Parent who made the decision
  parentNotes: text("parent_notes"), // Parent's reason for approval/denial
  createdAt: timestamp("created_at").defaultNow(),
});

// Point earning ledger - full audit trail of all point transactions
export const earnEvents = pgTable("earn_events", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(), // Student who earned the points
  type: text("type", {
    enum: ["Session", "Task", "Streak", "Quest", "Manual"]
  }).notNull(), // What action earned the points
  amount: integer("amount").notNull(), // Points earned (positive) or spent (negative)
  sourceId: uuid("source_id"), // ID of the source (assignment ID, session ID, quest ID, etc.)
  sourceDetails: text("source_details"), // Human-readable details about the source
  createdAt: timestamp("created_at").defaultNow(),
});

// Parent reward system settings
export const rewardSettings = pgTable("reward_settings", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().unique(), // Parent user ID
  dailyEarnCapPoints: integer("daily_earn_cap_points").default(100), // Max points per day
  weeklyEarnCapPoints: integer("weekly_earn_cap_points").default(400), // Max points per week
  redemptionCooldownMinutes: integer("redemption_cooldown_minutes").default(60), // Minutes between redemptions
  sessionMinimumMinutes: integer("session_minimum_minutes").default(15), // Min session length to earn points
  sessionPauseThreshold: integer("session_pause_threshold").default(50), // Max pause percentage allowed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Create insert schemas for RewardBank tables
export const insertRewardProfileSchema = createInsertSchema(rewardProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuestSchema = createInsertSchema(quests).omit({
  id: true,
  createdAt: true,
});

export const insertRewardCatalogSchema = createInsertSchema(rewardCatalog).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRedemptionRequestSchema = createInsertSchema(redemptionRequests).omit({
  id: true,
  createdAt: true,
});

export const insertEarnEventSchema = createInsertSchema(earnEvents).omit({
  id: true,
  createdAt: true,
});

export const insertRewardSettingsSchema = createInsertSchema(rewardSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Export types (removed unused user/task/session types)

// New advanced types
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type UpdateAssignment = z.infer<typeof updateAssignmentSchema>;
export type Assignment = typeof assignments.$inferSelect;

export type InsertScheduleTemplate = z.infer<typeof insertScheduleTemplateSchema>;
export type ScheduleTemplate = typeof scheduleTemplate.$inferSelect;

export type DailyScheduleStatus = typeof dailyScheduleStatus.$inferSelect;
export type InsertDailyScheduleStatus = typeof dailyScheduleStatus.$inferInsert;

export type InsertBibleCurriculum = z.infer<typeof insertBibleCurriculumSchema>;
export type BibleCurriculum = typeof bibleCurriculum.$inferSelect;

export type InsertBibleCurriculumPosition = z.infer<typeof insertBibleCurriculumPositionSchema>;
export type BibleCurriculumPosition = typeof bibleCurriculumPosition.$inferSelect;

export type InsertProgressSession = z.infer<typeof insertProgressSessionSchema>;
export type ProgressSession = typeof progressSessions.$inferSelect;

export type InsertStudentProfile = z.infer<typeof insertStudentProfileSchema>;
export type UpdateStudentProfile = z.infer<typeof updateStudentProfileSchema>;
export type StudentProfile = typeof studentProfiles.$inferSelect;

export type StudentStatus = typeof studentStatus.$inferSelect;
export type InsertStudentStatus = typeof studentStatus.$inferInsert;

// Session types removed - managed by connect-pg-simple

export type ChecklistItem = typeof checklistItems.$inferSelect;
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;
export type UpdateChecklistItem = z.infer<typeof updateChecklistItemSchema>;


// RewardBank types
export type RewardProfile = typeof rewardProfiles.$inferSelect;
export type InsertRewardProfile = z.infer<typeof insertRewardProfileSchema>;

export type Quest = typeof quests.$inferSelect;
export type InsertQuest = z.infer<typeof insertQuestSchema>;

export type RewardCatalogItem = typeof rewardCatalog.$inferSelect;
export type InsertRewardCatalogItem = z.infer<typeof insertRewardCatalogSchema>;

export type RedemptionRequest = typeof redemptionRequests.$inferSelect;
export type InsertRedemptionRequest = z.infer<typeof insertRedemptionRequestSchema>;

export type EarnEvent = typeof earnEvents.$inferSelect;
export type InsertEarnEvent = z.infer<typeof insertEarnEventSchema>;

export type RewardSettings = typeof rewardSettings.$inferSelect;
export type InsertRewardSettings = z.infer<typeof insertRewardSettingsSchema>;
