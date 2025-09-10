import { canvasConfig } from './config';
import { logger } from './logger';

export interface CanvasAssignment {
  id: number;
  name: string;
  description?: string;
  due_at?: string;
  course_id: number;
  submission_types: string[];
  points_possible?: number;
  courseName?: string; // Added for course name mapping
  
  // Grading/submission information
  workflow_state?: string; // published, unpublished, etc.
  has_submitted_submissions?: boolean;
  graded_submissions_exist?: boolean;
  
  // Individual student submission data (when fetched)
  submission?: {
    id?: number;
    user_id?: number;
    assignment_id?: number;
    score?: number;
    grade?: string;
    submission_type?: string;
    workflow_state?: string; // submitted, graded, etc.
    graded_at?: string;
    submitted_at?: string;
  };
  
  // Extended Canvas metadata
  assignment_group_id?: number;
  assignment_group?: {
    id: number;
    name: string;
    position: number;
    group_weight?: number;
  };
  
  // Availability and timing
  unlock_at?: string; // When assignment becomes available
  lock_at?: string; // When assignment locks (different from due_at)
  created_at?: string;
  updated_at?: string;
  
  // Assignment classification
  html_url?: string;
  position?: number;
  published?: boolean;
  muted?: boolean;
  only_visible_to_overrides?: boolean;
  
  // Submission configuration
  allowed_extensions?: string[];
  turnitin_enabled?: boolean;
  vericite_enabled?: boolean;
  grade_group_students_individually?: boolean;
  anonymous_submissions?: boolean;
  anonymous_grading?: boolean;
  
  // Canvas categorization
  submission_types_display?: string;
  external_tool_tag_attributes?: any;
  peer_reviews?: boolean;
  automatic_peer_reviews?: boolean;
  
  // Custom metadata for our processing
  canvas_category?: 'assignments' | 'discussions' | 'quizzes' | 'syllabus' | 'other';
  is_recurring?: boolean;
  academic_year?: string;
  course_start_date?: string;
  course_end_date?: string;
  
  // Module timing extraction (when assignment timing is null)
  module_data?: any;
  inferred_start_date?: string;
  inferred_end_date?: string;
  
  // TEXTBOOK linking for referencing pages/modules from TEXTBOOK course
  textbook_links?: TextbookLink[];
}

export interface TextbookLink {
  title: string;
  url: string;
  module_name?: string;
  page_type: 'page' | 'module' | 'assignment';
}

export interface CanvasCourse {
  id: number;
  name: string;
  course_code?: string;
  account_id?: number;
  root_account_id?: number;
  enrollment_term_id?: number;
  grading_standard_id?: number;
  created_at?: string;
  start_at?: string;
  end_at?: string;
  locale?: string;
  enrollments?: any[];
  total_students?: number;
  calendar?: any;
  default_view?: string;
  syllabus_body?: string;
  public_syllabus?: boolean;
  public_syllabus_to_auth?: boolean;
  storage_quota_mb?: number;
  is_public?: boolean;
  is_public_to_auth_users?: boolean;
  public_description?: string;
  allow_student_wiki_edits?: boolean;
  allow_wiki_comments?: boolean;
  allow_student_forum_attachments?: boolean;
  open_enrollment?: boolean;
  self_enrollment?: boolean;
  restrict_enrollments_to_course_dates?: boolean;
  course_format?: string;
  access_restricted_by_date?: boolean;
  time_zone?: string;
  blueprint?: boolean;
  blueprint_restrictions?: any;
  blueprint_restrictions_by_object_type?: any;
  template?: boolean;
}

// Canvas API client for a specific student
export class CanvasClient {
  private baseUrl: string;
  private token: string;

  constructor(studentName: string, instanceNumber: number = 1) {
    // Configure based on student and Canvas instance
    if (studentName.toLowerCase() === 'abigail') {
      this.baseUrl = instanceNumber === 2 ? canvasConfig.baseUrl2 : canvasConfig.baseUrl;
      this.token = instanceNumber === 2 ? canvasConfig.abigailToken2 : canvasConfig.abigailToken;
    } else if (studentName.toLowerCase() === 'khalil') {
      this.baseUrl = canvasConfig.baseUrl;
      this.token = canvasConfig.khalilToken;
    } else {
      throw new Error(`Unknown student: ${studentName}`);
    }

    if (!this.baseUrl || !this.token) {
      throw new Error(`Canvas configuration missing for ${studentName} (instance ${instanceNumber})`);
    }
  }

