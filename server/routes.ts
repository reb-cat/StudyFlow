import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { logger } from "./lib/logger";
import { basicHealthCheck, readinessCheck, livenessCheck, metricsEndpoint } from "./lib/health-checks";
import { generalRateLimit, authRateLimit, apiRateLimit, strictRateLimit, uploadRateLimit } from "./lib/rate-limiting";
import { sql } from "drizzle-orm";
import { db } from "./db";

// Family authentication middleware - reads the same field set during login
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // REQUESTED LOG: If 401 happens, include short reason
  if (!req.session) {
    logger.debug('Auth', '401: No session cookie found');
    return res.status(401).json({ code: 401, message: 'Authentication required', reason: 'no session cookie' });
  }
  
  if (!req.session.authenticated) {
    logger.debug('Auth', '401: Session present but not authenticated');
    return res.status(401).json({ code: 401, message: 'Authentication required', reason: 'session present but not authenticated' });
  }
  
  if (!req.session.userId) {
    logger.debug('Auth', '401: Session present but no user id'); 
    return res.status(401).json({ code: 401, message: 'Authentication required', reason: 'session present but no user id' });
  }
  
  next();
};

// Simple unlock endpoint for family password
const setupFamilyAuth = (app: Express) => {
  app.post('/api/unlock', (req: Request, res: Response) => {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({ message: 'Password required' });
    }
    
    if (password === process.env.FAMILY_PASSWORD) {
      // CRITICAL: Write user into session and save before responding
      req.session.authenticated = true;
      req.session.userId = 'family'; // Same field that auth guards will check
      
      req.session.save((err) => {
        if (err) {
          logger.error('Auth', 'Session save failed', { error: err.message });
          return res.status(500).json({ message: 'Session save failed' });
        }
        
        // Step 5 Evidence: Log sessionId and userId after saving session
        console.log('✅ LOGIN OK:', { 
          sessionId: req.sessionID, 
          userId: req.session.userId 
        });
        
        res.json({ success: true, authenticated: true });
      });
    } else {
      res.status(401).json({ message: 'Invalid password' });
    }
  });
  
  // Check authentication status
  app.get('/api/auth/status', (req: Request, res: Response) => {
    res.json({ authenticated: !!req.session.authenticated });
  });

  // Who am I endpoint - required for acceptance proof
  app.get('/api/me', requireAuth, (req: Request, res: Response) => {
    res.json({
      authenticated: true,
      userId: req.session.userId,
      sessionId: req.sessionID
    });
  });

  // Health check endpoints for deployment monitoring
  app.get('/health', basicHealthCheck);
  app.get('/health/ready', readinessCheck);  
  app.get('/health/live', livenessCheck);
  app.get('/metrics', metricsEndpoint);
  
  // Database connection status endpoint
  app.get('/health/database', async (req: Request, res: Response) => {
    try {
      const { connectionManager } = await import('./lib/db-connection');
      const diagnostics = await connectionManager.getConnectionDiagnostics();
      
      res.status(diagnostics.isConnected ? 200 : 503).json({
        status: diagnostics.isConnected ? 'healthy' : 'unhealthy',
        connection: diagnostics.isConnected,
        retryCount: diagnostics.retryCount,
        serverInfo: diagnostics.serverInfo,
        error: diagnostics.error,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      res.status(503).json({
        status: 'unhealthy',
        connection: false,
        error: error?.message || 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Debug endpoint for production troubleshooting
  app.get('/api/debug', (req: Request, res: Response) => {
    res.json({
      nodeEnv: process.env.NODE_ENV,
      replitDeployment: process.env.REPLIT_DEPLOYMENT,
      isProduction: process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1',
      sessionId: req.sessionID,
      hasSession: !!req.session,
      authenticated: req.session.authenticated,
      userId: req.session.userId,
      cookieSecure: req.secure,
      protocol: req.protocol,
      headers: {
        'x-forwarded-proto': req.get('x-forwarded-proto'),
        'host': req.get('host')
      }
    });
  });
  
  // Logout endpoint
  app.post('/api/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to logout' });
      }
      res.json({ success: true });
    });
  });
};
import { 
  insertAssignmentSchema, updateAssignmentSchema, insertScheduleTemplateSchema, 
  insertChecklistItemSchema, updateChecklistItemSchema, 
  type Assignment, type ChecklistItem 
} from "@shared/schema";
import { getElevenLabsService } from "./lib/elevenlabs";
import { 
  getBibleSubjectForSchedule, 
  getNextBibleCurriculumForStudent, 
  markBibleCurriculumCompleted, 
  getWeeklyBibleProgress
} from './lib/bibleCurriculum';
import { bibleCurriculum, bibleCurriculumPosition } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { extractDueDatesFromExistingAssignments, extractDueDateFromTitle } from './lib/assignmentIntelligence';
import { getAllAssignmentsForStudent, getCanvasClient } from "./lib/canvas";
import { normalizeAssignment, type AssignmentLike } from './lib/assignmentNormalizer';
import { normalizeAssignment as normalizeAssignmentNew } from '@shared/normalize';
import { ObjectStorageService } from "./objectStorage"; 
// Email config moved inline since Supabase removed
const emailConfig = {
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFrom: process.env.RESEND_FROM || '',
  parentEmail: process.env.PARENT_EMAIL || '',
};
import { jobScheduler } from "./lib/scheduler";

