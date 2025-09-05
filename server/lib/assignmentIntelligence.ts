/**
 * Intelligent Assignment Processing
 * Handles smart text parsing and categorization of assignments
 */

// SEQUENCE SORTING UTILITIES - Export for use across the system
// Extract leading/embedded unit number for sequencing (e.g., "Unit 2", "U2", "Ch. 3")
export function extractUnitNumber(title?: string): number | null {
  if (!title) return null;
  const match = title.match(/(?:unit|u|chapter|ch\.?|module|mod\.?|lesson|section)\s*(\d+)/i) || title.match(/\b(\d+)\b/);
  return match ? parseInt(match[1], 10) : null;
}

// Extract all numbers from assignment titles for comprehensive sequencing
export function extractSequenceNumbers(title: string): number[] {
  // Match patterns like "Unit 2", "Module 3", "Chapter 1", "Page 5", etc.
  const patterns = [
    /(?:unit|module|chapter|lesson|section|part|page|step|week|day)\s*(\d+)/gi,
    /(\d+)\s*(?:unit|module|chapter|lesson|section|part|page|step|week|day)/gi,
    /(\d+)/g // Fall back to any numbers
  ];
  
  for (const pattern of patterns) {
    const matches = [...title.matchAll(pattern)];
    if (matches.length > 0) {
      return matches.map(match => parseInt(match[1], 10)).filter(n => !isNaN(n));
    }
  }
  
  return [];
}

// Smart title comparison that handles numerical sequences - PRESERVES Unit 2 → Unit 3 order
export function compareAssignmentTitles(titleA: string, titleB: string): number {
  const numbersA = extractSequenceNumbers(titleA);
  const numbersB = extractSequenceNumbers(titleB);
  
  // If both have numbers, compare numerically (Unit 2 before Unit 3)
  if (numbersA.length > 0 && numbersB.length > 0) {
    // Compare each number in sequence
    const maxLength = Math.max(numbersA.length, numbersB.length);
    for (let i = 0; i < maxLength; i++) {
      const numA = numbersA[i] || 0;
      const numB = numbersB[i] || 0;
      if (numA !== numB) {
        return numA - numB;
      }
    }
  }
  
  // Fall back to alphabetical comparison
  return titleA.localeCompare(titleB);
}

// CAPACITY TRACKING - Daily and per-course limits for EF support
export interface StudentCapacityProfile {
  studentName: string;
  maxFocusMinutesPerDay: number;      // Total daily capacity (e.g., 150 min = 2.5 hours)
  maxPerCoursePerDay: number;         // Per-subject daily limit (e.g., 75 min = 1.25 hours)
  preferredWorkloadDistribution: 'even' | 'front-loaded' | 'light-end'; // How to distribute across week
}

export interface DailyCapacityUsage {
  date: string; // YYYY-MM-DD
  studentName: string;
  totalMinutesUsed: number;
  courseMinutes: Record<string, number>; // course -> minutes used
  assignmentCount: number;
  canAddMore: boolean;
}

// Default student capacity profiles based on user guidance
export function getStudentCapacityProfile(studentName: string): StudentCapacityProfile {
  const student = studentName.toLowerCase();
  
  if (student === 'khalil') {
    return {
      studentName: 'khalil',
      maxFocusMinutesPerDay: 150,        // 2.5 hours max with dyslexia considerations
      maxPerCoursePerDay: 75,            // 1.25 hours per subject max
      preferredWorkloadDistribution: 'even'
    };
  } else if (student === 'abigail') {
    return {
      studentName: 'abigail', 
      maxFocusMinutesPerDay: 150,        // 2.5 hours max with EF considerations
      maxPerCoursePerDay: 75,            // 1.25 hours per subject max
      preferredWorkloadDistribution: 'even'
    };
  }
  
  // Default for other students
  return {
    studentName: studentName,
    maxFocusMinutesPerDay: 180,         // 3 hours default
    maxPerCoursePerDay: 90,             // 1.5 hours per subject
    preferredWorkloadDistribution: 'even'
  };
}

// Calculate current capacity usage for a day
export async function calculateDailyCapacityUsage(
  studentName: string, 
  date: string, 
  storage: any
): Promise<DailyCapacityUsage> {
  // Get all scheduled assignments for this student on this date
  const assignments = await storage.getAssignmentsByStudentAndDate(studentName, date);
  
  let totalMinutesUsed = 0;
  const courseMinutes: Record<string, number> = {};
  let assignmentCount = 0;
  
  for (const assignment of assignments) {
    if (assignment.completionStatus !== 'completed') {
      const minutes = assignment.actualEstimatedMinutes || 30;
      totalMinutesUsed += minutes;
      assignmentCount++;
      
      const course = assignment.courseName || assignment.subject || 'Other';
      courseMinutes[course] = (courseMinutes[course] || 0) + minutes;
    }
  }
  
  const profile = getStudentCapacityProfile(studentName);
  const canAddMore = totalMinutesUsed < profile.maxFocusMinutesPerDay;
  
  return {
    date,
    studentName,
    totalMinutesUsed,
    courseMinutes,
    assignmentCount,
    canAddMore
  };
}

// Check if a new assignment can be added to a day without exceeding capacity
export function canAddAssignmentToDay(
  currentUsage: DailyCapacityUsage,
  newAssignmentMinutes: number,
  newAssignmentCourse: string
): { canAdd: boolean; reason: string } {
  const profile = getStudentCapacityProfile(currentUsage.studentName);
  
  // Check total daily capacity
  if (currentUsage.totalMinutesUsed + newAssignmentMinutes > profile.maxFocusMinutesPerDay) {
    const remaining = profile.maxFocusMinutesPerDay - currentUsage.totalMinutesUsed;
    return {
      canAdd: false,
      reason: `Daily capacity exceeded. Only ${remaining} minutes remaining (${newAssignmentMinutes} needed)`
    };
  }
  
  // Check per-course capacity
  const currentCourseMinutes = currentUsage.courseMinutes[newAssignmentCourse] || 0;
  if (currentCourseMinutes + newAssignmentMinutes > profile.maxPerCoursePerDay) {
    const remaining = profile.maxPerCoursePerDay - currentCourseMinutes;
    return {
      canAdd: false,
      reason: `Course capacity exceeded for ${newAssignmentCourse}. Only ${remaining} minutes remaining`
    };
  }
  
  return {
    canAdd: true,
    reason: 'Within capacity limits'
  };
}