  // Rate limiting: Track request timestamps
  private lastRequestTime = 0;
  private readonly REQUEST_DELAY_MS = 100; // 10 requests per second max

  private async makeRequest<T>(endpoint: string, retries = 3): Promise<T> {
    // Ensure baseUrl starts with https:// and remove trailing slash
    let baseUrl = this.baseUrl;
    if (!baseUrl.startsWith('https://') && !baseUrl.startsWith('http://')) {
      baseUrl = `https://${baseUrl}`;
    }
    // Remove trailing slash to prevent double slashes in URL construction
    baseUrl = baseUrl.replace(/\/$/, '');
    const url = `${baseUrl}/api/v1${endpoint}`;
    
    // Rate limiting: Ensure minimum delay between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.REQUEST_DELAY_MS) {
      await new Promise(resolve => setTimeout(resolve, this.REQUEST_DELAY_MS - timeSinceLastRequest));
    }
    this.lastRequestTime = Date.now();

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Create AbortController for request timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          // Rate limit handling: wait and retry for 429 status
          if (response.status === 429 && attempt < retries) {
            const retryAfter = response.headers.get('Retry-After');
            const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
            logger.warn('Canvas', `API rate limited, retrying in ${delayMs}ms`, { attempt, retries, url });
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }
          
          // Server error handling: retry with exponential backoff
          if (response.status >= 500 && attempt < retries) {
            const delayMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
            logger.warn('Canvas', `API server error ${response.status}, retrying in ${delayMs}ms`, { attempt, retries, url });
            await new Promise(resolve => setTimeout(resolve, delayMs));
            continue;
          }

          throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
      } catch (error: any) {
        // Handle timeout and network errors
        if (error.name === 'AbortError') {
          if (attempt < retries) {
            logger.warn('Canvas', 'API timeout, retrying', { attempt, retries, url });
            await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
            continue;
          }
          throw new Error('Canvas API request timed out after 30 seconds');
        }
        
        // Network error handling: retry with exponential backoff
        if (attempt < retries && (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT')) {
          const delayMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          logger.warn('Canvas', `API network error, retrying in ${delayMs}ms`, { attempt, retries, url, error: error.message });
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
        
        // Final attempt or non-retryable error
        if (attempt === retries) {
          logger.error('Canvas', 'API request failed after all retries', { url, error: error.message });
          throw error;
        }
      }
    }
    
    throw new Error('Canvas API request failed: Max retries exceeded');
  }

  async getCourses(): Promise<CanvasCourse[]> {
    return this.makeRequest<CanvasCourse[]>('/courses?enrollment_state=active');
  }

  async getAssignments(courseId?: number): Promise<CanvasAssignment[]> {
    if (courseId) {
      // Add pagination support for individual courses
      return this.makeRequest<CanvasAssignment[]>(`/courses/${courseId}/assignments?per_page=100`);
    } else {
      // Get assignments from all courses with pagination
      const courses = await this.getCourses();
      const allAssignments: CanvasAssignment[] = [];
      
      console.log(`📚 Found ${courses.length} active courses`);
      
      for (const course of courses) {
        // Skip TEXTBOOK courses as they contain only reference material, not actual assignments
        // EXCEPTION: Allow Apologia course (570) for forensics textbook readings
        if (course.name.toUpperCase().includes('TEXTBOOK') && parseInt(course.id.toString()) !== 570) {
          console.log(`  📖 Skipping TEXTBOOK course: "${course.name}" (ID: ${course.id}) - reference material only`);
          continue;
        }
        
        // Special logging for the Apologia textbook course
        if (parseInt(course.id.toString()) === 570) {
          console.log(`  📚 APOLOGIA TEXTBOOK: Processing course "${course.name}" (ID: ${course.id}) for forensics readings`);
        }
        
        try {
          // Fetch assignments AND modules for comprehensive timing data
          const [assignments, modules] = await Promise.all([
            this.makeRequest<CanvasAssignment[]>(
              `/courses/${course.id}/assignments?per_page=50&include[]=all_dates&include[]=submission&include[]=assignment_group&include[]=overrides&include[]=assessment_question_bank&include[]=discussion_topic&include[]=module_items&order_by=due_at`
            ),
            this.makeRequest<any[]>(`/courses/${course.id}/modules?per_page=50`)
          ]);
          
          console.log(`  📖 Course "${course.name}" (${course.id}): ${assignments.length} assignments, ${modules.length} modules`);
          
          // Create module lookup for timing resolution
          const moduleMap = new Map();
          modules.forEach(module => {
            moduleMap.set(module.id, module);
            
            // Also create name-based lookup for module references in assignment titles
            const moduleNumber = this.extractModuleNumber(module.name);
            if (moduleNumber) {
              moduleMap.set(`module_${moduleNumber}`, module);
            }
          });
          
          // NEW: Also fetch module items to include educational content (Pages, Videos, etc.)
          const moduleItems: any[] = [];
          for (const module of modules) {
            try {
              const items = await this.makeRequest<any[]>(`/courses/${course.id}/modules/${module.id}/items?per_page=100`);
              // Filter for educational content that should be treated as assignments
              const educationalItems = items.filter(item => {
                // For Apologia textbook course (570): Include ALL pages as they are textbook readings
                if (course.id === 570 && item.type === 'Page') {
                  return true;
                }
                
                // For other courses: Use selective filtering
                return (item.type === 'Page' && (
                  item.title?.toLowerCase().includes('video') ||
                  item.title?.toLowerCase().includes('pre-class') ||
                  item.title?.toLowerCase().includes('lesson') ||
                  item.title?.toLowerCase().includes('lecture') ||
                  item.title?.toLowerCase().includes('tutorial')
                )) ||
                (item.type === 'ExternalUrl' && (
                  item.title?.toLowerCase().includes('video') ||
                  item.title?.toLowerCase().includes('lesson')
                ))
              });
              moduleItems.push(...educationalItems.map(item => ({
                ...item,
                course_id: course.id,
                courseName: course.name,
                module_id: module.id,
                module_name: module.name
              })));
            } catch (error) {
              console.warn(`Failed to fetch items for module ${module.id}:`, error);
            }
          }
          
          console.log(`  📺 Found ${moduleItems.length} educational module items in "${course.name}"`);
          
          // Convert module items to assignment-like objects
          const moduleItemAssignments = moduleItems.map(item => ({
            id: parseInt(`9999${item.id}`, 10), // Convert to number ID with prefix to avoid conflicts
            name: item.title,
            description: `Educational content from module: ${item.module_name}`,
            due_at: undefined, // Module items typically don't have due dates
            unlock_at: undefined,
            lock_at: undefined,
            course_id: item.course_id,
            courseName: item.courseName,
            submission_types: ['none'], // These are typically for viewing/studying
            canvas_category: 'assignments' as const,
            is_recurring: false,
            academic_year: this.determineAcademicYear({ created_at: null, name: item.title } as any, course),
            // Canvas assignment fields
            html_url: item.html_url,
            external_url: item.external_url,
            workflow_state: 'published',
            created_at: undefined,
            updated_at: undefined,
            points_possible: undefined
          } as CanvasAssignment));

          // Combine regular assignments with module item assignments
          const allCourseAssignments = [...assignments, ...moduleItemAssignments];

          // Enhance assignments with comprehensive metadata including module timing
          const assignmentsWithMetadata = await Promise.all(allCourseAssignments.map(async assignment => {
            const enhanced = {
              ...assignment,
              courseName: course.name,
              course_id: course.id,  // CRITICAL: Add course ID for Canvas URL generation
              course_start_date: course.start_at,
              course_end_date: course.end_at,
              // Determine Canvas category based on assignment group or submission types
              canvas_category: this.determineCanvasCategory(assignment),
              // Detect if this is a recurring assignment
              is_recurring: this.isRecurringAssignment(assignment),
              // Determine academic year from course or assignment dates
              academic_year: this.determineAcademicYear(assignment, course)
            };
            
            // CRITICAL: Extract module timing when assignment timing is missing (skip for textbook items)
            const isTextbookItem = enhanced.id > 9999000; // Module items have IDs starting with 9999
            if (!isTextbookItem && !enhanced.due_at && !enhanced.unlock_at && !enhanced.lock_at) {
              const moduleData = this.findModuleForAssignment(enhanced, moduleMap);
              if (moduleData) {
                console.log(`🔗 "${enhanced.name}" linked to module: "${moduleData.name}" (unlock: ${moduleData.unlock_at})`);
                // Add module data for assignments with timing
              } else {
                // NEW: Smart fallback for assignments without dates
                console.log(`⚠️ "${enhanced.name}" has no Canvas dates and no module timing - applying smart fallback`);
                
                // For quizzes, try to infer from related assignments
                if (enhanced.name.toLowerCase().includes('quiz')) {
                  const relatedAssignments = assignments.filter(a => 
                    a.name.toLowerCase().includes('module') && 
                    enhanced.name.toLowerCase().includes('module') &&
                    a.due_at // Only consider assignments with actual dates
                  );
                  
                  if (relatedAssignments.length > 0) {
                    // Use the earliest related assignment's due date as reference
                    const earliestDate = relatedAssignments
                      .map(a => new Date(a.due_at))
                      .sort((a, b) => a.getTime() - b.getTime())[0];
                    
                    // Set quiz to be due one day before the related assignment
                    const suggestedDate = new Date(earliestDate);
                    suggestedDate.setDate(suggestedDate.getDate() - 1);
                    
                    enhanced.suggested_due_date = suggestedDate.toISOString();
                    console.log(`💡 "${enhanced.name}" suggested due date: ${suggestedDate.toISOString().split('T')[0]} (1 day before related assignment)`);
                  }
                }
              }
            }
            
            // Add TEXTBOOK links if this is a Forensic Science assignment (skip for module items)
            if (!enhanced.is_module_item && course.name.includes('Forensic Science') && !course.name.includes('TEXTBOOK')) {
              enhanced.textbook_links = await this.findTextbookLinks(enhanced);
            }
            
            return enhanced;
          }));
          
          allAssignments.push(...assignmentsWithMetadata);
        } catch (error) {
          console.warn(`Failed to get assignments for course ${course.id} (${course.name}):`, error);
        }
      }
      
      console.log(`📊 Total assignments across all courses: ${allAssignments.length}`);
      return allAssignments;
    }
  }

  async getUpcomingAssignments(daysAhead: number = 7): Promise<CanvasAssignment[]> {
    const assignments = await this.getAssignments();
    const now = new Date();
    const future = new Date();
    future.setDate(now.getDate() + daysAhead);

    return assignments.filter(assignment => {
      if (!assignment.due_at) return false;
      const dueDate = new Date(assignment.due_at);
      return dueDate >= now && dueDate <= future;
    });
  }

  /**
   * Determine Canvas assignment category based on metadata
   */
  private determineCanvasCategory(assignment: CanvasAssignment): 'assignments' | 'discussions' | 'quizzes' | 'syllabus' | 'other' {
    const name = assignment.name.toLowerCase();
    const groupName = assignment.assignment_group?.name?.toLowerCase() || '';
    
    // Check assignment group name first (most reliable)
    if (groupName.includes('syllabus') || groupName.includes('course info')) {
      return 'syllabus';
    }
    if (groupName.includes('discussion') || groupName.includes('forum')) {
      return 'discussions';
    }
    if (groupName.includes('quiz') || groupName.includes('test') || groupName.includes('exam')) {
      return 'quizzes';
    }
    
    // Check submission types
    if (assignment.submission_types?.includes('discussion_topic')) {
      return 'discussions';
    }
    if (assignment.submission_types?.includes('online_quiz')) {
      return 'quizzes';
    }
    
    // Check assignment name patterns
    if (name.includes('syllabus') || name.includes('honor code') || name.includes('fee')) {
      return 'syllabus';
    }
    if (name.includes('discussion') || name.includes('forum') || name.includes('post')) {
      return 'discussions';
    }
    if (name.includes('quiz') || name.includes('test') || name.includes('exam')) {
      return 'quizzes';
    }
    
    // Default to assignments
    return 'assignments';
  }

  /**
   * Detect if assignment is recurring (like attendance, participation)
   */
  private isRecurringAssignment(assignment: CanvasAssignment): boolean {
    const name = assignment.name.toLowerCase();
    const description = assignment.description?.toLowerCase() || '';
    
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
    
    return recurringPatterns.some(pattern => 
      name.includes(pattern) || description.includes(pattern)
    );
  }

  /**
   * Determine academic year from assignment/course data
   */
  private determineAcademicYear(assignment: CanvasAssignment, course: CanvasCourse): string {
    const currentYear = new Date().getFullYear();
    
    // Try to extract year from course name
    const courseNameMatch = course.name.match(/(\d{2})\/(\d{2})/);
    if (courseNameMatch) {
      const startYear = parseInt(`20${courseNameMatch[1]}`, 10);
      const endYear = parseInt(`20${courseNameMatch[2]}`, 10);
      return `${startYear}-${endYear}`;
    }
    
    // Try course start date
    if (course.start_at) {
      const courseStart = new Date(course.start_at);
      const academicYearStart = courseStart.getFullYear();
      return `${academicYearStart}-${academicYearStart + 1}`;
    }
    
    // Try assignment creation date
    if (assignment.created_at) {
      const assignmentYear = new Date(assignment.created_at).getFullYear();
      return `${assignmentYear}-${assignmentYear + 1}`;
    }
    
    // Default to current academic year
    const isFirstHalf = new Date().getMonth() < 6; // Before July
    const academicStart = isFirstHalf ? currentYear - 1 : currentYear;
    return `${academicStart}-${academicStart + 1}`;
  }

  /**
   * Extract module number from module name (e.g., "Module 1" -> 1)
   */
  private extractModuleNumber(moduleName: string): number | null {
    const match = moduleName.match(/module\s+(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Find and link to relevant TEXTBOOK resources based on assignment content
   */
  private async findTextbookLinks(assignment: CanvasAssignment): Promise<TextbookLink[]> {
    try {
      // For instance 2 (Forensic Science), look for TEXTBOOK course ID 570
      if (this.token === canvasConfig.abigailToken2) {
        const textbookCourseId = 570;
        
        // Get TEXTBOOK modules (pages API has access issues, focus on modules)
        const modules = await this.makeRequest<any[]>(`/courses/${textbookCourseId}/modules?per_page=50`);
        
        const links: TextbookLink[] = [];
        const assignmentText = `${assignment.name} ${assignment.description || ''}`.toLowerCase();
        
        // Detect module references (Module 1, Module 2, etc.)
        const moduleMatch = assignmentText.match(/module\s*(\d+)/i);
        if (moduleMatch) {
          const moduleNum = parseInt(moduleMatch[1]);
          const matchingModule = modules.find(m => m.name.toLowerCase().includes(`module ${moduleNum}`));
          if (matchingModule) {
            links.push({
              title: matchingModule.name,
              url: `https://apologia.instructure.com/courses/${textbookCourseId}/modules/${matchingModule.id}`,
              module_name: matchingModule.name,
              page_type: 'module'
            });
          }
        }
        
        // Detect topic references in module names
        const topicKeywords = [
          'criminal law', 'civil law', 'evidence', 'witnesses', 'testimony', 
          'fingerprints', 'legal system', 'trace evidence', 'toxicology'
        ];
        
        for (const keyword of topicKeywords) {
          if (assignmentText.includes(keyword)) {
            const matchingModule = modules.find(m => 
              m.name.toLowerCase().includes(keyword)
            );
            if (matchingModule && !links.find(l => l.title === matchingModule.name)) {
              links.push({
                title: matchingModule.name,
                url: `https://apologia.instructure.com/courses/${textbookCourseId}/modules/${matchingModule.id}`,
                module_name: matchingModule.name,
                page_type: 'module'
              });
            }
          }
        }
        
        if (links.length > 0) {
          console.log(`🔗 Found ${links.length} TEXTBOOK links for "${assignment.name}": ${links.map(l => l.title).join(', ')}`);
        }
        
        return links;
      }
      
      return [];
    } catch (error) {
      console.warn('Failed to fetch TEXTBOOK links:', error);
      return [];
    }
  }

  /**
   * Find associated module data for assignment based on title references
   */
  private findModuleForAssignment(assignment: CanvasAssignment, moduleMap: Map<any, any>): any | null {
    const title = assignment.name.toLowerCase();
    
    // Look for "Module X" patterns in assignment title
    const moduleMatch = title.match(/module\s+(\d+)/i);
    if (moduleMatch) {
      const moduleNumber = parseInt(moduleMatch[1], 10);
      const moduleData = moduleMap.get(`module_${moduleNumber}`);
      if (moduleData) {
        return moduleData;
      }
    }
    
    // Look for other module indicators
    if (title.includes('module') && title.match(/\d+/)) {
      // Try to find any module that might be related
      const numbers = title.match(/\d+/g);
      if (numbers) {
        for (const num of numbers) {
          const moduleData = moduleMap.get(`module_${parseInt(num, 10)}`);
          if (moduleData) {
            return moduleData;
          }
        }
      }
    }
    
    return null;
  }
  
  /**
   * Fetch individual student submissions with actual grades for all assignments
   * This checks the actual gradebook data instead of just aggregate flags
   */
  async getAssignmentsWithSubmissions(): Promise<CanvasAssignment[]> {
    try {
      const courses = await this.getCourses();
      const allAssignmentsWithGrades: CanvasAssignment[] = [];
      
      console.log(`🎯 Fetching individual grades for ${courses.length} courses`);
      
      for (const course of courses) {
        // Skip TEXTBOOK courses
        if (course.name.toUpperCase().includes('TEXTBOOK')) {
          continue;
        }
        
        try {
          // Fetch assignments with submission data included
          const assignments = await this.makeRequest<CanvasAssignment[]>(
            `/courses/${course.id}/assignments?per_page=100&include[]=submission`
          );
          
          // Add course name to each assignment
          const assignmentsWithCourse = assignments.map(assignment => ({
            ...assignment,
            courseName: course.name,
            course_id: course.id
          }));
          
          allAssignmentsWithGrades.push(...assignmentsWithCourse);
          console.log(`  📊 Course "${course.name}": ${assignments.length} assignments with submission data`);
          
        } catch (error) {
          console.error(`Failed to fetch grades for course ${course.name}:`, error);
        }
      }
      
      console.log(`✅ Retrieved ${allAssignmentsWithGrades.length} assignments with grade data`);
      return allAssignmentsWithGrades;
      
    } catch (error) {
      console.error('Failed to fetch assignments with submissions:', error);
      return [];
    }
  }
}

// Helper function to get Canvas client for a student
export function getCanvasClient(studentName: string, instanceNumber: number = 1): CanvasClient {
  return new CanvasClient(studentName, instanceNumber);
}

// Multi-instance support for Abigail (who has two Canvas accounts)
export async function getAllAssignmentsForStudent(studentName: string): Promise<{
  instance1: CanvasAssignment[];
  instance2?: CanvasAssignment[];
}> {
  const result: { instance1: CanvasAssignment[]; instance2?: CanvasAssignment[] } = {
    instance1: []
  };

  try {
    const client1 = getCanvasClient(studentName, 1);
    // Get ALL assignments, not just upcoming ones - this is the key fix!
    result.instance1 = await client1.getAssignments();
    console.log(`✅ Canvas Instance 1: Retrieved ${result.instance1.length} assignments for ${studentName}`);
  } catch (error) {
    console.error(`Failed to get assignments from Canvas instance 1 for ${studentName}:`, error);
  }

  // Check if Abigail has a second Canvas instance
  if (studentName.toLowerCase() === 'abigail' && canvasConfig.abigailToken2 && canvasConfig.baseUrl2) {
    try {
      const client2 = getCanvasClient(studentName, 2);
      // Get ALL assignments from instance 2 as well
      result.instance2 = await client2.getAssignments();
      console.log(`✅ Apologia: Retrieved ${result.instance2?.length || 0} assignments for ${studentName}`);
    } catch (error) {
      console.error(`Failed to get assignments from Apologia for ${studentName}:`, error);
      result.instance2 = [];
    }
  }

  const totalCount = result.instance1.length + (result.instance2?.length || 0);
  console.log(`📊 Total Canvas assignments for ${studentName}: ${totalCount}`);
  return result;
}