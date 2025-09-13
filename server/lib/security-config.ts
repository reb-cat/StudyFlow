// Centralized security configuration
export interface SecurityConfig {
  // Authentication settings
  sessionSecret: string;
  sessionMaxAge: number;
  passwordMinLength: number;
  loginAttemptWindow: number;
  maxLoginAttempts: number;
  
  // Rate limiting
  apiRateLimit: number;
  authRateLimit: number;
  uploadRateLimit: number;
  
  // Security headers
  enableCSP: boolean;
  enableHSTS: boolean;
  frameOptions: string;
  
  // Validation
  enableStrictValidation: boolean;
  sanitizeUserInput: boolean;
  
  // Logging
  logSensitiveData: boolean;
  maxLogLevel: string;
}

export function getSecurityConfig(): SecurityConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    // Authentication
    sessionSecret: process.env.SESSION_SECRET || '',
    sessionMaxAge: 24 * 60 * 60 * 1000, // 24 hours
    passwordMinLength: isProduction ? 12 : 8,
    loginAttemptWindow: 15 * 60 * 1000, // 15 minutes
    maxLoginAttempts: isProduction ? 5 : 10,
    
    // Rate limiting
    apiRateLimit: isProduction ? 100 : 1000, // per 15 minutes
    authRateLimit: 5, // per 15 minutes
    uploadRateLimit: isProduction ? 10 : 50, // per hour
    
    // Security headers
    enableCSP: isProduction,
    enableHSTS: isProduction,
    frameOptions: isProduction ? 'DENY' : 'SAMEORIGIN',
    
    // Validation
    enableStrictValidation: true,
    sanitizeUserInput: true,
    
    // Logging
    logSensitiveData: false, // Never log sensitive data
    maxLogLevel: isProduction ? 'warn' : 'debug'
  };
}

// Validate security configuration on startup
export function validateSecurityConfig(): void {
  const config = getSecurityConfig();
  const errors: string[] = [];
  
  if (!config.sessionSecret) {
    errors.push('SESSION_SECRET must be configured');
  } else if (config.sessionSecret.length < 32) {
    errors.push('SESSION_SECRET must be at least 32 characters long');
  }
  
  if (process.env.NODE_ENV === 'production') {
    if (config.passwordMinLength < 12) {
      errors.push('Password minimum length must be at least 12 characters in production');
    }
    
    if (!config.enableCSP) {
      errors.push('Content Security Policy must be enabled in production');
    }
    
    if (!config.enableHSTS) {
      errors.push('HSTS must be enabled in production');
    }
  }
  
  if (errors.length > 0) {
    console.error('❌ Security configuration errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    throw new Error('Security configuration validation failed');
  }
}