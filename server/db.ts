// Database exports with connection manager integration
import { databaseManager } from './lib/db-connection';

// Legacy database instance for backward compatibility
// This will be initialized after the connection manager is ready
export let db: any = null;

// Initialize legacy db export
export async function initializeLegacyDatabase() {
  try {
    db = await databaseManager.getDatabase();
  } catch (error) {
    // If database is not available, provide a proxy that logs warnings
    db = new Proxy({}, {
      get() {
        throw new Error('Database not available - ensure connection is initialized');
      }
    });
  }
}

// Modern exports with fallback support
export { databaseManager, getDatabaseWithFallback } from './lib/db-connection';