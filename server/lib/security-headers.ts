// Security headers and CORS configuration for production
import type { Express, Request, Response, NextFunction } from 'express';
import { logger } from './logger';

interface SecurityConfig {
  enableCORS: boolean;
  allowedOrigins: string[];
  enableCSP: boolean;
  enableHSTS: boolean;
  maxAge: number;
}

// SECURITY FIX: Unified production detection across codebase
export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT === '1';
}

const getSecurityConfig = (): SecurityConfig => {
  const isProduction = isProductionEnvironment();
  
  return {
    enableCORS: true,
    allowedOrigins: isProduction 
      ? [process.env.REPLIT_DOMAINS?.split(',')[0] || 'https://studyflow.replit.app'] 
      : ['http://localhost:5000', 'http://127.0.0.1:5000'],
    enableCSP: isProduction,
    enableHSTS: isProduction,
    maxAge: 31536000 // 1 year
  };
};

export function setupSecurityHeaders(app: Express): void {
  const config = getSecurityConfig();

  // CORS configuration
  if (config.enableCORS) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const origin = req.headers.origin;
      
      // SECURITY FIX: Exact origin matching only, conditional credentials
      if (origin && config.allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Credentials', 'true');
      } else if (config.allowedOrigins.includes('*')) {
        res.header('Access-Control-Allow-Origin', '*');
        // Never set Allow-Credentials with wildcard origin
      }
      
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Max-Age', '86400'); // 24 hours
      
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      
      next();
    });
  }

  // Security headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Prevent clickjacking
    res.header('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.header('X-Content-Type-Options', 'nosniff');
    
    // XSS protection
    res.header('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Feature policy
    res.header('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    
    next();
  });

  // Content Security Policy (production only)
  if (config.enableCSP) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Relaxed for development frameworks
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self' https:",
        "media-src 'self'",
        "object-src 'none'",
        "child-src 'self'",
        "worker-src 'self'",
        "manifest-src 'self'",
        "base-uri 'self'",
        "form-action 'self'"
      ].join('; ');
      
      res.header('Content-Security-Policy', csp);
      next();
    });
  }

  // HSTS (production only)
  if (config.enableHSTS) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Strict-Transport-Security', `max-age=${config.maxAge}; includeSubDomains; preload`);
      next();
    });
  }

  // Remove server signature
  app.disable('x-powered-by');

  logger.info('Security', 'Security headers configured', {
    cors: config.enableCORS,
    csp: config.enableCSP,
    hsts: config.enableHSTS,
    allowedOrigins: config.allowedOrigins
  });
}

// CSRF protection via Origin/Referer validation
export function validateOrigin(req: Request, res: Response, next: NextFunction): void {
  const config = getSecurityConfig();
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  
  // Skip validation in development for localhost
  if (!isProductionEnvironment()) {
    return next();
  }
  
  // Check Origin header first (more reliable)
  if (origin) {
    if (config.allowedOrigins.includes(origin)) {
      return next();
    } else {
      logger.warn('Security', 'CSRF attempt blocked - invalid Origin', { 
        origin, 
        path: req.path, 
        method: req.method 
      });
      return res.status(403).json({ message: 'Invalid origin' });
    }
  }
  
  // Fallback to Referer header - SECURITY FIX: Robust URL parsing
  if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (config.allowedOrigins.includes(refererOrigin)) {
        return next();
      } else {
        logger.warn('Security', 'CSRF attempt blocked - invalid Referer', { 
          referer: refererOrigin, 
          path: req.path, 
          method: req.method 
        });
        return res.status(403).json({ message: 'Invalid referer' });
      }
    } catch (err) {
      logger.warn('Security', 'CSRF attempt blocked - malformed Referer', { 
        referer, 
        path: req.path, 
        method: req.method 
      });
      return res.status(403).json({ message: 'Invalid referer format' });
    }
  }
  
  // No valid origin/referer found
  logger.warn('Security', 'CSRF attempt blocked - no Origin/Referer', { 
    path: req.path, 
    method: req.method 
  });
  res.status(403).json({ message: 'Origin validation required' });
}

// Rate limiting headers for API responses
export function addRateLimitHeaders(res: Response, limit: number, remaining: number, resetTime: number): void {
  res.set({
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': resetTime.toString(),
    'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString()
  });
}