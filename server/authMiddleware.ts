import { Request, Response, NextFunction } from 'express';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // Check if user is authenticated via session
  const userId = (req.session as any)?.userId;
  
  if (!userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  
  // Attach user ID to request for use in route handlers
  (req as any).userId = userId;
  next();
};

export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  // Allow access regardless of auth status, but attach user if authenticated
  next();
};