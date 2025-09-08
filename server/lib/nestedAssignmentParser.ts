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
  const subAssignments: ParsedSubAssignment[] = [];
  
  // Match patterns like:
  // "Read Lessons 6-9" (but not "read lesson 6 and answer questions")
  // "Chapters 1-3" 
  // "Pages 45-67" (large page ranges only)
  // "Lessons 6, 7, 8, and 9"
  const rangePatterns = [
    /read\s+(?:lessons?|chapters?|units?)\s+(\d+)[-–—](\d+)/gi,
    /(?:lessons?|chapters?|units?)\s+(\d+)[-–—](\d+)/gi,
    /(?:lessons?|chapters?)\s+(\d+)(?:,?\s*(?:and\s+)?(\d+))+/gi
  ];

  // Don't split page ranges unless they're very large (20+ pages)
  const pageRangePattern = /pages?\s+(\d+)[-–—](\d+)/gi;

  for (const pattern of rangePatterns) {
    const matches = Array.from(text.matchAll(pattern));
    for (const match of matches) {
      const start = parseInt(match[1]);
      const end = parseInt(match[2]) || start;
      
      // Only split if it's a meaningful range (3+ lessons/chapters)
      if (end - start + 1 < 3) {
        continue; // Skip small ranges
      }
      
      // Create individual lesson tasks only for clear multi-lesson assignments
      for (let lessonNum = start; lessonNum <= end; lessonNum++) {
        const lessonTitle = `Read Lesson ${lessonNum} + Answer Questions`;
        const estimatedMinutes = calculateReadingTime(studentName);
        
        subAssignments.push({
          title: lessonTitle,
          description: `Read textbook lesson ${lessonNum} (approximately 6 pages) and complete associated questions`,
          estimatedMinutes,
          priority: 'B',
          difficulty: 'medium',
          type: 'combined', // Reading + questions = one 30-min block
          lessonNumber: lessonNum
        });
      }
    }
  }

  // Handle large page ranges (20+ pages) separately
  const pageMatches = Array.from(text.matchAll(pageRangePattern));
  for (const match of pageMatches) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    const pageCount = end - start + 1;
    
    // Only split very large page ranges (20+ pages)
    if (pageCount >= 20) {
      const chunksNeeded = Math.ceil(pageCount / 15); // 15 pages per chunk
      for (let chunk = 0; chunk < chunksNeeded; chunk++) {
        const chunkStart = start + (chunk * 15);
        const chunkEnd = Math.min(start + ((chunk + 1) * 15) - 1, end);
        
        subAssignments.push({
          title: `Read Pages ${chunkStart}-${chunkEnd}`,
          description: `Read pages ${chunkStart} through ${chunkEnd}`,
          estimatedMinutes: calculateReadingTime(studentName),
          priority: 'B',
          difficulty: 'medium',
          type: 'reading',
          lessonNumber: chunk + 1
        });
      }
    }
  }

  return subAssignments;
}

/**
 * Parses distinct activities from assignment instructions
 */
function parseActivities(text: string, fullInstructions: string): ParsedSubAssignment[] {
  const activities: ParsedSubAssignment[] = [];
  
  // Be much more conservative - only look for clearly separate activities
  // Don't split activities that are naturally cohesive
  
  // Only split if we find multiple distinct project-level activities
  const majorActivityPatterns = [
    // Large projects that are clearly separate
    /create.*presentation.*(?:and|&).*write.*essay/gi,
    /write.*essay.*(?:and|&).*create.*presentation/gi,
    /complete.*project.*(?:and|&).*(?:write|create|design)/gi,
  ];

  // Check for major separate activities only
  for (const pattern of majorActivityPatterns) {
    const matches = Array.from(fullInstructions.matchAll(pattern));
    for (const match of matches) {
      // Split major combined activities
      const parts = match[0].split(/(?:and|&)/);
      for (const part of parts) {
        if (part.trim().length > 5) {
          activities.push({
            title: capitalizeFirst(part.trim()),
            description: part.trim(),
            estimatedMinutes: 45, // Longer for major activities
            priority: 'B',
            difficulty: 'medium',
            type: 'activity'
          });
        }
      }
    }
  }

  // Don't split map+chart, reading+questions, or other cohesive activities
  // These should be handled as single assignments

  return activities;
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