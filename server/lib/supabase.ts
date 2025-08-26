import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Please set up your Supabase database connection.");
}

// Handle different DATABASE_URL formats
let connectionString = process.env.DATABASE_URL;

// If it's a Supabase HTTPS URL, convert it to PostgreSQL format
if (connectionString.startsWith('https://') && connectionString.includes('.supabase.co')) {
  console.log('Detected Supabase HTTPS URL, converting to PostgreSQL format...');
  // Extract project ID and construct PostgreSQL connection string
  const projectMatch = connectionString.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (projectMatch && projectMatch[1]) {
    const projectId = projectMatch[1];
    // Note: You'll need to set SUPABASE_DB_PASSWORD separately
    const dbPassword = process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD || '';
    if (!dbPassword) {
      console.error('SUPABASE_DB_PASSWORD is required when using Supabase HTTPS URL');
      console.error('Please set SUPABASE_DB_PASSWORD with your Supabase database password');
    }
    connectionString = `postgresql://postgres:${dbPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`;
    console.log('Converted to PostgreSQL format');
  }
} else if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
  console.error('Invalid DATABASE_URL format. Expected: postgresql://user:password@host.tld/dbname?option=value');
  console.error('Received:', connectionString.substring(0, 50) + '...');
  throw new Error("DATABASE_URL must be a valid PostgreSQL connection string starting with postgresql:// or postgres://");
}

// Create Neon HTTP connection using Supabase connection string
const sql = neon(connectionString);

// Initialize Drizzle with schema
export const db = drizzle(sql, { schema });

// Server-only Supabase configuration (optional for now)
export const supabaseConfig = {
  url: process.env.SUPABASE_URL || "",
  anonKey: process.env.SUPABASE_ANON_KEY || "",
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
};

// Canvas configuration for multi-student setup
export const canvasConfig = {
  baseUrl: process.env.CANVAS_BASE_URL || "",
  baseUrl2: process.env.CANVAS_BASE_URL_2 || "",
  abigailToken: process.env.ABIGAIL_CANVAS_TOKEN || "",
  abigailToken2: process.env.ABIGAIL_CANVAS_TOKEN_2 || "",
  khalilToken: process.env.KHALIL_CANVAS_TOKEN || "",
};

// Email configuration
export const emailConfig = {
  resendApiKey: process.env.RESEND_API_KEY || "",
  resendFrom: process.env.RESEND_FROM || "",
  parentEmail: process.env.PARENT_EMAIL || "",
};

console.log('Canvas config loaded:', {
  hasAbigailToken: !!canvasConfig.abigailToken,
  hasAbigailToken2: !!canvasConfig.abigailToken2,
  hasKhalilToken: !!canvasConfig.khalilToken,
  hasBaseUrl: !!canvasConfig.baseUrl,
  hasBaseUrl2: !!canvasConfig.baseUrl2
});

// Export database connection for use in server code
export { sql };
