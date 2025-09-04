// Environment variable validation for production safety
import { logger } from './logger';

interface EnvironmentConfig {
  required: string[];
  optional: string[];
  secrets: string[];
}

const ENVIRONMENT_CONFIG: EnvironmentConfig = {
  required: [
    'NODE_ENV',
    'PORT',
    'DATABASE_URL',
    'FAMILY_PASSWORD'
  ],
  optional: [
    'CANVAS_BASE_URL',
    'CANVAS_BASE_URL_2',
    'RESEND_API_KEY',
    'RESEND_FROM',
    'PARENT_EMAIL',
    'ELEVEN_LABS_API_KEY'
  ],
  secrets: [
    'ABIGAIL_CANVAS_TOKEN',
    'ABIGAIL_CANVAS_TOKEN_2',
    'KHALIL_CANVAS_TOKEN',
    'DATABASE_URL',
    'FAMILY_PASSWORD',
    'RESEND_API_KEY',
    'ELEVEN_LABS_API_KEY'
  ]
};

export function validateEnvironment(): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of ENVIRONMENT_CONFIG.required) {
    if (!process.env[varName]) {
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // Check for empty secrets (security issue)
  for (const secretName of ENVIRONMENT_CONFIG.secrets) {
    const value = process.env[secretName];
    if (value !== undefined && value.trim() === '') {
      errors.push(`Secret ${secretName} is set but empty - this is a security risk`);
    }
  }

  // Validate specific environment values
  if (process.env.NODE_ENV && !['development', 'production', 'test'].includes(process.env.NODE_ENV)) {
    errors.push(`Invalid NODE_ENV: ${process.env.NODE_ENV}. Must be development, production, or test`);
  }

  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      errors.push(`Invalid PORT: ${process.env.PORT}. Must be a number between 1 and 65535`);
    }
    if (port !== 5000 && process.env.NODE_ENV === 'production') {
      warnings.push(`PORT is ${port} but Replit requires port 5000 for web services`);
    }
  }

  // Database URL validation
  if (process.env.DATABASE_URL) {
    try {
      const url = new URL(process.env.DATABASE_URL);
      if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
        errors.push('DATABASE_URL must be a PostgreSQL connection string');
      }
      if (!url.hostname || !url.pathname) {
        errors.push('DATABASE_URL is malformed - missing host or database name');
      }
    } catch {
      errors.push('DATABASE_URL is not a valid URL');
    }
  }

  // Canvas configuration validation
  const canvasTokens = [
    process.env.ABIGAIL_CANVAS_TOKEN,
    process.env.ABIGAIL_CANVAS_TOKEN_2,
    process.env.KHALIL_CANVAS_TOKEN
  ].filter(Boolean);

  const canvasUrls = [
    process.env.CANVAS_BASE_URL,
    process.env.CANVAS_BASE_URL_2
  ].filter(Boolean);

  if (canvasTokens.length === 0) {
    warnings.push('No Canvas API tokens configured - Canvas sync will be disabled');
  }

  if (canvasUrls.length === 0) {
    warnings.push('No Canvas base URLs configured - Canvas sync will be disabled');
  }

  // Email configuration validation
  if (process.env.RESEND_API_KEY && !process.env.RESEND_FROM) {
    errors.push('RESEND_FROM is required when RESEND_API_KEY is set');
  }

  if (process.env.RESEND_FROM && !isValidEmail(process.env.RESEND_FROM)) {
    errors.push('RESEND_FROM must be a valid email address');
  }

  if (process.env.PARENT_EMAIL && !isValidEmail(process.env.PARENT_EMAIL)) {
    errors.push('PARENT_EMAIL must be a valid email address');
  }

  // Security validations for production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.FAMILY_PASSWORD && process.env.FAMILY_PASSWORD.length < 12) {
      errors.push('FAMILY_PASSWORD must be at least 12 characters long in production');
    }

    if (!process.env.DATABASE_URL?.includes('ssl=true') && 
        !process.env.DATABASE_URL?.includes('sslmode=require')) {
      warnings.push('DATABASE_URL should use SSL/TLS in production');
    }
  }

  const isValid = errors.length === 0;

  // Log results
  if (errors.length > 0) {
    logger.error('Environment', 'Environment validation failed', { errors });
  }

  if (warnings.length > 0) {
    logger.warn('Environment', 'Environment validation warnings', { warnings });
  }

  if (isValid && warnings.length === 0) {
    logger.info('Environment', 'Environment validation passed');
  }

  return { isValid, errors, warnings };
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate required environment variables on startup
export function validateRequiredEnvironment(): void {
  const validation = validateEnvironment();
  
  if (!validation.isValid) {
    logger.error('Environment', 'Critical environment validation errors - server cannot start', {
      errors: validation.errors
    });
    
    console.error('❌ ENVIRONMENT VALIDATION FAILED:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
    console.error('\n💡 Please check your environment variables and try again.');
    
    process.exit(1);
  }
}