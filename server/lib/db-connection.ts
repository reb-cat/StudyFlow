// Production-safe database connection manager
import { logger } from './logger';
import { db } from '../db';
import { sql } from 'drizzle-orm';

export interface ConnectionConfig {
  maxRetries?: number;
  retryDelay?: number;
  connectionTimeout?: number;
  healthCheckInterval?: number;
}

export class DatabaseConnectionManager {
  private isConnected = false;
  private retryCount = 0;
  private healthCheckTimer?: NodeJS.Timeout;
  private config: Required<ConnectionConfig>;

  constructor(config: ConnectionConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 5,
      retryDelay: config.retryDelay ?? 2000,
      connectionTimeout: config.connectionTimeout ?? 30000,
      healthCheckInterval: config.healthCheckInterval ?? 60000
    };
  }

  // Validate database connection with retries
  async validateConnection(): Promise<boolean> {
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        logger.info('Database', `Connection attempt ${attempt}/${this.config.maxRetries}`);
        
        // Test basic connection
        await Promise.race([
          db.execute(sql`SELECT 1 as test`),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Connection timeout')), this.config.connectionTimeout)
          )
        ]);

        // Test database permissions
        await db.execute(sql`SELECT current_database(), current_user, version()`);
        
        this.isConnected = true;
        this.retryCount = 0;
        logger.info('Database', '✅ Database connection validated successfully');
        
        // Start health monitoring
        this.startHealthMonitoring();
        return true;

      } catch (error: any) {
        this.isConnected = false;
        this.retryCount = attempt;
        
        logger.warn('Database', `Connection attempt ${attempt} failed`, {
          error: error.message,
          attempt,
          maxRetries: this.config.maxRetries
        });

        if (attempt === this.config.maxRetries) {
          logger.error('Database', '❌ All connection attempts failed', {
            totalAttempts: attempt,
            error: error.message
          });
          return false;
        }

        // Exponential backoff with jitter
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    return false;
  }

  // Check if currently connected
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  // Get connection diagnostics
  async getConnectionDiagnostics(): Promise<{
    isConnected: boolean;
    retryCount: number;
    serverInfo?: any;
    error?: string;
  }> {
    try {
      if (this.isConnected) {
        const result = await db.execute(sql`
          SELECT 
            current_database() as database,
            current_user as user,
            inet_server_addr() as server_ip,
            inet_server_port() as server_port,
            version() as version
        `);
        
        return {
          isConnected: true,
          retryCount: this.retryCount,
          serverInfo: result.rows[0]
        };
      }
    } catch (error: any) {
      this.isConnected = false;
      return {
        isConnected: false,
        retryCount: this.retryCount,
        error: error.message
      };
    }
    
    return {
      isConnected: false,
      retryCount: this.retryCount
    };
  }

  // Start periodic health monitoring
  private startHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        await db.execute(sql`SELECT 1`);
        if (!this.isConnected) {
          this.isConnected = true;
          logger.info('Database', '🔄 Database connection restored');
        }
      } catch (error: any) {
        if (this.isConnected) {
          this.isConnected = false;
          logger.warn('Database', '⚠️ Database connection lost', {
            error: error.message
          });
        }
      }
    }, this.config.healthCheckInterval);
  }

  // Stop health monitoring
  stopHealthMonitoring(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    logger.info('Database', 'Shutting down database connection manager');
    this.stopHealthMonitoring();
    this.isConnected = false;
  }
}

// Global connection manager instance
export const connectionManager = new DatabaseConnectionManager();

// Utility function for safe database operations
export async function safeDbOperation<T>(
  operation: () => Promise<T>,
  context: string,
  fallback?: T
): Promise<T> {
  try {
    // Check connection before operation
    if (!connectionManager.getConnectionStatus()) {
      logger.warn('Database', `${context}: Connection not available, attempting to reconnect`);
      const connected = await connectionManager.validateConnection();
      if (!connected) {
        throw new Error('Database connection unavailable');
      }
    }

    return await operation();
  } catch (error: any) {
    logger.error('Database', `${context} failed`, {
      error: error.message,
      hasConnection: connectionManager.getConnectionStatus()
    });

    if (fallback !== undefined) {
      logger.info('Database', `${context}: Using fallback value`);
      return fallback;
    }

    throw error;
  }
}