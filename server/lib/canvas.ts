import { canvasConfig } from './supabase';

export interface CanvasAssignment {
  id: number;
  name: string;
  description?: string;
  due_at?: string;
  course_id: number;
  submission_types: string[];
  points_possible?: number;
}

export interface CanvasCourse {
  id: number;
  name: string;
  course_code?: string;
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

  private async makeRequest<T>(endpoint: string): Promise<T> {
    // Ensure baseUrl starts with https://
    let baseUrl = this.baseUrl;
    if (!baseUrl.startsWith('https://') && !baseUrl.startsWith('http://')) {
      baseUrl = `https://${baseUrl}`;
    }
    const url = `${baseUrl}/api/v1${endpoint}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Canvas API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Canvas API request failed:', { url, error });
      throw error;
    }
  }

  async getCourses(): Promise<CanvasCourse[]> {
    return this.makeRequest<CanvasCourse[]>('/courses?enrollment_state=active');
  }

  async getAssignments(courseId?: number): Promise<CanvasAssignment[]> {
    if (courseId) {
      return this.makeRequest<CanvasAssignment[]>(`/courses/${courseId}/assignments`);
    } else {
      // Get assignments from all courses
      const courses = await this.getCourses();
      const allAssignments: CanvasAssignment[] = [];
      
      for (const course of courses) {
        try {
          const assignments = await this.makeRequest<CanvasAssignment[]>(`/courses/${course.id}/assignments`);
          allAssignments.push(...assignments);
        } catch (error) {
          console.warn(`Failed to get assignments for course ${course.id}:`, error);
        }
      }
      
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
    result.instance1 = await client1.getUpcomingAssignments();
  } catch (error) {
    console.error(`Failed to get assignments from Canvas instance 1 for ${studentName}:`, error);
  }

  // Check if Abigail has a second Canvas instance
  if (studentName.toLowerCase() === 'abigail' && canvasConfig.abigailToken2 && canvasConfig.baseUrl2) {
    try {
      const client2 = getCanvasClient(studentName, 2);
      result.instance2 = await client2.getUpcomingAssignments();
    } catch (error) {
      console.error(`Failed to get assignments from Canvas instance 2 for ${studentName}:`, error);
      result.instance2 = [];
    }
  }

  return result;
}