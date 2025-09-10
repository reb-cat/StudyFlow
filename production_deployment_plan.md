# Production Deployment Plan - Forensics Textbook Sequencing

## 🎯 **MISSION: Zero-Downtime Deployment of Educational Sequencing**

Deploy 139 forensics textbook readings with proper Module 1.1 → 1.2 → 1.3 → 1.4 sequencing to production **without disrupting existing live data**.

---

## 🛡️ **Phase 1: Pre-Flight Safety Checks** (5 minutes)

```sql
-- 1. Check for any existing forensics data (should be 0 in prod)
SELECT COUNT(*) FROM assignments WHERE course_name = 'Apologia Forensics Textbook';

-- 2. Create backup snapshot of current assignments  
\copy assignments TO '/tmp/assignments_backup_$(date +%Y%m%d_%H%M).csv' WITH CSV HEADER;

-- 3. Verify target users exist
SELECT DISTINCT user_id FROM assignments WHERE user_id IN ('abigail-user', 'khalil-user');
```

**✅ Success Criteria:** 
- 0 existing forensics assignments OR explicit approval to proceed
- Backup file created successfully
- Target user IDs confirmed

---

## 🔧 **Phase 2: Schema Migration** (2 minutes, Online DDL)

```sql
-- Add nullable sequencing columns (zero impact on existing data)
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS module_number INTEGER,
ADD COLUMN IF NOT EXISTS reading_number INTEGER;

-- Optional: Performance index for forensics sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_forensics_order 
ON assignments (user_id, course_name, module_number, reading_number)
WHERE course_name = 'Apologia Forensics Textbook';
```

**✅ Success Criteria:**
- Columns added successfully
- No existing data modified
- Application continues running normally

---

## 📦 **Phase 3: Code Deployment** (5 minutes)

Deploy the updated scheduler logic that:
- **ONLY** applies sequencing to `course_name = 'Apologia Forensics Textbook'`
- **PRESERVES** existing priority logic for all other assignments
- **MAINTAINS** backward compatibility (works with NULL module/reading numbers)

**✅ Success Criteria:**
- Server restarts cleanly
- Existing schedules unchanged
- No LSP/TypeScript errors

---

## 📚 **Phase 4: Data Import** (3 minutes)

### Import Command:
```bash
# Set target user (change as needed)
export PRODUCTION_USER_ID="abigail-user"

# Run migration with safety checks
node production_forensics_migration.js
```

### What It Does:
- ✅ **Safety Check:** Verifies no conflicting assignment titles
- ✅ **Idempotent:** Won't create duplicates if run multiple times  
- ✅ **Atomic:** All 139 assignments or none
- ✅ **Tagged:** `creation_source='textbook'` for easy rollback

**✅ Success Criteria:**
- Exactly 139 new assignments imported
- All assignments have proper module_number/reading_number
- No existing assignments modified

---

## 🔍 **Phase 5: Validation** (5 minutes)

```sql
-- 1. Verify import count
SELECT COUNT(*) FROM assignments 
WHERE course_name = 'Apologia Forensics Textbook' 
AND creation_source = 'textbook';

-- 2. Check sequencing data
SELECT module_number, reading_number, title 
FROM assignments 
WHERE course_name = 'Apologia Forensics Textbook' 
AND user_id = 'abigail-user'
ORDER BY module_number, reading_number 
LIMIT 10;

-- 3. Test schedule generation (via API)
curl -X POST "https://your-app.replit.app/api/assignments/auto-schedule" \
  -H "Content-Type: application/json" \
  -d '{"studentName": "abigail", "targetDate": "2025-09-11"}'
```

**✅ Success Criteria:**
- 139 assignments with proper sequencing fields
- Schedule generation shows Module 1.1 → 1.2 → 1.3 → 1.4 order
- Existing assignments remain unchanged

---

## 🚨 **Emergency Rollback Strategy**

### Fast Rollback (30 seconds):
```sql
-- Remove only the imported forensics textbook assignments
DELETE FROM assignments 
WHERE course_name = 'Apologia Forensics Textbook' 
AND creation_source = 'textbook' 
AND academic_year = '2024-2025';
```

### Full Rollback (if needed):
```sql
-- Restore from backup (ONLY if corruption detected)
TRUNCATE assignments;
\copy assignments FROM '/tmp/assignments_backup_YYYYMMDD_HHMM.csv' WITH CSV HEADER;
```

---

## 🎯 **Production Deployment Checklist**

- [ ] **Pre-flight:** Backup created, existing data verified
- [ ] **Schema:** Columns added successfully  
- [ ] **Code:** Updated scheduler deployed and tested
- [ ] **Data:** 139 forensics assignments imported with sequencing
- [ ] **Validation:** Schedule generation shows proper 1.1 → 1.2 → 1.3 → 1.4 order
- [ ] **Monitoring:** System stable for 24 hours post-deployment

---

## 🔐 **Security & Safety**

- Uses existing `DATABASE_URL` secret (no new credentials)
- All changes are **additive** (no data deletion)
- **Backward compatible** (old code works with new schema)
- **Idempotent** (safe to run multiple times)
- **Tagged** for easy identification and rollback

---

**Total Deployment Time: ~20 minutes**  
**Risk Level: Minimal** (additive changes only)  
**Rollback Time: 30 seconds** (if needed)