// HYBRID TEMPLATE-AWARE SCHEDULER - Builds ON the sacred schedule template
export interface ScheduleBlockSlot {
  studentName: string;
  weekday: string;
  blockNumber: number;
  blockType: string;
  startTime: string;
  endTime: string;
  availableMinutes: number;  // Total capacity of this block
  usedMinutes: number;       // Currently assigned minutes
  remainingMinutes: number;  // Available for new assignments
  assignments: any[];        // Currently assigned assignments
}

export interface HybridSchedulingRequest {
  studentName: string;
  targetWeek: string;       // YYYY-MM-DD format for Monday of week
  assignments: any[];       // Unscheduled assignments to place
  preserveExisting: boolean; // Keep existing scheduled assignments
}

export interface HybridSchedulingResult {
  success: boolean;
  scheduledAssignments: any[];
  unscheduledAssignments: any[];
  weeklySchedule: Record<string, ScheduleBlockSlot[]>; // weekday -> slots
  warnings: string[];
}

// Get available Assignment and Study Hall blocks from schedule template
export async function getAvailableScheduleSlots(
  studentName: string,
  weekday: string,
  storage: any
): Promise<ScheduleBlockSlot[]> {
  // Get schedule template blocks for this student/day that can accept assignments
  const templateBlocks = await storage.getScheduleTemplate(studentName, weekday);
  
  console.log(`🔍 TEMPLATE DEBUG: Found ${templateBlocks.length} template blocks for ${studentName} on ${weekday}:`);
  templateBlocks.forEach((block: any, index: number) => {
    console.log(`   ${index + 1}. ${block.blockType} Block ${block.blockNumber} (${block.startTime}-${block.endTime})`);
  });
  
  const availableSlots: ScheduleBlockSlot[] = [];
  
  for (const block of templateBlocks) {
    // Only Assignment and Study Hall blocks can receive assignments
    if (block.blockType === 'Assignment' || block.blockType === 'Study Hall') {
      // Calculate block duration in minutes
      const startTime = new Date(`2000-01-01T${block.startTime}`);
      const endTime = new Date(`2000-01-01T${block.endTime}`);
      const durationMs = endTime.getTime() - startTime.getTime();
      const availableMinutes = Math.floor(durationMs / (1000 * 60));
      
      // Get currently assigned assignments for this block
      // For blocks with null blockNumber, no assignments can be scheduled using current system
      const assignedAssignments = block.blockNumber !== null 
        ? await storage.getAssignmentsByBlock(studentName, weekday, block.blockNumber)
        : []; // Empty - null blockNumber blocks have full capacity available
      
      // Calculate used minutes
      const usedMinutes = assignedAssignments.reduce((total: number, assignment: any) => {
        return total + (assignment.actualEstimatedMinutes || 30);
      }, 0);
      
      // Debug what assignments are currently in this block
      if (assignedAssignments.length > 0) {
        console.log(`   🚨 Block ${block.blockNumber} (${block.blockType}) already has ${assignedAssignments.length} assignments:`);
        assignedAssignments.forEach((a: any) => {
          console.log(`      - ${a.title} (due: ${a.dueDate}, ${a.actualEstimatedMinutes || 30}min)`);
        });
      }
      
      availableSlots.push({
        studentName,
        weekday,
        blockNumber: block.blockNumber || -999, // Use special marker for null blocks
        blockType: block.blockType,
        startTime: block.startTime,
        endTime: block.endTime,
        availableMinutes,
        usedMinutes,
        remainingMinutes: Math.max(0, availableMinutes - usedMinutes),
        assignments: assignedAssignments
      });
    }
  }
  
  console.log(`🔍 SLOT DEBUG: Found ${availableSlots.length} available slots for ${studentName} on ${weekday}:`);
  availableSlots.forEach((slot: ScheduleBlockSlot, index: number) => {
    console.log(`   ${index + 1}. ${slot.blockType} Block ${slot.blockNumber} (${slot.startTime}-${slot.endTime}): ${slot.remainingMinutes}/${slot.availableMinutes} minutes available`);
  });
  
  return availableSlots;
}

// Hybrid scheduler that respects template structure + adds intelligent assignment placement
export async function hybridScheduleAssignments(
  request: HybridSchedulingRequest,
  storage: any
): Promise<HybridSchedulingResult> {
  console.log(`🚀 HYBRID SCHEDULER: Starting for ${request.studentName}, target week: ${request.targetWeek}`);
  console.log(`📝 HYBRID SCHEDULER: ${request.assignments.length} assignments to schedule`);
  
  const result: HybridSchedulingResult = {
    success: false,
    scheduledAssignments: [],
    unscheduledAssignments: [...request.assignments],
    weeklySchedule: {},
    warnings: []
  };
  
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  
  try {
    // Step 1: Get all available slots for the week
    for (const weekday of weekdays) {
      const slots = await getAvailableScheduleSlots(request.studentName, weekday, storage);
      result.weeklySchedule[weekday] = slots;
    }
    
    // Step 2: Sort assignments by priority (overdue first, then sequence, then due date)
    const sortedAssignments = [...request.assignments].sort((a, b) => {
      // Priority A (overdue) first
      if (a.priority === 'A' && b.priority !== 'A') return -1;
      if (b.priority === 'A' && a.priority !== 'A') return 1;
      
      // Within same priority, use sequence sorting to preserve Unit 2 → Unit 3
      if (a.priority === b.priority) {
        return compareAssignmentTitles(a.title, b.title);
      }
      
      // Fall back to due date
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      
      return 0;
    });
    
    // Step 3: Place assignments strategically
    for (const assignment of sortedAssignments) {
      const placed = await placeAssignmentInOptimalSlot(
        assignment, 
        result.weeklySchedule, 
        request.studentName,
        storage
      );
      
      if (placed.success) {
        result.scheduledAssignments.push({
          ...assignment,
          scheduledDate: placed.scheduledDate,
          scheduledBlock: placed.scheduledBlock,
          blockStart: placed.blockStart,
          blockEnd: placed.blockEnd
        });
        
        // Remove from unscheduled list
        const index = result.unscheduledAssignments.findIndex(a => a.id === assignment.id);
        if (index >= 0) {
          result.unscheduledAssignments.splice(index, 1);
        }
      } else {
        result.warnings.push(`Could not schedule "${assignment.title}": ${placed.reason}`);
      }
    }
    
    result.success = result.scheduledAssignments.length > 0;
    
  } catch (error) {
    result.warnings.push(`Scheduling error: ${error.message}`);
  }
  
  return result;
}

