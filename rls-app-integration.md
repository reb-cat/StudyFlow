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

### 3. Family Dashboard Considerations

Since parents need to see all students' data, you have two options:

**Option A: Bypass RLS for Admin Queries**
```sql
-- Create admin policies that allow access to all data
CREATE POLICY "Admin can access all data" ON assignments
  FOR ALL USING (current_student() = 'admin' OR current_student() = 'family');
```

**Option B: Query Each Student Separately**
```typescript
// For family dashboard, query each student's data separately
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