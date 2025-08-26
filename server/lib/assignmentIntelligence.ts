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
}

/**
 * Extract due dates from assignment titles like "Homework Due 9/1" or "Assignment Due 10/15"
 */
export function extractDueDateFromTitle(title: string): Date | null {
  // Common patterns for due dates in titles
  const patterns = [
    /due\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,           // "Due 9/1" or "Due 9/1/24"
    /due\s+(\d{1,2}-\d{1,2}(?:-\d{2,4})?)/i,            // "Due 9-1" or "Due 9-1-24"
    /(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\s*due/i,          // "9/1 Due"
    /homework\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,     // "Homework 9/1"
    /assignment\s+(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/i,   // "Assignment 9/1"
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match) {
      const dateStr = match[1];
      const parsedDate = parseDateString(dateStr);
      if (parsedDate) {
        console.log(`📅 Extracted due date from "${title}": ${parsedDate.toDateString()}`);
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
 * Comprehensive analysis of assignment title and content
 */
export function analyzeAssignment(title: string, description?: string): AssignmentIntelligence {
  const isInClass = isInClassActivity(title);
  const extractedDueDate = extractDueDateFromTitle(title) || (isInClass ? extractClassDate(title) : null);
  
  // Determine category
  let category: 'homework' | 'in-class' | 'makeup' | 'other' = 'other';
  if (isInClass) {
    category = 'in-class';
  } else if (title.toLowerCase().includes('homework') || title.toLowerCase().includes('assignment')) {
    category = 'homework';
  } else if (title.toLowerCase().includes('makeup') || title.toLowerCase().includes('make-up')) {
    category = 'makeup';
  }

  // Determine schedulability
  // In-class activities are normally not schedulable (fixed to class time)
  // BUT makeup work becomes schedulable
  const isSchedulable = !isInClass || category === 'makeup';
  
  // Determine block type
  let blockType: 'assignment' | 'co-op' | 'travel' | 'prep' = 'assignment';
  if (isInClass && category !== 'makeup') {
    blockType = 'co-op'; // Fixed co-op class time
  }

  return {
    extractedDueDate,
    isInClassActivity: isInClass,
    isSchedulable,
    blockType,
    category
  };
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