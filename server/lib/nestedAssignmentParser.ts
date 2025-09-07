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
  const fullText = `${title} ${instructions || ''}`.toLowerCase();
  
  // Skip parsing for simple assignments that are already atomic
  if (isSimpleAssignment(fullText)) {
    return {
      shouldSplit: false,
      subAssignments: [],
      originalTitle: title,
      parsingConfidence: 0.9
    };
  }

  const subAssignments: ParsedSubAssignment[] = [];
  let confidence = 0.5;

  // Parse reading ranges (e.g., "Read Lessons 6-9", "Chapters 1-3")
  const readingTasks = parseReadingRanges(fullText, studentName);
  if (readingTasks.length > 0) {
    subAssignments.push(...readingTasks);
    confidence = 0.85;
  }

  // Parse individual activities and combined tasks
  const activityTasks = parseActivities(fullText, instructions || '');
  if (activityTasks.length > 0) {
    subAssignments.push(...activityTasks);
    confidence = Math.max(confidence, 0.8);
  }

  // Only split if we found multiple meaningful sub-components
  const shouldSplit = subAssignments.length >= 2;

  return {
    shouldSplit,
    subAssignments: shouldSplit ? subAssignments : [],
    originalTitle: title,
    parsingConfidence: confidence
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
 * Parses reading ranges like "Lessons 6-9" into individual reading tasks
 */
function parseReadingRanges(text: string, studentName: string): ParsedSubAssignment[] {
  const subAssignments: ParsedSubAssignment[] = [];
  
  // Match patterns like:
  // "Read Lessons 6-9"
  // "Chapters 1-3" 
  // "Pages 45-67"
  // "Lessons 6, 7, 8, and 9"
  const rangePatterns = [
    /read\s+(?:lessons?|chapters?|pages?|units?)\s+(\d+)[-–—](\d+)/gi,
    /(?:lessons?|chapters?|pages?|units?)\s+(\d+)[-–—](\d+)/gi,
    /(?:lessons?|chapters?)\s+(\d+)(?:,?\s*(?:and\s+)?(\d+))+/gi
  ];

  for (const pattern of rangePatterns) {
    const matches = [...text.matchAll(pattern)];
    for (const match of matches) {
      const start = parseInt(match[1]);
      const end = parseInt(match[2]) || start;
      
      // Create individual lesson tasks
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

  return subAssignments;
}

/**
 * Parses distinct activities from assignment instructions
 */
function parseActivities(text: string, fullInstructions: string): ParsedSubAssignment[] {
  const activities: ParsedSubAssignment[] = [];
  
  // Look for numbered activities or bullet points
  const activityPatterns = [
    // Maps, charts, and similar activities that go together
    /(?:label|complete|color).*?(?:map|chart).*?(?:label|complete|color).*?(?:map|chart)/gi,
    // Standalone activities
    /answer.*?question/gi,
    /complete.*?worksheet/gi,
    /write.*?essay/gi,
    /create.*?presentation/gi,
    /draw.*?diagram/gi
  ];

  // Check for combined map + chart activity (classic history pattern)
  if (/map.*chart|chart.*map/i.test(fullInstructions)) {
    activities.push({
      title: 'Complete Map & Chart Activity',
      description: 'Label colonies on map and complete reference chart',
      estimatedMinutes: 30,
      priority: 'B',
      difficulty: 'medium',
      type: 'activity'
    });
  }

  // Look for other distinct activities
  for (const pattern of activityPatterns) {
    const matches = [...fullInstructions.matchAll(pattern)];
    for (const match of matches) {
      if (!activities.some(a => a.title.includes('Map & Chart'))) {
        activities.push({
          title: capitalizeFirst(match[0]),
          description: match[0],
          estimatedMinutes: 30,
          priority: 'B',
          difficulty: 'medium',
          type: 'activity'
        });
      }
    }
  }

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
  if (!parsedResult.shouldSplit) {
    return [originalAssignment]; // Return original if no splitting needed
  }

  return parsedResult.subAssignments.map((subAssignment, index) => ({
    ...originalAssignment,
    id: undefined, // Let database generate new IDs
    title: subAssignment.title,
    instructions: subAssignment.description,
    actualEstimatedMinutes: subAssignment.estimatedMinutes,
    priority: subAssignment.priority,
    difficulty: subAssignment.difficulty,
    creationSource: 'auto_split' as const,
    notes: `Split from: ${originalAssignment.title} (Part ${index + 1}/${parsedResult.subAssignments.length})`,
    // Preserve Canvas metadata but mark as derived
    canvasId: null, // These are derived assignments, not direct Canvas imports
    isCanvasImport: false,
    // Sequence numbering for proper scheduling
    sequenceNumber: subAssignment.lessonNumber || index + 1
  }));
}