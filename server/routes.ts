import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAssignmentSchema, updateAssignmentSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Assignment API routes
  
  // GET /api/assignments - Get assignments for a user/date
  app.get('/api/assignments', async (req, res) => {
    try {
      const { date } = req.query;
      // For demo, always use demo user
      const userId = "demo-user-1";
      
      const assignments = await storage.getAssignments(userId, date as string);
      res.json(assignments);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      res.status(500).json({ message: 'Failed to fetch assignments' });
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
  
  // Demo user route
  app.get('/api/user', async (req, res) => {
    try {
      const user = await storage.getUser("demo-user-1");
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
