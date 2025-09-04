// Database transaction utilities for production-safe operations
import { db } from '../db';
import { logger } from './logger';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { NeonQueryFunction } from '@neondatabase/serverless';

export interface TransactionOptions {
  retries?: number;
  timeout?: number;
  isolation?: 'read uncommitted' | 'read committed' | 'repeatable read' | 'serializable';
}

// Wrapper for safe database transactions with retry logic and proper error handling
export async function withTransaction<T>(
  operation: (tx: PgTransaction<any, any, any>) => Promise<T>,
  options: TransactionOptions = {}
): Promise<T> {
  const { retries = 3, timeout = 30000, isolation = 'read committed' } = options;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Create transaction with timeout
      const result = await Promise.race([
        db.transaction(operation, { isolationLevel: isolation }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Transaction timeout')), timeout)
        )
      ]);
      
      logger.debug('Database', `Transaction completed successfully`, { attempt });
      return result;
    } catch (error: any) {
      logger.warn('Database', `Transaction failed`, { 
        attempt, 
        retries, 
        error: error.message,
        code: error.code 
      });
      
      // Check if error is retryable
      if (!isRetryableError(error) || attempt === retries) {
        logger.error('Database', 'Transaction failed after all retries', { 
          attempts: attempt, 
          error: error.message,
          code: error.code,
          stack: error.stack 
        });
        throw error;
      }
      
      // Exponential backoff before retry
      const delay = Math.pow(2, attempt - 1) * 1000 + Math.random() * 500;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Transaction failed: Maximum retries exceeded');
}

// Check if database error is retryable
function isRetryableError(error: any): boolean {
  const retryableCodes = [
    '40001', // serialization_failure
    '40P01', // deadlock_detected  
    '53300', // too_many_connections
    '08006', // connection_failure
    '08001', // sqlclient_unable_to_establish_sqlconnection
    '08004', // sqlserver_rejected_establishment_of_sqlconnection
  ];
  
  const retryableMessages = [
    'connection terminated',
    'server closed the connection',
    'connection reset',
    'timeout',
  ];
  
  return retryableCodes.includes(error.code) || 
         retryableMessages.some(msg => error.message?.toLowerCase().includes(msg));
}

// Safe query execution with error handling
export async function safeQuery<T>(
  queryFn: () => Promise<T>,
  context: string,
  fallbackValue?: T
): Promise<T> {
  try {
    return await queryFn();
  } catch (error: any) {
    logger.error('Database', `Query failed in ${context}`, { 
      error: error.message,
      code: error.code 
    });
    
    if (fallbackValue !== undefined) {
      logger.info('Database', `Using fallback value for ${context}`);
      return fallbackValue;
    }
    
    throw error;
  }
}

// Check database connection health
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.execute('SELECT 1');
    return true;
  } catch (error: any) {
    logger.error('Database', 'Health check failed', { error: error.message });
    return false;
  }
}

// Bulk operation utilities for better performance
export interface BulkOperationOptions {
  batchSize?: number;
  maxConcurrency?: number;
  onProgress?: (processed: number, total: number) => void;
}

export async function bulkOperation<T, R>(
  items: T[],
  operation: (batch: T[]) => Promise<R[]>,
  options: BulkOperationOptions = {}
): Promise<R[]> {
  const { batchSize = 100, maxConcurrency = 3, onProgress } = options;
  const results: R[] = [];
  
  // Split items into batches
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  // Process batches with controlled concurrency
  for (let i = 0; i < batches.length; i += maxConcurrency) {
    const currentBatches = batches.slice(i, i + maxConcurrency);
    
    const batchPromises = currentBatches.map(async (batch, batchIndex) => {
      try {
        const result = await operation(batch);
        const processedCount = (i + batchIndex + 1) * batchSize;
        onProgress?.(Math.min(processedCount, items.length), items.length);
        return result;
      } catch (error: any) {
        logger.error('Database', 'Bulk operation batch failed', { 
          batchIndex: i + batchIndex,
          batchSize: batch.length,
          error: error.message 
        });
        throw error;
      }
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults.flat());
  }
  
  logger.info('Database', 'Bulk operation completed', { 
    totalItems: items.length,
    totalBatches: batches.length,
    batchSize 
  });
  
  return results;
}