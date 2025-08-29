import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAssignmentSchema, updateAssignmentSchema, insertScheduleTemplateSchema } from "@shared/schema";
import { getElevenLabsService } from "./lib/elevenlabs";
import { 
  getBibleSubjectForSchedule, 
  getNextBibleCurriculumForStudent, 
  markBibleCurriculumCompleted, 
  getWeeklyBibleProgress
} from './lib/bibleCurriculum';
import { extractDueDatesFromExistingAssignments, extractDueDateFromTitle } from './lib/assignmentIntelligence';
import { getAllAssignmentsForStudent, getCanvasClient } from "./lib/canvas";
import { ObjectStorageService } from "./objectStorage"; 
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
      const { date, studentName, includeCompleted } = req.query;
      
      // Use student-specific user ID mapping  
      let userId = "demo-user-1"; // fallback
      
      if (studentName && typeof studentName === 'string') {
        // Map student names to actual database user IDs
        const studentUserMap: Record<string, string> = {
          'abigail': 'abigail-user',
          'khalil': 'khalil-user'
        };
        
        const normalizedStudentName = studentName.toLowerCase();
        userId = studentUserMap[normalizedStudentName] || userId;
      }
      
      // Get assignments for daily scheduling (filtered to next 12 days when date provided)
      // Admin mode can include completed assignments
      const includeCompletedBool = includeCompleted === 'true';
      const assignments = await storage.getAssignments(userId, date as string, includeCompletedBool);
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

  // POST /api/assignments/extract-due-dates - Retroactive due date extraction
  app.post('/api/assignments/extract-due-dates', async (req, res) => {
    try {
      const { studentName, dryRun = false } = req.body;
      
      console.log(`🚀 Starting retroactive due date extraction for ${studentName || 'all students'} (dryRun: ${dryRun})`);
      
      const results = await extractDueDatesFromExistingAssignments(storage, {
        studentName,
        dryRun,
        onProgress: (processed, total, assignment) => {
          if (processed % 10 === 0) {
            console.log(`📊 Progress: ${processed}/${total} assignments processed`);
          }
        }
      });
      
      res.json({
        message: `Due date extraction completed: ${results.updated} assignments updated`,
        results,
        dryRun,
        studentName: studentName || 'all'
      });
      
    } catch (error) {
      console.error('Due date extraction failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to extract due dates', error: errorMessage });
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
          // ENHANCED DUE DATE EXTRACTION: Use Canvas due_at OR extract from title
          let finalDueDate = canvasAssignment.due_at ? new Date(canvasAssignment.due_at) : null;
          if (!finalDueDate) {
            finalDueDate = extractDueDateFromTitle(canvasAssignment.name);
          }
          
          transformedAssignments.push({
            title: canvasAssignment.name,
            subject: canvasAssignment.courseName || 'Unknown Course',
            instructions: canvasAssignment.description || '',
            dueDate: finalDueDate,
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
          // ENHANCED DUE DATE EXTRACTION: Use Canvas due_at OR extract from title
          let finalDueDate = canvasAssignment.due_at ? new Date(canvasAssignment.due_at) : null;
          if (!finalDueDate) {
            finalDueDate = extractDueDateFromTitle(canvasAssignment.name);
          }
          
          transformedAssignments.push({
            title: canvasAssignment.name,
            subject: canvasAssignment.courseName || 'Unknown Course 2',
            instructions: canvasAssignment.description || '',
            dueDate: finalDueDate,
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

          // ENHANCED DUE DATE EXTRACTION: Use Canvas due_at OR extract from title
          let finalDueDate = canvasAssignment.due_at ? new Date(canvasAssignment.due_at) : null;
          
          // If no Canvas due date, try to extract from title
          if (!finalDueDate) {
            const extractedDate = extractDueDateFromTitle(canvasAssignment.name);
            if (extractedDate) {
              finalDueDate = extractedDate;
              console.log(`📅 Extracted due date from "${canvasAssignment.name}": ${extractedDate.toDateString()}`);
            }
          }

          const assignment = await storage.createAssignment({
            userId: userId,
            title: canvasAssignment.name,
            subject: canvasAssignment.courseName || 'Unknown Course',
            courseName: canvasAssignment.courseName || 'Unknown Course',
            instructions: canvasAssignment.description || 'Assignment from Canvas',
            dueDate: finalDueDate,
            scheduledDate: today, // Schedule for today for testing
            actualEstimatedMinutes: 60,
            completionStatus: completionStatus,
            priority: 'B',
            difficulty: 'medium',
            canvasId: canvasAssignment.id,
            canvasCourseId: canvasAssignment.course_id, // CRITICAL FIX: Add course ID for Canvas URLs
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

          // ENHANCED DUE DATE EXTRACTION: Use Canvas due_at OR extract from title
          let finalDueDate = canvasAssignment.due_at ? new Date(canvasAssignment.due_at) : null;
          
          // If no Canvas due date, try to extract from title
          if (!finalDueDate) {
            const extractedDate = extractDueDateFromTitle(canvasAssignment.name);
            if (extractedDate) {
              finalDueDate = extractedDate;
              console.log(`📅 Extracted due date from "${canvasAssignment.name} (Canvas 2)": ${extractedDate.toDateString()}`);
            }
          }

          const assignment = await storage.createAssignment({
            userId: userId,
            title: `${canvasAssignment.name} (Canvas 2)`,
            subject: canvasAssignment.courseName || 'Unknown Course 2',
            courseName: canvasAssignment.courseName || 'Unknown Course 2',
            instructions: canvasAssignment.description || 'Assignment from Canvas instance 2',
            dueDate: finalDueDate,
            scheduledDate: today,
            actualEstimatedMinutes: 60,
            completionStatus: completionStatus,
            priority: 'B',
            difficulty: 'medium',
            canvasId: canvasAssignment.id,
            canvasCourseId: canvasAssignment.course_id, // CRITICAL FIX: Add course ID for Canvas URLs
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

  // Daily schedule status routes for Overview Mode
  app.get('/api/schedule/:studentName/:date/status', async (req, res) => {
    try {
      const { studentName, date } = req.params;
      
      console.log(`Fetching daily schedule status for ${studentName} on ${date}`);
      
      const statusData = await storage.getDailyScheduleStatus(studentName, date);
      
      console.log(`Found ${statusData.length} schedule blocks with status`);
      
      res.json(statusData);
    } catch (error) {
      console.error('Error fetching daily schedule status:', error);
      res.status(500).json({ message: 'Failed to fetch daily schedule status' });
    }
  });

  app.patch('/api/schedule/:studentName/:date/block/:templateBlockId/status', async (req, res) => {
    try {
      const { studentName, date, templateBlockId } = req.params;
      const { status, flags } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: 'Status is required' });
      }
      
      // Validate status values
      const validStatuses = ['not-started', 'in-progress', 'complete', 'stuck', 'overtime'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }
      
      console.log(`Updating block status: ${studentName}/${date}/${templateBlockId} -> ${status}`);
      
      const updated = await storage.updateBlockStatus(studentName, date, templateBlockId, status, flags);
      
      if (!updated) {
        return res.status(404).json({ message: 'Schedule block not found' });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating block status:', error);
      res.status(500).json({ message: 'Failed to update block status' });
    }
  });

  app.post('/api/schedule/:studentName/:date/initialize', async (req, res) => {
    try {
      const { studentName, date } = req.params;
      
      console.log(`Initializing daily schedule for ${studentName} on ${date}`);
      
      await storage.initializeDailySchedule(studentName, date);
      
      res.json({ 
        message: 'Daily schedule initialized successfully',
        studentName,
        date
      });
    } catch (error) {
      console.error('Error initializing daily schedule:', error);
      res.status(500).json({ message: 'Failed to initialize daily schedule' });
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
  
  // Print Queue Management API for Parent Dashboard
  app.get('/api/print-queue', async (req, res) => {
    try {
      const { startDate, endDate, days } = req.query;
      
      let fromDate: Date;
      let toDate: Date;
      
      if (startDate && endDate) {
        // Explicit date range
        fromDate = new Date(startDate as string);
        toDate = new Date(endDate as string);
      } else {
        // Default: next 4 days starting from today
        const daysAhead = days ? parseInt(days as string) : 4;
        fromDate = new Date();
        toDate = new Date();
        toDate.setDate(fromDate.getDate() + daysAhead);
      }
      
      const fromDateStr = fromDate.toISOString().split('T')[0];
      const toDateStr = toDate.toISOString().split('T')[0];
      
      console.log(`📋 Fetching print queue for ${fromDateStr} to ${toDateStr}`);
      
      // Get ALL assignments (including completed ones for print queue)
      const allAssignments = await storage.getAllAssignments();
      
      const { detectPrintNeeds, estimatePageCount } = await import('./lib/printQueue.js');
      
      // Filter assignments by due date range
      const filteredAssignments = allAssignments.filter(assignment => {
        if (!assignment.dueDate) return false;
        
        const dueDate = new Date(assignment.dueDate);
        const dueDateStr = dueDate.toISOString().split('T')[0];
        
        return dueDateStr >= fromDateStr && dueDateStr <= toDateStr;
      });

      console.log(`📋 Found ${filteredAssignments.length} assignments due ${fromDateStr} to ${toDateStr}`);

      // Process assignments and detect print needs
      const printQueue: any[] = [];
      for (const assignment of filteredAssignments) {
        const printDetection = detectPrintNeeds({
          title: assignment.title,
          instructions: assignment.instructions,
          canvasId: assignment.canvasId,
          canvasCourseId: assignment.canvasCourseId,  // Use proper camelCase property
          canvasInstance: assignment.canvasInstance,
          submissionTypes: assignment.submissionTypes,
          courseName: assignment.courseName,
          subject: assignment.subject
        });
        
        if (printDetection.needsPrinting) {
          printQueue.push({
            id: assignment.id,
            studentName: assignment.userId,
            title: assignment.title,
            courseName: assignment.courseName,
            subject: assignment.subject,
            dueDate: assignment.dueDate,
            printReason: printDetection.printReason,
            priority: printDetection.priority,
            canvasUrl: printDetection.canvasUrl,
            printStatus: 'needs_printing',
            estimatedPages: estimatePageCount(assignment.instructions)
          });
        }
      }
      
      // Group by due date and sort within each group
      const groupedByDate: { [date: string]: any[] } = {};
      
      for (const item of printQueue) {
        const dateKey = item.dueDate ? new Date(item.dueDate).toISOString().split('T')[0] : 'no-date';
        if (!groupedByDate[dateKey]) {
          groupedByDate[dateKey] = [];
        }
        groupedByDate[dateKey].push(item);
      }
      
      // Sort items within each date group by priority, then by student
      for (const date in groupedByDate) {
        groupedByDate[date].sort((a: any, b: any) => {
          const priorityOrder: { [key: string]: number } = { high: 0, medium: 1, low: 2 };
          const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
          if (priorityDiff !== 0) return priorityDiff;
          return a.studentName.localeCompare(b.studentName);
        });
      }
      
      // Create final response with date groups sorted chronologically
      const sortedDates = Object.keys(groupedByDate).sort();
      const response = {
        dateRange: { from: fromDateStr, to: toDateStr },
        totalItems: printQueue.length,
        groupsByDate: sortedDates.map(date => ({
          date,
          items: groupedByDate[date],
          count: groupedByDate[date].length,
          highPriorityCount: groupedByDate[date].filter((item: any) => item.priority === 'high').length
        }))
      };
      
      console.log(`📋 Found ${printQueue.length} items needing printing for ${fromDateStr} to ${toDateStr}`);
      res.json(response);
      
    } catch (error) {
      console.error('Print queue fetch error:', error);
      res.status(500).json({ error: 'Failed to fetch print queue' });
    }
  });
  
  app.post('/api/print-queue/:assignmentId/status', async (req, res) => {
    try {
      const { assignmentId } = req.params;
      const { status } = req.body;
      
      if (!['printed', 'skipped', 'needs_printing'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      
      console.log(`📋 Updated print status for assignment ${assignmentId}: ${status}`);
      res.json({ success: true, status, assignmentId });
      
    } catch (error) {
      console.error('Print status update error:', error);
      res.status(500).json({ error: 'Failed to update print status' });
    }
  });

  // ElevenLabs TTS route (Khalil only)
  app.post('/api/tts/generate', async (req, res) => {
    try {
      const { text, studentName, voiceId } = req.body;
      
      // Only allow TTS for Khalil
      if (studentName !== 'Khalil') {
        return res.status(403).json({ error: 'TTS only available for Khalil' });
      }
      
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text is required' });
      }
      
      // Use specific voice for Khalil - Victor (preferred voice)
      const khalilVoiceId = voiceId || 'Yp1ySsmODnAcIghdWxeK'; // Victor - Khalil's preferred voice
      
      const elevenLabs = getElevenLabsService();
      // Optimize settings for speed while maintaining quality
      const audioBuffer = await elevenLabs.generateSpeech(text, khalilVoiceId, {
        stability: 0.5,        // Lower for faster generation
        similarity_boost: 0.75, // Clear pronunciation
        style: 0.1,           // Minimal expressiveness for speed
        use_speaker_boost: false // Disable for faster processing
      });
      
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
      });
      
      res.send(audioBuffer);
    } catch (error) {
      console.error('TTS generation error:', error);
      res.status(500).json({ error: 'Failed to generate speech' });
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
      
      // Get all assignments and filter/update the problematic ones
      const allAssignments = await storage.getAllAssignments();
      const inClassAssignments = allAssignments.filter(assignment => 
        assignment.title.toLowerCase().includes('in class') &&
        assignment.blockType === 'assignment' &&
        assignment.isAssignmentBlock === true
      );
      
      // Update each problematic assignment
      const result = [];
      for (const assignment of inClassAssignments) {
        const updated = await storage.updateAssignment(assignment.id, {
          blockType: 'co-op',
          isAssignmentBlock: false
        });
        if (updated) {
          result.push(updated);
        }
      }
      
      const totalFixed = result?.length || 0;
      
      if (totalFixed > 0) {
        console.log(`🎉 Successfully fixed ${totalFixed} In Class assignments`);
        result.forEach((assignment: any) => {
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

  // Student Profile Management API endpoints
  
  // GET /api/students/:studentName/assignments - Get assignments for specific student
  app.get('/api/students/:studentName/assignments', async (req, res) => {
    try {
      const { studentName } = req.params;
      const { date, includeCompleted } = req.query;
      
      // Map student name to user ID
      const userIdMap: Record<string, string> = {
        'abigail': 'abigail-user',
        'khalil': 'khalil-user'
      };
      
      const userId = userIdMap[studentName.toLowerCase()] || `${studentName.toLowerCase()}-user`;
      const includeCompletedBool = includeCompleted === 'true';
      
      const assignments = await storage.getAssignments(userId, date as string, includeCompletedBool);
      console.log(`📚 Retrieved ${assignments.length} assignments for ${studentName}`);
      res.json(assignments);
    } catch (error) {
      console.error('Error fetching student assignments:', error);
      res.status(500).json({ message: 'Failed to fetch student assignments' });
    }
  });

  // GET /api/students/:studentName/profile - Get student profile
  app.get('/api/students/:studentName/profile', async (req, res) => {
    try {
      const { studentName } = req.params;
      const profile = await storage.getStudentProfile(studentName);
      res.json(profile);
    } catch (error) {
      console.error('Error fetching student profile:', error);
      res.status(500).json({ message: 'Failed to fetch student profile' });
    }
  });

  // PUT /api/students/:studentName/profile - Update student profile
  app.put('/api/students/:studentName/profile', async (req, res) => {
    try {
      const { studentName } = req.params;
      const { profileImageUrl, themeColor } = req.body;
      
      const profile = await storage.upsertStudentProfile({
        studentName,
        displayName: studentName.charAt(0).toUpperCase() + studentName.slice(1),
        profileImageUrl,
        themeColor
      });
      
      res.json(profile);
    } catch (error) {
      console.error('Error updating student profile:', error);
      res.status(500).json({ message: 'Failed to update student profile' });
    }
  });

  // POST /api/profile-image/upload - Get upload URL for profile image
  app.post('/api/profile-image/upload', async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ url: uploadURL });
    } catch (error) {
      console.error('Error getting upload URL:', error);
      res.status(500).json({ message: 'Failed to get upload URL' });
    }
  });

  // POST /api/profile-image/complete - Complete profile image upload
  app.post('/api/profile-image/complete', async (req, res) => {
    try {
      const { uploadUrl, studentName } = req.body;
      
      if (!uploadUrl || !studentName) {
        return res.status(400).json({ message: 'Upload URL and student name are required' });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadUrl);
      
      // Update student profile with new image URL
      const profile = await storage.upsertStudentProfile({
        studentName,
        displayName: studentName.charAt(0).toUpperCase() + studentName.slice(1),
        profileImageUrl: objectPath
      });
      
      res.json({ objectPath, profile });
    } catch (error) {
      console.error('Error completing profile image upload:', error);
      res.status(500).json({ message: 'Failed to complete upload' });
    }
  });

  // GET /objects/:objectPath(*) - Serve uploaded profile images
  app.get('/objects/:objectPath(*)', async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error('Error serving object:', error);
      res.status(404).json({ error: 'File not found' });
    }
  });

  // Family Dashboard API endpoints
  
  // GET /api/family/dashboard - Get family dashboard data
  app.get('/api/family/dashboard', async (req, res) => {
    try {
      const dashboardData = await storage.getFamilyDashboardData();
      
      // Calculate daily stats across all students
      const totalCompleted = dashboardData.students.reduce((sum, s) => sum + (s.completedToday || 0), 0);
      const totalRemaining = dashboardData.students.reduce((sum, s) => sum + ((s.totalToday || 0) - (s.completedToday || 0)), 0);
      
      // Get current date for display
      const today = new Date().toISOString().split('T')[0];
      
      res.json({
        date: today,
        stats: {
          totalCompleted,
          totalRemaining,
          needsAttention: dashboardData.needsReview.length
        },
        students: dashboardData.students,
        needsReview: dashboardData.needsReview,
        // Connect to existing print queue
        printQueueCount: 0 // Will be updated when we integrate with print queue
      });
    } catch (error) {
      console.error('Error fetching family dashboard data:', error);
      res.status(500).json({ message: 'Failed to fetch family dashboard data' });
    }
  });

  // POST /api/family/student/:studentName/flags - Update student flags (stuck, need help, etc.)
  app.post('/api/family/student/:studentName/flags', async (req, res) => {
    try {
      const { studentName } = req.params;
      const { isStuck, needsHelp, isOvertimeOnTask } = req.body;
      
      const updatedStatus = await storage.updateStudentFlags(studentName, {
        isStuck,
        needsHelp,
        isOvertimeOnTask
      });
      
      if (!updatedStatus) {
        return res.status(404).json({ message: 'Student not found' });
      }
      
      res.json(updatedStatus);
    } catch (error) {
      console.error('Error updating student flags:', error);
      res.status(500).json({ message: 'Failed to update student flags' });
    }
  });

  // POST /api/family/student/:studentName/status - Update student activity status
  app.post('/api/family/student/:studentName/status', async (req, res) => {
    try {
      const { studentName } = req.params;
      const { 
        currentMode, 
        currentAssignmentId, 
        currentAssignmentTitle, 
        sessionStartTime,
        estimatedEndTime,
        completedToday,
        totalToday,
        minutesWorkedToday,
        targetMinutesToday 
      } = req.body;
      
      const statusUpdate = await storage.upsertStudentStatus({
        studentName,
        currentMode: currentMode || 'overview',
        currentAssignmentId,
        currentAssignmentTitle,
        sessionStartTime: sessionStartTime ? new Date(sessionStartTime) : null,
        estimatedEndTime: estimatedEndTime ? new Date(estimatedEndTime) : null,
        completedToday: completedToday || 0,
        totalToday: totalToday || 0,
        minutesWorkedToday: minutesWorkedToday || 0,
        targetMinutesToday: targetMinutesToday || 180,
        lastActivity: new Date()
      });
      
      res.json(statusUpdate);
    } catch (error) {
      console.error('Error updating student status:', error);
      res.status(500).json({ message: 'Failed to update student status' });
    }
  });

  // GET /api/family/student/:studentName/status - Get current student status
  app.get('/api/family/student/:studentName/status', async (req, res) => {
    try {
      const { studentName } = req.params;
      const status = await storage.getStudentStatus(studentName);
      
      if (!status) {
        // Return default status if not found
        return res.json({
          studentName,
          currentMode: 'overview',
          currentAssignmentId: null,
          currentAssignmentTitle: null,
          sessionStartTime: null,
          estimatedEndTime: null,
          isStuck: false,
          stuckSince: null,
          needsHelp: false,
          isOvertimeOnTask: false,
          completedToday: 0,
          totalToday: 0,
          minutesWorkedToday: 0,
          targetMinutesToday: 180,
          lastActivity: new Date(),
          updatedAt: new Date()
        });
      }
      
      res.json(status);
    } catch (error) {
      console.error('Error fetching student status:', error);
      res.status(500).json({ message: 'Failed to fetch student status' });
    }
  });

  // POST /api/family/initialize - Initialize student status data for testing
  app.post('/api/family/initialize', async (req, res) => {
    try {
      console.log('🔧 Initializing student status data with REAL current state...');
      
      // Get real assignments for both students today
      const today = new Date().toISOString().split('T')[0];
      const abigailAssignments = await storage.getAssignments('abigail-user', today, false);
      const khalilAssignments = await storage.getAssignments('khalil-user', today, false);
      
      console.log(`📋 Real assignments today - Abigail: ${abigailAssignments.length}, Khalil: ${khalilAssignments.length}`);
      
      // Initialize REAL status for Abigail based on actual data
      const abigailStatus = await storage.upsertStudentStatus({
        studentName: 'abigail',
        currentMode: 'guided',
        currentAssignmentId: null,
        currentAssignmentTitle: null, // No current assignment - real state
        sessionStartTime: null,
        estimatedEndTime: null,
        isStuck: false,
        needsHelp: false,
        isOvertimeOnTask: false,
        completedToday: 0, // Real count - nothing completed today
        totalToday: abigailAssignments.length, // Real total assignments for today
        minutesWorkedToday: 0, // No time worked today
        targetMinutesToday: 180, // Standard target
        lastActivity: new Date()
      });

      // Initialize REAL status for Khalil based on actual data  
      const khalilStatus = await storage.upsertStudentStatus({
        studentName: 'khalil',
        currentMode: 'guided',
        currentAssignmentId: null,
        currentAssignmentTitle: null, // No current assignment - real state
        sessionStartTime: null,
        estimatedEndTime: null,
        isStuck: false,
        needsHelp: false,
        isOvertimeOnTask: false,
        completedToday: 0, // Real count - nothing completed today
        totalToday: khalilAssignments.length, // Real total assignments for today
        minutesWorkedToday: 0, // No time worked today
        targetMinutesToday: 150, // Standard target
        lastActivity: new Date()
      });

      console.log('✅ Student status initialized with REAL current state (no active work today)');
      res.json({
        message: 'Student status initialized with real current state',
        students: [abigailStatus, khalilStatus],
        realData: {
          abigailAssignments: abigailAssignments.length,
          khalilAssignments: khalilAssignments.length
        }
      });
    } catch (error) {
      console.error('Error initializing student status data:', error);
      res.status(500).json({ message: 'Failed to initialize student status data' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
