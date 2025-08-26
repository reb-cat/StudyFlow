// Note: Using Neon database with Drizzle ORM instead of Supabase REST API
// The DATABASE_URL points to a Neon PostgreSQL database, not Supabase

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