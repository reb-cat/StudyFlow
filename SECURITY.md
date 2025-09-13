# StudyFlow Security Documentation

## Security Overview

This document outlines the security measures implemented in StudyFlow and provides guidance for maintaining security in development and production environments.

## Authentication & Session Management

### Session Security
- **Session Secret**: Uses cryptographically secure session secrets (minimum 32 characters)
- **Session Storage**: PostgreSQL-backed session storage for production reliability
- **Session Expiration**: 24-hour session timeout with rolling expiration on activity
- **Secure Cookies**: HttpOnly, Secure (HTTPS), and SameSite configuration

### Authentication
- **Family Password**: Single shared password for family access
- **Rate Limiting**: Strict rate limiting on authentication endpoints (5 attempts per 15 minutes)
- **Timing Attack Protection**: Consistent response times for failed authentication attempts

## Input Validation & Sanitization

### Client Input Protection
- **XSS Prevention**: All user input is sanitized using DOMPurify
- **Length Limits**: Maximum input lengths enforced (1000 characters for text)
- **Type Validation**: Strict type checking on all inputs
- **HTML Sanitization**: Dangerous HTML tags and attributes removed

### SQL Injection Prevention
- **Parameterized Queries**: All database queries use parameterized statements
- **Input Validation**: SQL identifiers validated against allowlists
- **Schema Validation**: Zod schemas enforce data structure and types

## CSRF Protection

### Cross-Site Request Forgery Prevention
- **CSRF Tokens**: Cryptographically secure tokens for state-changing operations
- **Token Validation**: All POST/PUT/DELETE requests require valid CSRF tokens
- **Token Expiration**: 1-hour token lifetime with automatic cleanup

## Rate Limiting

### API Protection
- **General API**: 1000 requests per 15 minutes per IP
- **Authentication**: 5 attempts per 15 minutes per IP
- **File Uploads**: 50 uploads per hour per IP
- **TTS Endpoint**: Protected by authentication + rate limiting

## Security Headers

### HTTP Security Headers
- **Content Security Policy (CSP)**: Strict CSP in production
- **HSTS**: HTTP Strict Transport Security enabled in production
- **X-Frame-Options**: Clickjacking prevention
- **X-Content-Type-Options**: MIME type sniffing prevention
- **X-XSS-Protection**: Browser XSS protection enabled

## Data Protection

### Sensitive Data Handling
- **No Credential Logging**: API keys, passwords, and tokens never logged
- **Environment Variable Security**: Sensitive configuration in environment variables
- **Database Connection Security**: SSL/TLS encryption for database connections

### File Upload Security
- **Filename Sanitization**: Uploaded filenames sanitized to prevent path traversal
- **File Type Validation**: Only allowed file types accepted
- **Size Limits**: Maximum file size enforcement

## Environment Configuration

### Required Environment Variables
```bash
SESSION_SECRET=your_secure_session_secret_minimum_32_chars
FAMILY_PASSWORD=your_secure_family_password
DATABASE_URL=postgresql://user:pass@host:port/db
```

### Production Security Requirements
- SESSION_SECRET must be at least 32 characters
- FAMILY_PASSWORD must be at least 12 characters
- HTTPS must be enabled
- Database connections should use SSL/TLS

## Security Testing

### Automated Security Tests
```bash
npm run test:security      # Run security test suite
npm run security:audit     # Check for dependency vulnerabilities
npm run security:check     # Run full security check
```

### Manual Security Testing
- Authentication bypass attempts
- SQL injection testing
- XSS payload testing
- CSRF token validation
- Rate limiting verification

## Dependency Security

### Vulnerability Management
- Regular dependency audits using `npm audit`
- Automatic security updates where possible
- Manual review of security advisories
- Dependency pinning for critical packages

### Current Vulnerabilities
Run `npm audit` to see current dependency vulnerabilities and follow remediation guidance.

## Security Incident Response

### If You Suspect a Security Issue
1. **Immediate**: Rotate all API keys and session secrets
2. **Investigate**: Check logs for suspicious activity
3. **Document**: Record all findings and actions taken
4. **Report**: Contact the development team immediately

### Log Monitoring
- Monitor authentication failures
- Watch for unusual API usage patterns
- Alert on repeated rate limit violations
- Track failed validation attempts

## Security Best Practices

### For Developers
- Never commit secrets to version control
- Use environment variables for configuration
- Validate all inputs at API boundaries
- Follow principle of least privilege
- Review security implications of new features

### For Deployment
- Use HTTPS in production
- Enable all security headers
- Configure proper firewall rules
- Regular security updates
- Monitor application logs

### For Users
- Use strong family passwords
- Log out when done using the application
- Report suspicious behavior immediately
- Keep browsers updated

## Security Checklist

### Pre-Deployment Security Checklist
- [ ] All environment variables configured
- [ ] SESSION_SECRET is cryptographically secure (≥32 chars)
- [ ] HTTPS enabled and working
- [ ] Security headers configured
- [ ] Rate limiting active
- [ ] Input validation working
- [ ] CSRF protection enabled
- [ ] No sensitive data in logs
- [ ] Database connections encrypted
- [ ] File upload restrictions active
- [ ] Security tests passing
- [ ] Dependency vulnerabilities addressed

## Contact

For security questions or to report vulnerabilities, contact the development team.

---

**Last Updated**: December 2024  
**Review Schedule**: Quarterly security reviews