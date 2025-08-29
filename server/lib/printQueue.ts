// Print Queue Intelligence - Detect assignments that need physical printing
// for the Parent Dashboard proactive support feature

export interface PrintDetection {
  needsPrinting: boolean;
  printReason: string | null;
  canvasUrl: string | null;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Intelligent print detection for assignments
 * Identifies Canvas assignments that need physical materials
 */
export function detectPrintNeeds(assignment: {
  title: string;
  instructions?: string | null;
  canvasId?: number | null;
  canvasCourseId?: number | null;  // CRITICAL: Add course ID for Canvas URLs
  canvasInstance?: number | null;
  submissionTypes?: string[] | null;
  courseName?: string | null;
  subject?: string | null;
}): PrintDetection {
  
  const result: PrintDetection = {
    needsPrinting: false,
    printReason: null,
    canvasUrl: null,
    priority: 'low'
  };

  // Generate Canvas URL if we have Canvas ID and Course ID
  if (assignment.canvasId && assignment.canvasCourseId && assignment.canvasInstance) {
    const baseUrl = assignment.canvasInstance === 1 
      ? process.env.CANVAS_BASE_URL 
      : process.env.CANVAS_BASE_URL_2;
    if (baseUrl) {
      // Generate proper Canvas assignment URL: https://canvas.instructure.com/courses/6739821/assignments/40318135
      result.canvasUrl = `${baseUrl}/courses/${assignment.canvasCourseId}/assignments/${assignment.canvasId}`;
    }
  }
  // ENHANCED FALLBACK: Map course IDs for Canvas assignments with missing course data
  else if (assignment.canvasId && assignment.canvasInstance) {
    const baseUrl = assignment.canvasInstance === 1 
      ? process.env.CANVAS_BASE_URL 
      : process.env.CANVAS_BASE_URL_2;
    if (baseUrl) {
      // Map known course IDs based on assignment subject/courseName
      let courseId: number | null = null;
      const subject = (assignment.subject || '').toLowerCase();
      const courseName = (assignment.courseName || '').toLowerCase();
      
      // Map based on known course patterns from Canvas logs
      if (subject.includes('baking') || courseName.includes('baking')) {
        courseId = 12112029; // 25/26 M4 MS/HS Baking
      } else if (subject.includes('geometry') || courseName.includes('geometry')) {
        courseId = 12060124; // 25/26 M4/T4 Geometry  
      } else if (subject.includes('american lit') || subject.includes('literature') || courseName.includes('american lit') || subject.includes('10th-11th')) {
        courseId = 6739821; // 25/26 T2 10th-11th Gr American Lit/Comp
      } else if (subject.includes('photography') || courseName.includes('photography')) {
        courseId = 12261099; // 25/26 T5 Photography
      } else if (subject.includes('yearbook') || courseName.includes('yearbook')) {
        courseId = 12267845; // 25/26 T6 Yearbook
      }
      
      if (courseId) {
        result.canvasUrl = `${baseUrl}/courses/${courseId}/assignments/${assignment.canvasId}`;
        console.log(`🔗 Fixed Canvas URL for "${assignment.title}": ${result.canvasUrl}`);
      } else {
        // Final fallback to search
        const searchTerm = encodeURIComponent(assignment.title.substring(0, 50));
        result.canvasUrl = `${baseUrl}/search/all_courses?search=${searchTerm}`;
      }
    }
  } 
  // FALLBACK: Generate search URL for assignments without Canvas IDs
  else {
    const baseUrl = process.env.CANVAS_BASE_URL;
    if (baseUrl && assignment.title) {
      // Create a Canvas search URL to help find the assignment
      const searchTerm = encodeURIComponent(assignment.title.substring(0, 50));
      result.canvasUrl = `${baseUrl}/search/all_courses?search=${searchTerm}`;
    }
  }

  const title = assignment.title.toLowerCase();
  const instructions = (assignment.instructions || '').toLowerCase();
  const fullText = `${title} ${instructions}`;

  // HIGH PRIORITY - Definitely needs printing
  const highPriorityKeywords = [
    'worksheet', 'handout', 'print', 'fill out', 'complete the chart',
    'table to fill', 'answer sheet', 'activity page', 'lab sheet',
    'periodic table', 'map activity', 'timeline', 'graphic organizer',
    // ENHANCED: Study materials and test prep
    'study guide', 'study for', 'notebook', 'tear out', 'hole punch',
    'test booklet', 'floppy folder', 'turn in', 'bring to class',
    // ENHANCED: Assignment types that benefit from printing
    'homework due', 'assignment due', 'complete p.', 'read p.', 'pages',
    'chapter', 'exercises', 'problems', 'practice', 'review',
    'questions', 'workbook', 'textbook', 'student notebook'
  ];

  for (const keyword of highPriorityKeywords) {
    if (fullText.includes(keyword)) {
      result.needsPrinting = true;
      result.printReason = 'worksheet';
      result.priority = 'high';
      break;
    }
  }

  // MEDIUM PRIORITY - Complex instructions likely need printing
  if (!result.needsPrinting) {
    // Very long instructions (>500 chars) - likely multi-step procedures
    if (instructions.length > 500) {
      result.needsPrinting = true;
      result.printReason = 'long_instructions';
      result.priority = 'medium';
    }
    
    // Contains HTML tables or complex formatting
    if (instructions.includes('<table>') || instructions.includes('<th>') || instructions.includes('<td>')) {
      result.needsPrinting = true;
      result.printReason = 'contains_table';
      result.priority = 'high';
    }

    // Contains step-by-step numbered instructions
    const stepPattern = /\d+\.\s/g;
    const steps = (instructions.match(stepPattern) || []).length;
    if (steps >= 5) {
      result.needsPrinting = true;
      result.printReason = 'multi_step_procedure';
      result.priority = 'medium';
    }

    // Science lab keywords
    const labKeywords = ['experiment', 'laboratory', 'materials:', 'procedure:', 'observations:', 'data table'];
    if (labKeywords.some(keyword => fullText.includes(keyword))) {
      result.needsPrinting = true;
      result.printReason = 'lab_activity';
      result.priority = 'high';
    }

    // Math problem sets
    if ((assignment.subject === 'Mathematics' || assignment.courseName?.includes('Math')) && 
        (fullText.includes('problems') || fullText.includes('exercises') || instructions.length > 200)) {
      result.needsPrinting = true;
      result.printReason = 'math_problems';
      result.priority = 'medium';
    }
  }

  // LOW PRIORITY - Might benefit from printing but not essential
  if (!result.needsPrinting) {
    // Reference materials or reading assignments with complex formatting
    if (instructions.includes('<ol>') || instructions.includes('<ul>') || instructions.includes('<li>')) {
      const listItems = (instructions.match(/<li>/g) || []).length;
      if (listItems >= 8) {
        result.needsPrinting = true;
        result.printReason = 'reference_list';
        result.priority = 'low';
      }
    }

    // History assignments with dates, names, events
    if ((assignment.subject === 'History' || assignment.courseName?.includes('History')) && 
        instructions.length > 300) {
      result.needsPrinting = true;
      result.printReason = 'history_reference';
      result.priority = 'low';
    }

    // ENHANCED: Any assignment with meaningful instructions (not just "Assignment from Canvas")
    if (instructions.length > 50 && !instructions.includes('assignment from canvas')) {
      // Check for study-related content
      const studyKeywords = ['study', 'test', 'quiz', 'exam', 'prepare', 'review'];
      if (studyKeywords.some(keyword => fullText.includes(keyword))) {
        result.needsPrinting = true;
        result.printReason = 'study_material';
        result.priority = 'medium';
      }
      // Check for homework with specific instructions (page numbers, etc.)
      else if (fullText.includes('p.') || fullText.includes('page') || instructions.length > 100) {
        result.needsPrinting = true;
        result.printReason = 'detailed_homework';
        result.priority = 'low';
      }
    }
  }

  return result;
}

/**
 * Generate print queue items for parent dashboard
 */
export interface PrintQueueItem {
  id: string;
  studentName: string;
  title: string;
  courseName?: string | null;
  dueDate?: Date | null;
  scheduledDate?: string | null;
  printReason: string;
  priority: 'high' | 'medium' | 'low';
  canvasUrl?: string | null;
  printStatus: 'needs_printing' | 'printed' | 'skipped';
  estimatedPages?: number;
}

/**
 * Calculate estimated page count for printing
 */
export function estimatePageCount(instructions: string | null): number {
  if (!instructions) return 1;
  
  const charCount = instructions.length;
  const hasTable = instructions.includes('<table>');
  const hasList = instructions.includes('<ol>') || instructions.includes('<ul>');
  
  // Base page estimate (roughly 2000 chars per page)
  let pages = Math.ceil(charCount / 2000);
  
  // Tables typically take more space
  if (hasTable) pages += 1;
  
  // Long lists take extra space
  if (hasList && charCount > 1000) pages += 1;
  
  return Math.max(1, Math.min(pages, 10)); // Minimum 1, maximum 10 pages
}

/**
 * Get print priority color for UI
 */
export function getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  }
}

/**
 * Get print reason display text
 */
export function getPrintReasonText(reason: string): string {
  switch (reason) {
    case 'worksheet': return '📄 Worksheet/Handout';
    case 'long_instructions': return '📋 Detailed Instructions';
    case 'contains_table': return '📊 Data Table';
    case 'multi_step_procedure': return '🔢 Step-by-Step Guide';
    case 'lab_activity': return '🔬 Science Lab';
    case 'math_problems': return '🔢 Math Problems';
    case 'reference_list': return '📝 Reference Material';
    case 'history_reference': return '📚 History Guide';
    case 'study_material': return '📚 Study Material';
    case 'detailed_homework': return '📝 Homework Instructions';
    default: return '📄 Printable Material';
  }
}