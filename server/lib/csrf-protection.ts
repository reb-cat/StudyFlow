import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// CSRF protection middleware
export class CSRFProtection {
  private static tokens = new Map<string, { token: string; expires: number }>();
  
  // Generate a secure CSRF token
  static generateToken(sessionId: string): string {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + (60 * 60 * 1000); // 1 hour
    
    this.tokens.set(sessionId, { token, expires });
    
    // Cleanup expired tokens
    this.cleanupExpiredTokens();
    
    return token;
  }
  
  // Verify CSRF token
  static verifyToken(sessionId: string, providedToken: string): boolean {
    const stored = this.tokens.get(sessionId);
    
    if (!stored || stored.expires < Date.now()) {
      this.tokens.delete(sessionId);
      return false;
    }
    
    // Use timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(stored.token, 'hex'),
      Buffer.from(providedToken, 'hex')
    );
  }
  
  // Clean up expired tokens
  private static cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [sessionId, data] of this.tokens.entries()) {
      if (data.expires < now) {
        this.tokens.delete(sessionId);
      }
    }
  }
  
  // Middleware to generate and set CSRF token
  static setToken() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (req.session && req.sessionID) {
        const token = this.generateToken(req.sessionID);
        res.locals.csrfToken = token;
        
        // Set as cookie for client-side access
        res.cookie('CSRF-Token', token, {
          httpOnly: false, // Needs to be accessible to client JS
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 1000 // 1 hour
        });
      }
      next();
    };
  }
  
  // Middleware to verify CSRF token
  static verifyToken() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip verification for GET, HEAD, OPTIONS
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }
      
      // Skip for unauthenticated requests
      if (!req.session || !req.sessionID) {
        return next();
      }
      
      const token = req.headers['x-csrf-token'] as string || 
                   req.body.csrfToken ||
                   req.query.csrfToken as string;
      
      if (!token) {
        logger.warn('CSRF', 'CSRF token missing', {
          sessionId: req.sessionID.substring(0, 8),
          method: req.method,
          path: req.path,
          ip: req.ip
        });
        
        return res.status(403).json({
          error: 'CSRF token required',
          message: 'Missing CSRF token for state-changing operation'
        });
      }
      
      if (!this.verifyToken(req.sessionID, token)) {
        logger.warn('CSRF', 'CSRF token invalid', {
          sessionId: req.sessionID.substring(0, 8),
          method: req.method,
          path: req.path,
          ip: req.ip
        });
        
        return res.status(403).json({
          error: 'Invalid CSRF token',
          message: 'CSRF token is invalid or expired'
        });
      }
      
      next();
    };
  }
  
  // Get current token for a session
  static getToken(sessionId: string): string | null {
    const stored = this.tokens.get(sessionId);
    
    if (!stored || stored.expires < Date.now()) {
      this.tokens.delete(sessionId);
      return null;
    }
    
    return stored.token;
  }
}