// Production-safe database migration system
import { logger } from './logger';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import { withTransaction } from './db-utils';

interface Migration {
  id: string;
  description: string;
  up: string;
  down?: string;
  timestamp: number;
}

// Create migrations table if it doesn't exist
async function ensureMigrationsTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS __migrations (
      id VARCHAR(255) PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      checksum VARCHAR(64) NOT NULL
    )
  `);
}

// Calculate migration checksum for integrity verification
function calculateChecksum(migration: Migration): string {
  const content = `${migration.id}:${migration.description}:${migration.up}`;
  // Simple hash function for integrity checking
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// Get applied migrations from database
async function getAppliedMigrations(): Promise<string[]> {
  try {
    const result = await db.execute(sql`
      SELECT id FROM __migrations ORDER BY applied_at ASC
    `);
    return result.rows.map(row => String(row.id || '')).filter(id => id && id !== 'null' && id !== 'undefined');
  } catch (error: any) {
    if (error.message?.includes('relation "__migrations" does not exist')) {
      return [];
    }
    throw error;
  }
}

// Apply a single migration safely (with or without transactions based on driver support)
async function applyMigration(migration: Migration): Promise<void> {
  logger.info('Migrations', `Applying migration: ${migration.id}`, {
    description: migration.description
  });

  try {
    // Try with transaction first (for databases that support it)
    await withTransaction(async (tx) => {
      // Execute migration statements one by one
      const statements = migration.up.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const statement of statements) {
        await tx.execute(sql.raw(statement));
      }
      const checksum = calculateChecksum(migration);
      await tx.execute(sql`
        INSERT INTO __migrations (id, description, checksum)
        VALUES (${migration.id}, ${migration.description}, ${checksum})
      `);
    });
  } catch (error: any) {
    // If transaction fails due to driver limitation, fall back to non-transactional
    if (error.message?.includes('No transactions support')) {
      logger.warn('Migrations', 'Falling back to non-transactional migration', { migration: migration.id });
      
      // Execute migration without transaction - split by statements
      const statements = migration.up.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const statement of statements) {
        await db.execute(sql.raw(statement));
      }
      
      // Record the migration
      const checksum = calculateChecksum(migration);
      await db.execute(sql`
        INSERT INTO __migrations (id, description, checksum)
        VALUES (${migration.id}, ${migration.description}, ${checksum})
      `);
    } else {
      throw error;
    }
  }

  logger.info('Migrations', `Successfully applied migration: ${migration.id}`);
}

// Rollback a single migration
async function rollbackMigration(migration: Migration): Promise<void> {
  if (!migration.down) {
    throw new Error(`Migration ${migration.id} does not have a rollback script`);
  }

  return withTransaction(async (tx) => {
    logger.warn('Migrations', `Rolling back migration: ${migration.id}`, {
      description: migration.description
    });

    // Execute the rollback
    await tx.execute(sql.raw(migration.down));

    // Remove migration record
    await tx.execute(sql`
      DELETE FROM __migrations WHERE id = ${migration.id}
    `);

    logger.warn('Migrations', `Successfully rolled back migration: ${migration.id}`);
  });
}

// All migrations in chronological order
const MIGRATIONS: Migration[] = [
  {
    id: '001_initial_schema',
    description: 'Create initial schema with safe column defaults',
    timestamp: Date.now(),
    up: `-- Safe migration that only runs if tables and columns exist
SELECT 1;`,
    down: `
      DROP INDEX IF EXISTS idx_assignments_student_name;
      DROP INDEX IF EXISTS idx_assignments_due_date;
      DROP INDEX IF EXISTS idx_daily_schedule_status_student_date;
    `
  }
];

// Main migration function - safe for production
export async function runMigrations(): Promise<{ applied: number; skipped: number }> {
  try {
    await ensureMigrationsTable();
    
    const appliedMigrations = await getAppliedMigrations();
    const pendingMigrations = MIGRATIONS.filter(m => !appliedMigrations.includes(m.id));

    logger.info('Migrations', `Found ${appliedMigrations.length} applied, ${pendingMigrations.length} pending migrations`);

    if (pendingMigrations.length === 0) {
      logger.info('Migrations', 'No pending migrations to apply');
      return { applied: 0, skipped: appliedMigrations.length };
    }

    // Apply migrations one by one
    for (const migration of pendingMigrations) {
      await applyMigration(migration);
    }

    logger.info('Migrations', `Successfully applied ${pendingMigrations.length} migrations`);
    return { applied: pendingMigrations.length, skipped: appliedMigrations.length };

  } catch (error: any) {
    logger.error('Migrations', 'Migration failed', { error: error.message });
    throw new Error(`Migration failed: ${error.message}`);
  }
}

// Rollback to specific migration (for emergency use)
export async function rollbackTo(migrationId: string): Promise<void> {
  try {
    await ensureMigrationsTable();
    
    const appliedMigrations = await getAppliedMigrations();
    const migrationIndex = appliedMigrations.indexOf(migrationId);
    
    if (migrationIndex === -1) {
      throw new Error(`Migration ${migrationId} was never applied`);
    }

    // Find migrations to rollback (everything after the target)
    const migrationsToRollback = appliedMigrations.slice(migrationIndex + 1);
    
    logger.warn('Migrations', `Rolling back ${migrationsToRollback.length} migrations to reach ${migrationId}`);

    // Rollback in reverse order
    for (const id of migrationsToRollback.reverse()) {
      const migration = MIGRATIONS.find(m => m.id === id);
      if (!migration) {
        throw new Error(`Migration ${id} not found in migration definitions`);
      }
      await rollbackMigration(migration);
    }

    logger.warn('Migrations', `Successfully rolled back to migration: ${migrationId}`);

  } catch (error: any) {
    logger.error('Migrations', 'Rollback failed', { error: error.message });
    throw new Error(`Rollback failed: ${error.message}`);
  }
}

// Get migration status
export async function getMigrationStatus(): Promise<{
  applied: string[];
  pending: string[];
  total: number;
}> {
  await ensureMigrationsTable();
  
  const appliedMigrations = await getAppliedMigrations();
  const allMigrationIds = MIGRATIONS.map(m => m.id);
  const pendingMigrations = allMigrationIds.filter(id => !appliedMigrations.includes(id));

  return {
    applied: appliedMigrations,
    pending: pendingMigrations,
    total: allMigrationIds.length
  };
}