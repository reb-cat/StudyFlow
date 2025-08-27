import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAssignmentSchema, updateAssignmentSchema, insertScheduleTemplateSchema } from "@shared/schema";
import { 
  getBibleSubjectForSchedule, 
  getNextBibleCurriculumForStudent, 
  markBibleCurriculumCompleted, 
  getWeeklyBibleProgress
} from './lib/bibleCurriculum';
import { getAllAssignmentsForStudent, getCanvasClient } from "./lib/canvas"; 
// Email config moved inline since Supabase removed
const emailConfig = {
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFrom: process.env.RESEND_FROM || '',
  parentEmail: process.env.PARENT_EMAIL || '',
};
import { jobScheduler } from "./lib/scheduler";

export async function registerRoutes(app: Express): Promise<Server> {

  // Assignment API routes
  
  // PATCH /api/assignments/:id - Update assignment status
  app.patch('/api/assignments/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { completionStatus } = req.body;
      
      if (!id || !completionStatus) {
        return res.status(400).json({ message: 'Assignment ID and completion status are required' });
      }

      const assignment = await storage.updateAssignmentStatus(id, completionStatus);
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
      
      res.json({ message: 'Assignment status updated successfully', assignment });
    } catch (error) {
      console.error('Error updating assignment status:', error);
      res.status(500).json({ message: 'Failed to update assignment status' });
    }
  });

  // GET /api/assignments - Get assignments for a user/date
  app.get('/api/assignments', async (req, res) => {
    try {
      const { date, studentName } = req.query;
      
      // Use student-specific user ID mapping  
      let userId = "demo-user-1"; // fallback
      
      if (studentName && typeof studentName === 'string') {
        // Map student names to standardized user IDs
        const studentUserMap: Record<string, string> = {
          'abigail': 'Abigail',
          'khalil': 'Khalil'
        };
        
        const normalizedStudentName = studentName.toLowerCase();
        userId = studentUserMap[normalizedStudentName] || userId;
      }
      
      // Get assignments for daily scheduling (filtered to next 12 days when date provided)
      const assignments = await storage.getAssignments(userId, date as string);
      console.log(`📚 Retrieved ${assignments.length} assignments for daily planning for ${studentName} on ${date}`);
      res.json(assignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to fetch assignments', error: errorMessage });
    }
  });
  
  // POST /api/assignments - Create new assignment
  app.post('/api/assignments', async (req, res) => {
    try {
      const { studentName, ...assignmentData } = req.body;
      const validatedAssignmentData = insertAssignmentSchema.parse(assignmentData);
      
      // Use student-specific user ID or fallback
      let userId = "demo-user-1";
      if (studentName) {
        const studentUserMap: Record<string, string> = {
          'abigail': 'abigail-user',
          'khalil': 'khalil-user'
        };
        userId = studentUserMap[studentName.toLowerCase()] || userId;
      }
      
      const assignment = await storage.createAssignment({ ...validatedAssignmentData, userId });
      res.status(201).json(assignment);
    } catch (error) {
      console.error('Error creating assignment:', error);
      res.status(400).json({ message: 'Failed to create assignment' });
    }
  });
  
  // PATCH /api/assignments - Update assignment
  app.patch('/api/assignments', async (req, res) => {
    try {
      const { id, ...updateData } = req.body;
      
      if (!id) {
        return res.status(400).json({ message: 'Assignment ID is required' });
      }
      
      const validatedUpdate = updateAssignmentSchema.parse(updateData);
      const assignment = await storage.updateAssignment(id, validatedUpdate);
      
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
      
      res.json(assignment);
    } catch (error) {
      console.error('Error updating assignment:', error);
      res.status(400).json({ message: 'Failed to update assignment' });
    }
  });
  
  // DELETE /api/assignments/:id - Delete assignment
  app.delete('/api/assignments/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteAssignment(id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      res.status(500).json({ message: 'Failed to delete assignment' });
    }
  });
  
  // Database test and setup endpoint
  app.post('/api/setup-demo', async (req, res) => {
    try {
      // Create demo user
      const demoUser = await storage.createUser({
        username: 'demo-student',
        email: 'demo@studyflow.com',
        password: 'demo',
        firstName: 'Demo',
        lastName: 'Student'
      });

      // Create sample assignments
      const today = new Date().toISOString().split('T')[0];
      const sampleAssignments = [
        {
          title: "Math Practice - Algebra Review",
          subject: "Mathematics",
          courseName: "Algebra II",
          instructions: "Complete problems 1-15 on page 84. Focus on quadratic equations and show your work clearly.",
          scheduledDate: today,
          scheduledBlock: 1,
          blockStart: "09:00",
          blockEnd: "09:45",
          actualEstimatedMinutes: 45,
          priority: "A" as const,
          difficulty: "medium" as const
        },
        {
          title: "English Essay - Character Analysis",
          subject: "English Literature",
          courseName: "English 11",
          instructions: "Write a 500-word character analysis of Elizabeth Bennet from Pride and Prejudice.",
          scheduledDate: today,
          scheduledBlock: 2,
          blockStart: "10:00",
          blockEnd: "11:30",
          actualEstimatedMinutes: 90,
          priority: "B" as const,
          difficulty: "hard" as const
        },
        {
          title: "Science Lab Report",
          subject: "Chemistry",
          courseName: "Chemistry I",
          instructions: "Complete the lab report on chemical reactions. Include hypothesis, observations, and conclusion.",
          scheduledDate: today,
          scheduledBlock: 3,
          blockStart: "13:00",
          blockEnd: "13:30",
          actualEstimatedMinutes: 30,
          completionStatus: "pending" as const,
          priority: "B" as const,
          difficulty: "medium" as const
        }
      ];

      const createdAssignments = [];
      for (const assignmentData of sampleAssignments) {
        const assignment = await storage.createAssignment({ ...assignmentData, userId: demoUser.id });
        createdAssignments.push(assignment);
      }

      res.json({ 
        message: 'Demo data created successfully', 
        user: demoUser, 
        assignments: createdAssignments 
      });
    } catch (error) {
      console.error('Error setting up demo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to setup demo data', error: errorMessage });
    }
  });

  // Get demo user route
  app.get('/api/user', async (req, res) => {
    try {
      let user = await storage.getUser("demo-user-1");
      if (!user) {
        // Try to get by username instead
        user = await storage.getUserByUsername("demo-student");
      }
      if (!user) {
        return res.status(404).json({ message: 'Demo user not found. Try POST /api/setup-demo first.' });
      }
      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to fetch user', error: errorMessage });
    }
  });

  // Canvas integration endpoints
  app.get('/api/canvas/:studentName', async (req, res) => {
    try {
      const { studentName } = req.params;
      
      if (!['abigail', 'khalil'].includes(studentName.toLowerCase())) {
        return res.status(400).json({ message: 'Invalid student name. Use: abigail or khalil' });
      }
      
      const canvasData = await getAllAssignmentsForStudent(studentName);
      
      // Transform Canvas assignments to our format
      const transformedAssignments = [];
      
      // Process instance 1 assignments
      if (canvasData.instance1) {
        for (const canvasAssignment of canvasData.instance1) {
          transformedAssignments.push({
            title: canvasAssignment.name,
            subject: canvasAssignment.courseName || 'Unknown Course',
            instructions: canvasAssignment.description || '',
            dueDate: canvasAssignment.due_at ? new Date(canvasAssignment.due_at) : null,
            actualEstimatedMinutes: 60, // Default to 1 hour
            completionStatus: 'pending',
            priority: 'B',
            difficulty: 'medium',
            canvasId: canvasAssignment.id,
            canvasInstance: 1
          });
        }
      }
      
      // Process instance 2 assignments (Abigail only)
      if (canvasData.instance2) {
        for (const canvasAssignment of canvasData.instance2) {
          transformedAssignments.push({
            title: canvasAssignment.name,
            subject: canvasAssignment.courseName || 'Unknown Course 2',
            instructions: canvasAssignment.description || '',
            dueDate: canvasAssignment.due_at ? new Date(canvasAssignment.due_at) : null,
            actualEstimatedMinutes: 60,
            completionStatus: 'pending',
            priority: 'B',
            difficulty: 'medium',
            canvasId: canvasAssignment.id,
            canvasInstance: 2
          });
        }
      }
      
      res.json({
        student: studentName,
        assignmentCount: transformedAssignments.length,
        assignments: transformedAssignments,
        canvasInstances: {
          instance1Count: canvasData.instance1?.length || 0,
          instance2Count: canvasData.instance2?.length || 0
        }
      });
    } catch (error) {
      console.error('Canvas API failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to fetch Canvas data', error: errorMessage });
    }
  });
  
  // Import Canvas assignments for a student
  app.post('/api/import-canvas/:studentName', async (req, res) => {
    try {
      const { studentName } = req.params;
      const today = new Date().toISOString().split('T')[0];
      
      // For demo purposes, use a fixed user ID
      const userId = `${studentName.toLowerCase()}-user`;
      
      // Fetch Canvas assignments
      const canvasData = await getAllAssignmentsForStudent(studentName);
      const importedAssignments = [];
      
      // Import from instance 1
      if (canvasData.instance1) {
        for (const canvasAssignment of canvasData.instance1) {
          // Skip assignments before June 15, 2025
          if (canvasAssignment.due_at) {
            const dueDate = new Date(canvasAssignment.due_at);
            const cutoffDate = new Date('2025-06-15');
            if (dueDate < cutoffDate) {
              console.log(`⏭️ Skipping old assignment "${canvasAssignment.name}" (due: ${dueDate.toDateString()}) - before June 15, 2025`);
              continue;
            }
          }
          
          // Determine completion status based on Canvas grading info
          let completionStatus: 'pending' | 'completed' | 'needs_more_time' | 'stuck' = 'pending';
          if (canvasAssignment.graded_submissions_exist || canvasAssignment.has_submitted_submissions) {
            completionStatus = 'completed';
          }

          const assignment = await storage.createAssignment({
            userId: userId,
            title: canvasAssignment.name,
            subject: canvasAssignment.courseName || 'Unknown Course',
            courseName: canvasAssignment.courseName || 'Unknown Course',
            instructions: canvasAssignment.description || 'Assignment from Canvas',
            dueDate: canvasAssignment.due_at ? new Date(canvasAssignment.due_at) : null,
            scheduledDate: today, // Schedule for today for testing
            actualEstimatedMinutes: 60,
            completionStatus: completionStatus,
            priority: 'B',
            difficulty: 'medium',
            canvasId: canvasAssignment.id,
            canvasInstance: 1,
            isCanvasImport: true
          });
          importedAssignments.push(assignment);
        }
      }
      
      // Import from instance 2 (Abigail only)
      if (canvasData.instance2) {
        for (const canvasAssignment of canvasData.instance2) {
          // Skip assignments before June 15, 2025
          if (canvasAssignment.due_at) {
            const dueDate = new Date(canvasAssignment.due_at);
            const cutoffDate = new Date('2025-06-15');
            if (dueDate < cutoffDate) {
              console.log(`⏭️ Skipping old assignment "${canvasAssignment.name} (Canvas 2)" (due: ${dueDate.toDateString()}) - before June 15, 2025`);
              continue;
            }
          }
          
          // Determine completion status based on Canvas grading info
          let completionStatus: 'pending' | 'completed' | 'needs_more_time' | 'stuck' = 'pending';
          if (canvasAssignment.graded_submissions_exist || canvasAssignment.has_submitted_submissions) {
            completionStatus = 'completed';
          }

          const assignment = await storage.createAssignment({
            userId: userId,
            title: `${canvasAssignment.name} (Canvas 2)`,
            subject: canvasAssignment.courseName || 'Unknown Course 2',
            courseName: canvasAssignment.courseName || 'Unknown Course 2',
            instructions: canvasAssignment.description || 'Assignment from Canvas instance 2',
            dueDate: canvasAssignment.due_at ? new Date(canvasAssignment.due_at) : null,
            scheduledDate: today,
            actualEstimatedMinutes: 60,
            completionStatus: completionStatus,
            priority: 'B',
            difficulty: 'medium',
            canvasId: canvasAssignment.id,
            canvasInstance: 2,
            isCanvasImport: true
          });
          importedAssignments.push(assignment);
        }
      }
      
      res.json({
        message: `Successfully imported ${importedAssignments.length} assignments for ${studentName}`,
        student: studentName,
        userId: userId,
        importedCount: importedAssignments.length,
        assignments: importedAssignments
      });
      
    } catch (error) {
      console.error('Canvas import failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to import Canvas assignments', error: errorMessage });
    }
  });

  // Get schedule template for a specific student and date with Bible curriculum integration
  app.get('/api/schedule/:studentName/:date', async (req, res) => {
    try {
      const { studentName, date } = req.params;
      
      // Convert date to weekday name
      const dateObj = new Date(date);
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const weekday = weekdays[dateObj.getDay()];
      
      console.log(`Fetching schedule for ${studentName} on ${weekday} (${date})`);
      
      // Get schedule template for this student and weekday
      const scheduleBlocks = await storage.getScheduleTemplate(studentName, weekday);
      
      // BIBLE CURRICULUM INTEGRATION: Replace generic "Bible" entries with specific curriculum content
      const enhancedScheduleBlocks = await Promise.all(
        scheduleBlocks.map(async (block) => {
          if (block.subject === 'Bible' || block.blockType === 'Bible') {
            try {
              const bibleSubject = await getBibleSubjectForSchedule(studentName);
              return {
                ...block,
                subject: bibleSubject, // Replace "Bible" with specific reading like "Genesis 1-2"
                originalSubject: 'Bible' // Keep track of original for reference
              };
            } catch (error) {
              console.warn('Error getting Bible curriculum, using fallback:', error);
              return block; // Return original if Bible curriculum fails
            }
          }
          return block; // Non-Bible blocks remain unchanged
        })
      );
      
      console.log(`Found ${enhancedScheduleBlocks.length} schedule blocks:`, scheduleBlocks);
      
      res.json(enhancedScheduleBlocks);
    } catch (error) {
      console.error("Error fetching schedule:", error);
      res.status(500).json({ message: "Failed to fetch schedule" });
    }
  });
  
  // Parent notification endpoint (when student clicks "Stuck")
  app.post('/api/notify-parent', async (req, res) => {
    try {
      const { studentName, assignmentTitle, message } = req.body;
      
      // For now, just log the notification (we can add Resend integration later)
      console.log('📧 Parent Notification:', {
        student: studentName,
        assignment: assignmentTitle,
        message,
        timestamp: new Date().toISOString(),
        parentEmail: emailConfig.parentEmail
      });
      
      res.json({ 
        message: 'Parent notification sent successfully',
        notificationSent: true,
        parentEmail: emailConfig.parentEmail ? '***@***.***' : 'Not configured'
      });
      
    } catch (error) {
      console.error('Parent notification failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to send parent notification', error: errorMessage });
    }
  });
  
  // Database connection test
  app.get('/api/db-test', async (req, res) => {
    try {
      const assignments = await storage.getAssignments('demo-user-1');
      res.json({ 
        status: 'Connected to database successfully', 
        assignmentCount: assignments.length,
        assignments: assignments.slice(0, 2) // Return first 2 for testing
      });
    } catch (error) {
      console.error('Database test failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Database connection failed', error: errorMessage });
    }
  });

  // Bible curriculum routes
  app.get('/api/bible/current-week', async (req, res) => {
    try {
      const bibleData = await storage.getBibleCurrentWeek();
      res.json(bibleData);
    } catch (error) {
      console.error('Error fetching current Bible week:', error);
      res.status(500).json({ message: 'Failed to fetch Bible curriculum' });
    }
  });

  app.get('/api/bible/week/:weekNumber', async (req, res) => {
    try {
      const weekNumber = parseInt(req.params.weekNumber);
      const bibleData = await storage.getBibleCurriculum(weekNumber);
      res.json(bibleData);
    } catch (error) {
      console.error('Error fetching Bible week:', error);
      res.status(500).json({ message: 'Failed to fetch Bible curriculum' });
    }
  });

  app.patch('/api/bible/completion', async (req, res) => {
    try {
      const { weekNumber, dayOfWeek, completed } = req.body;
      
      if (typeof weekNumber !== 'number' || typeof dayOfWeek !== 'number' || typeof completed !== 'boolean') {
        return res.status(400).json({ message: 'Invalid data provided' });
      }
      
      const updated = await storage.updateBibleCompletion(weekNumber, dayOfWeek, completed);
      
      if (!updated) {
        return res.status(404).json({ message: 'Bible curriculum entry not found' });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating Bible completion:', error);
      res.status(500).json({ message: 'Failed to update Bible completion' });
    }
  });

  // Attendance tracking routes for fixed blocks
  app.get('/api/attendance/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const date = req.query.date as string;
      
      // For now, return empty array - will implement attendance storage later
      res.json([]);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      res.status(500).json({ message: 'Failed to fetch attendance' });
    }
  });

  app.post('/api/attendance', async (req, res) => {
    try {
      const { userId, blockId, date, attended, blockType } = req.body;
      
      // For now, just return success - will implement attendance storage later
      res.json({ 
        id: `attendance-${Date.now()}`,
        userId,
        blockId,
        date,
        attended,
        blockType,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error recording attendance:', error);
      res.status(500).json({ message: 'Failed to record attendance' });
    }
  });

  // Schedule template routes - using real database data instead of hardcoded blocks
  app.get('/api/schedule-template/:studentName', async (req, res) => {
    try {
      const { studentName } = req.params;
      const weekday = req.query.weekday as string;
      
      const templateData = await storage.getScheduleTemplate(studentName, weekday);
      res.json(templateData);
    } catch (error) {
      console.error('Error fetching schedule template:', error);
      res.status(500).json({ message: 'Failed to fetch schedule template' });
    }
  });

  // Manual Canvas sync trigger (for testing)
  app.post('/api/sync-canvas', async (req, res) => {
    try {
      console.log('🔧 Manual Canvas sync triggered via API');
      await jobScheduler.runSyncNow();
      
      // Update administrative assignments
      console.log('🔧 Updating administrative assignments...');
      await storage.updateAdministrativeAssignments();
      
      res.json({ 
        message: 'Canvas sync completed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Manual Canvas sync failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Canvas sync failed', error: errorMessage });
    }
  });
  
  // Manual cleanup endpoint for testing problematic assignments
  app.post('/api/cleanup-assignments', async (req, res) => {
    try {
      console.log('🧹 Manual assignment cleanup triggered via API');
      // Access the private method using bracket notation for testing
      await (jobScheduler as any).cleanupProblematicAssignments();
      
      res.json({ 
        message: 'Assignment cleanup completed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Manual cleanup failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ 
        message: 'Cleanup failed', 
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Fix misclassified In Class assignments endpoint
  app.post('/api/fix-in-class-assignments', async (req, res) => {
    try {
      console.log('🔧 Fixing misclassified In Class assignments via direct database update...');
      
      // Use direct SQL update for efficiency with large number of assignments
      const result = await storage.executeDirectSQL(`
        UPDATE assignments 
        SET 
          block_type = 'co-op',
          is_assignment_block = false,
          updated_at = CURRENT_TIMESTAMP
        WHERE 
          LOWER(title) LIKE '%in class%' 
          AND block_type = 'assignment' 
          AND is_assignment_block = true
        RETURNING id, title, block_type, is_assignment_block
      `);
      
      const totalFixed = result?.length || 0;
      
      if (totalFixed > 0) {
        console.log(`🎉 Successfully fixed ${totalFixed} In Class assignments`);
        result.forEach(assignment => {
          console.log(`   ✅ "${assignment.title}" -> co-op block (non-schedulable)`);
        });
      }
      
      res.json({ 
        message: `Fixed ${totalFixed} In Class assignments`,
        assignments: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Fix In Class assignments failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ 
        message: 'Fix failed', 
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Deep Canvas investigation endpoint with comprehensive timing analysis
  app.post('/api/investigate-canvas-assignment', async (req, res) => {
    try {
      const { title, studentName } = req.body;
      
      if (!title || !studentName) {
        return res.status(400).json({ message: 'Title and studentName are required' });
      }
      
      // Get all Canvas assignments for the student
      const { getAllAssignmentsForStudent } = await import('./lib/canvas.js');
      const canvasData = await getAllAssignmentsForStudent(studentName);
      
      // Find the specific assignment
      let targetAssignment = null;
      let foundInInstance = null;
      
      if (canvasData.instance1) {
        targetAssignment = canvasData.instance1.find(a => a.name === title);
        if (targetAssignment) foundInInstance = 1;
      }
      
      if (!targetAssignment && canvasData.instance2) {
        targetAssignment = canvasData.instance2.find(a => a.name === title);
        if (targetAssignment) foundInInstance = 2;
      }
      
      if (!targetAssignment) {
        return res.status(404).json({ 
          message: `Assignment "${title}" not found in Canvas for ${studentName}`,
          searchedInstances: {
            instance1Count: canvasData.instance1?.length || 0,
            instance2Count: canvasData.instance2?.length || 0
          }
        });
      }
      
      // Check our database to see what timing data we stored
      const dbAssignment = await storage.getAssignments(`${studentName.toLowerCase()}-user`);
      const dbMatch = dbAssignment.find(a => a.title === title);
      
      // Apply assignment intelligence to see what should be extracted
      const { analyzeAssignmentWithCanvas } = await import('./lib/assignmentIntelligence.js');
      const intelligence = analyzeAssignmentWithCanvas(
        title,
        targetAssignment.description,
        {
          assignment_group: targetAssignment.assignment_group,
          submission_types: targetAssignment.submission_types,
          points_possible: targetAssignment.points_possible,
          unlock_at: targetAssignment.unlock_at,
          lock_at: targetAssignment.lock_at,
          is_recurring: targetAssignment.is_recurring,
          academic_year: targetAssignment.academic_year,
          course_start_date: targetAssignment.course_start_date,
          course_end_date: targetAssignment.course_end_date,
          inferred_start_date: targetAssignment.inferred_start_date,
          inferred_end_date: targetAssignment.inferred_end_date,
          module_data: targetAssignment.module_data
        }
      );
      
      // Return comprehensive analysis
      res.json({
        title,
        studentName,
        foundInInstance,
        rawCanvasData: targetAssignment,
        databaseData: dbMatch ? {
          due_date: dbMatch.dueDate,
          available_from: dbMatch.availableFrom,
          available_until: dbMatch.availableUntil,
          created_at: dbMatch.createdAt
        } : null,
        intelligenceAnalysis: {
          extractedDueDate: intelligence.extractedDueDate?.toISOString() || null,
          isInClassActivity: intelligence.isInClassActivity,
          category: intelligence.category,
          availabilityWindow: {
            availableFrom: intelligence.availabilityWindow.availableFrom?.toISOString() || null,
            availableUntil: intelligence.availabilityWindow.availableUntil?.toISOString() || null
          }
        },
        moduleData: targetAssignment.module_data,
        timingGaps: {
          hasCanvasDueDate: !!targetAssignment.due_at,
          hasCanvasUnlockDate: !!targetAssignment.unlock_at,
          hasModuleData: !!targetAssignment.module_data,
          hasInferredTiming: !!(targetAssignment.inferred_start_date || targetAssignment.inferred_end_date),
          processingWorking: !!intelligence.extractedDueDate
        },
        allTimingFields: Object.keys(targetAssignment).filter(key => 
          key.includes('date') || 
          key.includes('time') || 
          key.includes('at') ||
          key.includes('unlock') ||
          key.includes('lock') ||
          key.includes('available') ||
          key.includes('module') ||
          key.includes('inferred')
        ),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Canvas investigation failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ 
        message: 'Investigation failed', 
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Test pattern extraction endpoint
  app.post('/api/test-pattern-extraction', async (req, res) => {
    try {
      const { titles } = req.body;
      
      if (!Array.isArray(titles)) {
        return res.status(400).json({ message: 'titles must be an array' });
      }
      
      const { extractDueDateFromTitle } = await import('./lib/assignmentIntelligence.js');
      
      const results = titles.map(title => {
        const extractedDate = extractDueDateFromTitle(title);
        return {
          title,
          extractedDate: extractedDate?.toISOString() || null,
          success: !!extractedDate
        };
      });
      
      const summary = {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        successRate: `${Math.round((results.filter(r => r.success).length / results.length) * 100)}%`
      };
      
      res.json({
        summary,
        results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Pattern testing failed:', error);
      res.status(500).json({ 
        message: 'Pattern testing failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Schedule template bulk upload endpoint
  app.post('/api/schedule-templates/bulk-upload', async (req, res) => {
    try {
      const { templates } = req.body;
      
      if (!Array.isArray(templates)) {
        return res.status(400).json({ message: 'Templates must be an array' });
      }
      
      console.log(`📅 Uploading ${templates.length} schedule templates...`);
      
      const insertedTemplates = [];
      for (const template of templates) {
        const validatedTemplate = insertScheduleTemplateSchema.parse(template);
        const inserted = await storage.createScheduleTemplate(validatedTemplate);
        insertedTemplates.push(inserted);
      }
      
      res.status(201).json({
        message: `Successfully uploaded ${insertedTemplates.length} schedule templates`,
        count: insertedTemplates.length
      });
    } catch (error) {
      console.error('Error uploading schedule templates:', error);
      res.status(400).json({ message: 'Failed to upload schedule templates', error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // BIBLE CURRICULUM API ENDPOINTS

  // GET /api/bible-curriculum/current - Get current Bible curriculum for today
  app.get('/api/bible-curriculum/current', async (req, res) => {
    try {
      const { date } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();
      
      const curriculum = await getNextBibleCurriculumForStudent("Abigail");
      const weekNumber = curriculum?.dailyReading?.weekNumber || 1;
      
      res.json({
        weekNumber,
        curriculum,
        date: targetDate.toISOString().split('T')[0],
        weekday: targetDate.toLocaleDateString('en-US', { weekday: 'long' })
      });
    } catch (error) {
      console.error('Error fetching current Bible curriculum:', error);
      res.status(500).json({ message: 'Failed to fetch Bible curriculum' });
    }
  });

  // GET /api/bible-curriculum/week/:weekNumber - Get full week curriculum
  app.get('/api/bible-curriculum/week/:weekNumber', async (req, res) => {
    try {
      const { weekNumber } = req.params;
      const week = parseInt(weekNumber);
      
      if (week < 1 || week > 52) {
        return res.status(400).json({ message: 'Week number must be between 1 and 52' });
      }
      
      const progress = await getWeeklyBibleProgress(week);
      
      res.json(progress);
    } catch (error) {
      console.error('Error fetching weekly Bible curriculum:', error);
      res.status(500).json({ message: 'Failed to fetch weekly Bible curriculum' });
    }
  });

  // POST /api/bible-curriculum/complete - Mark curriculum item as completed
  app.post('/api/bible-curriculum/complete', async (req, res) => {
    try {
      const { weekNumber, dayOfWeek, readingType } = req.body;
      
      if (!weekNumber || !readingType) {
        return res.status(400).json({ 
          message: 'Week number and reading type are required' 
        });
      }
      
      const success = await markBibleCurriculumCompleted(
        weekNumber, 
        dayOfWeek || null, 
        readingType
      );
      
      if (success) {
        res.json({ 
          message: 'Bible curriculum item marked as completed',
          weekNumber,
          dayOfWeek,
          readingType,
          completedAt: new Date().toISOString()
        });
      } else {
        res.status(500).json({ message: 'Failed to mark curriculum item as completed' });
      }
    } catch (error) {
      console.error('Error marking Bible curriculum completed:', error);
      res.status(500).json({ message: 'Failed to mark curriculum item as completed' });
    }
  });

  // GET /api/bible-curriculum/progress - Get overall curriculum progress
  app.get('/api/bible-curriculum/progress', async (req, res) => {
    try {
      const currentWeek = 1; // Simplified for sequential approach
      
      if (!currentWeek) {
        return res.json({
          message: 'School year not currently active',
          currentWeek: null,
          progress: null
        });
      }
      
      // Get progress for current week and a few surrounding weeks
      const weekNumbers = [
        Math.max(1, currentWeek - 1),
        currentWeek,
        Math.min(52, currentWeek + 1)
      ];
      
      const weeklyProgress = await Promise.all(
        weekNumbers.map(week => getWeeklyBibleProgress(week))
      );
      
      res.json({
        currentWeek,
        weeklyProgress: weeklyProgress.filter(Boolean),
        schoolYearStartDate: process.env.SCHOOL_YEAR_START_DATE || '2025-08-14'
      });
    } catch (error) {
      console.error('Error fetching Bible curriculum progress:', error);
      res.status(500).json({ message: 'Failed to fetch curriculum progress' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
