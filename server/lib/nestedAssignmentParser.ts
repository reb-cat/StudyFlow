/**
 * Nested Assignment Parser
 * Intelligently breaks down complex Canvas assignments into schedulable sub-components
 * Designed for executive function support - transforms bundled assignments into manageable tasks
 */

export interface ParsedSubAssignment {
  title: string;
  description: string;
  estimatedMinutes: number;
  priority: 'A' | 'B' | 'C';
  difficulty: 'easy' | 'medium' | 'hard';
  type: 'reading' | 'activity' | 'combined';
  lessonNumber?: number; // For sequencing
}

export interface AssignmentParsingResult {
  shouldSplit: boolean;
  subAssignments: ParsedSubAssignment[];
  originalTitle: string;
  parsingConfidence: number; // 0-1 scale
}

/**
 * Main parsing function - analyzes assignment instructions and breaks down complex assignments
 */
export function parseNestedAssignments(
  title: string, 
  instructions: string | null, 
  studentName: string = 'generic'
): AssignmentParsingResult {
  // CANVAS DATA INTEGRITY: COMPLETELY DISABLED
  // Never split Canvas assignments - preserve them exactly as-is
  // Canvas is the definitive source of truth for assignment titles and structure
  return {
    shouldSplit: false,
    subAssignments: [],
    originalTitle: title,
    parsingConfidence: 1.0
  };
}

/**
 * Detects if assignment is already atomic and doesn't need parsing
 */
function isSimpleAssignment(text: string): boolean {
  const simplePatterns = [
    /^quiz\b/i,
    /^test\b/i,
    /^exam\b/i,
    /^discussion\b/i,
    /^turn\s+in\b/i,
    /^submit\b/i,
    /^review\b.*\brecipe\b/i, // Recipe reviews are already atomic
    /^forensics?\s+lab\b/i, // Forensics labs are already atomic
  ];

  return simplePatterns.some(pattern => pattern.test(text));
}

/**
 * Detects cohesive assignments that should stay together despite having multiple components
 */
function isCohesiveAssignment(text: string): boolean {
  const cohesivePatterns = [
    // Reading + questions is one cohesive task
    /read.*(?:chapter|ch|page).*(?:and|&).*(?:answer|complete).*question/i,
    /(?:answer|complete).*question.*(?:and|&).*read.*(?:chapter|ch|page)/i,
    
    // Worksheet + discussion is cohesive
    /complete.*worksheet.*(?:and|&).*(?:discussion|post)/i,
    /(?:discussion|post).*(?:and|&).*complete.*worksheet/i,
    
    // Watch + answer is cohesive
    /watch.*video.*(?:and|&).*(?:answer|complete)/i,
    /(?:answer|complete).*(?:and|&).*watch.*video/i,
    
    // Single chapter/lesson with questions is cohesive
    /(?:read|study).*(?:chapter|lesson|ch)\s+\d+.*(?:answer|complete|do).*question/i,
    
    // Map and chart activities are cohesive
    /(?:complete|label|color).*(?:map|chart).*(?:and|&).*(?:complete|label|color).*(?:map|chart)/i,
    
    // Single assignment with numbered items (1-5 questions, etc.)
    /answer.*(?:questions?\s+)?(?:\d+[-–—]\d+|\d+\s*[,-]\s*\d+)/i,
    
    // Essay with research is cohesive
    /write.*essay.*(?:and|&).*(?:research|find|cite)/i,
    
    // Lab report components are cohesive
    /(?:complete|do).*lab.*(?:and|&).*(?:write|submit).*report/i,
  ];

  return cohesivePatterns.some(pattern => pattern.test(text));
}

/**
 * Parses reading ranges like "Lessons 6-9" into individual reading tasks
 */
function parseReadingRanges(text: string, studentName: string): ParsedSubAssignment[] {
  // PHANTOM ASSIGNMENT FIX: COMPLETELY DISABLED
  // This function was generating "Read Lesson X + Answer Questions" phantom assignments
  // that appeared in schedules but didn't exist in the database and couldn't be deleted
  console.log('🚫 parseReadingRanges called but DISABLED to prevent phantom assignments');
  return [];

}

/**
 * Parses distinct activities from assignment instructions
 */
function parseActivities(text: string, fullInstructions: string): ParsedSubAssignment[] {
  // PHANTOM ASSIGNMENT FIX: COMPLETELY DISABLED
  // Disabled to prevent any phantom assignment generation
  console.log('🚫 parseActivities called but DISABLED to prevent phantom assignments');
  return [];
}

/**
 * Calculate reading time based on student profile
 */
function calculateReadingTime(studentName: string): number {
  const baseMinutes = 25; // Base time for 6 pages + questions
  
  // Apply student-specific multipliers
  if (studentName.toLowerCase() === 'khalil') {
    // Khalil has dyslexia support - 1.35x reading multiplier
    return Math.ceil(baseMinutes * 1.35); // ~34 minutes, fits in 30-min block with small buffer
  }
  
  if (studentName.toLowerCase() === 'abigail') {
    // Abigail has EF slowness - 1.25x global multiplier
    return Math.ceil(baseMinutes * 1.25); // ~31 minutes, fits in 30-min block
  }
  
  return 30; // Standard 30-minute block
}

/**
 * Utility function to capitalize first letter
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Integration helper - creates actual assignment records from parsed sub-assignments
 */
export function createSubAssignmentRecords(
  originalAssignment: any,
  parsedResult: AssignmentParsingResult
) {
  // CANVAS DATA INTEGRITY: COMPLETELY DISABLED
  // Always return the original assignment unchanged
  // Never create sub-assignments that modify Canvas data
  return [originalAssignment];
}