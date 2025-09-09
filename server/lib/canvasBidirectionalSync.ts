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
  published?: boolean;
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
    const databaseAssignments = await storage.getAllAssignments(); // Include deleted for comparison
    const studentDbAssignments = databaseAssignments.filter(
      a => a.userId === studentUserId && a.canvasId && !a.deletedAt // Only active Canvas-synced assignments
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
    
    // RESTORATION LOGIC DISABLED: Caused phantom assignments to reappear
    // Previously restored soft-deleted assignments that "reappeared" in Canvas,
    // but this was causing completed assignments to resurrect and create phantom "(Continued)" versions.
    // Original purpose was to handle graded work checks, but manual management is more reliable.
    // If restoration is needed in the future, add back with proper completion status checks.
    console.log(`🔒 RESTORATION DISABLED: Not restoring any previously deleted assignments to prevent phantom resurrections`);
    
    console.log(`🔄 Sync complete: ${deletedAssignments.length} deleted, 0 restored (restoration disabled) for ${studentUserId}`);
    
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
        // CANVAS SOURCE OF TRUTH: Sync due date changes from Canvas
        let dueDateChanged = false;
        if (canvasAssignment.due_at) {
          const canvasDueDate = new Date(canvasAssignment.due_at);
          const dbDueDate = dbAssignment.dueDate ? new Date(dbAssignment.dueDate) : null;
          
          // Compare dates (normalize to same timezone for comparison)
          const canvasDateStr = canvasDueDate.toISOString().split('T')[0];
          const dbDateStr = dbDueDate ? dbDueDate.toISOString().split('T')[0] : null;
          
          if (canvasDateStr !== dbDateStr) {
            dueDateChanged = true;
            await storage.updateAssignment(dbAssignment.id, {
              dueDate: canvasDueDate,
              updatedAt: new Date()
            });
            console.log(`📅 Canvas sync: Updated due date for "${canvasAssignment.name}" from ${dbDateStr || 'none'} to ${canvasDateStr}`);
          }
        } else if (dbAssignment.dueDate) {
          // Canvas assignment has no due date but database has one - update to null
          dueDateChanged = true;
          await storage.updateAssignment(dbAssignment.id, {
            dueDate: null,
            updatedAt: new Date()
          });
          console.log(`📅 Canvas sync: Removed due date for "${canvasAssignment.name}" (no longer set in Canvas)`);
        }
        
        // DEBUG: Check what Canvas is actually returning for this assignment
        if (canvasAssignment.name.includes('Points, Lines and Planes')) {
          console.log(`🔍 DEBUG Canvas data for "${canvasAssignment.name}":`, {
            id: canvasAssignment.id,
            graded_submissions_exist: canvasAssignment.graded_submissions_exist,
            has_submitted_submissions: canvasAssignment.has_submitted_submissions,
            workflow_state: canvasAssignment.workflow_state,
            published: canvasAssignment.published
          });
        }
        
        // DISABLED: Auto-completion sync due to data integrity issues
        // Canvas graded_submissions_exist can be true if ANY student has graded work,
        // not necessarily THIS specific student, causing false completions.
        // 
        // StudyFlow completion status should ONLY be managed by:
        // 1. Manual student/parent completion actions in StudyFlow UI
        // 2. Admin manual status changes in Assignment Manager
        // 
        // Canvas sync is now limited to: imports, deletions, and metadata updates
        console.log(`🔒 Canvas sync: Preserving StudyFlow completion status for "${canvasAssignment.name}" (status: ${dbAssignment.completionStatus})${dueDateChanged ? ' [due date updated]' : ''}`);
        
        // DEBUG: Log Canvas grading data for transparency but take no action
        if (canvasAssignment.name.includes('Points, Lines and Planes')) {
          console.log(`📊 Canvas grading data (NO AUTO-SYNC): graded_submissions_exist=${canvasAssignment.graded_submissions_exist}, has_submitted_submissions=${canvasAssignment.has_submitted_submissions}`);
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
  
  // Then sync completion status (Canvas grades → StudyFlow completion) - THIS IS THE CRITICAL FIX
  await syncCompletionStatus(studentUserId, canvasAssignments);
  
  console.log(`✅ Bidirectional Canvas sync complete for ${studentUserId}`);
}