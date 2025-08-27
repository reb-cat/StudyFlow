# StudyFlow Production Environment Variables Checklist

## 🚨 CRITICAL - ALL REQUIRED FOR DEPLOYMENT

### **DATABASE CONFIGURATION**
- [ ] `DATABASE_URL` - Production PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/database`
  - **MUST point to production database, NOT development**
  - Test connection before deployment

### **AUTHENTICATION SECURITY**  
- [ ] `JWT_SECRET` - Cryptographically secure secret for JWT tokens
  - **CRITICAL**: Use production secret (32+ random characters)
  - Generate with: `openssl rand -base64 32`
  - **NEVER use development secrets in production**

- [ ] `SESSION_SECRET` - Session storage encryption key
  - **CRITICAL**: Must be different from development
  - Used for cookie session storage security

### **CANVAS INTEGRATION**
- [ ] `CANVAS_BASE_URL` - Canvas API endpoint
  - Development: Usually includes instance identifier
  - Production: Must match actual Canvas deployment

- [ ] `ABIGAIL_CANVAS_TOKEN` - Abigail's Canvas API token
  - **CRITICAL**: Must be production Canvas token
  - Test with actual Canvas API before deployment
  
- [ ] `KHALIL_CANVAS_TOKEN` - Khalil's Canvas API token  
  - **CRITICAL**: Must be production Canvas token
  - Test with actual Canvas API before deployment

### **OPTIONAL BUT RECOMMENDED**
- [ ] `CANVAS_BASE_URL_2` - Secondary Canvas instance (if used)
- [ ] `ABIGAIL_CANVAS_TOKEN_2` - Secondary token for Abigail (if used)
- [ ] `ELEVEN_LABS_API_KEY` - Text-to-speech functionality
- [ ] `RESEND_API_KEY` - Email notifications
- [ ] `RESEND_FROM` - Email sender address
- [ ] `PARENT_EMAIL` - Parent notification email

## 🔍 PRE-DEPLOYMENT VERIFICATION TESTS

### **Database Connection Test**
```bash
# Test production database connectivity
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testpass123","firstName":"Test","lastName":"User"}' \
  https://your-production-url.replit.app/api/register
```

### **JWT Authentication Test**
```bash
# Test JWT token generation with production secret
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"testpass123"}' \
  https://your-production-url.replit.app/api/login
```

### **Canvas API Test**
```bash
# Test Canvas connectivity with production tokens
curl -H "Authorization: Bearer [PRODUCTION_JWT_TOKEN]" \
  https://your-production-url.replit.app/api/canvas/khalil
```

## ⚠️ CRITICAL SECURITY WARNINGS

### **NEVER DO THIS IN PRODUCTION:**
- ❌ Use development database URLs
- ❌ Use weak JWT secrets (like "dev-secret")
- ❌ Use development Canvas tokens
- ❌ Expose secrets in logs or client code
- ❌ Use hardcoded passwords or tokens

### **PRODUCTION SECURITY REQUIREMENTS:**
- ✅ All secrets must be 32+ characters random
- ✅ Database must be production instance with backups
- ✅ Canvas tokens must have minimal required permissions
- ✅ Environment variables must be encrypted at rest
- ✅ No debugging or verbose logging in production

## 🚀 DEPLOYMENT READINESS CHECKLIST

### **Before Deploying:**
1. [ ] All environment variables set and tested
2. [ ] Production database migrated and verified
3. [ ] Canvas API connectivity confirmed
4. [ ] JWT authentication working with production secrets
5. [ ] No hardcoded development URLs or tokens in code
6. [ ] Database backup created
7. [ ] Rollback plan documented and tested

### **Critical Failure Modes to Test:**
- [ ] Invalid database connection (should fail gracefully)
- [ ] Expired Canvas tokens (should show clear error)
- [ ] Missing JWT secret (should refuse to start)
- [ ] Database schema mismatch (should show migration error)

## 📊 PRODUCTION MONITORING

### **Key Metrics to Watch:**
- Database query performance (< 1ms for key queries)
- JWT authentication success rate (> 99%)
- Canvas API response times (< 2s)
- Error rates (< 1% of requests)

### **Immediate Rollback Triggers:**
- Authentication failures > 5%
- Database query times > 100ms
- Canvas API failures > 10%
- Any security-related errors

## 🆘 EMERGENCY CONTACTS & PROCEDURES

### **If Deployment Fails:**
1. **STOP deployment immediately**
2. **Rollback to previous version**
3. **Check environment variable configuration**
4. **Verify database connectivity**
5. **Test in staging environment first**

### **Common Deployment Failures:**
1. **Database connection refused** → Check DATABASE_URL
2. **JWT token errors** → Verify JWT_SECRET is set
3. **Canvas API 401 errors** → Check Canvas tokens
4. **Missing data errors** → Run database migration script

---

**⚠️ DO NOT DEPLOY UNTIL ALL ITEMS ARE CHECKED AND VERIFIED**