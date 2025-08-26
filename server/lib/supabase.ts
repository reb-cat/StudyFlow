import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Please set up your Supabase database connection.");
}

// Create Neon HTTP connection using Supabase connection string
const sql = neon(process.env.DATABASE_URL);

// Initialize Drizzle with schema
export const db = drizzle(sql, { schema });

// Server-only Supabase configuration
export const supabaseConfig = {
  url: process.env.SUPABASE_URL || "",
  anonKey: process.env.SUPABASE_ANON_KEY || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
};

// Validate required environment variables
if (!supabaseConfig.url || !supabaseConfig.anonKey) {
  throw new Error("Missing required Supabase configuration. Please check your environment variables.");
}

// Export database connection for use in server code
export { sql };
