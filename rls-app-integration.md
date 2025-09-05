# RLS Integration with StudyFlow Application

## Application Code Changes Required

### 1. Update Database Connection Layer

You'll need to modify your database queries to set the current student context before executing queries.

```typescript
// In server/storage.ts or wherever you make database calls

import { db } from './db';
import { sql } from 'drizzle-orm';

// Set current student context before queries
async function setCurrentStudent(studentName: string) {
  await db.execute(sql`SELECT set_config('app.current_student', ${studentName}, true)`);
}

// Example usage in your API routes
export async function getStudentAssignments(studentName: string) {
  // Set the student context first
  await setCurrentStudent(studentName);
  
  // Now query - RLS will automatically filter
  return await db.select().from(assignments);
}
```

### 2. Update API Routes

Modify your API routes to extract and set the student context:

```typescript
// In server/routes.ts

app.get('/api/assignments/:studentName', async (req, res) => {
  const { studentName } = req.params;
  
  try {
    // Set RLS context
    await db.execute(sql`SELECT set_config('app.current_student', ${studentName}, true)`);
    
    // Query will now be automatically filtered by RLS
    const assignments = await storage.getAssignments();
    
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});
```

### 3. CSV Upload Fix

**CRITICAL**: Your CSV upload process needs admin context to work:

```typescript
// In server/routes.ts - CSV upload endpoint
app.post('/api/schedule-template/upload-csv', requireAuth, async (req, res) => {
  try {
    // Set admin context to bypass RLS for multi-student operations
    await db.execute(sql`SELECT set_config('app.current_student', 'admin', true)`);
    
    // Now the CSV upload can delete ALL records and insert ALL records
    const { csvData } = req.body;
    
    // Delete all existing records (works because of admin context)
    await db.delete(scheduleTemplate);
    
    // Insert all new records from CSV (works for all students)
    for (const record of csvData) {
      await db.insert(scheduleTemplate).values(record);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 4. Family Dashboard Implementation

**Option A: Use Admin Context** (Recommended)
```typescript
// For family dashboard, use admin context to see all data
app.get('/api/family-dashboard', requireAuth, async (req, res) => {
  // Set admin context
  await db.execute(sql`SELECT set_config('app.current_student', 'family', true)`);
  
  // Now all queries return data for all students
  const allAssignments = await storage.getAllAssignments();
  const allSchedules = await storage.getAllSchedules();
  
  res.json({ assignments: allAssignments, schedules: allSchedules });
});
```

**Option B: Query Each Student Separately**
```typescript
// Alternative: Query each student's data separately
const getAllStudentsData = async () => {
  const students = ['abigail', 'khalil'];
  const allData = {};
  
  for (const student of students) {
    await setCurrentStudent(student);
    allData[student] = await getStudentData();
  }
  
  return allData;
};
```

## Production Deployment Steps

1. **Test in Development**: Apply RLS to your dev database first
2. **Backup Production**: Take a backup before applying changes
3. **Apply RLS**: Run the SQL script in Database pane
4. **Deploy App Changes**: Deploy the updated application code
5. **Test**: Verify students can only see their own data

## Rollback Plan

If issues arise, you can quickly disable RLS:

```sql
ALTER TABLE assignments DISABLE ROW LEVEL SECURITY;
-- Repeat for all tables
```