// Find optimal slot for assignment considering capacity, sequence, and quick wins
async function placeAssignmentInOptimalSlot(
  assignment: any,
  weeklySchedule: Record<string, ScheduleBlockSlot[]>,
  studentName: string,
  storage: any
): Promise<{ success: boolean; scheduledDate?: string; scheduledBlock?: number; blockStart?: string; blockEnd?: string; reason: string }> {
  
  const assignmentMinutes = assignment.actualEstimatedMinutes || 30;
  const course = assignment.courseName || assignment.subject || 'Other';
  
  // Generate candidate slots (earliest days first, but consider quick wins)
  const candidates: Array<{
    weekday: string;
    slot: ScheduleBlockSlot;
    date: string;
    priority: number;
  }> = [];
  
  const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  
  for (const weekday of weekdays) {
    const slots = weeklySchedule[weekday] || [];
    const date = getDateForWeekday(weekday); // Helper function needed
    
    for (const slot of slots) {
      if (slot.remainingMinutes >= assignmentMinutes) {
        // Check capacity constraints
        const dailyUsage = await calculateDailyCapacityUsage(studentName, date, storage);
        const capacityCheck = canAddAssignmentToDay(dailyUsage, assignmentMinutes, course);
        
        if (capacityCheck.canAdd) {
          let priority = 0;
          
          // Prefer earlier in week
          priority += weekdays.indexOf(weekday) * 10;
          
          // Quick wins (< 20 min) can be placed strategically between longer tasks
          if (assignmentMinutes < 20) {
            priority -= 5; // Boost quick wins
          }
          
          // Prefer Study Hall over Assignment blocks for flexibility
          if (slot.blockType === 'Study Hall') {
            priority -= 2;
          }
          
          candidates.push({
            weekday,
            slot,
            date,
            priority
          });
        }
      }
    }
  }
  
  // Sort by priority (lower is better)
  candidates.sort((a, b) => a.priority - b.priority);
  
  if (candidates.length === 0) {
    return {
      success: false,
      reason: `No available slots with sufficient capacity (${assignmentMinutes} minutes needed)`
    };
  }
  
  // Use the best candidate
  const best = candidates[0];
  
  // Update the slot usage
  best.slot.usedMinutes += assignmentMinutes;
  best.slot.remainingMinutes -= assignmentMinutes;
  best.slot.assignments.push(assignment);
  
  return {
    success: true,
    scheduledDate: best.date,
    scheduledBlock: best.slot.blockNumber === -999 ? null : best.slot.blockNumber, // Convert marker back to null
    blockStart: best.slot.startTime,
    blockEnd: best.slot.endTime,
    reason: 'Successfully scheduled'
  };
}

// Helper function to convert weekday to actual date (implementation needed)
function getDateForWeekday(weekday: string): string {
  // This should calculate actual date based on current week
  // For now, return a placeholder - this needs to be implemented based on target week
  const today = new Date();
  const currentWeekday = today.getDay(); // 0 = Sunday
  const weekdayMap = {
    'Monday': 1,
    'Tuesday': 2, 
    'Wednesday': 3,
    'Thursday': 4,
    'Friday': 5
  };
  
  const targetWeekday = weekdayMap[weekday];
  const daysDiff = targetWeekday - currentWeekday;
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysDiff);
  
  return targetDate.toISOString().split('T')[0]; // YYYY-MM-DD
}

// QUICK WIN STRATEGIC PLACEMENT - Place short tasks between longer assignments
export interface QuickWinStrategy {
  assignment: any;
  targetSlot: ScheduleBlockSlot;
  placementReason: 'break_between_long' | 'fill_gap' | 'momentum_builder' | 'optimal_fit';
  confidenceScore: number; // 0-100, higher = better placement
}

// Identify quick win opportunities (assignments under 20 minutes)
export function identifyQuickWins(assignments: any[]): { quickWins: any[]; longerTasks: any[] } {
  const quickWins: any[] = [];
  const longerTasks: any[] = [];
  
  for (const assignment of assignments) {
    const minutes = assignment.actualEstimatedMinutes || 30;
    if (minutes <= 20) {
      quickWins.push(assignment);
    } else {
      longerTasks.push(assignment);
    }
  }
  
  return { quickWins, longerTasks };
}

// Strategic placement of quick wins between longer assignments
export function generateQuickWinStrategies(
  quickWins: any[],
  weeklySchedule: Record<string, ScheduleBlockSlot[]>,
  studentName: string
): QuickWinStrategy[] {
  
  const strategies: QuickWinStrategy[] = [];
  
  for (const quickWin of quickWins) {
    const quickWinMinutes = quickWin.actualEstimatedMinutes || 30;
    
    // Look for optimal placement opportunities
    for (const [weekday, slots] of Object.entries(weeklySchedule)) {
      for (const slot of slots) {
        
        if (slot.remainingMinutes >= quickWinMinutes) {
          let confidenceScore = 50; // Base score
          let placementReason: QuickWinStrategy['placementReason'] = 'optimal_fit';
          
          // Strategy 1: Break between long assignments
          const longAssignments = slot.assignments.filter(a => (a.actualEstimatedMinutes || 30) > 45);
          if (longAssignments.length >= 1) {
            confidenceScore += 25;
            placementReason = 'break_between_long';
          }
          
          // Strategy 2: Fill small gaps perfectly  
          if (slot.remainingMinutes >= quickWinMinutes && slot.remainingMinutes <= quickWinMinutes + 10) {
            confidenceScore += 30;
            placementReason = 'fill_gap';
          }
          
          // Strategy 3: Momentum builder at start of day
          if (slot.assignments.length === 0 && quickWinMinutes <= 15) {
            confidenceScore += 20;
            placementReason = 'momentum_builder';
          }
          
          // Strategy 4: Account for course diversity
          const slotCourses = new Set(slot.assignments.map(a => a.courseName || a.subject));
          const quickWinCourse = quickWin.courseName || quickWin.subject;
          if (!slotCourses.has(quickWinCourse)) {
            confidenceScore += 15; // Bonus for course diversity
          }
          
          // Earlier in week gets preference for non-urgent tasks
          const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
          const dayIndex = weekdays.indexOf(weekday);
          if (dayIndex <= 2) { // Monday-Wednesday
            confidenceScore += 10;
          }
          
          strategies.push({
            assignment: quickWin,
            targetSlot: slot,
            placementReason,
            confidenceScore
          });
        }
      }
    }
  }
  
  // Sort by confidence score (highest first)
  return strategies.sort((a, b) => b.confidenceScore - a.confidenceScore);
}

