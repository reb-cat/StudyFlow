// File upload security and validation system
import { logger } from './logger';
import crypto from 'crypto';
import path from 'path';

// Allowed MIME types and extensions
const ALLOWED_FILE_TYPES = {
  images: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    extensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    maxSize: 10 * 1024 * 1024 // 10MB
  },
  documents: {
    mimeTypes: ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    extensions: ['.pdf', '.txt', '.doc', '.docx'],
    maxSize: 50 * 1024 * 1024 // 50MB
  }
} as const;

// Dangerous file types that should never be allowed
const DANGEROUS_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.app', '.deb', '.pkg', '.dmg',
  '.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl', '.sh', '.bash', '.zsh', '.fish'
];

const DANGEROUS_MIME_TYPES = [
  'application/x-executable', 'application/x-msdownload', 'application/x-msdos-program',
  'application/x-javascript', 'text/javascript', 'application/javascript', 'text/x-php',
  'application/x-php', 'text/x-python', 'application/x-python-code'
];

interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedName?: string;
  category?: keyof typeof ALLOWED_FILE_TYPES;
}

interface FileUploadLimits {
  maxFileSize: number;
  maxFilesPerHour: number;
  maxFilesPerDay: number;
  allowedCategories: (keyof typeof ALLOWED_FILE_TYPES)[];
}

// Rate limiting store for file uploads
const uploadRateLimits = new Map<string, { count: number; resetTime: number }>();

// Generate secure random filename
export function generateSecureFilename(originalName: string, preserveExtension = true): string {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(16).toString('hex');
  
  if (preserveExtension) {
    const ext = path.extname(originalName).toLowerCase();
    return `${timestamp}_${randomBytes}${ext}`;
  }
  
  return `${timestamp}_${randomBytes}`;
}

// Validate file type and content
export function validateFile(
  filename: string, 
  mimeType: string, 
  content: Buffer,
  category: keyof typeof ALLOWED_FILE_TYPES
): FileValidationResult {
  const errors: string[] = [];
  const ext = path.extname(filename).toLowerCase();
  const allowedTypes = ALLOWED_FILE_TYPES[category];

  // Check dangerous extensions
  if (DANGEROUS_EXTENSIONS.includes(ext)) {
    errors.push(`File extension ${ext} is not allowed for security reasons`);
  }

  // Check dangerous MIME types
  if (DANGEROUS_MIME_TYPES.includes(mimeType)) {
    errors.push(`File type ${mimeType} is not allowed for security reasons`);
  }

  // Check allowed extensions
  if (!allowedTypes.extensions.includes(ext)) {
    errors.push(`File extension ${ext} is not allowed. Allowed: ${allowedTypes.extensions.join(', ')}`);
  }

  // Check allowed MIME types
  if (!allowedTypes.mimeTypes.includes(mimeType as (typeof allowedTypes.mimeTypes)[number])) {
    errors.push(`MIME type ${mimeType} is not allowed. Allowed: ${allowedTypes.mimeTypes.join(', ')}`);
  }

  // Check file size
  if (content.length > allowedTypes.maxSize) {
    const maxSizeMB = Math.round(allowedTypes.maxSize / 1024 / 1024);
    const actualSizeMB = Math.round(content.length / 1024 / 1024 * 100) / 100;
    errors.push(`File too large: ${actualSizeMB}MB (max: ${maxSizeMB}MB)`);
  }

  // Basic malware detection (check for suspicious patterns)
  const suspiciousPatterns = [
    /eval\s*\(/gi,
    /exec\s*\(/gi,
    /<script[^>]*>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi
  ];

  const contentString = content.toString('utf8').substring(0, 1000); // Check first 1KB
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(contentString)) {
      errors.push('File contains suspicious content and may be malicious');
      break;
    }
  }

  // Validate image headers for image files
  if (category === 'images' && errors.length === 0) {
    if (!isValidImageFile(content, mimeType)) {
      errors.push('File appears to be corrupted or not a valid image');
    }
  }

  const isValid = errors.length === 0;
  const result: FileValidationResult = {
    isValid,
    errors,
    category: isValid ? category : undefined
  };

  if (isValid) {
    result.sanitizedName = generateSecureFilename(filename);
  }

  logger.info('FileValidation', `File validation result`, {
    filename,
    mimeType,
    size: content.length,
    category,
    isValid,
    errors: errors.length > 0 ? errors : undefined
  });

  return result;
}