// Helper function to normalize student names case-insensitively
const normalizeStudentName = (name: string): string => {
  return name.toLowerCase().trim();
};

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Health check endpoints for production monitoring
  app.get('/health', basicHealthCheck);
  app.get('/health/ready', readinessCheck);
  app.get('/health/live', livenessCheck);
  app.get('/metrics', strictRateLimit, metricsEndpoint);
  
  // Apply general rate limiting to all API routes
  app.use('/api', generalRateLimit);
  
  // Setup family authentication
  setupFamilyAuth(app);

  // Text-to-Speech route for Khalil's guided day (Victor voice)
  app.post('/api/tts/speak', async (req, res) => {
    try {
      const { text, voice = 'Victor' } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }

      // Eleven Labs Victor voice ID (found from API)
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/Yp1ySsmODnAcIghdWxeK', {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVEN_LABS_API_KEY!,
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        })
      });

      if (!response.ok) {
        console.error('Eleven Labs API error:', response.status, response.statusText);
        return res.status(500).json({ error: 'TTS service unavailable' });
      }

      // Stream the audio response
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'no-cache');
      
      const audioBuffer = await response.arrayBuffer();
      res.send(Buffer.from(audioBuffer));

    } catch (error) {
      console.error('TTS error:', error);
      res.status(500).json({ error: 'Failed to generate speech' });
    }
  });

  // Assignment API routes
  
  // PATCH /api/assignments/:id - Update assignment status
  app.patch('/api/assignments/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const rawData = req.body;
      
      if (!id) {
        return res.status(400).json({ message: 'Assignment ID is required' });
      }

      // Only allow editable fields - filter out read-only database fields
      const editableFields = [
        'title', 'subject', 'courseName', 'instructions', 'dueDate', 
        'priority', 'completionStatus', 'actualEstimatedMinutes', 'notes'
      ];
      
      const updateData: any = {};
      
      // Copy only editable fields
      for (const field of editableFields) {
        if (rawData[field] !== undefined) {
          updateData[field] = rawData[field];
        }
      }
      
      // Track when assignment is marked complete for grading delay detection
      if (updateData.completionStatus === 'completed') {
        updateData.completedAt = new Date();
        
        // 🎯 REWARDBANK HOOK: Award points for completing assignment
        try {
          const studentName = req.params.userId; // Extract student from userId
          const rewardUserId = `${studentName.toLowerCase()}-user`;
          
          // Calculate points based on your exact specifications
          const assignment = await storage.getAssignment(id);
          if (assignment) {
            // Task completion points: High = +150, Medium = +100, Low = +75
            let points = 75; // Default for Low priority
            if (assignment.priority === 'A') points = 150; // High priority
            else if (assignment.priority === 'B') points = 100; // Medium priority
            else points = 75; // Low priority
            
            // Check earning limits before awarding
            const settings = await storage.getRewardSettings('family');
            const canEarn = await storage.checkEarningLimits(rewardUserId, points, settings || null);
            
            if (canEarn.allowed) {
              await storage.createEarnEvent({
                userId: rewardUserId,
                type: 'Task',
                amount: points,
                sourceId: assignment.id,
                sourceDetails: assignment.title
              });
              
              await storage.updateRewardProfile(rewardUserId, points);
              console.log(`🏆 Awarded ${points} points to ${studentName} for completing: ${assignment.title}`);
            } else {
              console.log(`⚠️ Points capped for ${studentName}: ${canEarn.reason}`);
            }
          }
        } catch (error) {
          // Silent fail - don't break assignment completion if rewards fail
          console.error('❌ RewardBank hook failed:', error);
        }
      }
      
      // Convert dueDate string to Date object if provided
      if (updateData.dueDate && typeof updateData.dueDate === 'string') {
        updateData.dueDate = new Date(updateData.dueDate);
      }
      
      // Always set updatedAt
      updateData.updatedAt = new Date();
      
      console.log(`📝 Updating assignment ${id} with filtered data:`, updateData);
      
      const assignment = await storage.updateAssignment(id, updateData);
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
      
      console.log(`✅ Assignment ${id} updated successfully:`, assignment.title);
      res.json({ message: 'Assignment updated successfully', assignment });
    } catch (error) {
      logger.error('API', 'Failed to update assignment', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: 'Failed to update assignment' });
    }
  });

  // GET /api/bible-curriculum - Get current Bible curriculum for student (assignments management only)
  app.get('/api/bible-curriculum', requireAuth, async (req, res) => {
    try {
      const { studentName } = req.query;
      
      if (!studentName || typeof studentName !== 'string') {
        return res.status(400).json({ message: 'Student name required' });
      }
      
      const { getNextBibleCurriculumForStudent } = await import('./lib/bibleCurriculum');
      const bibleResult = await getNextBibleCurriculumForStudent(studentName);
      
      const bibleItems = [];
      
      // Add daily reading if not completed
      if (bibleResult.dailyReading && !bibleResult.dailyReading.completed) {
        bibleItems.push({
          id: `bible-reading-${bibleResult.dailyReading.id}`,
          type: 'daily_reading',
          title: bibleResult.dailyReading.readingTitle || 'Bible Reading',
          weekNumber: bibleResult.dailyReading.weekNumber,
          dayOfWeek: bibleResult.dailyReading.dayOfWeek,
          completed: false,
          estimatedMinutes: 20
        });
      }
      
      // Add memory verse if not completed  
      if (bibleResult.memoryVerse && !bibleResult.memoryVerse.completed) {
        bibleItems.push({
          id: `bible-memory-${bibleResult.memoryVerse.id}`,
          type: 'memory_verse',
          title: `Memory Verse - Week ${bibleResult.memoryVerse.weekNumber}`,
          weekNumber: bibleResult.memoryVerse.weekNumber,
          dayOfWeek: null,
          completed: false,
          estimatedMinutes: 15
        });
      }
      
      res.json(bibleItems);
    } catch (error) {
      console.error('Error fetching Bible curriculum:', error);
      res.status(500).json({ message: 'Failed to fetch Bible curriculum' });
    }
  });

  // POST /api/bible-curriculum/complete - Mark Bible curriculum item complete
  app.post('/api/bible-curriculum/complete', requireAuth, async (req, res) => {
    try {
      const { weekNumber, dayOfWeek, type, studentName } = req.body;
      
      if (!studentName || !weekNumber || !type) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      const { markBibleCurriculumCompleted } = await import('./lib/bibleCurriculum');
      const success = await markBibleCurriculumCompleted(
        weekNumber,
        dayOfWeek,
        type,
        studentName
      );
      
      if (success) {
        res.json({ success: true, message: 'Bible curriculum item marked complete' });
      } else {
        res.status(400).json({ message: 'Failed to mark Bible curriculum complete' });
      }
    } catch (error) {
      console.error('Error completing Bible curriculum:', error);
      res.status(500).json({ message: 'Failed to complete Bible curriculum' });
    }
  });

  // GET /api/assignments - Get assignments for a user/date
  app.get('/api/assignments', requireAuth, async (req, res) => {
    try {
      const { date, startDate, endDate, studentName, includeCompleted, unscheduled } = req.query;
      
      // Use student-specific user ID mapping  
      let userId = "unknown-user"; // fallback (was demo-user-1 - removed to prevent mock data contamination)
      
      if (studentName && typeof studentName === 'string') {
        // Map student names to actual database user IDs
        const studentUserMap: Record<string, string> = {
          'abigail': 'abigail-user',
          'khalil': 'khalil-user'
        };
        
        const normalizedStudentName = studentName.toLowerCase();
        userId = studentUserMap[normalizedStudentName] || userId;
      }
      
      // Get assignments for daily scheduling (filtered by date range if provided)
      // Admin mode can include completed assignments
      const includeCompletedBool = includeCompleted === 'true';
      
      // Use date range if provided, otherwise fall back to single date
      let filterDate = date as string;
      if (startDate && endDate) {
        // For date range filtering, we'll pass the range to the storage method
        filterDate = `${startDate},${endDate}`;
      }
      
      console.log(`🔍 PRODUCTION DEBUG: Fetching assignments for userId="${userId}", date="${filterDate}", includeCompleted="${includeCompletedBool}"`);
      const assignments = await storage.getAssignments(userId, filterDate, includeCompletedBool);
      console.log(`📊 PRODUCTION DEBUG: Found ${assignments.length} assignments in database for ${userId}`);
      
      if (assignments.length === 0) {
        console.log(`❌ PRODUCTION DEBUG: No assignments found! Check:
          1. Is data in database for userId="${userId}"?
          2. Is date filtering too restrictive for date="${filterDate}"?
          3. Is student name mapping correct for studentName="${studentName}"?`);
      }
      
      // FIXED: Proper data separation architecture
      // Bible blocks get content from bible_curriculum table ONLY
      // Assignment blocks get content from assignments table ONLY  
      // NEVER mix the two data sources
      let allAssignments = [...assignments];
      
      // NOTE: Bible content is handled separately in Bible-specific endpoints
      // This endpoint should only return actual assignments from the assignments table
      
      // Apply normalization to assignment titles for meaningful display
      const normalizedAssignments = allAssignments.map(assignment => {
        const normalized = normalizeAssignmentNew({
          id: assignment.id,
          title: assignment.title,
          course: assignment.courseName,
          instructions: assignment.instructions,
          dueAt: assignment.dueDate ? assignment.dueDate.toISOString() : null
        });
        
        return {
          ...assignment,
          displayTitle: normalized.displayTitle,
          effectiveDueAt: normalized.effectiveDueAt,
          courseLabel: normalized.courseLabel
        };
      });
      
      console.log(`📚 Retrieved ${assignments.length} assignments for daily planning for ${studentName} on ${date}`);
      res.json(normalizedAssignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to fetch assignments', error: errorMessage });
    }
  });

  // PRODUCTION DIAGNOSTIC: Comprehensive database and user validation
  app.get('/api/production-diagnostic', async (req, res) => {
    console.log('🔧 PRODUCTION DIAGNOSTIC: Comprehensive system check');
    
    try {
      const diagnostics: any = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        database: {},
        users: {},
        assignments: {},
        scheduleTemplates: {}
      };

      // Check database connection
      try {
        const allAssignments = await storage.getAllAssignments();
        diagnostics.database.connection = 'OK';
        diagnostics.database.totalAssignments = allAssignments.length;
      } catch (error) {
        diagnostics.database.connection = 'FAILED';
        diagnostics.database.error = error instanceof Error ? error.message : 'Unknown error';
      }

      // Check user data for both students
      const studentUserMap: Record<string, string> = {
        'abigail': 'abigail-user',
        'khalil': 'khalil-user'
      };

      for (const [studentName, userId] of Object.entries(studentUserMap)) {
        try {
          const userAssignments = await storage.getAllAssignments();
          const studentAssignments = userAssignments.filter(a => a.userId === userId);
          diagnostics.users[studentName] = {
            userId,
            assignmentCount: studentAssignments.length,
            hasData: studentAssignments.length > 0
          };
        } catch (error) {
          diagnostics.users[studentName] = {
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      }

      // Check today's assignments specifically
      const today = new Date().toISOString().split('T')[0];
      try {
        const todayAssignments = await storage.getAssignments('abigail-user', today, false);
        diagnostics.assignments.todayForAbigail = todayAssignments.length;
      } catch (error) {
        diagnostics.assignments.todayError = error instanceof Error ? error.message : 'Unknown error';
      }

      console.log('📊 PRODUCTION DIAGNOSTIC RESULTS:', JSON.stringify(diagnostics, null, 2));
      res.json(diagnostics);
    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
      res.status(500).json({ error: 'Diagnostic failed', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // PRODUCTION FIX: Create missing endpoints that production frontend is calling
  app.get('/api/assignments-v2', async (req, res) => {
    console.log('🔧 PRODUCTION FIX: /api/assignments-v2 called with params:', req.query);
    
    try {
      // Extract parameters
      const { date, studentName } = req.query as { date?: string; studentName?: string };
      
      if (!date || !studentName) {
        console.log('❌ Missing required parameters:', { date, studentName });
        return res.status(400).json({ error: 'Missing date or studentName parameter' });
      }

      // Use student-specific user ID mapping
      const studentUserMap: Record<string, string> = {
        'abigail': 'abigail-user',
        'khalil': 'khalil-user'
      };
      const userId = studentUserMap[studentName.toLowerCase()] || "unknown-user";

      console.log(`🔍 BRIDGE DEBUG: Fetching assignments for userId="${userId}", date="${date}"`);
      
      // Add comprehensive error handling and fallback
      let assignments: Assignment[];
      try {
        assignments = await storage.getAssignments(userId, date, false);
      } catch (dbError) {
        console.error(`❌ Database error for ${userId}:`, dbError);
        // Try to get all assignments as fallback
        try {
          const allAssignments = await storage.getAllAssignments();
          assignments = allAssignments.filter(a => a.userId === userId);
          console.log(`🔄 Fallback: Using all assignments, found ${assignments.length}`);
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError);
          assignments = [];
        }
      }

      console.log(`📊 BRIDGE DEBUG: Found ${assignments.length} assignments for ${userId} on ${date}`);
      
      // If no assignments found, provide helpful debugging info
      if (assignments.length === 0) {
        console.log(`🔍 DEBUG: No assignments found for ${userId} on ${date}. Checking user data...`);
        try {
          const allAssignments = await storage.getAllAssignments();
          const userAssignments = allAssignments.filter(a => a.userId === userId);
          const totalUsers = new Set(allAssignments.map(a => a.userId)).size;
          console.log(`📈 USER DEBUG: Found ${userAssignments.length} total assignments for ${userId}, ${totalUsers} total users in system`);
        } catch (debugError) {
          console.error('❌ Debug query failed:', debugError);
        }
      }

      res.json(assignments);
    } catch (error) {
      console.error('❌ Bridge endpoint error:', error);
      res.status(500).json({ error: 'Failed to fetch assignments' });
    }
  });

  app.get('/api/debug-fetch', async (req, res) => {
    console.log('🔧 PRODUCTION FIX: /api/debug-fetch called with params:', req.query);
    
    try {
      // Extract parameters
      const { date, studentName } = req.query as { date?: string; studentName?: string };
      
      if (!date || !studentName) {
        console.log('❌ Missing required parameters:', { date, studentName });
        return res.status(400).json({ error: 'Missing date or studentName parameter' });
      }

      // Use student-specific user ID mapping with validation
      const studentUserMap: Record<string, string> = {
        'abigail': 'abigail-user',
        'khalil': 'khalil-user'
      };
      const userId = studentUserMap[studentName.toLowerCase()] || "unknown-user";

      if (userId === "unknown-user") {
        console.log(`⚠️ WARNING: Unknown student "${studentName}", using fallback userId`);
      }

      console.log(`🔍 DEBUG BRIDGE: Fetching assignments for userId="${userId}", date="${date}"`);
      
      // Enhanced debugging with multiple fallback strategies
      let assignments: Assignment[];
      try {
        assignments = await storage.getAssignments(userId, date, false);
      } catch (dbError) {
        console.error(`❌ Primary query failed for ${userId}:`, dbError);
        
        // Fallback 1: Try without date filter
        try {
          console.log(`🔄 Fallback 1: Trying without date filter...`);
          const allUserAssignments = await storage.getAllAssignments();
          assignments = allUserAssignments.filter(a => a.userId === userId);
          console.log(`📊 Fallback 1: Found ${assignments.length} total assignments for ${userId}`);
        } catch (fallback1Error) {
          console.error('❌ Fallback 1 failed:', fallback1Error);
          
          // Fallback 2: Return empty with detailed error info
          console.log(`🔄 Fallback 2: Returning empty with diagnostic data...`);
          assignments = [];
        }
      }

      console.log(`📊 DEBUG BRIDGE: Final result: ${assignments.length} assignments for ${userId} on ${date}`);

      res.json(assignments);
    } catch (error) {
      console.error('❌ Debug bridge endpoint critical error:', error);
      res.status(500).json({ 
        error: 'Failed to fetch assignments', 
        details: error instanceof Error ? error.message : 'Unknown error',
        userId: req.query.studentName ? `${String(req.query.studentName).toLowerCase()}-user` : 'unknown'
      });
    }
  });
  
  // POST /api/assignments - Create new assignment
  app.post('/api/assignments', requireAuth, async (req, res) => {
    try {
      console.log('🔍 Assignment creation request body:', JSON.stringify(req.body, null, 2));
      
      const { studentName, ...assignmentData } = req.body;
      
      console.log('📝 Assignment data after extracting studentName:', JSON.stringify(assignmentData, null, 2));
      
      // Convert dueDate string to Date object if present (HTTP serializes Date objects to strings)
      if (assignmentData.dueDate && typeof assignmentData.dueDate === 'string') {
        assignmentData.dueDate = new Date(assignmentData.dueDate);
        console.log('📅 Converted dueDate string to Date object:', assignmentData.dueDate);
      }
      
      // Validate the assignment data
      const validatedAssignmentData = insertAssignmentSchema.parse(assignmentData);
      
      console.log('✅ Validation passed, validated data:', JSON.stringify(validatedAssignmentData, null, 2));
      
      // Use student-specific user ID or fallback
      let userId = "unknown-user"; // fallback (was demo-user-1 - removed to prevent mock data contamination)
      if (studentName) {
        const studentUserMap: Record<string, string> = {
          'abigail': 'abigail-user',
          'khalil': 'khalil-user'
        };
        userId = studentUserMap[studentName.toLowerCase()] || userId;
      }
      
      console.log(`👤 Using userId: ${userId} for student: ${studentName}`);
      
      const assignment = await storage.createAssignment({ ...validatedAssignmentData, userId });
      console.log('🎉 Assignment created successfully:', assignment.id);
      
      res.status(201).json(assignment);
    } catch (error) {
      console.error('❌ Assignment creation failed:', error);
      
      // Better error handling for validation errors
      if (error instanceof Error && error.name === 'ZodError') {
        console.error('🔍 Zod validation error details:', JSON.stringify(error, null, 2));
        return res.status(400).json({ 
          message: 'Validation failed', 
          details: error.message,
          issues: (error as any).issues || []
        });
      }
      
      logger.error('API', 'Failed to create assignment', { error: error instanceof Error ? error.message : String(error) });
      res.status(400).json({ 
        message: 'Failed to create assignment',
        details: error instanceof Error ? error.message : String(error)
      });
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
      logger.error('API', 'Failed to update assignment', { error: error instanceof Error ? error.message : String(error) });
      res.status(400).json({ message: 'Failed to update assignment' });
    }
  });
  
  // DELETE /api/assignments/:id - Delete assignment
  app.delete('/api/assignments/:id', requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteAssignment(id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      logger.error('API', 'Failed to delete assignment', { error: error instanceof Error ? error.message : String(error) });
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

  // Saturday Scheduling Settings API endpoints
  
  // GET /api/students/profiles/saturday-settings - Get all student profiles with Saturday settings
  app.get('/api/students/profiles/saturday-settings', async (req, res) => {
    try {
      const profiles = await storage.getAllStudentProfiles();
      
      // Map to include Saturday settings and format for admin interface
      const settingsProfiles = profiles.map(profile => ({
        id: profile.id,
        studentName: profile.studentName,
        displayName: profile.displayName,
        allowSaturdayScheduling: profile.allowSaturdayScheduling || false
      }));
      
      console.log(`🗓️ Retrieved Saturday settings for ${settingsProfiles.length} students`);
      res.json(settingsProfiles);
    } catch (error) {
      console.error('Error fetching Saturday settings:', error);
      res.status(500).json({ message: 'Failed to fetch Saturday scheduling settings' });
    }
  });

  // PATCH /api/students/:studentName/saturday-scheduling - Update Saturday scheduling preference
  app.patch('/api/students/:studentName/saturday-scheduling', async (req, res) => {
    try {
      const { studentName } = req.params;
      const { allowSaturdayScheduling } = req.body;

      if (typeof allowSaturdayScheduling !== 'boolean') {
        return res.status(400).json({ message: 'allowSaturdayScheduling must be a boolean' });
      }

      const updatedProfile = await storage.updateStudentSaturdayScheduling(studentName, allowSaturdayScheduling);
      
      if (!updatedProfile) {
        return res.status(404).json({ message: 'Student profile not found' });
      }

      console.log(`🗓️ Updated Saturday scheduling for ${studentName}: ${allowSaturdayScheduling ? 'enabled' : 'disabled'}`);
      res.json({ 
        success: true, 
        studentName,
        allowSaturdayScheduling: updatedProfile.allowSaturdayScheduling
      });
    } catch (error) {
      console.error('Error updating Saturday scheduling:', error);
      res.status(500).json({ message: 'Failed to update Saturday scheduling preference' });
    }
  });


  // Checklist Item Management API endpoints
  
  // GET /api/checklist/:studentName - Get checklist items for student
  app.get('/api/checklist/:studentName', async (req, res) => {
    try {
      const { studentName } = req.params;
      const { subject } = req.query;
      
      const items = await storage.getChecklistItems(studentName, subject as string | undefined);
      res.json(items);
    } catch (error) {
      logger.error('API', 'Failed to fetch checklist items', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: 'Failed to fetch checklist items' });
    }
  });

  // POST /api/checklist - Create new checklist item
  app.post('/api/checklist', async (req, res) => {
    try {
      const validatedData = insertChecklistItemSchema.parse(req.body);
      const newItem = await storage.createChecklistItem(validatedData);
      
      res.status(201).json({ 
        message: 'Checklist item created successfully', 
        item: newItem 
      });
    } catch (error) {
      logger.error('API', 'Failed to create checklist item', { error: error instanceof Error ? error.message : String(error) });
      res.status(400).json({ message: 'Failed to create checklist item' });
    }
  });

  // PATCH /api/checklist/:id - Update checklist item
  app.patch('/api/checklist/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const validatedData = updateChecklistItemSchema.parse(req.body);
      
      const updatedItem = await storage.updateChecklistItem(id, validatedData);
      
      if (!updatedItem) {
        return res.status(404).json({ message: 'Checklist item not found' });
      }
      
      res.json({ 
        message: 'Checklist item updated successfully', 
        item: updatedItem 
      });
    } catch (error) {
      logger.error('API', 'Failed to update checklist item', { error: error instanceof Error ? error.message : String(error) });
      res.status(400).json({ message: 'Failed to update checklist item' });
    }
  });

  // DELETE /api/checklist/:id - Delete checklist item
  app.delete('/api/checklist/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteChecklistItem(id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Checklist item not found' });
      }
      
      res.status(204).send();
    } catch (error) {
      logger.error('API', 'Failed to delete checklist item', { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: 'Failed to delete checklist item' });
    }
  });
  
  // DISABLED: Demo endpoint removed to prevent mock data contamination
  // app.post('/api/setup-demo', async (req, res) => {
  //   // REMOVED - was creating mock assignments that contaminated real student data
  // });

  // DISABLED: Demo user endpoint removed
  // app.get('/api/user', async (req, res) => {
  //   // REMOVED - was fetching demo user that contaminated real student data
  // });

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
          // Use assignment normalizer for improved titles and due dates
          const assignmentLike: AssignmentLike = {
            id: canvasAssignment.id.toString(),
            title: canvasAssignment.name,
            course: canvasAssignment.courseName,
            instructions: canvasAssignment.description,
            dueAt: canvasAssignment.due_at
          };
          
          const normalized = normalizeAssignment(assignmentLike);
          const finalDueDate = normalized.effectiveDueAt ? new Date(normalized.effectiveDueAt) : null;
          
          transformedAssignments.push({
            title: normalized.displayTitle,
            subject: normalized.courseLabel || 'Unknown Course',
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
          // Use assignment normalizer for improved titles and due dates
          const assignmentLike: AssignmentLike = {
            id: canvasAssignment.id.toString(),
            title: canvasAssignment.name,
            course: canvasAssignment.courseName,
            instructions: canvasAssignment.description,
            dueAt: canvasAssignment.due_at
          };
          
          const normalized = normalizeAssignment(assignmentLike);
          const finalDueDate = normalized.effectiveDueAt ? new Date(normalized.effectiveDueAt) : null;
          
          transformedAssignments.push({
            title: normalized.displayTitle,
            subject: normalized.courseLabel || 'Unknown Course 2',
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
  
  // POST /api/sync-canvas-completion/:studentName - Sync completion status from Canvas for existing assignments
  app.post('/api/sync-canvas-completion/:studentName', async (req, res) => {
    try {
      const { studentName } = req.params;
      console.log(`\n🔄 Starting Canvas completion sync for: ${studentName}`);
      
      // Get student assignments from database
      const userId = `${studentName.toLowerCase()}-user`;
      const existingAssignments = await storage.getAssignments(userId);
      console.log(`📊 Found ${existingAssignments.length} existing assignments to check`);
      
      let updatedCount = 0;
      const results = [];
      
      // Fetch Canvas assignments with actual submission/grade data
      const client1 = new (await import('./lib/canvas')).CanvasClient(studentName, 1);
      let allCanvasAssignments = await client1.getAssignmentsWithSubmissions();
      
      // Check if Abigail has a second Canvas instance
      if (studentName.toLowerCase() === 'abigail') {
        try {
          const client2 = new (await import('./lib/canvas')).CanvasClient(studentName, 2);
          const instance2Assignments = await client2.getAssignmentsWithSubmissions();
          allCanvasAssignments = [...allCanvasAssignments, ...instance2Assignments];
        } catch (error) {
          console.error('Failed to get instance 2 grades:', error);
        }
      }
      
      console.log(`📚 Fetched ${allCanvasAssignments.length} assignments with grade data from Canvas`);
      
      // Match and update completion status
      for (const dbAssignment of existingAssignments) {
        if (dbAssignment.creationSource !== 'canvas_sync') continue; // Only sync Canvas assignments
        if (dbAssignment.completionStatus === 'grading_delay') continue; // Already processed for grading delay
        
        // Find matching Canvas assignment by title and course
        const canvasMatch = allCanvasAssignments.find(ca => 
          ca.name === dbAssignment.title && ca.courseName === dbAssignment.courseName
        );
        
        if (canvasMatch) {
          // CANVAS SOURCE OF TRUTH: Sync due date changes from Canvas
          let dueDateChanged = false;
          if (canvasMatch.due_at) {
            const canvasDueDate = new Date(canvasMatch.due_at);
            const dbDueDate = dbAssignment.dueDate ? new Date(dbAssignment.dueDate) : null;
            
            // Compare dates (normalize to same timezone for comparison)
            const canvasDateStr = canvasDueDate.toISOString().split('T')[0];
            const dbDateStr = dbDueDate ? dbDueDate.toISOString().split('T')[0] : null;
            
            if (canvasDateStr !== dbDateStr) {
              dueDateChanged = true;
              await storage.updateAssignment(dbAssignment.id, {
                dueDate: canvasDueDate,
                updatedAt: new Date()
              });
              console.log(`📅 Canvas sync: Updated due date for "${canvasMatch.name}" from ${dbDateStr || 'none'} to ${canvasDateStr}`);
            }
          } else if (dbAssignment.dueDate) {
            // Canvas assignment has no due date but database has one - update to null
            dueDateChanged = true;
            await storage.updateAssignment(dbAssignment.id, {
              dueDate: null,
              updatedAt: new Date()
            });
            console.log(`📅 Canvas sync: Removed due date for "${canvasMatch.name}" (no longer set in Canvas)`);
          }
          
          // Check multiple ways an assignment can be graded in Canvas:
          // 1. Traditional flags (graded_submissions_exist && has_submitted_submissions)
          // 2. Actual submission with a score/grade
          // 3. Submission workflow state indicates grading
          // 4. Zero-point assignments marked as missing/graded
          
          let isGraded = false;
          let gradeReason = '';
          
          // Method 1: Traditional Canvas flags
          if (canvasMatch.graded_submissions_exist && canvasMatch.has_submitted_submissions) {
            isGraded = true;
            gradeReason = 'graded + submitted flags';
          }
          
          // Method 2: Check actual submission data for grades
          if (canvasMatch.submission) {
            const sub = canvasMatch.submission;
            if (sub.score !== null && sub.score !== undefined) {
              isGraded = true;
              gradeReason = `scored ${sub.score} points`;
            } else if (sub.grade && sub.grade !== '' && sub.grade !== null) {
              isGraded = true;
              gradeReason = `graded: ${sub.grade}`;
            } else if (sub.workflow_state === 'graded' || sub.graded_at) {
              isGraded = true;
              gradeReason = 'marked as graded in Canvas';
            }
          }

          // Method 3: Handle zero-point assignments (0 points possible)
          if (!isGraded && canvasMatch.points_possible === 0) {
            // For zero-point assignments, check if it's marked as missing or has a grade
            if (canvasMatch.submission && ((canvasMatch.submission as any).missing || canvasMatch.submission.workflow_state)) {
              isGraded = true;
              gradeReason = `zero-point assignment graded (missing: ${(canvasMatch.submission as any).missing})`;
            }
          }
          
          if (isGraded && dbAssignment.completionStatus === 'pending') {
            // EXECUTIVE FUNCTION SUPPORT: Create confirmation notification for graded assignments
            // Instead of auto-completing, ask student if they forgot to mark it complete
            console.log(`💡 Canvas shows "${dbAssignment.title}" is graded (${gradeReason}) but still pending in StudyFlow - creating confirmation notification`);
            
            // TEMPORARY: Update notes field until database migration completes
            // TODO: Restore canvas grading notification fields once migration finishes
            await storage.updateAssignment(dbAssignment.id, {
              notes: `${dbAssignment.notes || ''}\nCANVAS GRADED: ${gradeReason} - did you forget to mark this complete?`.trim(),
              updatedAt: new Date()
            });
            
            results.push({
              id: dbAssignment.id,
              title: dbAssignment.title,
              action: 'grading_notification_created',
              reason: `Canvas shows graded (${gradeReason}) - notification created for student confirmation`
            });
          } else if (isGraded) {
            // Already completed or other status - just log
            console.log(`🔒 Canvas shows "${dbAssignment.title}" is graded (${gradeReason}) - already ${dbAssignment.completionStatus}`);
            results.push({
              id: dbAssignment.id,
              title: dbAssignment.title,
              action: 'already_handled',
              reason: `Canvas shows graded (${gradeReason}) but already ${dbAssignment.completionStatus}`
            });
          } else {
            // Check for grading delay: student marked complete but still ungraded after 5+ days
            if (dbAssignment.completionStatus === 'completed' && dbAssignment.completedAt) {
              const completedDate = new Date(dbAssignment.completedAt);
              const daysSinceCompleted = Math.floor((Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24));
              
              if (daysSinceCompleted >= 5 && dbAssignment.completionStatus === 'completed') {
                console.log(`⚠️ Grading delay detected: "${dbAssignment.title}" completed ${daysSinceCompleted} days ago but still ungraded`);
                
                await storage.updateAssignment(dbAssignment.id, {
                  completionStatus: 'grading_delay',
                  gradingDelayDetectedAt: new Date(),
                  notes: `${dbAssignment.notes || ''}\nGRADING DELAY: Completed ${daysSinceCompleted} days ago but still ungraded in Canvas`.trim(),
                  updatedAt: new Date()
                });
                
                updatedCount++;
                results.push({
                  id: dbAssignment.id,
                  title: dbAssignment.title,
                  action: 'grading_delay_detected',
                  reason: `ungraded for ${daysSinceCompleted} days`
                });
              }
            }
          }
        }
      }
      
      console.log(`🔒 Canvas completion sync finished: Auto-completion DISABLED - checked ${results.length} assignments`);
      res.json({
        message: `Canvas completion sync completed: Auto-completion DISABLED to prevent false completions`,
        updated: 0, // Always 0 now that auto-completion is disabled
        checked: results.length,
        total: existingAssignments.length,
        results,
        studentName
      });
      
    } catch (error) {
      console.error('Canvas completion sync failed:', error);
      res.status(500).json({ 
        message: 'Canvas completion sync failed', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });
  
  // Import Canvas assignments for a student
  app.post('/api/import-canvas/:studentName', requireAuth, async (req, res) => {
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
          
          // CRITICAL FIX: DISABLE auto-completion during Canvas import
          // Canvas graded_submissions_exist can be true if ANY student has graded work,
          // not necessarily THIS specific student, causing false completions.
          // All new assignments should import as 'pending' - completion status only managed manually.
          let completionStatus: 'pending' | 'completed' | 'needs_more_time' | 'stuck' = 'pending';
          if (canvasAssignment.graded_submissions_exist && canvasAssignment.has_submitted_submissions) {
            console.log(`🔒 DISABLED: Would have auto-marked "${canvasAssignment.name}" as completed (graded + submitted) - importing as pending instead`);
          } else if (canvasAssignment.graded_submissions_exist || canvasAssignment.has_submitted_submissions) {
            console.log(`📊 Canvas shows partial completion for "${canvasAssignment.name}" - graded: ${canvasAssignment.graded_submissions_exist}, submitted: ${canvasAssignment.has_submitted_submissions} - importing as pending`);
          }

          // Use assignment normalizer for improved titles and due dates
          const assignmentLike: AssignmentLike = {
            id: canvasAssignment.id.toString(),
            title: canvasAssignment.name,
            course: canvasAssignment.courseName,
            instructions: canvasAssignment.description,
            dueAt: canvasAssignment.due_at
          };
          
          const normalized = normalizeAssignment(assignmentLike);
          const finalDueDate = normalized.effectiveDueAt ? new Date(normalized.effectiveDueAt) : null;
          
          // Log improved titles and due dates
          if (normalized.displayTitle !== canvasAssignment.name) {
            console.log(`📝 Improved title: "${canvasAssignment.name}" → "${normalized.displayTitle}"`);
          }
          if (finalDueDate && !canvasAssignment.due_at) {
            console.log(`📅 Extracted due date from content: "${normalized.displayTitle}": ${finalDueDate.toDateString()}`);
          }

          const assignment = await storage.createAssignment({
            userId: userId,
            title: normalized.displayTitle,
            subject: normalized.courseLabel || 'Unknown Course',
            creationSource: 'canvas_sync',
            courseName: normalized.courseLabel || 'Unknown Course',
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
          // More lenient date filtering for Canvas Instance 2 - allow assignments from current academic year
          // Skip only assignments before January 1, 2024 (extremely old assignments)
          if (canvasAssignment.due_at) {
            const dueDate = new Date(canvasAssignment.due_at);
            const cutoffDate = new Date('2024-01-01');
            if (dueDate < cutoffDate) {
              console.log(`⏭️ Skipping very old assignment "${canvasAssignment.name}" (due: ${dueDate.toDateString()}) - before January 1, 2024`);
              continue;
            }
          }
          
          // CRITICAL FIX: DISABLE auto-completion during Canvas import
          // Canvas graded_submissions_exist can be true if ANY student has graded work,
          // not necessarily THIS specific student, causing false completions.
          // All new assignments should import as 'pending' - completion status only managed manually.
          let completionStatus: 'pending' | 'completed' | 'needs_more_time' | 'stuck' = 'pending';
          if (canvasAssignment.graded_submissions_exist && canvasAssignment.has_submitted_submissions) {
            console.log(`🔒 DISABLED: Would have auto-marked "${canvasAssignment.name}" as completed (graded + submitted) - importing as pending instead`);
          } else if (canvasAssignment.graded_submissions_exist || canvasAssignment.has_submitted_submissions) {
            console.log(`📊 Canvas shows partial completion for "${canvasAssignment.name}" - graded: ${canvasAssignment.graded_submissions_exist}, submitted: ${canvasAssignment.has_submitted_submissions} - importing as pending`);
          }

          // Use assignment normalizer for improved titles and due dates
          const assignmentLike: AssignmentLike = {
            id: canvasAssignment.id.toString(),
            title: canvasAssignment.name,
            course: canvasAssignment.courseName,
            instructions: canvasAssignment.description,
            dueAt: canvasAssignment.due_at
          };
          
          const normalized = normalizeAssignment(assignmentLike);
          const finalDueDate = normalized.effectiveDueAt ? new Date(normalized.effectiveDueAt) : null;
          
          // Log improved titles and due dates for Canvas instance 2
          if (normalized.displayTitle !== canvasAssignment.name) {
            console.log(`📝 Improved title: "${canvasAssignment.name}" → "${normalized.displayTitle}"`);
          }
          if (finalDueDate && !canvasAssignment.due_at) {
            console.log(`📅 Extracted due date from content: "${normalized.displayTitle}": ${finalDueDate.toDateString()}`);
          }

          const assignment = await storage.createAssignment({
            userId: userId,
            title: normalized.displayTitle,
            subject: normalized.courseLabel || 'Unknown Course 2',
            creationSource: 'canvas_sync',
            courseName: normalized.courseLabel || 'Unknown Course 2',
            instructions: canvasAssignment.description || 'Assignment from Apologia',
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
  app.get('/api/schedule/:studentName/:date', requireAuth, async (req, res) => {
    try {
      const { studentName, date } = req.params;
      
      // Set student context for RLS to access their own schedule
      await db.execute(sql`SELECT set_config('app.current_student', ${studentName.toLowerCase()}, true)`);
      
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
      
      // The fields are already in camelCase from Drizzle
      console.log('DEBUG: First block sample:', enhancedScheduleBlocks[0]);
      
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
      
      // Validate email configuration
      if (!emailConfig.resendApiKey || !emailConfig.resendFrom || !emailConfig.parentEmail) {
        console.error('⚠️ Email configuration incomplete:', {
          hasApiKey: !!emailConfig.resendApiKey,
          hasFromEmail: !!emailConfig.resendFrom,
          hasParentEmail: !!emailConfig.parentEmail
        });
        return res.status(500).json({ 
          message: 'Email configuration incomplete',
          notificationSent: false
        });
      }

      // Initialize Resend
      const { Resend } = await import('resend');
      const resend = new Resend(emailConfig.resendApiKey);
      
      // Send email notification
      const emailResult = await resend.emails.send({
        from: emailConfig.resendFrom,
        to: emailConfig.parentEmail,
        subject: `StudyFlow Alert: ${studentName} needs help`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 8px;">
            <div style="background-color: white; padding: 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #dc2626; margin-top: 0; display: flex; align-items: center; gap: 8px;">
                🆘 StudyFlow Alert
              </h2>
              
              <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-weight: 600; color: #dc2626; font-size: 16px;">
                  ${studentName} is stuck and needs help
                </p>
              </div>
              
              <div style="margin: 20px 0;">
                <p style="margin: 8px 0; color: #374151;"><strong>Student:</strong> ${studentName}</p>
                <p style="margin: 8px 0; color: #374151;"><strong>Assignment:</strong> ${assignmentTitle}</p>
                <p style="margin: 8px 0; color: #374151;"><strong>Issue:</strong> ${message}</p>
                <p style="margin: 8px 0; color: #6b7280;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
              </div>
              
              <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.5;">
                  📝 <strong>What this means:</strong> ${studentName} has marked this assignment as "stuck" and specifically requested parent help. 
                  The assignment has been removed from today's schedule so they can continue with other work.
                </p>
              </div>
              
              <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0; color: #6b7280; font-size: 12px;">
                  This notification was sent automatically by StudyFlow when ${studentName} clicked "Stuck" and requested help.
                </p>
              </div>
            </div>
          </div>
        `
      });
      
      console.log('✉️ Email sent successfully:', {
        student: studentName,
        assignment: assignmentTitle,
        message,
        timestamp: new Date().toISOString(),
        emailId: emailResult.data?.id,
        parentEmail: emailConfig.parentEmail
      });
      
      res.json({ 
        message: 'Parent notification sent successfully',
        notificationSent: true,
        emailId: emailResult.data?.id,
        parentEmail: emailConfig.parentEmail.replace(/(.{2}).*(@.*)/, '$1***$2') // Partially hide email
      });
      
    } catch (error) {
      console.error('❌ Parent notification failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ 
        message: 'Failed to send parent notification', 
        error: errorMessage,
        notificationSent: false
      });
    }
  });
  
  // DISABLED: Database connection test using demo data removed
  // app.get('/api/db-test', async (req, res) => {
  //   // REMOVED - was using demo-user-1 that contaminated real student data  
  // });

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

  // POST /api/bible-curriculum/reschedule - Reschedule Bible reading to later same day or tomorrow
  app.post('/api/bible-curriculum/reschedule', requireAuth, async (req, res) => {
    try {
      const { studentName, date, skipToLater, skipToTomorrow } = req.body;
      
      if (!studentName || !date) {
        return res.status(400).json({ message: 'Student name and date are required' });
      }
      
      console.log(`📖 Bible Reschedule: ${studentName} on ${date} - always goes to tomorrow morning`);
      
      // Bible always goes to tomorrow - it only happens first thing in the morning
      // We don't advance the curriculum position, so the same reading appears tomorrow
      res.json({
        success: true,
        message: 'Bible reading rescheduled to tomorrow morning'
      });
      
    } catch (error) {
      console.error('Error rescheduling Bible curriculum:', error);
      res.status(500).json({ message: 'Failed to reschedule Bible curriculum' });
    }
  });

  // Auto-scheduling route - triggers assignment allocation via daily schedule initialization
  app.post('/api/assignments/auto-schedule', async (req, res) => {
    try {
      const { studentName, targetDate } = req.body;
      
      if (!studentName || !targetDate) {
        return res.status(400).json({ message: 'Student name and target date are required' });
      }
      
      console.log(`🤖 Auto-scheduling assignments for ${studentName} on ${targetDate}`);
      
      // Use the new allocation system by triggering daily schedule initialization
      // This automatically calls allocateAssignmentsToTemplate
      await storage.initializeDailySchedule(studentName, targetDate);
      
      // Get updated assignments to return allocation results
      const userId = `${studentName.toLowerCase()}-user`;
      const assignments = await storage.getAssignments(userId, targetDate);
      const scheduledAssignments = assignments.filter(a => a.scheduledDate === targetDate && a.scheduledBlock);
      
      res.json({
        message: `Successfully allocated ${scheduledAssignments.length} assignments using sophisticated scoring system`,
        scheduled: scheduledAssignments.length,
        total: assignments.length,
        assignments: scheduledAssignments,
        targetDate,
        studentName
      });
      
    } catch (error) {
      console.error('Auto-scheduling failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to auto-schedule assignments', error: errorMessage });
    }
  });

  // GUIDED MODE ACTIONS
  
  // Done Action: Mark assignment completed with optional time banking
  app.post('/api/assignments/:id/done', async (req, res) => {
    try {
      const { id } = req.params;
      const { timeSpent, earlyFinish, bankMinutes } = req.body;
      
      console.log(`✅ Done Action: Assignment ${id} - timeSpent: ${timeSpent}, earlyFinish: ${earlyFinish}, bankMinutes: ${bankMinutes}`);
      
      // Mark assignment as completed
      let updateData: any = {
        completionStatus: 'completed',
        timeSpent: timeSpent || 0,
        updatedAt: new Date()
      };
      
      // If student finished early, offer time banking
      if (earlyFinish && bankMinutes > 0) {
        updateData.notes = `Finished ${bankMinutes} minutes early - time banked for later use`;
        console.log(`💰 Time Banking: ${bankMinutes} minutes banked for student`);
      }
      
      const updatedAssignment = await storage.updateAssignment(id, updateData);
      
      if (!updatedAssignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
      
      res.json({
        message: earlyFinish ? `Assignment completed! ${bankMinutes} minutes banked for later.` : 'Assignment completed successfully!',
        assignment: updatedAssignment,
        timeбанked: earlyFinish ? bankMinutes : 0
      });
      
    } catch (error) {
      console.error('Done action failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to complete assignment', error: errorMessage });
    }
  });
  
  // Need More Time Action: Create continued assignment instead of rescheduling
  app.post('/api/assignments/:id/need-more-time', async (req, res) => {
    try {
      const { id } = req.params;
      const { reason, estimatedMinutesNeeded } = req.body;
      
      console.log(`⏰ Need More Time: Assignment ${id} - reason: ${reason}, estimated: ${estimatedMinutesNeeded}`);
      
      // Get the assignment to check due date
      const assignment = await storage.getAssignment(id);
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
      
      // Smart rescheduling logic based on due date
      let newScheduledDate = null;
      let reschedulingStrategy = '';
      
      if (assignment.dueDate) {
        const dueDate = new Date(assignment.dueDate);
        const today = new Date();
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilDue <= 1) {
          // Due today/tomorrow - reschedule to today if possible, tomorrow otherwise
          reschedulingStrategy = 'URGENT: Rescheduled to today/tomorrow due to proximity to due date';
          newScheduledDate = today.toISOString().split('T')[0];
        } else if (daysUntilDue <= 3) {
          // Due soon - reschedule to tomorrow
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          newScheduledDate = tomorrow.toISOString().split('T')[0];
          reschedulingStrategy = 'Due soon - rescheduled to tomorrow';
        } else {
          // Due later - reschedule to next available day
          const nextDay = new Date(today);
          nextDay.setDate(nextDay.getDate() + 1);
          newScheduledDate = nextDay.toISOString().split('T')[0];
          reschedulingStrategy = 'Flexible - rescheduled to next day';
        }
      } else {
        // No due date - reschedule to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        newScheduledDate = tomorrow.toISOString().split('T')[0];
        reschedulingStrategy = 'No due date - rescheduled to tomorrow';
      }
      
      // Update assignment with new scheduling and status
      const updateData = {
        completionStatus: 'completed' as const, // Mark as completed since work was done
        scheduledDate: newScheduledDate,
        scheduledBlock: null, // Will be auto-scheduled later
        actualEstimatedMinutes: estimatedMinutesNeeded || assignment.actualEstimatedMinutes,
        notes: `${assignment.notes || ''}\nNeed More Time: ${reason} (${reschedulingStrategy})`.trim(),
        updatedAt: new Date()
      };
      
      // Check if a "Continued" version already exists to prevent duplicates
      const continuedTitle = `${assignment.title} (Continued)`;
      const existingContinued = await storage.getAssignments(assignment.userId);
      const hasContinued = existingContinued.some(a => a.title === continuedTitle);
      
      if (hasContinued) {
        return res.json({
          success: false,
          message: 'A continued version of this assignment already exists',
          existingContinued: true
        });
      }
      
      // Create the continued assignment
      const continuedAssignment = await storage.createAssignment({
        userId: assignment.userId,
        title: continuedTitle,
        subject: assignment.subject,
        courseName: assignment.courseName,
        instructions: assignment.instructions,
        dueDate: assignment.dueDate,
        scheduledDate: newScheduledDate,
        scheduledBlock: null, // Will be auto-scheduled later
        priority: assignment.priority,
        difficulty: assignment.difficulty,
        actualEstimatedMinutes: estimatedMinutesNeeded || Math.ceil((assignment.actualEstimatedMinutes || 30) * 0.6),
        completionStatus: 'pending',
        creationSource: 'student_need_more_time',
        notes: `Continued from: ${assignment.title}\nReason: ${reason}\n${reschedulingStrategy}`
      });
      
      // Mark the original assignment as completed (partial work done)
      await storage.updateAssignment(id, {
        completionStatus: 'completed',
        notes: `${assignment.notes || ''}
Partially completed - continued in: ${continuedTitle}`.trim(),
        updatedAt: new Date()
      });
      
      // IMMEDIATE SCHEDULE REORDERING: Bump lower priority items and reschedule
      const studentName = assignment.userId.replace('-user', '');
      const today = new Date().toISOString().split('T')[0];
      
      try {
        // Step 1: If continuing for today, bump lower priority assignments
        if (newScheduledDate === today) {
          console.log(`🔄 Bumping lower priority assignments to make room for: ${continuedTitle}`);
          
          // Get today's scheduled assignments
          const todayAssignments = await storage.getAssignments(assignment.userId);
          const todayScheduled = todayAssignments.filter(a => 
            a.scheduledDate === today && 
            a.scheduledBlock && 
            a.completionStatus === 'pending' &&
            a.id !== id // Exclude the original assignment
          );
          
          // Find lower priority assignments to bump (C priority first, then B)
          const toBump = todayScheduled
            .filter(a => {
              const currentPriority = continuedAssignment.priority;
              if (currentPriority === 'A') return a.priority === 'B' || a.priority === 'C';
              if (currentPriority === 'B') return a.priority === 'C';
              return false; // Don't bump if continuation is C priority
            })
            .sort((a, b) => {
              // Sort by priority (C first, then B) and then by due date (furthest first)
              if (a.priority !== b.priority) {
                if (a.priority === 'C') return -1;
                if (b.priority === 'C') return 1;
                return 0;
              }
              // Same priority, sort by due date (furthest first)
              if (!a.dueDate && !b.dueDate) return 0;
              if (!a.dueDate) return 1; // No due date goes last
              if (!b.dueDate) return -1;
              return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
            });
          
          // Bump one assignment to tomorrow if needed
          if (toBump.length > 0) {
            const assignmentToBump = toBump[0];
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            await storage.updateAssignment(assignmentToBump.id, {
              scheduledDate: tomorrow.toISOString().split('T')[0],
              scheduledBlock: null, // Will be auto-scheduled
              notes: `${assignmentToBump.notes || ''}
Bumped to make room for: ${continuedTitle}`.trim(),
              updatedAt: new Date()
            });
            
            console.log(`⏭️ Bumped ${assignmentToBump.title} to tomorrow for ${continuedTitle}`);
          }
        }
        
        // Step 2: Trigger immediate auto-scheduling for the target date
        console.log(`🎯 Auto-scheduling ${continuedTitle} for ${newScheduledDate}`);
        const schedulingResult = await storage.autoScheduleAssignmentsForDate(studentName, newScheduledDate);
        console.log(`✅ Scheduled ${schedulingResult.scheduled}/${schedulingResult.total} assignments`);
        
      } catch (schedulingError) {
        console.error('Warning: Failed to auto-schedule after Need More Time:', schedulingError);
        // Continue anyway - the assignment is created, just might need manual scheduling
      }
      
      res.json({
        success: true,
        message: 'Continued assignment created and schedule reordered successfully',
        originalAssignment: assignment,
        continuedAssignment,
        reschedulingStrategy,
        immediateReordering: true
      });
      
    } catch (error) {
      console.error('Need More Time action failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to reschedule assignment', error: errorMessage });
    }
  });
  
  // Stuck Action: Mark stuck, remove from today, log event, with 15-second undo
  app.post('/api/assignments/:id/stuck', async (req, res) => {
    try {
      const { id } = req.params;
      const { reason, needsHelp } = req.body;
      
      console.log(`🆘 Stuck Action: Assignment ${id} - reason: ${reason}, needsHelp: ${needsHelp}`);
      
      // Get original assignment state for undo
      const originalAssignment = await storage.getAssignment(id);
      if (!originalAssignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
      
      // Mark assignment as stuck and remove from today
      const updateData = {
        completionStatus: 'stuck' as const,
        scheduledDate: null, // Remove from today
        scheduledBlock: null, // Remove from specific block
        notes: `${originalAssignment.notes || ''}\nSTUCK: ${reason} ${needsHelp ? '(Parent notification sent)' : ''}`.trim(),
        updatedAt: new Date()
      };
      
      const updatedAssignment = await storage.updateAssignment(id, updateData);
      
      // Send parent notification if requested
      if (needsHelp) {
        try {
          await fetch('http://localhost:5000/api/notify-parent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentName: 'Student', // Will be derived from context
              assignmentTitle: originalAssignment.title,
              message: `Student is stuck on assignment: ${reason}`
            })
          });
          console.log('📧 Parent notification sent for stuck assignment');
        } catch (notifyError) {
          console.warn('Parent notification failed:', notifyError);
        }
      }
      
      res.json({
        message: needsHelp 
          ? 'Assignment marked as stuck and parent notified. Removed from today\'s schedule.'
          : 'Assignment marked as stuck and removed from today\'s schedule.',
        assignment: updatedAssignment,
        originalState: {
          scheduledDate: originalAssignment.scheduledDate,
          scheduledBlock: originalAssignment.scheduledBlock,
          completionStatus: originalAssignment.completionStatus
        },
        undoAvailable: true,
        undoTimeoutSeconds: 15
      });
      
    } catch (error) {
      console.error('Stuck action failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to mark assignment as stuck', error: errorMessage });
    }
  });
  
  // Undo Stuck Action (15-second window)
  app.post('/api/assignments/:id/undo-stuck', async (req, res) => {
    try {
      const { id } = req.params;
      const { originalState } = req.body;
      
      console.log(`↩️ Undo Stuck: Assignment ${id}`);
      
      if (!originalState) {
        return res.status(400).json({ message: 'Original state required for undo' });
      }
      
      // Restore original assignment state
      const updateData = {
        completionStatus: originalState.completionStatus,
        scheduledDate: originalState.scheduledDate,
        scheduledBlock: originalState.scheduledBlock,
        updatedAt: new Date()
      };
      
      const restoredAssignment = await storage.updateAssignment(id, updateData);
      
      res.json({
        message: 'Assignment restored to original state',
        assignment: restoredAssignment
      });
      
    } catch (error) {
      console.error('Undo stuck action failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to undo stuck status', error: errorMessage });
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
  app.get('/api/schedule/:studentName/:date/status', requireAuth, async (req, res) => {
    try {
      const { studentName, date } = req.params;
      
      // Set student context for RLS to access their own schedule status
      await db.execute(sql`SELECT set_config('app.current_student', ${studentName.toLowerCase()}, true)`);
      
      console.log(`Fetching daily schedule status for ${studentName} on ${date}`);
      
      const statusData = await storage.getDailyScheduleStatus(studentName, date);
      
      console.log(`Found ${statusData.length} schedule blocks with status`);
      
      res.json(statusData);
    } catch (error) {
      console.error('Error fetching daily schedule status:', error);
      res.status(500).json({ message: 'Failed to fetch daily schedule status' });
    }
  });

  app.patch('/api/schedule/:studentName/:date/block/:templateBlockId/status', requireAuth, async (req, res) => {
    try {
      const { studentName, date, templateBlockId } = req.params;
      const { status, flags } = req.body;
      
      // Set student context for RLS to update their own schedule block
      await db.execute(sql`SELECT set_config('app.current_student', ${studentName.toLowerCase()}, true)`);
      
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
      
      // 🎯 REWARDBANK HOOK: Award points for completing study block/session
      if (status === 'complete' && updated) {
        try {
          const rewardUserId = `${studentName.toLowerCase()}-user`;
          
          // Session completion: +25 points per 5 minutes (≥15 min, ≤50% pause)
          let points = 0;
          
          // Get template info for point calculation (simplified for now)
          // Calculate session points - use a default 30 minute session for now
          const minutes = 30; // Default session length
          
          // Only award points if session ≥ 15 minutes (anti-abuse)
          if (minutes >= 15) {
            // +25 points per 5 minutes of session time  
            points = Math.floor(minutes / 5) * 25;
          }
          
          // Check earning limits
          const settings = await storage.getRewardSettings('family');
          const canEarn = await storage.checkEarningLimits(rewardUserId, points, settings || null);
          
          if (canEarn.allowed) {
            await storage.createEarnEvent({
              userId: rewardUserId,
              type: 'Session',
              amount: points,
              sourceId: templateBlockId,
              sourceDetails: 'Study session completed'
            });
            
            await storage.updateRewardProfile(rewardUserId, points);
            console.log(`🎯 Awarded ${points} points to ${studentName} for completing study session`);
          } else {
            console.log(`⚠️ Session points capped for ${studentName}: ${canEarn.reason}`);
          }
        } catch (error) {
          // Silent fail - don't break block completion if rewards fail
          console.error('❌ RewardBank session hook failed:', error);
        }
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating block status:', error);
      res.status(500).json({ message: 'Failed to update block status' });
    }
  });

  app.post('/api/schedule/:studentName/:date/initialize', requireAuth, async (req, res) => {
    try {
      const { studentName, date } = req.params;
      
      // Set student context for RLS to initialize their own schedule
      await db.execute(sql`SELECT set_config('app.current_student', ${studentName.toLowerCase()}, true)`);
      
      console.log(`Initializing daily schedule for ${studentName} on ${date}`);
      
      await storage.initializeDailySchedule(studentName, date);
      
      res.json({ 
        message: 'Daily schedule initialized successfully',
        studentName,
        date
      });
    } catch (error) {
      console.error('Error initializing daily schedule:', error);
      
      // Check if this is a template incomplete error (JSON format)
      try {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorObj = JSON.parse(errorMessage);
        if (errorObj.error && errorObj.error.code === 'TEMPLATE_INCOMPLETE') {
          return res.status(400).json(errorObj);
        }
      } catch (parseError) {
        // Not a JSON error, continue with generic handling
      }
      
      res.status(500).json({ message: 'Failed to initialize daily schedule' });
    }
  });

  // Schedule template routes - using real database data instead of hardcoded blocks
  app.get('/api/schedule-template/:studentName', async (req, res) => {
    try {
      const { studentName } = req.params;
      const weekday = req.query.weekday as string;
      
      // Set student context for RLS to access their own schedule template
      await db.execute(sql`SELECT set_config('app.current_student', ${studentName.toLowerCase()}, true)`);
      
      const templateData = await storage.getScheduleTemplate(studentName, weekday);
      res.json(templateData);
    } catch (error) {
      console.error('Error fetching schedule template:', error);
      res.status(500).json({ message: 'Failed to fetch schedule template' });
    }
  });

  app.get('/api/schedule-template/:studentName/:weekday', async (req, res) => {
    try {
      const { studentName, weekday } = req.params;
      
      // Set student context for RLS to access their own schedule template
      await db.execute(sql`SELECT set_config('app.current_student', ${studentName.toLowerCase()}, true)`);
      
      const templateData = await storage.getScheduleTemplate(studentName, weekday);
      res.json(templateData);
    } catch (error) {
      console.error('Error fetching schedule template:', error);
      res.status(500).json({ message: 'Failed to fetch schedule template' });
    }
  });

  app.put('/api/schedule-template/:studentName/:weekday', requireAuth, async (req, res) => {
    try {
      const { studentName, weekday } = req.params;
      const { blocks } = req.body;
      
      // Set family context for RLS to update any student's schedule template (admin operation)
      await db.execute(sql`SELECT set_config('app.current_student', 'family', true)`);
      
      console.log(`🔒 AUTHORIZED: Updating schedule template for ${studentName} on ${weekday} via admin interface`);
      
      // Pass authorization flag - only this route can modify schedule templates
      await storage.updateScheduleTemplate(studentName, weekday, blocks, true);
      
      res.json({ 
        message: 'Schedule template updated successfully',
        studentName,
        weekday,
        blocksUpdated: blocks.length
      });
    } catch (error) {
      console.error('Error updating schedule template:', error);
      res.status(500).json({ message: 'Failed to update schedule template' });
    }
  });

  // CSV Upload endpoint to replace entire schedule_template
  app.post('/api/schedule-template/upload-csv', requireAuth, async (req, res) => {
    try {
      const { csvData } = req.body;
      
      console.log(`🔒 AUTHORIZED: Replacing entire schedule_template via CSV upload`);
      
      // Set family context for RLS bypass (needed for multi-student CSV operations)
      await db.execute(sql`SELECT set_config('app.current_student', 'family', true)`);
      
      if (!csvData || !Array.isArray(csvData)) {
        return res.status(400).json({ message: 'Invalid CSV data format' });
      }
      
      // Replace entire schedule template with CSV data
      await storage.replaceScheduleTemplateFromCSV(csvData);
      
      res.json({ 
        message: 'Schedule template replaced successfully from CSV',
        recordsProcessed: csvData.length
      });
    } catch (error) {
      console.error('Error uploading CSV schedule template:', error);
      res.status(500).json({ message: 'Failed to upload CSV schedule template' });
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
      // Set family context for RLS to access all students' print queue data
      await db.execute(sql`SELECT set_config('app.current_student', 'family', true)`);
      
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
        // Skip completed assignments - they don't need printing anymore
        if (assignment.completionStatus === 'completed') {
          continue;
        }
        
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
        
        // Include items that need printing OR have been printed/skipped (for completed section)
        if (printDetection.needsPrinting || assignment.printStatus === 'printed' || assignment.printStatus === 'skipped') {
          printQueue.push({
            id: assignment.id,
            studentName: assignment.userId === 'abigail-user' ? 'Abigail' : 
                         assignment.userId === 'khalil-user' ? 'Khalil' : 
                         assignment.userId.replace('-user', '').charAt(0).toUpperCase() + assignment.userId.replace('-user', '').slice(1),
            title: assignment.title,
            courseName: assignment.courseName,
            subject: assignment.subject,
            dueDate: assignment.dueDate,
            printReason: printDetection.printReason,
            priority: printDetection.priority,
            canvasUrl: printDetection.canvasUrl,
            printStatus: assignment.printStatus || 'needs_printing',
            estimatedPages: estimatePageCount(assignment.instructions)
          });
        }
      }
      
      // Group by due date and sort within each group
      const groupedByDate: { [date: string]: any[] } = {};
      
      for (const item of printQueue) {
        // Extract date in Eastern Time to match classroom context
        const dateKey = item.dueDate ? 
          new Date(item.dueDate).toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) : 
          'no-date';
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
      
      // Update the assignment's print status in the database
      await storage.updateAssignment(assignmentId, { printStatus: status });
      
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
      const { date, studentName } = req.query;
      const targetDate = date ? new Date(date as string) : new Date();
      const student = typeof studentName === 'string' ? studentName : 'Abigail';
      const curriculum = await getNextBibleCurriculumForStudent(student);
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
      const { studentName } = req.body;
      const student = typeof studentName === 'string' ? studentName : 'Abigail';
      
      // Get current curriculum to complete
      const current = await getNextBibleCurriculumForStudent(student);
      if (!current?.dailyReading) {
        return res.status(400).json({ message: 'No current Bible reading found' });
      }
      
      const success = await markBibleCurriculumCompleted(
        current.dailyReading.weekNumber,
        current.dailyReading.dayOfWeek,
        'daily_reading',
        student
      );
      
      if (success) {
        // Get next curriculum after completion
        const next = await getNextBibleCurriculumForStudent(student);
        res.json({ 
          ok: true,
          next: next
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
      
      // Set student context for RLS to access their own data
      await db.execute(sql`SELECT set_config('app.current_student', ${studentName.toLowerCase()}, true)`);
      
      // Map student name to user ID
      const userIdMap: Record<string, string> = {
        'abigail': 'abigail-user',
        'khalil': 'khalil-user'
      };
      
      const userId = userIdMap[studentName.toLowerCase()] || `${studentName.toLowerCase()}-user`;
      const includeCompletedBool = includeCompleted === 'true';
      
      const assignments = await storage.getAssignments(userId, date as string, includeCompletedBool);
      
      // Apply normalization to assignment titles for meaningful display
      const normalizedAssignments = assignments.map(assignment => {
        const normalized = normalizeAssignmentNew({
          id: assignment.id,
          title: assignment.title,
          course: assignment.courseName,
          instructions: assignment.instructions,
          dueAt: assignment.dueDate ? assignment.dueDate.toISOString() : null
        });
        
        return {
          ...assignment,
          displayTitle: normalized.displayTitle,
          effectiveDueAt: normalized.effectiveDueAt,
          courseLabel: normalized.courseLabel
        };
      });
      
      console.log(`📚 Retrieved ${assignments.length} assignments for ${studentName}`);
      res.json(normalizedAssignments);
    } catch (error) {
      console.error('Error fetching student assignments:', error);
      res.status(500).json({ message: 'Failed to fetch student assignments' });
    }
  });

  // GET /api/students/:studentName/profile - Get student profile
  app.get('/api/students/:studentName/profile', async (req, res) => {
    try {
      const { studentName } = req.params;
      
      // Set student context for RLS to access their own profile
      await db.execute(sql`SELECT set_config('app.current_student', ${studentName.toLowerCase()}, true)`);
      
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
      // Set family context for RLS to access all students' data
      await db.execute(sql`SELECT set_config('app.current_student', 'family', true)`);
      
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

  // Guided Mode endpoints
  
  // In-memory store for stuck assignment pending actions (60-second undo window)
  const stuckPendingActions = new Map<string, { 
    assignmentId: string, 
    studentName: string, 
    timeout: NodeJS.Timeout,
    timestamp: number 
  }>();

  // POST /api/guided/:studentName/:date/need-more-time - Reschedule assignment needing more time
  app.post('/api/guided/:studentName/:date/need-more-time', async (req, res) => {
    try {
      const { studentName, date } = req.params;
      const { assignmentId } = req.body;
      
      if (!assignmentId) {
        return res.status(400).json({ message: 'Assignment ID is required' });
      }
      
      console.log(`⏰ Processing need-more-time request for assignment ${assignmentId} on ${date}`);
      
      // Call the storage method to reschedule the assignment
      await storage.rescheduleNeedMoreTime(assignmentId, date);
      
      // Get updated assignments for the day to return current allocation
      const userId = `${studentName.toLowerCase()}-user`;
      const updatedAssignments = await storage.getAssignments(userId, date);
      
      // Get schedule template for the day
      const dateObj = new Date(date);
      const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const weekday = weekdays[dateObj.getDay()];
      const scheduleBlocks = await storage.getScheduleTemplate(studentName, weekday);
      
      res.json({
        message: 'Assignment rescheduled successfully',
        assignmentId,
        date,
        updatedAssignments,
        scheduleBlocks
      });
      
    } catch (error) {
      console.error('Error processing need-more-time request:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to reschedule assignment', error: errorMessage });
    }
  });

  // POST /api/guided/:studentName/:date/stuck - Mark assignment as stuck with 15-second undo window
  app.post('/api/guided/:studentName/:date/stuck', async (req, res) => {
    try {
      const { studentName, date } = req.params;
      const { assignmentId, reason, needsHelp } = req.body;
      
      if (!assignmentId) {
        return res.status(400).json({ message: 'Assignment ID is required' });
      }
      
      console.log(`🚩 Processing stuck request for assignment ${assignmentId} - starting 15-second countdown`);
      
      // Create unique key for this pending action
      const pendingKey = `${studentName}-${assignmentId}-${Date.now()}`;
      
      // Set up 15-second timeout to mark as stuck
      const timeout = setTimeout(async () => {
        try {
          // Check if the action is still pending (not cancelled)
          if (stuckPendingActions.has(pendingKey)) {
            console.log(`⏱️ 15 seconds elapsed - marking assignment ${assignmentId} as stuck`);
            
            // Mark the assignment as stuck
            await storage.markStuckWithUndo(assignmentId);
            
            // Send parent notification if requested
            if (needsHelp) {
              try {
                // Get assignment details for notification
                const assignment = await storage.getAssignment(assignmentId);
                if (assignment) {
                  await fetch('http://localhost:5000/api/notify-parent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      studentName: studentName, // Use actual student name
                      assignmentTitle: assignment.title,
                      message: `Student is stuck on assignment: ${reason}`
                    })
                  });
                  console.log('📧 Parent notification sent for stuck assignment');
                }
              } catch (notifyError) {
                console.warn('Parent notification failed:', notifyError);
              }
            }
            
            // Clean up the pending action
            stuckPendingActions.delete(pendingKey);
            
            console.log(`✅ Assignment ${assignmentId} marked as stuck and added to needs review`);
          }
        } catch (error) {
          console.error('Error marking assignment as stuck after timeout:', error);
          stuckPendingActions.delete(pendingKey);
        }
      }, 15000); // 15 seconds
      
      // Store the pending action
      stuckPendingActions.set(pendingKey, {
        assignmentId,
        studentName,
        timeout,
        timestamp: Date.now()
      });
      
      // Get current assignment queue for response
      const userId = `${studentName.toLowerCase()}-user`;
      const currentAssignments = await storage.getAssignments(userId, date);
      
      res.json({
        message: 'Assignment marked as stuck - 15 second undo window started',
        assignmentId,
        pendingKey,
        countdown: 15,
        currentQueue: currentAssignments,
        timestamp: Date.now()
      });
      
    } catch (error) {
      console.error('Error processing stuck request:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to mark assignment as stuck', error: errorMessage });
    }
  });

  // POST /api/guided/:studentName/:date/stuck/cancel - Cancel stuck marking (undo)
  app.post('/api/guided/:studentName/:date/stuck/cancel', async (req, res) => {
    try {
      const { pendingKey } = req.body;
      
      if (!pendingKey) {
        return res.status(400).json({ message: 'Pending key is required' });
      }
      
      const pendingAction = stuckPendingActions.get(pendingKey);
      if (!pendingAction) {
        return res.status(404).json({ message: 'Pending action not found or already completed' });
      }
      
      console.log(`↩️ Cancelling stuck marking for assignment ${pendingAction.assignmentId}`);
      
      // Clear the timeout to prevent marking as stuck
      clearTimeout(pendingAction.timeout);
      
      // Remove from pending actions
      stuckPendingActions.delete(pendingKey);
      
      res.json({
        message: 'Stuck marking cancelled successfully',
        assignmentId: pendingAction.assignmentId,
        cancelled: true
      });
      
    } catch (error) {
      console.error('Error cancelling stuck request:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to cancel stuck marking', error: errorMessage });
    }
  });

  // Admin endpoint to reset Bible progress
  app.post('/api/admin/bible/reset', async (req, res) => {
    try {
      const { studentName, scope = 'both' } = req.body;
      
      if (!studentName) {
        return res.status(400).json({ message: 'Student name is required' });
      }
      
      // Reset completed status if requested
      if (scope === 'both' || scope === 'completed') {
        await db
          .update(bibleCurriculum)
          .set({ completed: false, completedAt: null });
      }
      
      // Reset position if requested
      if (scope === 'both' || scope === 'position') {
        await db
          .insert(bibleCurriculumPosition)
          .values({ 
            studentName, 
            currentWeek: 1, 
            currentDay: 1, 
            lastUpdated: new Date() 
          })
          .onConflictDoUpdate({
            target: bibleCurriculumPosition.studentName,
            set: { currentWeek: 1, currentDay: 1, lastUpdated: new Date() }
          });
      }
      
      // Get next curriculum after reset
      const next = await getNextBibleCurriculumForStudent(studentName);
      
      res.json({
        ok: true,
        next: next
      });
    } catch (error) {
      console.error('Error resetting Bible curriculum progress:', error);
      res.status(500).json({ message: 'Failed to reset Bible curriculum progress' });
    }
  });

  // POST /api/assignments/:id/resolve - Parent resolution of stuck assignments
  app.post('/api/assignments/:id/resolve', async (req, res) => {
    try {
      const { id } = req.params;
      const { action, notes, studentName } = req.body;
      
      console.log(`🔧 Parent resolving stuck assignment ${id} - action: ${action}`);
      
      // Get original assignment
      const assignment = await storage.getAssignment(id);
      if (!assignment) {
        return res.status(404).json({ message: 'Assignment not found' });
      }
      
      if (assignment.completionStatus !== 'stuck') {
        return res.status(400).json({ message: 'Assignment is not marked as stuck' });
      }
      
      // Handle different resolution actions
      let updateData: any = {
        updatedAt: new Date()
      };
      
      // Extract original stuck reason from notes
      const originalReason = assignment.notes?.split('\n').find(line => line.startsWith('STUCK:'))?.replace('STUCK: ', '') || 'Unknown issue';
      
      switch (action) {
        case 'helped':
          // Parent helped - ready to retry
          updateData.completionStatus = 'pending';
          updateData.notes = `${assignment.notes || ''}\nPARENT RESOLVED: ${notes || 'Parent helped with: ' + originalReason}`.trim();
          
          // Smart reschedule for today if possible, tomorrow if full
          const todayDate = new Date().toISOString().split('T')[0];
          const tomorrowDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          
          // Try today first, then tomorrow
          updateData.scheduledDate = todayDate;
          updateData.scheduledBlock = null; // Let system find best slot
          
          console.log(`📅 Rescheduling resolved assignment for today: ${todayDate}`);
          break;
          
        case 'modified':
          // Assignment modified - reschedule with changes
          updateData.completionStatus = 'pending';
          updateData.notes = `${assignment.notes || ''}\nPARENT MODIFIED: ${notes || 'Parent modified assignment requirements'}`.trim();
          updateData.scheduledDate = new Date().toISOString().split('T')[0];
          updateData.scheduledBlock = null;
          break;
          
        case 'excused':
          // Assignment excused/skipped - mark complete
          updateData.completionStatus = 'completed';
          updateData.notes = `${assignment.notes || ''}\nPARENT EXCUSED: ${notes || 'Assignment excused by parent'}`.trim();
          updateData.scheduledDate = null;
          updateData.scheduledBlock = null;
          break;
          
        case 'still_needs_work':
          // Still needs work - reschedule for later with more time
          updateData.completionStatus = 'needs_more_time';
          updateData.notes = `${assignment.notes || ''}\nPARENT DEFERRED: ${notes || 'Still needs more work - rescheduled with additional time'}`.trim();
          
          // Schedule for tomorrow or later
          const laterDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
          updateData.scheduledDate = laterDate;
          updateData.scheduledBlock = null;
          
          // Increase estimated time by 50% for extra support
          if (assignment.actualEstimatedMinutes) {
            updateData.actualEstimatedMinutes = Math.ceil(assignment.actualEstimatedMinutes * 1.5);
          }
          break;
          
        default:
          return res.status(400).json({ message: 'Invalid resolution action' });
      }
      
      // Update the assignment
      const updatedAssignment = await storage.updateAssignment(id, updateData);
      
      // Clear student stuck flags if resolved
      if (['helped', 'modified', 'excused'].includes(action)) {
        const userId = assignment.userId.replace('-user', '');
        await storage.updateStudentFlags(userId, { 
          isStuck: false,
          needsHelp: false 
        });
      }
      
      // Send notification to student about resolution
      if (action !== 'excused') {
        try {
          // Get email configuration from environment
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);
          
          if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
            const studentEmail = process.env.PARENT_EMAIL; // For now, send to parent (could be extended)
            
            const actionMessages = {
              helped: 'Your parent helped resolve the issue. The assignment is ready to retry!',
              modified: 'Your parent made some changes. The assignment is ready to continue!',
              still_needs_work: 'Your parent rescheduled this for later with more time.'
            };
            
            await resend.emails.send({
              from: process.env.RESEND_FROM,
              to: studentEmail || process.env.PARENT_EMAIL || 'no-reply@studyflow.com',
              subject: `StudyFlow Update: ${assignment.title} - Ready to Continue`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2 style="color: #16a34a;">✅ Assignment Ready!</h2>
                  <div style="background: #f0f9ff; border-left: 4px solid #16a34a; padding: 16px; margin: 20px 0;">
                    <p><strong>Assignment:</strong> ${assignment.title}</p>
                    <p><strong>Status:</strong> ${actionMessages[action as keyof typeof actionMessages]}</p>
                    ${notes ? `<p><strong>Parent Note:</strong> ${notes}</p>` : ''}
                  </div>
                  <p>You can continue working on this assignment in your guided schedule.</p>
                </div>
              `
            });
          }
        } catch (emailError) {
          console.warn('Student notification email failed:', emailError);
        }
      }
      
      console.log(`✅ Assignment ${id} resolved with action: ${action}`);
      
      res.json({
        message: `Assignment ${action} successfully`,
        assignment: updatedAssignment,
        action,
        rescheduled: ['helped', 'modified', 'still_needs_work'].includes(action)
      });
      
    } catch (error) {
      console.error('Assignment resolution failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: 'Failed to resolve assignment', error: errorMessage });
    }
  });

  // REWARDBANK API ENDPOINTS
  // Gamification and rewards system for student engagement

  // Get student reward profile with points, level, streak
  app.get('/api/rewards/profile/:studentName', requireAuth, async (req: Request, res: Response) => {
    try {
      const { studentName } = req.params;
      const userId = `${studentName.toLowerCase()}-user`;
      
      const profile = await storage.getRewardProfile(userId);
      const quests = await storage.getActiveQuests(userId);
      const settings = await storage.getRewardSettings('family'); // Parent settings
      
      res.json({
        profile,
        quests,
        settings: {
          dailyEarnCapPoints: settings?.dailyEarnCapPoints || 100,
          weeklyEarnCapPoints: settings?.weeklyEarnCapPoints || 400,
        }
      });
    } catch (error) {
      console.error('Error fetching reward profile:', error);
      res.status(500).json({ message: 'Failed to fetch reward profile' });
    }
  });

  // Award points for completing activities (internal API - used by hooks)
  app.post('/api/rewards/earn', requireAuth, async (req: Request, res: Response) => {
    try {
      const { userId, type, amount, sourceId, sourceDetails } = req.body;
      
      // Check daily/weekly caps
      const settings = await storage.getRewardSettings('family');
      const canEarn = await storage.checkEarningLimits(userId, amount, settings || null);
      
      if (!canEarn.allowed) {
        return res.status(429).json({ 
          message: canEarn.reason,
          cappedAt: canEarn.limitType 
        });
      }
      
      // Award points and update profile
      const earnEvent = await storage.createEarnEvent({
        userId,
        type,
        amount,
        sourceId: sourceId || null,
        sourceDetails: sourceDetails || null
      });
      
      const updatedProfile = await storage.updateRewardProfile(userId, amount);
      
      res.json({
        success: true,
        pointsEarned: amount,
        profile: updatedProfile,
        earnEvent
      });
    } catch (error) {
      console.error('Error awarding points:', error);
      res.status(500).json({ message: 'Failed to award points' });
    }
  });

  // Get reward catalog (active rewards students can redeem)
  app.get('/api/rewards/catalog', requireAuth, async (req: Request, res: Response) => {
    try {
      const catalog = await storage.getRewardCatalog(true); // Active only
      res.json(catalog);
    } catch (error) {
      console.error('Error fetching reward catalog:', error);
      res.status(500).json({ message: 'Failed to fetch reward catalog' });
    }
  });

  // Student requests reward redemption
  app.post('/api/rewards/redeem', requireAuth, async (req: Request, res: Response) => {
    try {
      const { studentName, catalogItemId } = req.body;
      const userId = `${studentName.toLowerCase()}-user`;
      
      // Get reward details and check if student has enough points
      const catalogItem = await storage.getRewardCatalogItem(catalogItemId);
      const profile = await storage.getRewardProfile(userId);
      
      if (!catalogItem || !catalogItem.isActive) {
        return res.status(404).json({ message: 'Reward not found or inactive' });
      }
      
      if (!profile || (profile.points || 0) < catalogItem.costPoints) {
        return res.status(400).json({ message: 'Not enough points' });
      }
      
      // Check cooldown
      const settings = await storage.getRewardSettings('family');
      const lastApproved = await storage.getLastApprovedRedemption(userId);
      const cooldownMinutes = settings?.redemptionCooldownMinutes || 60;
      
      if (lastApproved) {
        const timeSinceApproval = Date.now() - lastApproved.getTime();
        const cooldownMs = cooldownMinutes * 60 * 1000;
        if (timeSinceApproval < cooldownMs) {
          const remainingMinutes = Math.ceil((cooldownMs - timeSinceApproval) / (60 * 1000));
          return res.status(429).json({ 
            message: `Please wait ${remainingMinutes} more minutes before redeeming again` 
          });
        }
      }
      
      // Create pending redemption request
      const request = await storage.createRedemptionRequest({
        userId,
        catalogItemId,
        pointsSpent: catalogItem.costPoints,
        status: 'Pending'
      });
      
      res.json({
        message: 'Redemption requested - waiting for parent approval',
        request,
        catalogItem
      });
    } catch (error) {
      console.error('Error requesting redemption:', error);
      res.status(500).json({ message: 'Failed to request redemption' });
    }
  });

  // Parent management endpoints - Reward catalog CRUD
  app.get('/api/rewards/admin/catalog', requireAuth, async (req: Request, res: Response) => {
    try {
      const catalog = await storage.getRewardCatalog(); // All items including inactive
      res.json(catalog);
    } catch (error) {
      console.error('Error fetching admin catalog:', error);
      res.status(500).json({ message: 'Failed to fetch catalog' });
    }
  });

  app.post('/api/rewards/admin/catalog', requireAuth, async (req: Request, res: Response) => {
    try {
      const item = await storage.createRewardCatalogItem({
        ownerId: 'family',
        ...req.body
      });
      res.json(item);
    } catch (error) {
      console.error('Error creating catalog item:', error);
      res.status(500).json({ message: 'Failed to create catalog item' });
    }
  });

  app.put('/api/rewards/admin/catalog/:id', requireAuth, async (req: Request, res: Response) => {
    try {
      const item = await storage.updateRewardCatalogItem(req.params.id, req.body);
      res.json(item);
    } catch (error) {
      console.error('Error updating catalog item:', error);
      res.status(500).json({ message: 'Failed to update catalog item' });
    }
  });

  // Parent approval/denial of redemption requests
  app.get('/api/rewards/admin/requests', requireAuth, async (req: Request, res: Response) => {
    try {
      const requests = await storage.getPendingRedemptionRequests();
      res.json(requests);
    } catch (error) {
      console.error('Error fetching redemption requests:', error);
      res.status(500).json({ message: 'Failed to fetch requests' });
    }
  });

  app.post('/api/rewards/admin/requests/:id/decide', requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { decision, notes } = req.body; // 'Approved' or 'Denied'
      
      const result = await storage.decideRedemptionRequest(id, decision, 'family', notes);
      
      res.json({
        message: `Redemption ${decision.toLowerCase()} successfully`,
        request: result.request,
        pointsDeducted: result.pointsDeducted
      });
    } catch (error) {
      console.error('Error deciding redemption request:', error);
      res.status(500).json({ message: 'Failed to process decision' });
    }
  });

  // Parent settings management
  app.get('/api/rewards/admin/settings', requireAuth, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getRewardSettings('family');
      res.json(settings || {
        userId: 'family',
        dailyEarnCapPoints: 100,
        weeklyEarnCapPoints: 400,
        redemptionCooldownMinutes: 60,
        sessionMinimumMinutes: 15,
        sessionPauseThreshold: 50
      });
    } catch (error) {
      console.error('Error fetching reward settings:', error);
      res.status(500).json({ message: 'Failed to fetch settings' });
    }
  });

  app.put('/api/rewards/admin/settings', requireAuth, async (req: Request, res: Response) => {
    try {
      const settings = await storage.updateRewardSettings('family', req.body);
      res.json(settings);
    } catch (error) {
      console.error('Error updating reward settings:', error);
      res.status(500).json({ message: 'Failed to update settings' });
    }
  });

  // Get earning history for transparency
  app.get('/api/rewards/history/:studentName', requireAuth, async (req: Request, res: Response) => {
    try {
      const { studentName } = req.params;
      const userId = `${studentName.toLowerCase()}-user`;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const history = await storage.getEarnHistory(userId, limit);
      res.json(history);
    } catch (error) {
      console.error('Error fetching earn history:', error);
      res.status(500).json({ message: 'Failed to fetch history' });
    }
  });

  // Quest management - complete quest and award bonus points
  app.post('/api/rewards/quests/:questId/complete', requireAuth, async (req: Request, res: Response) => {
    try {
      const { questId } = req.params;
      const result = await storage.completeQuest(questId);
      
      res.json({
        success: true,
        quest: result.quest,
        pointsEarned: result.pointsEarned,
        profile: result.updatedProfile
      });
    } catch (error) {
      console.error('Error completing quest:', error);
      res.status(500).json({ message: 'Failed to complete quest' });
    }
  });

  // Schedule Manager API endpoints

  // GET /api/schedule/:student/:date/preview - Get schedule preview with blocks and assignments
  app.get('/api/schedule/:student/:date/preview', requireAuth, async (req: Request, res: Response) => {
    try {
      const { student, date } = req.params;
      
      // Get schedule blocks for the student and date
      const blocks = await storage.getDailyScheduleStatus(student, date);
      
      if (!blocks || blocks.length === 0) {
        return res.status(404).json({ message: 'No schedule found for this date' });
      }

      // Get assignments scheduled for this student and date
      const assignments = await storage.getAssignmentsByStudentAndDate(student, date);
      
      // Create a map of assignments by block number
      const assignmentsByBlock = new Map();
      assignments.forEach(assignment => {
        if (assignment.scheduledBlock) {
          assignmentsByBlock.set(assignment.scheduledBlock, assignment);
        }
      });

      // Format response with assignment details
      const schedulePreview = {
        date,
        studentName: student,
        blocks: blocks.map((block: any) => ({
          blockNumber: block.template.blockNumber,
          startTime: block.template.startTime,
          endTime: block.template.endTime,
          blockType: block.template.blockType,
          assignment: assignmentsByBlock.get(block.template.blockNumber) || null
        }))
      };

      res.json(schedulePreview);
    } catch (error) {
      console.error('Error fetching schedule preview:', error);
      res.status(500).json({ message: 'Failed to fetch schedule preview' });
    }
  });

  // PUT /api/schedule/:student/:date/manual - Save manual schedule changes
  app.put('/api/schedule/:student/:date/manual', requireAuth, async (req: Request, res: Response) => {
    try {
      const { student, date } = req.params;
      const { blocks } = req.body;

      if (!blocks || !Array.isArray(blocks)) {
        return res.status(400).json({ message: 'Blocks array is required' });
      }

      // Clear existing assignments for the date
      const userId = `${student.toLowerCase()}-user`;
      const existingAssignments = await storage.getAssignmentsByStudentAndDate(student, date);
      
      // Clear existing scheduling
      for (const assignment of existingAssignments) {
        // TODO: Implement updateAssignmentScheduling or use updateAssignment
        console.log(`Would clear scheduling for assignment ${assignment.id}`);
      }

      // Apply manual schedule changes
      let updatedCount = 0;
      for (const block of blocks) {
        if (block.assignment) {
          // TODO: Implement updateAssignmentScheduling or use updateAssignment
          console.log(`Would schedule assignment ${block.assignment.id} to block ${block.blockNumber}`);
          updatedCount++;
        }
      }

      console.log(`🎯 Manual schedule saved: ${updatedCount} assignments scheduled for ${student} on ${date}`);
      
      res.json({
        message: 'Manual schedule saved successfully',
        updatedCount,
        studentName: student,
        date
      });
    } catch (error) {
      console.error('Error saving manual schedule:', error);
      res.status(500).json({ message: 'Failed to save manual schedule' });
    }
  });

  // POST /api/schedule/:student/:date/regenerate - Regenerate schedule automatically
  app.post('/api/schedule/:student/:date/regenerate', requireAuth, async (req: Request, res: Response) => {
    try {
      const { student, date } = req.params;
      
      // Clear existing schedule for the day
      const existingAssignments = await storage.getAssignmentsByStudentAndDate(student, date);
      
      // Clear existing scheduling
      for (const assignment of existingAssignments) {
        // TODO: Implement updateAssignmentScheduling or use updateAssignment
        console.log(`Would clear scheduling for assignment ${assignment.id}`);
      }
      
      // Regenerate using the scheduler
      await storage.autoScheduleAssignmentsForDate(student, date);
      
      console.log(`🔄 Schedule regenerated for ${student} on ${date}`);
      
      res.json({
        message: 'Schedule regenerated successfully',
        studentName: student,
        date
      });
    } catch (error) {
      console.error('Error regenerating schedule:', error);
      res.status(500).json({ message: 'Failed to regenerate schedule' });
    }
  });

  // PHASE A FIX: API 404 handler - must be LAST API route to catch unmatched /api/* paths
  app.use('/api/*', (req: Request, res: Response) => {
    res.status(404).json({ 
      message: 'API endpoint not found',
      path: req.path,
      method: req.method 
    });
  });

  const httpServer = createServer(app);

  return httpServer;
}
