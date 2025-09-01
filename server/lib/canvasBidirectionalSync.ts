/**
 * Canvas Bidirectional Sync
 * Handles two-way synchronization between Canvas and StudyFlow database
 */

import { storage } from '../storage.js';

interface CanvasAssignment {
  id: number;
  name: string;
  due_at?: string;
  workflow_state?: string;
  grading_standard_id?: number;
  graded_submissions_exist?: boolean;
  has_submitted_submissions?: boolean;
}

/**
 * Detect assignments that exist in database but were removed from Canvas
 * Mark them as soft deleted to maintain data integrity
 */
export async function syncAssignmentDeletions(
  studentUserId: string, 
  currentCanvasAssignments: CanvasAssignment[]
): Promise<void> {
  try {
    console.log(`🔄 Checking for deleted assignments for ${studentUserId}`);
    
    // Get all existing assignments from database (including already soft deleted for comparison)
    const databaseAssignments = await storage.getAllAssignments(true); // Include deleted for comparison
    const studentDbAssignments = databaseAssignments.filter(
      a => a.userId === studentUserId && a.canvasId // Only check Canvas-synced assignments
      // TODO: Add && !a.deletedAt after schema is pushed  
    );
    
    // Get current Canvas assignment IDs
    const currentCanvasIds = new Set(currentCanvasAssignments.map(a => a.id));
    
    // Find database assignments that no longer exist in Canvas
    const deletedAssignments = studentDbAssignments.filter(
      dbAssignment => !currentCanvasIds.has(dbAssignment.canvasId!)
    );
    
    // Mark missing assignments as deleted
    for (const deletedAssignment of deletedAssignments) {
      await storage.markAssignmentDeleted(deletedAssignment.id);
      console.log(`🗑️ Canvas sync: Marked "${deletedAssignment.title}" as deleted (no longer in Canvas)`);
    }
    
    // Restore any previously deleted assignments that reappear in Canvas
    const restoredAssignments = databaseAssignments.filter(
      dbAssignment => dbAssignment.userId === studentUserId && 
                      dbAssignment.canvasId && 
                      dbAssignment.deletedAt && 
                      currentCanvasIds.has(dbAssignment.canvasId!)
    );
    
    for (const restoredAssignment of restoredAssignments) {
      // Clear deletedAt to restore the assignment
      await storage.updateAssignment(restoredAssignment.id, { 
        deletedAt: null, 
        updatedAt: new Date() 
      } as any);
      console.log(`✅ Canvas sync: Restored "${restoredAssignment.title}" (reappeared in Canvas)`);
    }
    
    console.log(`🔄 Sync complete: ${deletedAssignments.length} deleted, ${restoredAssignments.length} restored for ${studentUserId}`);
    
  } catch (error) {
    console.error('Error in Canvas deletion sync:', error);
  }
}

/**
 * Sync completion status from Canvas grades back to StudyFlow
 */
export async function syncCompletionStatus(
  studentUserId: string,
  canvasAssignments: CanvasAssignment[]
): Promise<void> {
  try {
    console.log(`🎯 Syncing completion status from Canvas for ${studentUserId}`);
    
    const databaseAssignments = await storage.getAllAssignments();
    const studentDbAssignments = databaseAssignments.filter(
      a => a.userId === studentUserId && a.canvasId && !a.deletedAt
    );
    
    for (const canvasAssignment of canvasAssignments) {
      const dbAssignment = studentDbAssignments.find(a => a.canvasId === canvasAssignment.id);
      
      if (dbAssignment) {
        // Check if Canvas shows this as truly completed (graded AND submitted)
        const isCanvasCompleted = canvasAssignment.graded_submissions_exist && 
                                  canvasAssignment.has_submitted_submissions;
        
        // Only sync to "completed" if Canvas shows it's truly done AND our status is still "pending"
        if (isCanvasCompleted && dbAssignment.completionStatus === 'pending') {
          await storage.updateAssignmentStatus(dbAssignment.id, 'completed');
          console.log(`✅ Canvas grade sync: Marked "${canvasAssignment.name}" as completed`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error in Canvas completion status sync:', error);
  }
}

/**
 * Main bidirectional sync function
 * Call this after Canvas assignment import to ensure data integrity
 */
export async function performBidirectionalSync(
  studentUserId: string,
  canvasAssignments: CanvasAssignment[]
): Promise<void> {
  console.log(`🔄 Starting bidirectional Canvas sync for ${studentUserId}`);
  
  // First sync deletions (assignments removed from Canvas)
  await syncAssignmentDeletions(studentUserId, canvasAssignments);
  
  // Then sync completion status (Canvas grades → StudyFlow completion)
  await syncCompletionStatus(studentUserId, canvasAssignments);
  
  console.log(`✅ Bidirectional Canvas sync complete for ${studentUserId}`);
}