// Production-ready rate limiting system
import { logger } from './logger';
import type { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now();
  rateLimitStore.forEach((value, key) => {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  });
}, 300000); // Cleanup every 5 minutes

function defaultKeyGenerator(req: Request): string {
  // Use IP address and user agent for identification
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  return `${ip}:${Buffer.from(userAgent).toString('base64').substring(0, 32)}`;
}

export function createRateLimit(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    message = 'Too many requests, please try again later.',
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
    keyGenerator = defaultKeyGenerator
  } = config;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);
    if (!entry || entry.resetTime < now) {
      entry = { count: 0, resetTime: now + windowMs };
      rateLimitStore.set(key, entry);
    }

    // Check if request should be counted
    const shouldCount = !skipSuccessfulRequests && !skipFailedRequests;
    
    if (shouldCount && entry.count >= maxRequests) {
      const resetTime = new Date(entry.resetTime);
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      
      logger.warn('RateLimit', 'Rate limit exceeded', {
        key: key.substring(0, 20) + '...',
        count: entry.count,
        maxRequests,
        resetTime: resetTime.toISOString(),
        path: req.path,
        method: req.method
      });

      res.status(429).json({
        error: 'Rate limit exceeded',
        message,
        retryAfter,
        limit: maxRequests,
        windowMs
      });
      return;
    }

    // Increment counter
    if (shouldCount) {
      entry.count++;
    }

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, maxRequests - entry.count).toString(),
      'X-RateLimit-Reset': entry.resetTime.toString()
    });

    // Hook into response to potentially skip counting failed requests
    if (skipFailedRequests) {
      const originalSend = res.send;
      res.send = function(this: Response, body: any) {
        if (this.statusCode >= 400 && entry) {
          entry.count = Math.max(0, entry.count - 1);
        }
        return originalSend.call(this, body);
      };
    }

    next();
  };
}

// Predefined rate limiters
export const generalRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 1000, // 1000 requests per window
  message: 'Too many requests from this IP, please try again later.'
});

export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10, // 10 login attempts per window
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true
});

export const uploadRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 50, // 50 uploads per hour
  message: 'Too many file uploads, please try again later.'
});

export const apiRateLimit = createRateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 500, // 500 API calls per window
  message: 'API rate limit exceeded, please slow down.'
});

// Strict rate limiting for sensitive endpoints
export const strictRateLimit = createRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 requests per minute
  message: 'Rate limit exceeded for this endpoint.'
});

// Get rate limit status for monitoring
export function getRateLimitStats(): {
  totalEntries: number;
  topConsumers: Array<{ key: string; count: number; resetTime: number }>;
} {
  const entries = Array.from(rateLimitStore.entries()).map(([key, value]) => ({
    key: key.substring(0, 20) + '...',
    count: value.count,
    resetTime: value.resetTime
  }));

  // Sort by count descending
  const topConsumers = entries.sort((a, b) => b.count - a.count).slice(0, 10);

  return {
    totalEntries: rateLimitStore.size,
    topConsumers
  };
}