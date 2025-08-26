/**
 * Intelligent Assignment Processing
 * Handles smart text parsing and categorization of assignments
 */

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
    
    // === STANDALONE DATE PATTERNS (FALLBACK) ===
    /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/,                        // "9/11/2025" anywhere in title
    /\b(\d{1,2}\/\d{1,2})\b/,                                 // "9/11" anywhere in title (fallback)
  ];

  for (const [index, pattern] of patterns.entries()) {
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
 * Parse date strings with various formats and smart year inference
 */
function parseDateString(dateStr: string): Date | null {
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
    
    // If the date is in the past and no year was specified, try next year
    if (parts.length === 2 && date < new Date()) {
      const nextYearDate = new Date(year + 1, month - 1, day);
      return nextYearDate;
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
  
  // CRITICAL: Use module timing as fallback when assignment timing is missing
  if (!extractedDueDate && canvasData?.inferred_start_date) {
    extractedDueDate = new Date(canvasData.inferred_start_date);
    console.log(`📅 Using module timing for "${title}": ${extractedDueDate.toDateString()}`);
  }
  
  // For multi-week assignments like "Class Participation for Module 1", use module completion date if available
  if (!extractedDueDate && canvasData?.module_data?.completed_at) {
    extractedDueDate = new Date(canvasData.module_data.completed_at);
    console.log(`📅 Using module completion timing for "${title}": ${extractedDueDate.toDateString()}`);
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
  
  // Calculate availability window with module timing fallback
  const availabilityWindow = {
    availableFrom: canvasData?.unlock_at ? new Date(canvasData.unlock_at) : 
                   canvasData?.inferred_start_date ? new Date(canvasData.inferred_start_date) : null,
    availableUntil: canvasData?.lock_at ? new Date(canvasData.lock_at) :
                    canvasData?.inferred_end_date ? new Date(canvasData.inferred_end_date) : null
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
    confidence: Math.min(confidence, 1.0)
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