// Enhanced hybrid scheduler with quick win integration
export async function hybridScheduleAssignmentsWithQuickWins(
  request: HybridSchedulingRequest,
  storage: any
): Promise<HybridSchedulingResult> {
  console.log(`🎯 QUICK WINS SCHEDULER: Starting for ${request.studentName}, target: ${request.targetWeek}`);
  console.log(`📚 QUICK WINS SCHEDULER: ${request.assignments.length} assignments to schedule`);
  
  // First, separate quick wins from longer tasks
  const { quickWins, longerTasks } = identifyQuickWins(request.assignments);
  console.log(`⚡ QUICK WINS: ${quickWins.length} quick wins, ${longerTasks.length} longer tasks`);
  
  // Schedule longer tasks first to establish the foundation
  const longerTasksRequest = {
    ...request,
    assignments: longerTasks
  };
  
  const initialResult = await hybridScheduleAssignments(longerTasksRequest, storage);
  
  if (!initialResult.success && longerTasks.length > 0) {
    return initialResult; // If we can't place longer tasks, no point in quick wins
  }
  
  // Now strategically place quick wins
  const quickWinStrategies = generateQuickWinStrategies(
    quickWins, 
    initialResult.weeklySchedule, 
    request.studentName
  );
  
  // Apply quick win strategies in order of confidence
  for (const strategy of quickWinStrategies) {
    const assignment = strategy.assignment;
    const assignmentMinutes = assignment.actualEstimatedMinutes || 30;
    const course = assignment.courseName || assignment.subject || 'Other';
    
    // Double-check capacity (might have changed)
    const date = getDateForWeekday(strategy.targetSlot.weekday);
    const dailyUsage = await calculateDailyCapacityUsage(request.studentName, date, storage);
    const capacityCheck = canAddAssignmentToDay(dailyUsage, assignmentMinutes, course);
    
    if (capacityCheck.canAdd && strategy.targetSlot.remainingMinutes >= assignmentMinutes) {
      // Place the quick win
      initialResult.scheduledAssignments.push({
        ...assignment,
        scheduledDate: date,
        scheduledBlock: strategy.targetSlot.blockNumber,
        blockStart: strategy.targetSlot.startTime,
        blockEnd: strategy.targetSlot.endTime,
        quickWinStrategy: strategy.placementReason
      });
      
      // Update slot capacity
      strategy.targetSlot.usedMinutes += assignmentMinutes;
      strategy.targetSlot.remainingMinutes -= assignmentMinutes;
      strategy.targetSlot.assignments.push(assignment);
      
      // Remove from unscheduled
      const index = initialResult.unscheduledAssignments.findIndex(a => a.id === assignment.id);
      if (index >= 0) {
        initialResult.unscheduledAssignments.splice(index, 1);
      }
    } else {
      initialResult.warnings.push(
        `Quick win "${assignment.title}" could not be placed: ${capacityCheck.reason || 'insufficient slot capacity'}`
      );
    }
  }
  
  return initialResult;
}

// Assignment portability detection for co-op study hall workflow
export interface PortabilityAnalysis {
  isPortable: boolean;
  reason: string;
  confidence: number; // 0-1 scale
}

export interface AssignmentIntelligence {
  extractedDueDate: Date | null;
  isInClassActivity: boolean;
  isSchedulable: boolean;
  blockType: 'assignment' | 'co-op' | 'travel' | 'prep';
  category: 'homework' | 'in-class' | 'makeup' | 'other';
  
  // Enhanced metadata for Canvas integration
  isRecurring: boolean;
  canvasCategory: 'assignments' | 'discussions' | 'quizzes' | 'syllabus' | 'other';
  isFromPreviousYear: boolean;
  isTemplateData: boolean;
  suggestedScheduleDate: Date | null;
  availabilityWindow: {
    availableFrom: Date | null;
    availableUntil: Date | null;
  };
  submissionContext: {
    submissionTypes: string[];
    pointsValue: number | null;
    isGraded: boolean;
    allowsLateSubs: boolean;
  };
  confidence: number;
  priority: 'A' | 'B' | 'C';
}

/**
 * COMPREHENSIVE due date extraction from assignment titles
 * Handles ALL patterns found in dataset analysis
 */
