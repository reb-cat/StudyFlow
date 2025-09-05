-- Clean up all existing RLS policies before applying corrected ones
-- Run this first to remove any existing policies

DROP POLICY IF EXISTS "Students can only access their own assignments" ON assignments;
DROP POLICY IF EXISTS "Students can only access their own earn events" ON earn_events;
DROP POLICY IF EXISTS "Students can only access their own quests" ON quests;
DROP POLICY IF EXISTS "Students can only access their own redemptions" ON redemption_requests;
DROP POLICY IF EXISTS "Students can only access their own rewards" ON reward_profiles;
DROP POLICY IF EXISTS "Students can only access their own reward settings" ON reward_settings;
DROP POLICY IF EXISTS "Students can only access their own bible progress" ON bible_curriculum_position;
DROP POLICY IF EXISTS "Students can only access their own checklist" ON checklist_items;
DROP POLICY IF EXISTS "Students can only access their own daily status" ON daily_schedule_status;
DROP POLICY IF EXISTS "Students can only access their own sessions" ON progress_sessions;
DROP POLICY IF EXISTS "Students can only access their own schedule" ON schedule_template;
DROP POLICY IF EXISTS "Students can only access their own profile" ON student_profiles;
DROP POLICY IF EXISTS "Students can only access their own status" ON student_status;

-- Also try alternate policy names that might exist
DROP POLICY IF EXISTS "student_access_policy" ON assignments;
DROP POLICY IF EXISTS "student_access_policy" ON earn_events;
DROP POLICY IF EXISTS "student_access_policy" ON quests;
DROP POLICY IF EXISTS "student_access_policy" ON redemption_requests;
DROP POLICY IF EXISTS "student_access_policy" ON reward_profiles;
DROP POLICY IF EXISTS "student_access_policy" ON reward_settings;
DROP POLICY IF EXISTS "student_access_policy" ON bible_curriculum_position;
DROP POLICY IF EXISTS "student_access_policy" ON checklist_items;
DROP POLICY IF EXISTS "student_access_policy" ON daily_schedule_status;
DROP POLICY IF EXISTS "student_access_policy" ON progress_sessions;
DROP POLICY IF EXISTS "student_access_policy" ON schedule_template;
DROP POLICY IF EXISTS "student_access_policy" ON student_profiles;
DROP POLICY IF EXISTS "student_access_policy" ON student_status;