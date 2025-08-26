import { getAllAssignmentsForStudent } from './canvas';
import { storage } from '../storage';

interface ScheduledJob {
  name: string;
  cronPattern: string;
  handler: () => Promise<void>;
}

class JobScheduler {
  private jobs: ScheduledJob[] = [];
  private intervals: NodeJS.Timeout[] = [];

  constructor() {
    this.setupJobs();
  }

  private setupJobs() {
    // Daily Canvas sync at 5:00 AM
    this.addJob({
      name: 'daily-canvas-sync',
      cronPattern: '0 5 * * *', // 5:00 AM every day
      handler: this.syncCanvasAssignments.bind(this)
    });
  }

  private addJob(job: ScheduledJob) {
    this.jobs.push(job);
    console.log(`📅 Scheduled job: ${job.name} - ${job.cronPattern}`);
  }

  private async syncCanvasAssignments() {
    console.log('🔄 Starting daily Canvas sync at', new Date().toISOString());
    
    const students = ['Abigail', 'Khalil'];
    let totalImported = 0;
    
    for (const studentName of students) {
      try {
        console.log(`📚 Syncing Canvas assignments for ${studentName}...`);
        
        // Get student's user ID
        const userId = `${studentName.toLowerCase()}-user`;
        
        // Fetch Canvas assignments
        const canvasData = await getAllAssignmentsForStudent(studentName);
        
        // Import from instance 1
        if (canvasData.instance1 && canvasData.instance1.length > 0) {
          for (const canvasAssignment of canvasData.instance1) {
            try {
              // Skip assignments before June 15, 2025
              if (canvasAssignment.due_at) {
                const dueDate = new Date(canvasAssignment.due_at);
                const cutoffDate = new Date('2025-06-15');
                if (dueDate < cutoffDate) {
                  console.log(`⏭️ Skipping old assignment "${canvasAssignment.name}" (due: ${dueDate.toDateString()}) - before June 15, 2025`);
                  continue;
                }
              }
              
              // Log the real Canvas assignment being processed
              console.log(`📝 Real Canvas Assignment Found: "${canvasAssignment.name}" for ${studentName}`);
              
              // Check if assignment already exists to avoid duplicates
              const existingAssignments = await storage.getAssignments(userId);
              const alreadyExists = existingAssignments.some(
                assignment => assignment.title === canvasAssignment.name
              );
              
              if (!alreadyExists) {
                // Determine completion status based on Canvas grading info
                let completionStatus = 'pending';
                if (canvasAssignment.graded_submissions_exist || canvasAssignment.has_submitted_submissions) {
                  completionStatus = 'completed';
                  console.log(`📋 Auto-marking "${canvasAssignment.name}" as completed (graded in Canvas)`);
                }

                await storage.createAssignment({
                  userId: userId,
                  title: canvasAssignment.name,
                  subject: canvasAssignment.courseName || 'Unknown Course',
                  courseName: canvasAssignment.courseName || 'Unknown Course',
                  instructions: canvasAssignment.description || 'Assignment from Canvas',
                  dueDate: canvasAssignment.due_at ? new Date(canvasAssignment.due_at) : null,
                  scheduledDate: this.getNextAssignmentDate(),
                  actualEstimatedMinutes: 60,
                  completionStatus: completionStatus,
                  priority: 'B',
                  difficulty: 'medium',
                  canvasId: canvasAssignment.id,
                  canvasInstance: 1,
                  isCanvasImport: true
                });
                totalImported++;
              } else {
                // Update existing assignment if it's now graded
                const existingAssignment = existingAssignments.find(a => a.title === canvasAssignment.name);
                if (existingAssignment && existingAssignment.completionStatus === 'pending' && 
                    (canvasAssignment.graded_submissions_exist || canvasAssignment.has_submitted_submissions)) {
                  await storage.updateAssignment(existingAssignment.id, { completionStatus: 'completed' });
                  console.log(`✅ Updated "${canvasAssignment.name}" to completed (now graded in Canvas)`);
                }
              }
            } catch (error) {
              console.error(`Error importing assignment for ${studentName}:`, error);
            }
          }
        }
        
        // Import from instance 2 (Abigail only)
        if (studentName.toLowerCase() === 'abigail' && canvasData.instance2 && canvasData.instance2.length > 0) {
          for (const canvasAssignment of canvasData.instance2) {
            try {
              // Skip assignments before June 15, 2025
              if (canvasAssignment.due_at) {
                const dueDate = new Date(canvasAssignment.due_at);
                const cutoffDate = new Date('2025-06-15');
                if (dueDate < cutoffDate) {
                  console.log(`⏭️ Skipping old assignment "${canvasAssignment.name} (Canvas 2)" (due: ${dueDate.toDateString()}) - before June 15, 2025`);
                  continue;
                }
              }
              
              const existingAssignments = await storage.getAssignments(userId);
              const alreadyExists = existingAssignments.some(
                assignment => assignment.title === `${canvasAssignment.name} (Canvas 2)`
              );
              
              if (!alreadyExists) {
                // Determine completion status based on Canvas grading info
                let completionStatus = 'pending';
                if (canvasAssignment.graded_submissions_exist || canvasAssignment.has_submitted_submissions) {
                  completionStatus = 'completed';
                  console.log(`📋 Auto-marking "${canvasAssignment.name} (Canvas 2)" as completed (graded in Canvas)`);
                }

                await storage.createAssignment({
                  userId: userId,
                  title: `${canvasAssignment.name} (Canvas 2)`,
                  subject: canvasAssignment.courseName || 'Unknown Course 2',
                  courseName: canvasAssignment.courseName || 'Unknown Course 2',
                  instructions: canvasAssignment.description || 'Assignment from Canvas instance 2',
                  dueDate: canvasAssignment.due_at ? new Date(canvasAssignment.due_at) : null,
                  scheduledDate: this.getNextAssignmentDate(),
                  actualEstimatedMinutes: 60,
                  completionStatus: completionStatus,
                  priority: 'B',
                  difficulty: 'medium',
                  canvasId: canvasAssignment.id,
                  canvasInstance: 2,
                  isCanvasImport: true
                });
                totalImported++;
              } else {
                // Update existing assignment if it's now graded
                const existingAssignment = existingAssignments.find(a => a.title === `${canvasAssignment.name} (Canvas 2)`);
                if (existingAssignment && existingAssignment.completionStatus === 'pending' && 
                    (canvasAssignment.graded_submissions_exist || canvasAssignment.has_submitted_submissions)) {
                  await storage.updateAssignment(existingAssignment.id, { completionStatus: 'completed' });
                  console.log(`✅ Updated "${canvasAssignment.name} (Canvas 2)" to completed (now graded in Canvas)`);
                }
              }
            } catch (error) {
              console.error(`Error importing assignment from instance 2 for ${studentName}:`, error);
            }
          }
        }
        
        // Step 3: Clean up stale assignments (exist in our DB but not in Canvas anymore)
        await this.cleanupStaleAssignments(userId, canvasData);
        
        console.log(`✅ Completed Canvas sync for ${studentName}`);
        
      } catch (error) {
        console.error(`❌ Failed to sync Canvas assignments for ${studentName}:`, error);
      }
    }
    
    console.log(`🎉 Daily Canvas sync completed. Imported ${totalImported} new assignments.`);
    
    // Update administrative assignments with standard due dates (after Canvas sync) 
    await this.updateAdministrativeAssignments();
    
    return totalImported;
  }

