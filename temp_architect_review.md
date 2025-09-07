# Assignment Creation Fix Analysis

## Git Diff (commit d1479b8)

```diff
diff --git a/client/src/pages/assignments.tsx b/client/src/pages/assignments.tsx
index 6a2d7c7..1ecc9e1 100644
--- a/client/src/pages/assignments.tsx
+++ b/client/src/pages/assignments.tsx
@@ -171,7 +171,7 @@ export default function AssignmentsPage() {
 
   // Create manual assignment mutation
   const createAssignmentMutation = useMutation({
-    mutationFn: async (assignment: typeof manualAssignment & { userId: string }) => {
+    mutationFn: async (assignment: typeof manualAssignment & { studentName: string }) => {
       const response = await apiRequest('POST', '/api/assignments', assignment);
       return await response.json();
     },
@@ -464,8 +464,8 @@ export default function AssignmentsPage() {
   };
 
   const handleCreateManualAssignment = () => {
-    const userId = `${selectedStudent.toLowerCase()}-user`;
-    createAssignmentMutation.mutate({ ...manualAssignment, userId });
+    // Send studentName instead of userId - backend handles the mapping
```

## Changes Made
- Changed mutationFn parameter from `{ userId: string }` to `{ studentName: string }`
- Removed userId creation logic
- Added comment explaining backend handles mapping
- Fixed 400 error in assignment creation process