export function extractDueDateFromTitle(title: string): Date | null {
  // Comprehensive patterns ordered by specificity
  const patterns = [
    // === EXPLICIT DUE PATTERNS ===
    /due\s*:?\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,           // "Due 9/1", "Due: 9/1"
    /due\s*:?\s*(\d{1,2}-\d{1,2}(?:-\d{2,4})?)/i,            // "Due 9-1", "Due: 9-1"
    /homework\s+due\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,     // "Homework Due 9/1"
    /assignment\s+due\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,   // "Assignment Due 9/1"
    /project\s+due\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,      // "Project Due 9/1"
    /quiz\s+due\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,         // "Quiz Due 9/1"
    /test\s+due\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,         // "Test Due 9/1"
    
    // === EMBEDDED DATE PATTERNS (THE MISSING ONES!) ===
    /(?:test|quiz|exam|homework|assignment|project)\s+(?:on|for|by)\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i, // "test on 9/11" !!!
    /on\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,                 // "on 9/11"
    /by\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,                 // "by 9/11" 
    /for\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,                // "for 9/11"
    
    // === CLASS-SPECIFIC PATTERNS ===
    /class\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,              // "Class 10/6", "In Class 10/6"
    /in\s+class\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,         // "In Class 10/6"
    
    // === REVERSED DATE PATTERNS ===
    /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*due/i,                // "9/1 Due"
    /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*homework/i,           // "9/1 Homework"
    /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*assignment/i,         // "9/1 Assignment"
    
    // === MONTH NAME PATTERNS ===
    /due\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,?\s*(\d{4}))?/i,
    /on\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:,?\s*(\d{4}))?/i,
    
    // === ACADEMIC PATTERNS ===
    /week\s+of\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,          // "Week of 9/11"
    
    // === ENHANCED DATE FORMAT PATTERNS ===
    /due\s+(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/i,            // "due 1/15", "due 01/15"
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:,?\s*(\d{4}))?/i, // "Jan 15", "Jan 15, 2025"
    /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:,?\s*(\d{4}))?/i, // "15 Jan", "15 Jan 2025"
    
    // === STANDALONE DATE PATTERNS (FALLBACK) ===
    /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/,                        // "9/11/2025" anywhere in title
    /\b(\d{1,2}\/\d{1,2})\b/,                                 // "9/11" anywhere in title (fallback)
  ];

  for (let index = 0; index < patterns.length; index++) {
    const pattern = patterns[index];
    const match = title.match(pattern);
    if (match) {
      let dateStr: string;
      
      // Handle month name patterns specially
      if (pattern.source.includes('january|february')) {
        const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
        const monthIndex = monthNames.indexOf(match[1].toLowerCase()) + 1;
        const day = match[2];
        const year = match[3] || new Date().getFullYear();
        dateStr = `${monthIndex}/${day}/${year}`;
      } else {
        dateStr = match[1];
      }
      
      const parsedDate = parseDateString(dateStr);
      if (parsedDate) {
        console.log(`📅 COMPREHENSIVE: Extracted due date from "${title}" using pattern ${index + 1}: ${parsedDate.toDateString()}`);
        return parsedDate;
      }
    }
  }

  return null;
}

/**
 * Enhanced date parsing with academic calendar context and intelligent year inference
 */
function parseDateString(dateStr: string, courseContext?: {
  academicYear?: string;
  courseStartDate?: string;
  courseEndDate?: string;
}): Date | null {
  try {
    // Handle different separators (/, -)
    const normalized = dateStr.replace(/-/g, '/');
    const parts = normalized.split('/');
    
    if (parts.length < 2) return null;
    
    const month = parseInt(parts[0], 10);
    const day = parseInt(parts[1], 10);
    let year = parts.length > 2 ? parseInt(parts[2], 10) : new Date().getFullYear();
    
    // Handle 2-digit years
    if (year < 100) {
      year += year < 50 ? 2000 : 1900;
    }
    
    // Validate month and day
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    
    const date = new Date(year, month - 1, day);
    
    // ENHANCED ACADEMIC YEAR INFERENCE
    if (parts.length === 2) {
      const currentDate = new Date();
      const currentSchoolYearStart = new Date('2025-08-01');
      const currentSchoolYearEnd = new Date('2026-07-31');
      
      // If we have course context, use it for better inference
      if (courseContext?.courseStartDate && courseContext?.courseEndDate) {
        const courseStart = new Date(courseContext.courseStartDate);
        const courseEnd = new Date(courseContext.courseEndDate);
        
        // Try the course year first
        const courseYearDate = new Date(courseStart.getFullYear(), month - 1, day);
        if (courseYearDate >= courseStart && courseYearDate <= courseEnd) {
          return courseYearDate;
        }
      }
      
      // If date is in current school year, use current school year
      if (date >= currentSchoolYearStart && date <= currentSchoolYearEnd) {
        return date;
      }
      
      // If date is in the past and no year specified, try next school year
      if (date < currentDate) {
        const nextYearDate = new Date(year + 1, month - 1, day);
        if (nextYearDate <= currentSchoolYearEnd) {
          return nextYearDate;
        }
      }
    }
    
    return date;
  } catch (error) {
    console.warn(`Failed to parse date string: ${dateStr}`, error);
    return null;
  }
}

/**
 * Determine if assignment is an in-class activity
 */
export function isInClassActivity(title: string): boolean {
  const inClassPatterns = [
    /^in\s+class/i,                    // "In Class 10/16"
    /^class\s+(\d{1,2}\/\d{1,2})/i,   // "Class 10/16"
    /in-class/i,                       // "In-Class Activity"
    /during\s+class/i,                 // "During Class"
    /class\s+activity/i,               // "Class Activity"
    /class\s+work/i,                   // "Class Work"
  ];

  return inClassPatterns.some(pattern => pattern.test(title));
}

/**
 * Extract date from in-class assignment titles like "In Class 10/16"
 */
export function extractClassDate(title: string): Date | null {
  const classDatePatterns = [
    /in\s+class\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
    /class\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,
  ];

  for (const pattern of classDatePatterns) {
    const match = title.match(pattern);
    if (match) {
      return parseDateString(match[1]);
    }
  }

  return null;
}

/**
 * Detect if assignment is recurring (like attendance, participation)
 */
export function isRecurringAssignment(title: string, description?: string): boolean {
  const text = `${title} ${description || ''}`.toLowerCase();
  
  const recurringPatterns = [
    'roll call',
    'attendance',
    'participation',
    'daily',
    'weekly',
    'monthly',
    'ongoing',
    'semester',
    'year-long',
    'continuous'
  ];
  
  return recurringPatterns.some(pattern => text.includes(pattern));
}

/**
 * Detect if assignment data appears to be from previous academic year or template
 */
export function isFromPreviousYearOrTemplate(assignmentDate: Date | null, courseStartDate?: string): boolean {
  if (!assignmentDate) return false;
  
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const assignmentYear = assignmentDate.getFullYear();
  
  // More than 1 year old = likely template data
  if (assignmentYear < currentYear - 1) return true;
  
  // Assignment from previous year but course started this year = template data
  if (courseStartDate) {
    const courseStart = new Date(courseStartDate);
    if (assignmentYear < courseStart.getFullYear()) return true;
  }
  
  // Assignment due before June 15, 2025 (our filter date)
  const filterDate = new Date('2025-06-15');
  if (assignmentDate < filterDate) return true;
  
  return false;
}

/**
 * Enhanced comprehensive analysis of assignment with Canvas metadata
 */
