import DOMPurify from 'isomorphic-dompurify';

/**
 * Security sanitization utilities for user input
 * Prevents XSS attacks by cleaning HTML/script content
 */

/**
 * Sanitize a string to remove potentially malicious HTML/script content
 */
export function sanitizeString(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') {
    return input as null;
  }
  
  // Strip all HTML tags and scripts, keep only text content
  return DOMPurify.sanitize(input, { 
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true // Keep text content
  });
}

/**
 * Sanitize an object by applying string sanitization to all string properties
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const sanitized = { ...obj } as any;
  
  for (const [key, value] of Object.entries(sanitized)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeString(item) : item
      );
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeObject(value);
    }
  }
  
  return sanitized;
}

/**
 * Sanitize assignment data specifically
 */
export function sanitizeAssignmentData(data: any): any {
  return sanitizeObject({
    ...data,
    title: sanitizeString(data.title),
    subject: sanitizeString(data.subject),
    courseName: sanitizeString(data.courseName), 
    instructions: sanitizeString(data.instructions),
    notes: sanitizeString(data.notes),
    canvasCategory: sanitizeString(data.canvasCategory)
  });
}