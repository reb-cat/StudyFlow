import { createClient } from '@supabase/supabase-js';

// Environment validation
if (!process.env.SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_ANON_KEY is required. Please set your Supabase API key.");
}

// Extract Supabase URL from DATABASE_URL
// Your DATABASE_URL contains the Supabase database connection
let supabaseUrl = 'https://yusqctrtoskjtahtibwh.supabase.co'; // Extracted from your DATABASE_URL

// Create Supabase client for your existing database
export const supabase = createClient(supabaseUrl, process.env.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false // Server-side usage
  }
});

// Canvas configuration
export const canvasConfig = {
  abigailToken: process.env.ABIGAIL_CANVAS_TOKEN || '',
  abigailToken2: process.env.ABIGAIL_CANVAS_TOKEN_2 || '',
  khalilToken: process.env.KHALIL_CANVAS_TOKEN || '',
  baseUrl: process.env.CANVAS_BASE_URL || '',
  baseUrl2: process.env.CANVAS_BASE_URL_2 || '',
};

// Email configuration for parent notifications
export const emailConfig = {
  resendApiKey: process.env.RESEND_API_KEY || '',
  resendFrom: process.env.RESEND_FROM || '',
  parentEmail: process.env.PARENT_EMAIL || '',
};

console.log('Canvas config loaded:', {
  hasAbigailToken: !!canvasConfig.abigailToken,
  hasAbigailToken2: !!canvasConfig.abigailToken2,
  hasKhalilToken: !!canvasConfig.khalilToken,
  hasBaseUrl: !!canvasConfig.baseUrl,
  hasBaseUrl2: !!canvasConfig.baseUrl2
});