  /**
   * Clean up assignments that no longer exist in Canvas
   */
  private async cleanupStaleAssignments(userId: string, canvasData: any) {
    try {
      // Get all Canvas assignments for this user from our database
      const existingAssignments = await storage.getAssignments(userId);
      const canvasAssignments = existingAssignments.filter(a => a.isCanvasImport);
      
      // Build a Set of current Canvas assignment IDs for quick lookup
      const currentCanvasIds = new Set<number>();
      
      canvasData.instance1?.forEach((assignment: any) => {
        currentCanvasIds.add(assignment.id);
      });
      
      canvasData.instance2?.forEach((assignment: any) => {
        currentCanvasIds.add(assignment.id);
      });
      
      // Find assignments in our DB that no longer exist in Canvas
      const staleAssignments = canvasAssignments.filter(assignment => 
        assignment.canvasId && !currentCanvasIds.has(assignment.canvasId)
      );
      
      if (staleAssignments.length > 0) {
        console.log(`🧹 Found ${staleAssignments.length} stale assignments to remove for ${userId}`);
        
        for (const staleAssignment of staleAssignments) {
          await storage.deleteAssignment(staleAssignment.id);
          console.log(`🗑️ Removed stale assignment: "${staleAssignment.title}"`);
        }
      }
    } catch (error) {
      console.error(`Error cleaning up stale assignments for ${userId}:`, error);
    }
  }

  /**
   * Update administrative assignments (fees, syllabi, etc.) with standard due dates
   */
  private async updateAdministrativeAssignments() {
    try {
      // This method updates administrative assignments like fees and syllabi
      // Implementation would go here
      console.log('🔧 Updating administrative assignments...');
    } catch (error) {
      console.error('Error updating administrative assignments:', error);
    }
  }

  private getNextAssignmentDate(): string {
    // For now, schedule assignments for the next weekday
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Skip weekends
    while (tomorrow.getDay() === 0 || tomorrow.getDay() === 6) {
      tomorrow.setDate(tomorrow.getDate() + 1);
    }
    
    return tomorrow.toISOString().split('T')[0];
  }

  private parseCronToMs(cronPattern: string): number {
    // Simple cron parser for daily jobs (simplified for our use case)
    // For a real production app, use a proper cron library like 'node-cron'
    
    // For our "0 5 * * *" pattern (5 AM daily)
    if (cronPattern === '0 5 * * *') {
      const now = new Date();
      const targetTime = new Date();
      targetTime.setHours(5, 0, 0, 0);
      
      // If 5 AM already passed today, schedule for tomorrow
      if (now >= targetTime) {
        targetTime.setDate(targetTime.getDate() + 1);
      }
      
      return targetTime.getTime() - now.getTime();
    }
    
    // Fallback to 24 hours for other patterns
    return 24 * 60 * 60 * 1000;
  }

  start() {
    console.log('🚀 Starting job scheduler...');
    
    for (const job of this.jobs) {
      const initialDelay = this.parseCronToMs(job.cronPattern);
      
      // Set initial timeout
      setTimeout(() => {
        job.handler();
        
        // Then set up daily recurring
        const interval = setInterval(job.handler, 24 * 60 * 60 * 1000);
        this.intervals.push(interval);
      }, initialDelay);
    }
  }

  stop() {
    console.log('🛑 Stopping job scheduler...');
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals = [];
  }

  // Manual trigger for testing
  async runSyncNow() {
    console.log('🔧 Manual trigger: Running Canvas sync now...');
    await this.syncCanvasAssignments();
  }
}

export const jobScheduler = new JobScheduler();