-- Final RLS Verification - Check all tables have both RLS enabled AND policies
SELECT 
    t.schemaname,
    t.tablename,
    t.rowsecurity as rls_enabled,
    COALESCE(p.policy_count, 0) as policy_count,
    CASE 
        WHEN t.rowsecurity = true AND COALESCE(p.policy_count, 0) > 0 THEN '✅ PROTECTED'
        WHEN t.rowsecurity = true AND COALESCE(p.policy_count, 0) = 0 THEN '⚠️ RLS ON, NO POLICIES'
        WHEN t.rowsecurity = false THEN '❌ RLS DISABLED'
    END as status
FROM pg_tables t
LEFT JOIN (
    SELECT 
        schemaname, 
        tablename, 
        COUNT(*) as policy_count
    FROM pg_policies 
    WHERE schemaname = 'public'
    GROUP BY schemaname, tablename
) p ON t.schemaname = p.schemaname AND t.tablename = p.tablename
WHERE t.schemaname = 'public' 
AND t.tablename IN (
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
ORDER BY status, t.tablename;