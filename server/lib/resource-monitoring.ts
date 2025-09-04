// Resource monitoring and memory management for production
import { logger } from './logger';
import { canvasCache, assignmentCache, scheduleCache } from './cache';

interface MemoryUsage {
  rss: number; // Resident Set Size
  heapTotal: number;
  heapUsed: number;
  external: number;
}

interface ResourceLimits {
  maxMemoryMB: number;
  maxCacheSize: number;
  warningThresholdPercent: number;
}

const DEFAULT_LIMITS: ResourceLimits = {
  maxMemoryMB: 512, // 512MB limit for Replit
  maxCacheSize: 1000,
  warningThresholdPercent: 80
};

// Memory usage tracking
let lastMemoryWarning = 0;
const MEMORY_WARNING_COOLDOWN = 300000; // 5 minutes

export function getMemoryUsage(): MemoryUsage {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024), // MB
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
    external: Math.round(usage.external / 1024 / 1024) // MB
  };
}

export function checkMemoryLimits(limits: ResourceLimits = DEFAULT_LIMITS): {
  isHealthy: boolean;
  warnings: string[];
  usage: MemoryUsage;
} {
  const usage = getMemoryUsage();
  const warnings: string[] = [];
  const warningThreshold = (limits.maxMemoryMB * limits.warningThresholdPercent) / 100;

  // Check memory usage
  if (usage.rss > limits.maxMemoryMB) {
    warnings.push(`Memory usage critical: ${usage.rss}MB exceeds limit of ${limits.maxMemoryMB}MB`);
  } else if (usage.rss > warningThreshold) {
    warnings.push(`Memory usage high: ${usage.rss}MB (${Math.round((usage.rss / limits.maxMemoryMB) * 100)}% of limit)`);
  }

  // Check heap usage
  if (usage.heapUsed > warningThreshold) {
    warnings.push(`Heap usage high: ${usage.heapUsed}MB`);
  }

  const isHealthy = warnings.length === 0;

  // Log warnings with cooldown
  if (!isHealthy && Date.now() - lastMemoryWarning > MEMORY_WARNING_COOLDOWN) {
    logger.warn('ResourceMonitor', 'Memory usage warnings', {
      usage,
      warnings,
      limits
    });
    lastMemoryWarning = Date.now();
  }

  return { isHealthy, warnings, usage };
}

// Force garbage collection if available
export function forceGarbageCollection(): boolean {
  if (global.gc) {
    try {
      global.gc();
      logger.debug('ResourceMonitor', 'Forced garbage collection');
      return true;
    } catch (error: any) {
      logger.warn('ResourceMonitor', 'Failed to force garbage collection', { error: error.message });
      return false;
    }
  }
  return false;
}

// Emergency memory cleanup
export function performEmergencyCleanup(): void {
  logger.warn('ResourceMonitor', 'Performing emergency memory cleanup');

  // Clear all caches
  canvasCache.clear();
  assignmentCache.clear();
  scheduleCache.clear();

  // Force garbage collection if available
  forceGarbageCollection();

  logger.info('ResourceMonitor', 'Emergency cleanup completed');
}

// Monitor resource usage and perform cleanup if needed
export function monitorResources(limits: ResourceLimits = DEFAULT_LIMITS): void {
  const { isHealthy, warnings, usage } = checkMemoryLimits(limits);

  if (!isHealthy) {
    // If memory is critical, perform emergency cleanup
    if (usage.rss > limits.maxMemoryMB) {
      performEmergencyCleanup();
    }
  }

  // Log current usage for debugging
  logger.debug('ResourceMonitor', 'Resource usage check', {
    usage,
    cacheStats: {
      canvas: canvasCache.getStats(),
      assignments: assignmentCache.getStats(),
      schedules: scheduleCache.getStats()
    }
  });
}

// Periodic resource monitoring
let monitoringInterval: NodeJS.Timeout | null = null;

export function startResourceMonitoring(intervalMs = 60000): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }

  monitoringInterval = setInterval(() => {
    try {
      monitorResources();
    } catch (error: any) {
      logger.error('ResourceMonitor', 'Error during resource monitoring', { error: error.message });
    }
  }, intervalMs);

  logger.info('ResourceMonitor', 'Started resource monitoring', { intervalMs });
}

export function stopResourceMonitoring(): void {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    logger.info('ResourceMonitor', 'Stopped resource monitoring');
  }
}

// Graceful shutdown cleanup
export function cleanup(): void {
  logger.info('ResourceMonitor', 'Cleaning up resources during shutdown');
  stopResourceMonitoring();
  
  // Clear all caches
  canvasCache.destroy();
  assignmentCache.destroy();
  scheduleCache.destroy();
}

// Register cleanup handlers
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
process.on('beforeExit', cleanup);