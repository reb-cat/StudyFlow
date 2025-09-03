import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '@shared/schema';

// Use development DB in development, production DB in production
const isDev = process.env.NODE_ENV !== 'production';
const connectionString = isDev 
  ? process.env.DATABASE_URL_DEV!
  : process.env.DATABASE_URL!;

if (!connectionString) {
  throw new Error(isDev 
    ? "DATABASE_URL_DEV is required in development mode" 
    : "DATABASE_URL is required in production mode");
}

// Log active database for verification (mask credentials)
const dbHost = connectionString.match(/@([^/]+)/)?.[1] || 'unknown';
console.log(`🗄️ Database: ${isDev ? 'dev' : 'prod'} -> ${dbHost}`);

const client = neon(connectionString);
export const db = drizzle(client, { schema });