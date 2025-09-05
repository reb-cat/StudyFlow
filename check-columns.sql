-- Check actual column names in production tables
-- This will show us what columns exist so we can fix the RLS policies

SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
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
AND column_name LIKE '%student%' OR column_name LIKE '%user%'
ORDER BY table_name, column_name;