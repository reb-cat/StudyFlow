# StudyFlow Deployment Rollback Procedure

## 🆘 EMERGENCY ROLLBACK PLAN

### **IMMEDIATE ROLLBACK TRIGGERS**
Execute rollback immediately if ANY of these occur:
- [ ] Authentication failures > 5% of requests
- [ ] Database connection errors
- [ ] Missing critical data (assignments, Bible curriculum)
- [ ] Canvas API integration failures > 10%
- [ ] Security vulnerabilities detected
- [ ] Performance degradation > 200ms average

## 📋 PRE-DEPLOYMENT BACKUP CHECKLIST

### **1. Development Database State (Current)**
```sql
-- Document current development state
SELECT 
    'Development DB State - ' || CURRENT_TIMESTAMP as backup_timestamp,
    (SELECT COUNT(*) FROM assignments) as assignment_count,
    (SELECT COUNT(*) FROM bible_curriculum) as bible_curriculum_count,
    (SELECT COUNT(*) FROM schedule_template) as schedule_template_count,
    (SELECT COUNT(*) FROM users) as user_count;
```

**Current State (Pre-Deployment):**
- Assignments: 117 (Abigail: 24, Khalil: 93)
- Bible Curriculum: 310 entries (52 weeks)
- Schedule Templates: 103 blocks
- Users: 13 total (including test users)
- Database Performance: Sub-millisecond queries

### **2. Critical Environment Variables (Encrypted)**
- JWT_SECRET: ✅ Production-ready (32+ characters)
- DATABASE_URL: ✅ Configured  
- Canvas Tokens: ✅ Both students configured
- All authentication secrets: ✅ Secured

### **3. Application Version Info**
- StudyFlow Version: v1.0.0
- Last Successful Build: Production-ready bundle
- Critical Features: Auth, Canvas integration, Bible curriculum, Print queue
- Performance Status: Optimized (195x query improvement)

## 🔄 ROLLBACK EXECUTION STEPS

### **Step 1: Stop Failing Deployment**
1. **IMMEDIATELY stop the failing deployment**
2. **Document the exact error messages**
3. **Preserve logs for debugging**

### **Step 2: Revert to Known Good State**
```bash
# 1. Revert code to last working commit
git checkout [LAST_WORKING_COMMIT]

# 2. Rebuild with known good version
npm install
npm run build

# 3. Restart with previous configuration
npm run dev
```

### **Step 3: Database Recovery (If Needed)**
```sql
-- If database corruption occurred, restore from backup
-- (This should be done by database administrator)

-- Verify data integrity after rollback
SELECT 
    'Post-Rollback Verification' as status,
    (SELECT COUNT(*) FROM assignments) as assignment_count,
    (SELECT COUNT(*) FROM bible_curriculum) as bible_curriculum_count,
    (SELECT COUNT(*) FROM users) as user_count;

-- Verify Bible curriculum progression still works
SELECT 
    student_name, 
    current_week, 
    current_day 
FROM bible_curriculum_position 
ORDER BY student_name;

-- Test assignment queries still fast
EXPLAIN ANALYZE 
SELECT COUNT(*) FROM assignments 
WHERE user_id = 'khalil-user';
```

### **Step 4: Verify Rollback Success**
- [ ] Application starts without errors
- [ ] User authentication works
- [ ] Student dashboards accessible
- [ ] Bible curriculum progression functional
- [ ] Canvas integration working (if not, acceptable temporarily)
- [ ] Database queries performant (< 1ms)

## 🚨 CRITICAL FAILURE SCENARIOS

### **Scenario 1: Database Migration Failure**
**Symptoms:** Missing tables, data corruption, constraint violations
**Rollback:** Restore database backup, revert schema changes
**Prevention:** Always test migration on staging first

### **Scenario 2: Authentication System Failure**  
**Symptoms:** Users can't log in, JWT errors, session issues
**Rollback:** Verify JWT_SECRET, check auth middleware
**Prevention:** Test auth flow before deployment

### **Scenario 3: Canvas Integration Failure**
**Symptoms:** Assignment import failures, API errors
**Rollback:** Check Canvas tokens, verify API endpoints
**Prevention:** Test Canvas API connectivity pre-deployment

### **Scenario 4: Performance Degradation**
**Symptoms:** Slow page loads, database timeouts
**Rollback:** Verify indexes exist, check query performance
**Prevention:** Run performance tests before deployment

## 📞 EMERGENCY CONTACTS & ESCALATION

### **Technical Issues:**
1. Check application logs first
2. Verify environment variable configuration
3. Test database connectivity
4. Contact database administrator if needed

### **Security Issues:**
1. **IMMEDIATELY** stop the deployment
2. **NEVER** leave security vulnerabilities exposed
3. Revert to secure version immediately
4. Investigate security issue in development

## 📊 POST-ROLLBACK VERIFICATION

### **Critical System Tests:**
```bash
# Test 1: User authentication
curl -X POST -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}' \
  http://localhost:5000/api/login

# Test 2: Protected endpoint access
curl -H "Authorization: Bearer [TOKEN]" \
  http://localhost:5000/api/stats

# Test 3: Database performance
curl -H "Authorization: Bearer [TOKEN]" \
  "http://localhost:5000/api/assignments?studentName=khalil&date=2025-08-27"
```

### **Success Criteria:**
- [ ] All API endpoints responding correctly
- [ ] Authentication working for test users
- [ ] Database queries under 1ms
- [ ] No security errors in logs
- [ ] Student data accessible
- [ ] Bible curriculum progression working

## 📝 POST-INCIDENT DOCUMENTATION

### **Required Documentation:**
1. **Root cause of deployment failure**
2. **Timeline of rollback execution**
3. **Data integrity verification results**
4. **Lessons learned and prevention steps**
5. **Updated deployment checklist based on failure**

### **Follow-up Actions:**
1. Fix the deployment issue in development
2. Test the fix thoroughly in staging
3. Update deployment procedure to prevent recurrence
4. Document any new requirements or dependencies

---

**⚠️ REMEMBER: Better to rollback quickly than to debug in production!**

**🎯 GOAL: Maintain 99.9% uptime and zero data loss**