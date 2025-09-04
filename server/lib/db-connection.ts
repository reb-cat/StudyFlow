// Database connection manager with retry logic and health checks
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { logger } from './logger';

interface DatabaseConnectionOptions {
  maxRetries?: number;
  initialRetryDelay?: number;
  maxRetryDelay?: number;
  connectionTimeout?: number;
}

interface ConnectionHealth {
  isHealthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  error?: string;
}

class DatabaseConnectionManager {
  private db: ReturnType<typeof drizzle> | null = null;
  private client: ReturnType<typeof neon> | null = null;
  private connectionString: string | null = null;
  private health: ConnectionHealth = {
    isHealthy: false,
    lastCheck: new Date(),
    consecutiveFailures: 0
  };
  private options: Required<DatabaseConnectionOptions>;

  constructor(options: DatabaseConnectionOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 5,
      initialRetryDelay: options.initialRetryDelay ?? 1000,
      maxRetryDelay: options.maxRetryDelay ?? 30000,
      connectionTimeout: options.connectionTimeout ?? 10000
    };
  }

  /**
   * Initialize database connection with retry logic
   */
  async initialize(): Promise<{ success: boolean; error?: string }> {
    this.connectionString = process.env.DATABASE_URL || null;
    
    if (!this.connectionString) {
      const error = 'DATABASE_URL environment variable is required';
      logger.error('Database', error);
      return { success: false, error };
    }

    return await this.connectWithRetry();
  }

  /**
   * Attempt to connect to database with exponential backoff retry
   */
  private async connectWithRetry(): Promise<{ success: boolean; error?: string }> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        logger.info('Database', `Connection attempt ${attempt}/${this.options.maxRetries}`);
        
        // Create connection with timeout
        const connectionPromise = this.createConnection();
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), this.options.connectionTimeout);
        });

        await Promise.race([connectionPromise, timeoutPromise]);
        
        // Test the connection with a simple query
        await this.testConnection();
        
        this.health = {
          isHealthy: true,
          lastCheck: new Date(),
          consecutiveFailures: 0
        };
        
        logger.info('Database', 'Connection established successfully', { attempt });
        return { success: true };
        
      } catch (error: any) {
        lastError = error;
        this.health.consecutiveFailures++;
        
        logger.warn('Database', `Connection attempt ${attempt} failed`, {
          error: error.message,
          code: error.code,
          attempt,
          maxRetries: this.options.maxRetries
        });

        // Don't retry on certain non-recoverable errors
        if (this.isNonRetryableError(error)) {
          logger.error('Database', 'Non-retryable error encountered', { error: error.message });
          break;
        }

        // Calculate delay with exponential backoff + jitter
        if (attempt < this.options.maxRetries) {
          const delay = Math.min(
            this.options.initialRetryDelay * Math.pow(2, attempt - 1),
            this.options.maxRetryDelay
          );
          const jitter = Math.random() * 1000; // Add up to 1s jitter
          const totalDelay = delay + jitter;
          
          logger.info('Database', `Retrying in ${Math.round(totalDelay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, totalDelay));
        }
      }
    }

    const error = `Failed to connect to database after ${this.options.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`;
    this.health = {
      isHealthy: false,
      lastCheck: new Date(),
      consecutiveFailures: this.options.maxRetries,
      error
    };
    
    logger.error('Database', error, { lastError: lastError?.stack });
    return { success: false, error };
  }

  /**
   * Create database connection
   */
  private async createConnection(): Promise<void> {
    if (!this.connectionString) {
      throw new Error('Connection string not initialized');
    }

    this.client = neon(this.connectionString);
    this.db = drizzle(this.client, { schema });
  }

  /**
   * Test database connection with a simple query
   */
  private async testConnection(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Simple health check query
    await this.db.execute(sql`SELECT 1`);
  }

  /**
   * Check if error is non-retryable (authentication, invalid URL, etc.)
   */
  private isNonRetryableError(error: any): boolean {
    const nonRetryablePatterns = [
      'authentication failed',
      'invalid connection string',
      'database does not exist',
      'role does not exist',
      'password authentication failed',
      'no such host',
      'connection refused'
    ];

    const errorMessage = error.message?.toLowerCase() || '';
    return nonRetryablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Get database instance (with health check)
   */
  getDatabase(): ReturnType<typeof drizzle> {
    if (!this.db || !this.health.isHealthy) {
      throw new Error('Database connection is not healthy. Use initializeWithFallback() for graceful handling.');
    }
    return this.db;
  }

  /**
   * Get database with fallback behavior
   */
  async getDatabaseWithFallback(): Promise<{ db: ReturnType<typeof drizzle> | null; isHealthy: boolean }> {
    if (this.db && this.health.isHealthy) {
      return { db: this.db, isHealthy: true };
    }

    // Attempt to reconnect
    logger.info('Database', 'Attempting to restore connection...');
    const result = await this.connectWithRetry();
    
    return {
      db: result.success ? this.db : null,
      isHealthy: result.success
    };
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<ConnectionHealth> {
    if (!this.db) {
      this.health = {
        isHealthy: false,
        lastCheck: new Date(),
        consecutiveFailures: this.health.consecutiveFailures + 1,
        error: 'Database not initialized'
      };
      return this.health;
    }

    try {
      await this.testConnection();
      this.health = {
        isHealthy: true,
        lastCheck: new Date(),
        consecutiveFailures: 0
      };
    } catch (error: any) {
      this.health = {
        isHealthy: false,
        lastCheck: new Date(),
        consecutiveFailures: this.health.consecutiveFailures + 1,
        error: error.message
      };
    }

    return this.health;
  }

  /**
   * Get current connection health
   */
  getHealth(): ConnectionHealth {
    return { ...this.health };
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.client) {
      // Neon HTTP client doesn't have explicit close method
      this.client = null;
    }
    this.db = null;
    this.health.isHealthy = false;
    logger.info('Database', 'Connection closed');
  }
}

// Export singleton instance
export const databaseManager = new DatabaseConnectionManager();

// Export convenience function for getting database
export async function getDatabase(): Promise<ReturnType<typeof drizzle>> {
  return databaseManager.getDatabase();
}

// Export fallback function for graceful degradation
export async function getDatabaseWithFallback() {
  return databaseManager.getDatabaseWithFallback();
}

// Database operation wrappers with graceful degradation
export async function withDatabaseOperation<T>(
  operation: (db: ReturnType<typeof drizzle>) => Promise<T>,
  fallbackValue?: T,
  operationName: string = 'Database operation'
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const { db, isHealthy } = await databaseManager.getDatabaseWithFallback();
    
    if (!db || !isHealthy) {
      logger.warn('Database', `${operationName} skipped - database not available`);
      return { 
        success: false, 
        error: 'Database not available',
        data: fallbackValue 
      };
    }

    const result = await operation(db);
    return { success: true, data: result };
    
  } catch (error: any) {
    logger.error('Database', `${operationName} failed`, { 
      error: error.message,
      stack: error.stack 
    });
    
    return { 
      success: false, 
      error: error.message,
      data: fallbackValue 
    };
  }
}

// Safe database query wrapper
export async function safeQuery<T>(
  query: (db: ReturnType<typeof drizzle>) => Promise<T>,
  fallback: T,
  queryName: string = 'Query'
): Promise<T> {
  const result = await withDatabaseOperation(query, fallback, queryName);
  return result.data ?? fallback;
}

// Safe database execute wrapper
export async function safeExecute(
  operation: (db: ReturnType<typeof drizzle>) => Promise<any>,
  operationName: string = 'Execute'
): Promise<{ success: boolean; error?: string }> {
  const result = await withDatabaseOperation(operation, undefined, operationName);
  return { success: result.success, error: result.error };
}