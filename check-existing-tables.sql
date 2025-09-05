-- Check which tables exist in production database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'assignments',
    'schedule_template', 
    'daily_schedule_status',
    'bible_curriculum_position',
    'progress_sessions',
    'student_profiles',
    'student_status',
    'checklist_items',
    'reward_profiles',
    'quests',
    'redemption_requests',
    'earn_events',
    'reward_settings'
)
ORDER BY table_name;