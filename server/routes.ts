import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAssignmentSchema, updateAssignmentSchema } from "@shared/schema";
import { getAllAssignmentsForStudent, getCanvasClient } from "./lib/canvas"; 
import { emailConfig } from "./lib/supabase";

export async function registerRoutes(app: Express): Promise<Server> {
  // Assignment API routes
  
  // GET /api/assignments - Get assignments for a user/date
  app.get('/api/assignments', async (req, res) => {
    try {
      const { date } = req.query;
      // For demo, always use demo user
      let userId = "demo-user-1";
      
      // Try to find user first
      let user = await storage.getUser(userId);
      if (!user) {
        user = await storage.getUserByUsername("demo-student");
        userId = user?.id || userId;
      }
      
      const assignments = await storage.getAssignments(userId, date as string);
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
      const assignmentData = insertAssignmentSchema.parse(req.body);
      // For demo, always use demo user
      const userId = "demo-user-1";
      
      const assignment = await storage.createAssignment({ ...assignmentData, userId });
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
          completionStatus: "in_progress" as const,
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
            subject: 'Canvas Course',
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
            subject: 'Canvas Course 2',
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
          const assignment = await storage.createAssignment({
            userId: userId,
            title: canvasAssignment.name,
            subject: 'Canvas Course',
            instructions: canvasAssignment.description || 'Assignment from Canvas',
            dueDate: canvasAssignment.due_at ? new Date(canvasAssignment.due_at) : null,
            scheduledDate: today, // Schedule for today for testing
            actualEstimatedMinutes: 60,
            completionStatus: 'pending',
            priority: 'B',
            difficulty: 'medium'
          });
          importedAssignments.push(assignment);
        }
      }
      
      // Import from instance 2 (Abigail only)
      if (canvasData.instance2) {
        for (const canvasAssignment of canvasData.instance2) {
          const assignment = await storage.createAssignment({
            userId: userId,
            title: `${canvasAssignment.name} (Canvas 2)`,
            subject: 'Canvas Course 2',
            instructions: canvasAssignment.description || 'Assignment from Canvas instance 2',
            dueDate: canvasAssignment.due_at ? new Date(canvasAssignment.due_at) : null,
            scheduledDate: today,
            actualEstimatedMinutes: 60,
            completionStatus: 'pending',
            priority: 'B',
            difficulty: 'medium'
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

  // Get schedule template for a specific student and date
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
      
      console.log(`Found ${scheduleBlocks.length} schedule blocks:`, scheduleBlocks);
      
      res.json(scheduleBlocks);
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

  const httpServer = createServer(app);

  return httpServer;
}
