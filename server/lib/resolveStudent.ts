import { db } from '../db';
import { studentProfiles } from '../../shared/schema';
import { eq, ilike, and } from 'drizzle-orm';
import type { Request, Response } from 'express';

export async function resolveStudent(req: Request, res: Response) {
  const ownerId = (req as any).user?.id;
  const { studentSlug, studentId, studentName, name } = req.query as any;
  const q = (studentSlug || studentId || studentName || name || '').toString();
  
  if (!q) {
    res.status(400).json({ error: 'Missing student parameter' });
    return null;
  }

  if (!ownerId) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }

  try {
    let student = null;

    // Try by ID first if provided
    if (studentId) {
      student = await db.query.studentProfiles.findFirst({
        where: and(eq(studentProfiles.id, studentId))
      });
      if (student) return student;
    }

    // Try by slug/studentName (exact match)
    if (studentSlug || studentName) {
      const lookup = studentSlug || studentName;
      student = await db.query.studentProfiles.findFirst({
        where: eq(studentProfiles.studentName, lookup.toLowerCase())
      });
      if (student) return student;
    }

    // Try case-insensitive name search as fallback
    student = await db.query.studentProfiles.findFirst({
      where: ilike(studentProfiles.studentName, `%${q.toLowerCase()}%`)
    });

    if (!student) {
      res.status(404).json({ error: 'Student not found' });
      return null;
    }

    console.log('[resolveStudent]', { 
      query: q, 
      found: student.studentName, 
      id: student.id 
    });
    return student;
  } catch (error) {
    console.error('[resolveStudent] ERROR:', error);
    res.status(500).json({ error: 'Failed to resolve student' });
    return null;
  }
}