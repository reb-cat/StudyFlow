// Production health check and monitoring endpoints
import { logger } from './logger';
import { checkDatabaseHealth } from './db-utils';
import { canvasCache, assignmentCache, scheduleCache } from './cache';
import { getMemoryUsage } from './resource-monitoring';
import type { Request, Response } from 'express';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: { status: 'pass' | 'fail'; responseTime?: number; error?: string };
    cache: { status: 'pass' | 'warn'; stats: any };
    memory: { status: 'pass' | 'warn' | 'fail'; usage: any };
  };
}

// Basic health check
export async function basicHealthCheck(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  
  try {
    const health: HealthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version || '1.0.0',
      checks: {
        database: { status: 'pass' },
        cache: { status: 'pass', stats: {} },
        memory: { status: 'pass', usage: {} }
      }
    };

    // Check database
    const dbStart = Date.now();
    const dbHealthy = await checkDatabaseHealth();
    const dbTime = Date.now() - dbStart;
    
    if (dbHealthy) {
      health.checks.database = { status: 'pass', responseTime: dbTime };
    } else {
      health.checks.database = { status: 'fail', responseTime: dbTime, error: 'Database connection failed' };
      health.status = 'unhealthy';
    }

    // Check cache status
    const cacheStats = {
      canvas: canvasCache.getStats(),
      assignments: assignmentCache.getStats(),
      schedules: scheduleCache.getStats()
    };
    health.checks.cache = { status: 'pass', stats: cacheStats };

    // Check memory usage
    const memoryUsage = getMemoryUsage();
    health.checks.memory = { status: 'pass', usage: memoryUsage };
    
    // Warning if memory usage is high
    if (memoryUsage.rss > 400) { // 400MB warning threshold
      health.checks.memory.status = 'warn';
      health.status = 'degraded';
    }
    
    if (memoryUsage.rss > 480) { // 480MB critical threshold
      health.checks.memory.status = 'fail';
      health.status = 'unhealthy';
    }

    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
    
    // Log health check results
    logger.debug('HealthCheck', 'Health check completed', {
      status: health.status,
      responseTime: Date.now() - startTime,
      memoryMB: memoryUsage.rss
    });

  } catch (error: any) {
    logger.error('HealthCheck', 'Health check failed', { error: error.message });
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      uptime: Math.floor(process.uptime())
    });
  }
}

// Readiness check for load balancers
export function readinessCheck(req: Request, res: Response): void {
  // Simple readiness check - server is ready if it can respond
  res.status(200).json({
    status: 'ready',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
}

// Liveness check for container orchestration
export function livenessCheck(req: Request, res: Response): void {
  // Simple liveness check - process is alive
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid
  });
}

// Metrics endpoint for monitoring
export function metricsEndpoint(req: Request, res: Response): void {
  const memoryUsage = getMemoryUsage();
  const cacheStats = {
    canvas: canvasCache.getStats(),
    assignments: assignmentCache.getStats(),
    schedules: scheduleCache.getStats()
  };

  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    memory: memoryUsage,
    cache: cacheStats,
    nodejs: {
      version: process.version,
      platform: process.platform,
      arch: process.arch
    }
  };

  res.json(metrics);
  
  logger.debug('Metrics', 'Metrics accessed', {
    memoryMB: memoryUsage.rss,
    uptime: metrics.uptime
  });
}