export function analyzeAssignmentWithCanvas(
  title: string, 
  description?: string,
  canvasData?: {
    assignment_group?: { name: string };
    submission_types?: string[];
    points_possible?: number;
    unlock_at?: string;
    lock_at?: string;
    is_recurring?: boolean;
    academic_year?: string;
    course_start_date?: string;
    course_end_date?: string;
    inferred_start_date?: string;
    inferred_end_date?: string;
    module_data?: any;
  }
): AssignmentIntelligence {
  const isInClass = isInClassActivity(title);
  let extractedDueDate = extractDueDateFromTitle(title) || (isInClass ? extractClassDate(title) : null);
  
  // COMPREHENSIVE MODULE TIMING EXTRACTION
  // Priority 1: Use module timing from inferred_start_date (existing successful pattern)
  if (!extractedDueDate && canvasData?.inferred_start_date) {
    extractedDueDate = new Date(canvasData.inferred_start_date);
    console.log(`📅 Using module timing for "${title}": ${extractedDueDate.toDateString()}`);
  }
  
  // Priority 2: Extract timing from lock_at if available
  if (!extractedDueDate && canvasData?.lock_at) {
    extractedDueDate = new Date(canvasData.lock_at);
    console.log(`📅 Using assignment lock timing for "${title}": ${extractedDueDate.toDateString()}`);
  }
  
  // Priority 3: For multi-week assignments, use module completion date if available
  if (!extractedDueDate && canvasData?.module_data?.completed_at) {
    extractedDueDate = new Date(canvasData.module_data.completed_at);
    console.log(`📅 Using module completion timing for "${title}": ${extractedDueDate.toDateString()}`);
  }
  
  // Priority 4: Extract from Canvas assignment unlock_at if available
  if (!extractedDueDate && canvasData?.unlock_at) {
    extractedDueDate = new Date(canvasData.unlock_at);
    console.log(`📅 Using Canvas assignment unlock timing for "${title}": ${extractedDueDate.toDateString()}`);
  }
  
  // Priority 5: Extract from Canvas assignment lock_at as availability window end
  if (!extractedDueDate && canvasData?.lock_at) {
    extractedDueDate = new Date(canvasData.lock_at);
    console.log(`📅 Using Canvas assignment lock timing for "${title}": ${extractedDueDate.toDateString()}`);
  }
  
  // FALLBACK: If no due date found but we have availability window, use availability start as due date
  // This handles cases like "End of Year Project" with module unlock dates
  if (!extractedDueDate) {
    const availableFromDate = canvasData?.unlock_at || 
                              canvasData?.inferred_start_date ||
                              canvasData?.module_data?.unlock_at;
    
    if (availableFromDate) {
      extractedDueDate = new Date(availableFromDate);
      console.log(`📅 Using availability window as due date for "${title}": ${extractedDueDate.toDateString()}`);
    }
  }
  
  // Determine category
  let category: 'homework' | 'in-class' | 'makeup' | 'other' = 'other';
  if (isInClass) {
    category = 'in-class';
  } else if (title.toLowerCase().includes('homework') || title.toLowerCase().includes('assignment')) {
    category = 'homework';
  } else if (title.toLowerCase().includes('makeup') || title.toLowerCase().includes('make-up')) {
    category = 'makeup';
  }

  // Determine schedulability and block type
  // In-class activities remain as regular assignments but get special category handling
  // The UI can filter/handle them based on the 'in-class' category rather than blockType
  const isSchedulable = true; // All assignments remain schedulable for flexibility
  const blockType: 'assignment' | 'co-op' | 'travel' | 'prep' = 'assignment'; // Keep all as assignments

  // Enhanced analysis with Canvas data
  const isRecurring = canvasData?.is_recurring || isRecurringAssignment(title, description);
  const isFromPrevious = isFromPreviousYearOrTemplate(extractedDueDate, canvasData?.course_start_date);
  
  // Determine Canvas category
  let canvasCategory: 'assignments' | 'discussions' | 'quizzes' | 'syllabus' | 'other' = 'other';
  const groupName = canvasData?.assignment_group?.name?.toLowerCase() || '';
  const titleLower = title.toLowerCase();
  
  if (groupName.includes('syllabus') || titleLower.includes('syllabus') || titleLower.includes('fee')) {
    canvasCategory = 'syllabus';
  } else if (groupName.includes('discussion') || canvasData?.submission_types?.includes('discussion_topic')) {
    canvasCategory = 'discussions';
  } else if (groupName.includes('quiz') || canvasData?.submission_types?.includes('online_quiz')) {
    canvasCategory = 'quizzes';
  } else {
    canvasCategory = 'assignments';
  }
  
  // COMPREHENSIVE availability window calculation with ALL Canvas module timing sources
  let availableFrom: Date | null = null;
  let availableUntil: Date | null = null;
  
  // Priority 1: Direct Canvas assignment timing
  if (canvasData?.unlock_at) {
    availableFrom = new Date(canvasData.unlock_at);
  }
  if (canvasData?.lock_at) {
    availableUntil = new Date(canvasData.lock_at);
  }
  
  // Priority 2: Inferred module timing (existing successful pattern)
  if (!availableFrom && canvasData?.inferred_start_date) {
    availableFrom = new Date(canvasData.inferred_start_date);
    console.log(`📅 Using inferred start for availability: ${availableFrom.toDateString()}`);
  }
  if (!availableUntil && canvasData?.inferred_end_date) {
    availableUntil = new Date(canvasData.inferred_end_date);
    console.log(`📅 Using inferred end for availability: ${availableUntil.toDateString()}`);
  }
  
  // Priority 3: Module data timing (for assignments linked to modules)
  if (!availableFrom && canvasData?.module_data?.unlock_at) {
    availableFrom = new Date(canvasData.module_data.unlock_at);
    console.log(`📅 Using module data unlock for availability: ${availableFrom.toDateString()}`);
  }
  
  
  const availabilityWindow = {
    availableFrom,
    availableUntil
  };
  
  // Submission context
  const submissionContext = {
    submissionTypes: canvasData?.submission_types || [],
    pointsValue: canvasData?.points_possible || null,
    isGraded: (canvasData?.points_possible || 0) > 0,
    allowsLateSubs: !canvasData?.lock_at // If no lock date, late submissions might be allowed
  };
  
  // Smart scheduling suggestion
  let suggestedScheduleDate: Date | null = null;
  if (extractedDueDate && isSchedulable) {
    if (category === 'homework') {
      // Schedule homework 1-2 days before due date
      suggestedScheduleDate = new Date(extractedDueDate);
      suggestedScheduleDate.setDate(suggestedScheduleDate.getDate() - 1);
    } else {
      suggestedScheduleDate = extractedDueDate;
    }
  }

  // Determine priority based on assignment characteristics
  let priority: 'A' | 'B' | 'C' = 'B'; // Default to B (Important)
  
  if (extractedDueDate) {
    const daysUntilDue = Math.ceil((extractedDueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    // A = Critical (due today/tomorrow or overdue)
    if (daysUntilDue <= 1) {
      priority = 'A';
    }
    // C = Flexible (due more than a week away)
    else if (daysUntilDue > 7) {
      priority = 'C';
    }
    // B = Important (due this week)
    else {
      priority = 'B';
    }
  }
  
  // High-value assignments get priority bump
  if (canvasData?.points_possible && canvasData.points_possible >= 100) {
    if (priority === 'C') priority = 'B';
    if (priority === 'B') priority = 'A';
  }
  
  // Quizzes and tests get priority bump
  if (category === 'quiz' || category === 'test') {
    if (priority === 'C') priority = 'B';
    if (priority === 'B') priority = 'A';
  }
  
  // Calculate confidence score
  let confidence = 0.5; // Base confidence
  if (extractedDueDate) confidence += 0.3;
  if (canvasData?.assignment_group) confidence += 0.2;
  if (isInClass) confidence += 0.2;
  if (isRecurring) confidence += 0.1;
  
  return {
    extractedDueDate,
    isInClassActivity: isInClass,
    isSchedulable,
    blockType,
    category,
    isRecurring,
    canvasCategory,
    isFromPreviousYear: isFromPrevious,
    isTemplateData: isFromPrevious,
    suggestedScheduleDate,
    availabilityWindow,
    submissionContext,
    confidence: Math.min(confidence, 1.0),
    priority
  };
}

/**
 * Backward compatibility - analyze assignment with basic data
 */
export function analyzeAssignment(title: string, description?: string): AssignmentIntelligence {
  return analyzeAssignmentWithCanvas(title, description);
}

/**
 * Get smart scheduling date based on assignment analysis
 */
export function getSmartSchedulingDate(intelligence: AssignmentIntelligence, fallbackDate: string): string {
  // For in-class activities that are schedulable (makeup work), use the class date
  if (intelligence.extractedDueDate && intelligence.isSchedulable) {
    return intelligence.extractedDueDate.toISOString().split('T')[0];
  }
  
  // For homework with extracted due dates, schedule a day or two before
  if (intelligence.extractedDueDate && intelligence.category === 'homework') {
    const scheduledDate = new Date(intelligence.extractedDueDate);
    scheduledDate.setDate(scheduledDate.getDate() - 1); // Schedule day before due
    return scheduledDate.toISOString().split('T')[0];
  }
  
  return fallbackDate;
}

/**
 * Comprehensive Auto-Scheduler for Assignments
 * Schedules assignments into specific schedule blocks by priority, due date, and effort alternation
 */
export interface SchedulingResult {
  scheduledDate: string;
  scheduledBlock: number | null;
  blockStart: string | null;
  blockEnd: string | null;
  reason: string;
}

export interface ScheduleBlock {
  id: string;
  studentName: string;
  weekday: string;
  blockNumber: number | null;
  startTime: string;
  endTime: string;
  subject: string;
  blockType: string;
}

// Legacy interfaces kept for backward compatibility only - use hybrid scheduler instead
export interface AssignmentToSchedule {
  id: string;
  title: string;
  priority: 'A' | 'B' | 'C';
  dueDate: Date | null;
  difficulty: 'easy' | 'medium' | 'hard';
  actualEstimatedMinutes: number;
  completionStatus: string;
  scheduledDate?: string | null;
  scheduledBlock?: number | null;
}

/**
 * Enhanced date validation with academic calendar context
 */
export function validateExtractedDate(date: Date, title: string): { isValid: boolean; reason?: string } {
  const currentDate = new Date();
  const currentSchoolYearStart = new Date('2025-08-01');
  const currentSchoolYearEnd = new Date('2026-07-31');
  const nextSchoolYearEnd = new Date('2027-07-31');
  
  // Check if date is unreasonably far in the past
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(currentDate.getFullYear() - 2);
  if (date < twoYearsAgo) {
    return { isValid: false, reason: 'Date is more than 2 years in the past' };
  }
  
  // Check if date is unreasonably far in the future  
  if (date > nextSchoolYearEnd) {
    return { isValid: false, reason: 'Date is beyond next school year' };
  }
  
  // Warn if date is outside current school year but could be valid
  if (date < currentSchoolYearStart || date > currentSchoolYearEnd) {
    return { isValid: true, reason: 'Date is outside current school year but may be valid' };
  }
  
  return { isValid: true };
}

/**
 * Retroactive assignment cleanup - extract due dates from existing assignments
 */
export async function extractDueDatesFromExistingAssignments(storage: any, options: {
  studentName?: string;
  dryRun?: boolean;
  onProgress?: (processed: number, total: number, assignment: any) => void;
} = {}): Promise<{
  processed: number;
  updated: number;
  skipped: number;
  errors: Array<{ assignmentId: string; title: string; error: string }>;
}> {
  const results = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: [] as Array<{ assignmentId: string; title: string; error: string }>
  };
  
  try {
    // Get all assignments with no due date
    const allAssignments = await storage.getAllAssignments();
    const assignmentsNoDueDate = allAssignments.filter((assignment: any) => {
      const hasNoDueDate = !assignment.dueDate;
      const matchesStudent = !options.studentName || 
        assignment.userId.toLowerCase().includes(options.studentName.toLowerCase());
      return hasNoDueDate && matchesStudent;
    });
    
    console.log(`🔍 Found ${assignmentsNoDueDate.length} assignments without due dates for retroactive processing`);
    
    for (const assignment of assignmentsNoDueDate) {
      results.processed++;
      
      try {
        // Extract due date from title
        const extractedDate = extractDueDateFromTitle(assignment.title);
        
        if (extractedDate) {
          // Validate the extracted date
          const validation = validateExtractedDate(extractedDate, assignment.title);
          
          if (validation.isValid) {
            if (!options.dryRun) {
              // Update the assignment with extracted due date
              await storage.updateAssignment(assignment.id, {
                dueDate: extractedDate
              });
              console.log(`✅ Updated "${assignment.title}" with due date: ${extractedDate.toDateString()}`);
            } else {
              console.log(`🔍 DRY RUN: Would update "${assignment.title}" with due date: ${extractedDate.toDateString()}`);
            }
            results.updated++;
          } else {
            console.log(`⚠️ Skipped "${assignment.title}" - invalid date: ${validation.reason}`);
            results.skipped++;
          }
        } else {
          results.skipped++;
        }
        
        // Progress callback
        if (options.onProgress) {
          options.onProgress(results.processed, assignmentsNoDueDate.length, assignment);
        }
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push({
          assignmentId: assignment.id,
          title: assignment.title,
          error: errorMsg
        });
        console.error(`❌ Error processing "${assignment.title}": ${errorMsg}`);
      }
    }
    
    console.log(`🎉 Retroactive cleanup complete: ${results.updated} updated, ${results.skipped} skipped, ${results.errors.length} errors`);
    return results;
    
  } catch (error) {
    console.error('❌ Retroactive cleanup failed:', error);
    throw error;
  }
}

/**
 * CO-OP STUDY HALL PORTABILITY ANALYSIS
 * Determines if an assignment can be done during study hall at co-op
 */
export function analyzeAssignmentPortability(title: string, instructions?: string): PortabilityAnalysis {
  const content = `${title} ${instructions || ''}`.toLowerCase();
  
  // NON-PORTABLE PATTERNS (require parent supervision, special equipment, or home environment)
  const nonPortablePatterns = [
    // Parent supervision required
    /parent.*help/i,
    /with.*parent/i,
    /adult.*supervision/i,
    /ask.*parent/i,
    /parent.*signature/i,
    /guardian.*sign/i,
    
    // Video/multimedia that requires sound/headphones
    /watch.*video/i,
    /video.*assignment/i,
    /youtube/i,
    /streaming/i,
    /audio.*assignment/i,
    /listen.*to/i,
    /recording/i,
    
    // Lab work or hands-on activities
    /lab.*work/i,
    /laboratory/i,
    /experiment/i,
    /hands.*on/i,
    /materials.*needed/i,
    /supplies.*required/i,
    /kitchen/i,
    /cooking/i,
    /baking/i,
    
    // Projects requiring space/materials
    /poster.*board/i,
    /craft.*project/i,
    /art.*project/i,
    /build.*model/i,
    /construction/i,
    /large.*format/i,
    
    // Technology requirements not available at co-op
    /specific.*software/i,
    /install.*program/i,
    /download.*software/i,
    /cd.*rom/i,
    /printer.*required/i,
    /scan.*document/i,
    
    // Home environment specific
    /interview.*family/i,
    /home.*observation/i,
    /household/i,
    /family.*member/i,
    /sibling/i,
    /at.*home.*only/i,
  ];
  
  // PORTABLE PATTERNS (ideal for study hall)
  const portablePatterns = [
    // Reading assignments
    /read.*chapter/i,
    /reading.*assignment/i,
    /textbook.*reading/i,
    /article.*reading/i,
    /study.*guide/i,
    
    // Written work
    /worksheet/i,
    /workbook/i,
    /written.*assignment/i,
    /essay/i,
    /writing.*prompt/i,
    /journal.*entry/i,
    /notes/i,
    /note.*taking/i,
    
    // Math/problem solving
    /math.*problems/i,
    /practice.*problems/i,
    /solve.*equations/i,
    /calculations/i,
    /word.*problems/i,
    
    // Online work (if internet available)
    /online.*quiz/i,
    /digital.*assignment/i,
    /computer.*based/i,
    /typing.*assignment/i,
    /research.*online/i,
    
    // Independent study tasks
    /self.*paced/i,
    /independent.*work/i,
    /individual.*assignment/i,
    /quiet.*work/i,
    /study.*time/i,
  ];
  
  // Check for non-portable indicators
  for (const pattern of nonPortablePatterns) {
    if (pattern.test(content)) {
      const reason = getPortabilityReason(pattern, content, false);
      return {
        isPortable: false,
        reason: reason,
        confidence: 0.8
      };
    }
  }
  
  // Check for portable indicators
  for (const pattern of portablePatterns) {
    if (pattern.test(content)) {
      const reason = getPortabilityReason(pattern, content, true);
      return {
        isPortable: true,
        reason: reason,
        confidence: 0.9
      };
    }
  }
  
  // Default: assume portable unless proven otherwise (bias toward study hall productivity)
  return {
    isPortable: true,
    reason: "No specific restrictions detected - suitable for independent study hall work",
    confidence: 0.6
  };
}

function getPortabilityReason(pattern: RegExp, content: string, isPortable: boolean): string {
  const match = content.match(pattern);
  if (!match) return isPortable ? "Portable assignment" : "Non-portable assignment";
  
  if (!isPortable) {
    // Non-portable reasons
    if (pattern.source.includes('parent')) return "Requires parent supervision";
    if (pattern.source.includes('video|audio')) return "Requires video/audio playback";
    if (pattern.source.includes('lab|experiment')) return "Lab work requiring special equipment";
    if (pattern.source.includes('craft|art|build')) return "Project requiring materials/space";
    if (pattern.source.includes('software|printer')) return "Requires specific technology";
    if (pattern.source.includes('family|home')) return "Requires home environment";
    return "Requires resources not available during study hall";
  } else {
    // Portable reasons
    if (pattern.source.includes('read')) return "Reading assignment - ideal for quiet study time";
    if (pattern.source.includes('worksheet|written')) return "Written work - perfect for study hall";
    if (pattern.source.includes('math|problems')) return "Problem solving - good focus activity";
    if (pattern.source.includes('online')) return "Online work - if internet available";
    if (pattern.source.includes('independent')) return "Independent work - perfect for study hall";
    return "Can be completed independently during study hall";
  }
}