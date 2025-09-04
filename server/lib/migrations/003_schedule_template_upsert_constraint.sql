-- Migration: Add unique constraint for schedule template upserts
-- Purpose: Enable proper UPSERT functionality for schedule seeds
-- Key: {student_name, weekday, block_number} allows updating specific blocks

-- Add unique constraint to enable UPSERT ON CONFLICT functionality
ALTER TABLE schedule_template 
ADD CONSTRAINT schedule_template_upsert_key 
UNIQUE (student_name, weekday, block_number);

-- Normalize existing time formats from HH:MM:SS to HH:MM
UPDATE schedule_template 
SET 
    start_time = LEFT(start_time, 5),
    end_time = LEFT(end_time, 5)
WHERE 
    LENGTH(start_time) > 5 OR LENGTH(end_time) > 5;