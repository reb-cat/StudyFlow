-- StudyFlow Production Database Verification Script
-- Run BEFORE deployment to ensure production database is ready

-- ========================================
-- SCHEMA VERIFICATION CHECKS
-- ========================================

-- Check 1: Verify all required tables exist
SELECT 
    CASE 
        WHEN COUNT(*) = 8 THEN 'PASS: All 8 tables exist'
        ELSE 'FAIL: Missing tables - Expected 8, Found ' || COUNT(*)
    END as table_check,
    string_agg(table_name, ', ' ORDER BY table_name) as existing_tables
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('assignments', 'bible_curriculum', 'bible_curriculum_position', 
                     'progress_sessions', 'schedule_template', 'sessions', 'users');

-- Check 2: Verify critical indexes exist (performance requirement)
SELECT 
    CASE 
        WHEN COUNT(*) >= 6 THEN 'PASS: Performance indexes exist'
        ELSE 'FAIL: Missing performance indexes - Found ' || COUNT(*) || ' of 6+'
    END as index_check,
    string_agg(indexname, ', ') as existing_indexes
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND indexname IN ('idx_assignments_user_id', 'idx_assignments_scheduled_date', 
                    'idx_assignments_user_date', 'idx_assignments_completion_status',
                    'idx_assignments_canvas_id', 'idx_session_expire');

-- Check 3: Verify foreign key constraints
SELECT 
    CASE 
        WHEN COUNT(*) >= 1 THEN 'PASS: Foreign key constraints exist'
        ELSE 'FAIL: Missing foreign key constraints'
    END as fk_check,
    string_agg(constraint_name, ', ') as existing_fks
FROM information_schema.table_constraints 
WHERE table_schema = 'public' 
  AND constraint_type = 'FOREIGN KEY';

-- ========================================
-- CRITICAL DATA VERIFICATION
-- ========================================

-- Check 4: Bible curriculum data (MUST be 310 rows, 52 weeks)
SELECT 
    CASE 
        WHEN COUNT(*) = 310 AND MIN(week_number) = 1 AND MAX(week_number) = 52 
        THEN 'PASS: Bible curriculum complete (310 rows, weeks 1-52)'
        ELSE 'FAIL: Bible curriculum incomplete - Rows: ' || COUNT(*) || 
             ', Weeks: ' || MIN(week_number) || '-' || MAX(week_number)
    END as bible_curriculum_check
FROM bible_curriculum;

-- Check 5: Schedule template data (MUST be 103 blocks)
SELECT 
    CASE 
        WHEN COUNT(*) = 103 THEN 'PASS: Schedule templates complete (103 blocks)'
        ELSE 'FAIL: Schedule templates incomplete - Found ' || COUNT(*) || ' of 103'
    END as schedule_template_check
FROM schedule_template;

-- Check 6: Student position tracking (MUST have Abigail and Khalil)
SELECT 
    CASE 
        WHEN COUNT(*) = 2 AND 
             COUNT(CASE WHEN student_name = 'Abigail' THEN 1 END) = 1 AND
             COUNT(CASE WHEN student_name = 'Khalil' THEN 1 END) = 1
        THEN 'PASS: Both students have position tracking'
        ELSE 'FAIL: Missing student position tracking - Found ' || COUNT(*) || ' students'
    END as student_position_check,
    string_agg(student_name, ', ' ORDER BY student_name) as tracked_students
FROM bible_curriculum_position;

-- Check 7: Assignment data (SHOULD be 117 total assignments)
SELECT 
    CASE 
        WHEN COUNT(*) >= 100 THEN 'PASS: Assignment data loaded (' || COUNT(*) || ' assignments)'
        ELSE 'WARNING: Low assignment count - Only ' || COUNT(*) || ' assignments found'
    END as assignment_check,
    COUNT(CASE WHEN user_id = 'abigail-user' THEN 1 END) as abigail_assignments,
    COUNT(CASE WHEN user_id = 'khalil-user' THEN 1 END) as khalil_assignments
FROM assignments;

-- ========================================
-- PERFORMANCE VERIFICATION
-- ========================================

-- Check 8: Query performance test (MUST be under 1ms)
EXPLAIN (ANALYZE, BUFFERS) 
SELECT COUNT(*) 
FROM assignments 
WHERE user_id = 'khalil-user' 
  AND scheduled_date = '2025-08-27';

-- Check 9: Index usage verification
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public' 
  AND tablename = 'assignments' 
  AND attname IN ('user_id', 'scheduled_date', 'completion_status');

-- ========================================
-- PRODUCTION READINESS SUMMARY
-- ========================================

-- Final readiness check - ALL must pass for safe deployment
SELECT 
    'PRODUCTION READINESS SUMMARY' as status,
    'Review all checks above - ALL must show PASS for deployment' as instructions;

-- Critical failure patterns to watch for:
-- 1. "FAIL: Missing tables" - Run migration script first
-- 2. "FAIL: Missing performance indexes" - Database will be slow
-- 3. "FAIL: Bible curriculum incomplete" - Core functionality broken
-- 4. "FAIL: Missing student position tracking" - Student progress lost
-- 5. Query time > 1ms - Performance issues likely

-- If ANY check fails, DO NOT DEPLOY until fixed!