-- Step 3: Create policies (run this third)

-- Assignments table
DROP POLICY IF EXISTS "Students can only access their own assignments" ON assignments;
CREATE POLICY "Students can only access their own assignments" ON assignments
  FOR ALL USING (user_id = current_student());

-- Schedule template  
DROP POLICY IF EXISTS "Students can only access their own schedule" ON schedule_template;
CREATE POLICY "Students can only access their own schedule" ON schedule_template
  FOR ALL USING (
    student_name = current_student() 
    OR current_student() = 'admin' 
    OR current_student() = 'family'
  );

-- Daily schedule status
DROP POLICY IF EXISTS "Students can only access their own daily status" ON daily_schedule_status;
CREATE POLICY "Students can only access their own daily status" ON daily_schedule_status
  FOR ALL USING (student_name = current_student());

-- Bible curriculum position
DROP POLICY IF EXISTS "Students can only access their own bible progress" ON bible_curriculum_position;
CREATE POLICY "Students can only access their own bible progress" ON bible_curriculum_position
  FOR ALL USING (student_name = current_student());

-- Progress sessions
DROP POLICY IF EXISTS "Students can only access their own sessions" ON progress_sessions;
CREATE POLICY "Students can only access their own sessions" ON progress_sessions
  FOR ALL USING (student_name = current_student());

-- Student profiles
DROP POLICY IF EXISTS "Students can only access their own profile" ON student_profiles;
CREATE POLICY "Students can only access their own profile" ON student_profiles
  FOR ALL USING (student_name = current_student());

-- Student status
DROP POLICY IF EXISTS "Students can only access their own status" ON student_status;
CREATE POLICY "Students can only access their own status" ON student_status
  FOR ALL USING (student_name = current_student());

-- Checklist items
DROP POLICY IF EXISTS "Students can only access their own checklist" ON checklist_items;
CREATE POLICY "Students can only access their own checklist" ON checklist_items
  FOR ALL USING (student_name = current_student());

-- Reward profiles
DROP POLICY IF EXISTS "Students can only access their own rewards" ON reward_profiles;
CREATE POLICY "Students can only access their own rewards" ON reward_profiles
  FOR ALL USING (student_name = current_student());

-- Quests
DROP POLICY IF EXISTS "Students can only access their own quests" ON quests;
CREATE POLICY "Students can only access their own quests" ON quests
  FOR ALL USING (student_name = current_student());

-- Redemption requests
DROP POLICY IF EXISTS "Students can only access their own redemptions" ON redemption_requests;
CREATE POLICY "Students can only access their own redemptions" ON redemption_requests
  FOR ALL USING (student_name = current_student());

-- Earn events
DROP POLICY IF EXISTS "Students can only access their own earn events" ON earn_events;
CREATE POLICY "Students can only access their own earn events" ON earn_events
  FOR ALL USING (student_name = current_student());

-- Reward settings
DROP POLICY IF EXISTS "Students can only access their own reward settings" ON reward_settings;
CREATE POLICY "Students can only access their own reward settings" ON reward_settings
  FOR ALL USING (student_name = current_student());