// Basic image file validation
function isValidImageFile(content: Buffer, mimeType: string): boolean {
  const signatures: { [key: string]: Buffer[] } = {
    'image/jpeg': [
      Buffer.from([0xFF, 0xD8, 0xFF]), // JPEG
    ],
    'image/png': [
      Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), // PNG
    ],
    'image/gif': [
      Buffer.from('GIF87a'), // GIF87a
      Buffer.from('GIF89a'), // GIF89a
    ],
    'image/webp': [
      Buffer.from('RIFF'), // WebP starts with RIFF
    ]
  };

  const expectedSignatures = signatures[mimeType];
  if (!expectedSignatures) return false;

  return expectedSignatures.some(signature => 
    content.length >= signature.length && 
    content.subarray(0, signature.length).equals(signature)
  );
}

// Check upload rate limits
export function checkUploadRateLimit(
  userId: string, 
  limits: FileUploadLimits
): { allowed: boolean; resetTime?: number; remaining?: number } {
  const now = Date.now();
  const hourlyKey = `${userId}:hour:${Math.floor(now / (60 * 60 * 1000))}`;
  const dailyKey = `${userId}:day:${Math.floor(now / (24 * 60 * 60 * 1000))}`;

  // Check hourly limit
  const hourlyLimit = uploadRateLimits.get(hourlyKey) || { count: 0, resetTime: now + 60 * 60 * 1000 };
  if (hourlyLimit.count >= limits.maxFilesPerHour) {
    return { allowed: false, resetTime: hourlyLimit.resetTime };
  }

  // Check daily limit
  const dailyLimit = uploadRateLimits.get(dailyKey) || { count: 0, resetTime: now + 24 * 60 * 60 * 1000 };
  if (dailyLimit.count >= limits.maxFilesPerDay) {
    return { allowed: false, resetTime: dailyLimit.resetTime };
  }

  // Increment counters
  uploadRateLimits.set(hourlyKey, { count: hourlyLimit.count + 1, resetTime: hourlyLimit.resetTime });
  uploadRateLimits.set(dailyKey, { count: dailyLimit.count + 1, resetTime: dailyLimit.resetTime });

  // Clean up old entries
  if (Math.random() < 0.1) { // 10% chance to clean up
    cleanupRateLimits();
  }

  return { 
    allowed: true, 
    remaining: Math.min(
      limits.maxFilesPerHour - hourlyLimit.count - 1,
      limits.maxFilesPerDay - dailyLimit.count - 1
    )
  };
}

// Clean up expired rate limit entries
function cleanupRateLimits(): void {
  const now = Date.now();
  uploadRateLimits.forEach((value, key) => {
    if (value.resetTime < now) {
      uploadRateLimits.delete(key);
    }
  });
}

// Scan file content for additional security checks
export function performSecurityScan(content: Buffer, filename: string): { safe: boolean; threats: string[] } {
  const threats: string[] = [];
  
  // Convert to string for pattern matching
  const contentStr = content.toString('binary');
  
  // Check for embedded executables
  if (contentStr.includes('MZ') || contentStr.includes('\x4D\x5A')) {
    threats.push('Contains embedded executable code');
  }
  
  // Check for script injections in file content
  const scriptPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
    /data:application\/javascript/gi
  ];
  
  for (const pattern of scriptPatterns) {
    if (pattern.test(contentStr)) {
      threats.push('Contains potentially malicious script content');
      break;
    }
  }
  
  // Check for macro signatures (Office documents)
  if (contentStr.includes('Microsoft Office') && 
      (contentStr.includes('VBA') || contentStr.includes('macro'))) {
    threats.push('Contains potentially dangerous macros');
  }
  
  const isSafe = threats.length === 0;
  
  logger.info('SecurityScan', `File security scan completed`, {
    filename,
    size: content.length,
    isSafe,
    threats: threats.length > 0 ? threats : undefined
  });
  
  return { safe: isSafe, threats };
}