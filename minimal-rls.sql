-- Minimal RLS setup for core tables that definitely exist
-- Run this AFTER checking which tables exist with check-existing-tables.sql

-- 1. Create the function first (always safe to run)
CREATE OR REPLACE FUNCTION current_student() RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_student', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Enable RLS on core tables (only run for tables that exist!)
-- Check output of check-existing-tables.sql first

-- Assignments (we know this exists since it worked)
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can only access their own assignments" ON assignments;
CREATE POLICY "Students can only access their own assignments" ON assignments
  FOR ALL USING (user_id = current_student());

-- Schedule template (try this one next)
ALTER TABLE schedule_template ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can only access their own schedule" ON schedule_template;
CREATE POLICY "Students can only access their own schedule" ON schedule_template
  FOR ALL USING (
    student_name = current_student() 
    OR current_student() = 'admin' 
    OR current_student() = 'family'
  );

-- Daily schedule status
ALTER TABLE daily_schedule_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can only access their own daily status" ON daily_schedule_status;
CREATE POLICY "Students can only access their own daily status" ON daily_schedule_status
  FOR ALL USING (student_name = current_student());

-- Student profiles  
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can only access their own profile" ON student_profiles;
CREATE POLICY "Students can only access their own profile" ON student_profiles
  FOR ALL USING (student_name = current_student());

-- Student status
ALTER TABLE student_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can only access their own status" ON student_status;
CREATE POLICY "Students can only access their own status" ON student_status
  FOR ALL USING (student_name = current_student());