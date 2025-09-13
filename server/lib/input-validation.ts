import DOMPurify from 'isomorphic-dompurify';
import { z } from 'zod';

// Input sanitization utilities
export class InputSanitizer {
  static sanitizeText(input: string): string {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }
    
    // Remove potentially dangerous characters
    return input
      .replace(/[<>\"'&]/g, '') // Remove HTML special characters
      .trim()
      .substring(0, 1000); // Limit length
  }
  
  static sanitizeHtml(input: string): string {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }
    
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: []
    });
  }
  
  static sanitizeFilename(input: string): string {
    if (typeof input !== 'string') {
      throw new Error('Input must be a string');
    }
    
    // Only allow alphanumeric, dots, dashes, underscores
    return input
      .replace(/[^a-zA-Z0-9.\-_]/g, '')
      .substring(0, 255);
  }
  
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 254;
  }
  
  static validatePassword(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (password.length > 128) {
      errors.push('Password must not exceed 128 characters');
    }
    
    // In production, enforce stronger requirements
    if (process.env.NODE_ENV === 'production') {
      if (password.length < 12) {
        errors.push('Password must be at least 12 characters long in production');
      }
      
      if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }
      
      if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }
      
      if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
      }
      
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Enhanced Zod schemas with sanitization
export const sanitizedStringSchema = z.string()
  .transform(InputSanitizer.sanitizeText)
  .refine(val => val.length > 0, 'Field cannot be empty after sanitization');

export const sanitizedHtmlSchema = z.string()
  .transform(InputSanitizer.sanitizeHtml);

export const emailSchema = z.string()
  .email('Invalid email format')
  .refine(InputSanitizer.validateEmail, 'Invalid email format')
  .transform(email => email.toLowerCase().trim());

export const passwordSchema = z.string()
  .min(1, 'Password is required')
  .refine(
    password => InputSanitizer.validatePassword(password).valid,
    password => InputSanitizer.validatePassword(password).errors[0] || 'Invalid password'
  );

// SQL injection prevention helpers
export class SQLSecurityHelper {
  static escapeIdentifier(identifier: string): string {
    // Only allow alphanumeric characters and underscores for identifiers
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
      throw new Error('Invalid SQL identifier');
    }
    return identifier;
  }
  
  static validateTableName(tableName: string): string {
    const allowedTables = [
      'assignments', 'scheduleTemplates', 'checklistItems', 
      'bibleCurriculum', 'rewardProfiles', 'studentProfiles'
    ];
    
    if (!allowedTables.includes(tableName)) {
      throw new Error('Invalid table name');
    }
    
    return tableName;
  }
  
  static sanitizeOrderBy(orderBy: string): string {
    const allowedColumns = [
      'createdAt', 'updatedAt', 'title', 'dueDate', 
      'priority', 'completionStatus', 'studentName'
    ];
    
    const direction = orderBy.toLowerCase().includes('desc') ? 'DESC' : 'ASC';
    const column = orderBy.replace(/\s+(asc|desc)$/i, '').trim();
    
    if (!allowedColumns.includes(column)) {
      throw new Error('Invalid order by column');
    }
    
    return `${column} ${direction}`;
  }
}