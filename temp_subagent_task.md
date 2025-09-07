# Canvas UPSERT Implementation Task

## Objective
Fix Canvas sync constraint violations by implementing UPSERT logic

## Technical Details
- **File**: server/lib/scheduler.ts
- **Target**: Lines 70-80 (Canvas assignment import logic)
- **Problem**: prevent_duplicate_user_titles constraint blocks assignment re-imports
- **Current**: INSERT-only logic fails when assignment already exists
- **Impact**: Assignment 55304143 exists in Canvas but missing from StudyFlow

## Solution Requirements
- Replace INSERT with INSERT...ON CONFLICT DO UPDATE pattern
- Use Drizzle ORM syntax: .onConflictDoUpdate()
- Target constraint: prevent_duplicate_user_titles (student_name, title)
- Update fields: due_date, canvas_assignment_id, canvas_course_id, source, subject
- Preserve fields: completed_at, status, user_notes, time_estimate

## Success Criteria
- Canvas sync produces no constraint violation errors
- Existing assignments update properly during sync
- New assignments insert correctly
- Assignment 55304143 successfully syncs to StudyFlow
- Canvas remains source of truth for due dates and titles