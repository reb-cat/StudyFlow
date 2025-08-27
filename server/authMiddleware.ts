import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('=== JWT AUTH MIDDLEWARE START ===');
    console.log('JWT_SECRET exists in middleware:', !!JWT_SECRET);
    console.log('JWT_SECRET length in middleware:', JWT_SECRET ? JWT_SECRET.length : 0);
    
    const authHeader = req.headers.authorization;
    console.log('Authorization header received:', authHeader ? authHeader.substring(0, 20) + '...' : 'NONE');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('=== AUTH FAILED: No valid Bearer token ===');
      return res.status(401).json({ message: 'Not authenticated - no token provided' });
    }
    
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('Extracted token (first 50 chars):', token.substring(0, 50) + '...');
    
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    
    // Attach user ID to request for use in route handlers
    (req as any).userId = decoded.userId;
    (req as any).userEmail = decoded.email;
    console.log('=== JWT AUTH SUCCESS - User:', decoded.userId, '===');
    next();
  } catch (error) {
    console.log('=== JWT AUTH FAILED - Error:', error.message, '===');
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  // Allow access regardless of auth status, but attach user if authenticated
  next();
};