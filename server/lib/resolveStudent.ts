import { storage } from '../storage';
import type { Request, Response } from 'express';

export async function resolveStudent(req: Request, res: Response) {
  const { studentSlug, studentId, studentName, name } = req.query as any;
  const q = (studentSlug || studentId || studentName || name || '').toString();

  if (!q) {
    res.status(400).json({ error: 'Missing student parameter' });
    return null;
  }

  try {
    // Try direct lookup by student name
    const student = await storage.getStudentProfile(q);
    
    if (student) {
      console.log('[resolveStudent]', { 
        query: q, 
        found: student.studentName, 
        id: student.id 
      });
      return student;
    }

    console.log('[resolveStudent] NOT FOUND:', { 
      query: q 
    });
    res.status(404).json({ error: 'Student not found' });
    return null;
  } catch (error) {
    console.error('[resolveStudent] ERROR:', error);
    res.status(500).json({ error: 'Failed to resolve student' });
    return null;
  }
}