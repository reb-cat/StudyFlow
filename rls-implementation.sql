-- StudyFlow RLS Implementation for Production Database
-- Run these SQL commands in the Replit Database pane or via DATABASE_URL

-- 1. Enable RLS on all student-specific tables
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_template ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_schedule_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE bible_curriculum_position ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE redemption_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE earn_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_settings ENABLE ROW LEVEL SECURITY;

-- 2. Create a function to get current user context (student name)
-- This assumes you'll set the current user in your application
CREATE OR REPLACE FUNCTION current_student() RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_student', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create RLS policies for each table

-- Assignments table (uses user_id)
DROP POLICY IF EXISTS "Students can only access their own assignments" ON assignments;
CREATE POLICY "Students can only access their own assignments" ON assignments
  FOR ALL USING (user_id = current_student());

-- Schedule template (uses student_name)
DROP POLICY IF EXISTS "Students can only access their own schedule" ON schedule_template;
CREATE POLICY "Students can only access their own schedule" ON schedule_template
  FOR ALL USING (student_name = current_student());

-- Daily schedule status (uses student_name)
DROP POLICY IF EXISTS "Students can only access their own daily status" ON daily_schedule_status;
CREATE POLICY "Students can only access their own daily status" ON daily_schedule_status
  FOR ALL USING (student_name = current_student());

-- Bible curriculum position (uses student_name)
DROP POLICY IF EXISTS "Students can only access their own bible progress" ON bible_curriculum_position;
CREATE POLICY "Students can only access their own bible progress" ON bible_curriculum_position
  FOR ALL USING (student_name = current_student());

-- Progress sessions (uses student_name)
DROP POLICY IF EXISTS "Students can only access their own sessions" ON progress_sessions;
CREATE POLICY "Students can only access their own sessions" ON progress_sessions
  FOR ALL USING (student_name = current_student());

-- Student profiles (uses student_name)
DROP POLICY IF EXISTS "Students can only access their own profile" ON student_profiles;
CREATE POLICY "Students can only access their own profile" ON student_profiles
  FOR ALL USING (student_name = current_student());

-- Student status (uses student_name)
DROP POLICY IF EXISTS "Students can only access their own status" ON student_status;
CREATE POLICY "Students can only access their own status" ON student_status
  FOR ALL USING (student_name = current_student());

-- Checklist items (uses student_name)
DROP POLICY IF EXISTS "Students can only access their own checklist" ON checklist_items;
CREATE POLICY "Students can only access their own checklist" ON checklist_items
  FOR ALL USING (student_name = current_student());

-- Reward profiles (uses user_id)
DROP POLICY IF EXISTS "Students can only access their own rewards" ON reward_profiles;
CREATE POLICY "Students can only access their own rewards" ON reward_profiles
  FOR ALL USING (user_id = current_student());

-- Quests (uses user_id)
DROP POLICY IF EXISTS "Students can only access their own quests" ON quests;
CREATE POLICY "Students can only access their own quests" ON quests
  FOR ALL USING (user_id = current_student());

-- Redemption requests (uses user_id)
DROP POLICY IF EXISTS "Students can only access their own redemptions" ON redemption_requests;
CREATE POLICY "Students can only access their own redemptions" ON redemption_requests
  FOR ALL USING (user_id = current_student());

-- Earn events (uses user_id)
DROP POLICY IF EXISTS "Students can only access their own earn events" ON earn_events;
CREATE POLICY "Students can only access their own earn events" ON earn_events
  FOR ALL USING (user_id = current_student());

-- Reward settings (uses user_id)
DROP POLICY IF EXISTS "Students can only access their own reward settings" ON reward_settings;
CREATE POLICY "Students can only access their own reward settings" ON reward_settings
  FOR ALL USING (user_id = current_student());

-- 4. Grant necessary permissions to your application user
-- (Run this if your app connects with a specific database user)
-- GRANT USAGE ON SCHEMA public TO your_app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;