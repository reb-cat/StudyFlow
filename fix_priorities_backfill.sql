-- Backfill script to fix existing assignment priorities based on due dates
-- This script will update all assignments to have proper priorities:
-- 'A' for overdue, 'B' for due today, 'C' for future assignments

-- Update overdue assignments to Priority A
UPDATE assignments 
SET priority = 'A', updated_at = NOW()
WHERE due_date < CURRENT_DATE 
AND completion_status = 'pending'
AND priority != 'A';

-- Update assignments due today to Priority B  
UPDATE assignments 
SET priority = 'B', updated_at = NOW()
WHERE DATE(due_date) = CURRENT_DATE
AND completion_status = 'pending' 
AND priority != 'B';

-- Update future assignments to Priority C
UPDATE assignments 
SET priority = 'C', updated_at = NOW()
WHERE due_date > CURRENT_DATE
AND completion_status = 'pending'
AND priority != 'C';

-- Update assignments with no due date to Priority C (lowest)
UPDATE assignments 
SET priority = 'C', updated_at = NOW()
WHERE due_date IS NULL
AND completion_status = 'pending'
AND priority != 'C';

-- Show summary of changes
SELECT 
  priority,
  COUNT(*) as count,
  COUNT(CASE WHEN due_date < CURRENT_DATE THEN 1 END) as overdue_count,
  COUNT(CASE WHEN DATE(due_date) = CURRENT_DATE THEN 1 END) as due_today_count,
  COUNT(CASE WHEN due_date > CURRENT_DATE THEN 1 END) as future_count,
  COUNT(CASE WHEN due_date IS NULL THEN 1 END) as no_date_count
FROM assignments 
WHERE completion_status = 'pending'
GROUP BY priority
ORDER BY priority;