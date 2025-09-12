import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertTriangle, PlayCircle, Zap, Star, Timer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { normalizeAssignment } from '@shared/normalize';
import type { Assignment } from '@shared/schema';
import { ConfettiBurst } from './ConfettiBurst';
import { useState } from 'react';

interface AssignmentCardProps {
  assignment: Assignment;
  onUpdate?: () => void;
  variant?: 'default' | 'compact';
}

export function AssignmentCard({ assignment, onUpdate, variant = 'default' }: AssignmentCardProps) {
  const { toast } = useToast();
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Check if Canvas shows this assignment as graded but it's still pending in StudyFlow
  const hasCanvasGradingNotification = assignment.notes?.includes('CANVAS GRADED:') && assignment.completionStatus === 'pending';
  
  const normalized = normalizeAssignment({
    id: assignment.id,
    title: assignment.title,
    course: assignment.courseName,
    instructions: null,
    dueAt: assignment.dueDate?.toISOString() || null
  });

  // Check if this is a split assignment (Part 2)
  const isSplitAuto = assignment.title.includes('(Split Auto)');
  const isContinued = assignment.title.includes('(Continued)');
  
  // Enhanced priority badge configuration - Gaming Theme
  const getPriorityBadge = () => {
    if (!assignment.priority || assignment.priority === 'B') return null;
    
    const priorityConfig = {
      'A': { 
        label: 'High Priority', 
        color: 'bg-emerald/20 text-emerald border-emerald/30', 
        icon: Zap,
        darkColor: 'dark:bg-emerald/10 dark:text-emerald dark:border-emerald/20'
      },
      'C': { 
        label: 'Low Priority', 
        color: 'bg-muted text-muted-foreground border-border', 
        icon: Timer,
        darkColor: 'dark:bg-muted dark:text-muted-foreground dark:border-border'
      }
    };
    
    const config = priorityConfig[assignment.priority as keyof typeof priorityConfig];
    if (!config) return null;
    
    const PriorityIcon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} ${config.darkColor} font-medium px-3 py-1`}>
        <PriorityIcon className="h-4 w-4 mr-1" />
        {config.label}
      </Badge>
    );
  };
  
  // Check if assignment is overdue or due soon for urgency indicators
  const getUrgencyBadge = () => {
    if (!assignment.dueDate) return null;
    
    const dueDate = new Date(assignment.dueDate);
    const today = new Date();
    const timeDiff = dueDate.getTime() - today.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    if (daysDiff < 0) {
      return (
        <Badge className="bg-destructive text-destructive-foreground border-destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Overdue
        </Badge>
      );
    } else if (daysDiff === 0) {
      return (
        <Badge className="bg-gold text-gold-foreground border-gold">
          <Clock className="h-3 w-3 mr-1" />
          Due Today
        </Badge>
      );
    } else if (daysDiff === 1) {
      return (
        <Badge className="bg-[hsl(var(--status-progress))] text-[hsl(var(--background))] border-[hsl(var(--status-progress))]">
          <Timer className="h-3 w-3 mr-1" />
          Due Tomorrow
        </Badge>
      );
    }
    
    return null;
  };

  const statusConfig = {
    pending: { label: 'Not Started', color: 'bg-muted text-muted-foreground', icon: PlayCircle },
    in_progress: { label: 'In Progress', color: 'bg-[hsl(var(--status-progress)_/_0.2)] text-[hsl(var(--status-progress))] border-[hsl(var(--status-progress)_/_0.3)]', icon: Clock },
    completed: { label: 'Completed', color: 'bg-emerald/20 text-emerald border-emerald/30', icon: CheckCircle },
    stuck: { label: 'Stuck - Need Help', color: 'bg-destructive/20 text-destructive border-destructive/30', icon: AlertTriangle },
    needs_more_time: { label: 'Need More Time', color: 'bg-gold/20 text-gold border-gold/30', icon: Clock },
    grading_delay: { label: 'Grading Delay', color: 'bg-violet/20 text-violet border-violet/30', icon: Clock }
  };

  const status = statusConfig[assignment.completionStatus || 'pending'];
  const StatusIcon = status.icon;

  const handleStatusUpdate = async (newStatus: Assignment['completionStatus']) => {
    try {
      let response;
      
      // Special handling for stuck assignments - use dedicated endpoint with notifications
      if (newStatus === 'stuck') {
        response = await fetch(`/api/assignments/${assignment.id}/stuck`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: 'Student marked as stuck - needs help',
            needsHelp: true // Always send parent notification
          })
        });
      } else {
        // Use regular PATCH endpoint for other status updates
        response = await fetch(`/api/assignments/${assignment.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            completionStatus: newStatus,
            timeSpent: assignment.timeSpent || 0,
            notes: newStatus === 'stuck' ? 'Student marked as stuck - needs help' : ''
          })
        });
      }

      if (!response.ok) throw new Error('Failed to update assignment');

      // Trigger celebration animation for completion
      if (newStatus === 'completed') {
        setShowCelebration(true);
      }

      const messages = {
        completed: { title: "Great work! 🎉", description: "Assignment completed successfully." },
        stuck: { title: "Help is on the way! 📧", description: "Help notification sent - assistance coming soon." },
        in_progress: { title: "Keep going!", description: "Assignment marked as in progress." },
        needs_more_time: { title: "No worries!", description: "Take the time you need." }
      };

      const message = messages[newStatus as keyof typeof messages];
      if (message) {
        toast({
          title: message.title,
          description: message.description
        });
      }

      onUpdate?.();
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast({
        title: "Error",
        description: "Could not update assignment. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (variant === 'compact') {
    return (
      <Card className="bg-card border border-border hover:shadow-md transition-shadow relative">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-medium text-foreground truncate" data-testid={`assignment-title-${assignment.id}`}>
                  {normalized.displayTitle}
                </h3>
                {normalized.courseLabel && (
                  <span className="shrink-0 rounded-full border border-border bg-card/90 px-3 py-1 text-xs font-medium text-muted-foreground">
                    {normalized.courseLabel}
                  </span>
                )}
                {isSplitAuto && (
                  <Badge variant="outline" className="bg-[hsl(var(--status-progress)_/_0.2)] text-[hsl(var(--status-progress))] border-[hsl(var(--status-progress)_/_0.3)] text-xs px-2 py-0.5">
                    <Star className="h-3 w-3 mr-1" />
                    Auto Split
                  </Badge>
                )}
                {isContinued && (
                  <Badge variant="outline" className="bg-violet/20 text-violet border-violet/30 text-xs px-2 py-0.5">
                    <Clock className="h-3 w-3 mr-1" />
                    Continued
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm text-muted-foreground" data-testid={`assignment-subject-${assignment.id}`}>
                  {assignment.subject} • {assignment.actualEstimatedMinutes || 30} min
                </p>
                {getPriorityBadge()}
                {getUrgencyBadge()}
              </div>
            </div>
            <Badge className={`${status.color} ml-2`} data-testid={`assignment-status-${assignment.id}`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>
        </CardContent>
        <ConfettiBurst 
          trigger={showCelebration} 
          onComplete={() => setShowCelebration(false)}
          colors={['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']}
          particleCount={30}
          duration={2500}
        />
      </Card>
    );
  }

  return (
    <Card className="bg-card border border-border hover:shadow-md transition-shadow relative">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-sm text-muted-foreground" data-testid={`assignment-subject-${assignment.id}`}>
              {assignment.subject || assignment.courseName || 'Assignment'}
            </div>
            <div className="flex items-center gap-2 mt-1 mb-2">
              <h3 className="text-xl font-semibold text-foreground" data-testid={`assignment-title-${assignment.id}`}>
                {normalized.displayTitle}
              </h3>
              {normalized.courseLabel && (
                <span className="inline-block px-2 py-1 text-xs font-medium bg-[hsl(var(--status-progress)_/_0.2)] text-[hsl(var(--status-progress))] rounded-full">
                  {normalized.courseLabel}
                </span>
              )}
              {(isSplitAuto || isContinued) && (
                <Badge variant="outline" className="bg-[hsl(var(--status-progress)_/_0.2)] text-[hsl(var(--status-progress))] border-[hsl(var(--status-progress)_/_0.3)]">
                  <Star className="h-3 w-3 mr-1" />
                  Split Task
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {getPriorityBadge()}
              {getUrgencyBadge()}
            </div>
          </div>
          <Badge className={status.color} data-testid={`assignment-status-${assignment.id}`}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {status.label}
          </Badge>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span data-testid={`assignment-duration-${assignment.id}`}>
            {assignment.actualEstimatedMinutes || 30} minutes
          </span>
          {assignment.dueDate && (
            <span data-testid={`assignment-due-${assignment.id}`}>
              Due: {new Date(assignment.dueDate).toLocaleDateString('en-US', { 
                timeZone: 'America/New_York' 
              })}
            </span>
          )}
        </div>

        {/* Canvas Grading Notification - Executive Function Support */}
        {hasCanvasGradingNotification && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1 space-y-3">
                <div>
                  <h4 className="font-medium text-amber-800 dark:text-amber-200">Canvas shows this is graded!</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    Did you forget to mark this assignment as complete? Canvas indicates it has been graded.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleStatusUpdate('completed')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    data-testid={`mark-complete-${assignment.id}`}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Yes, Mark Complete
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      // Clear the Canvas grading notification from notes
                      const updatedNotes = assignment.notes?.replace(/\nCANVAS GRADED:.*$/, '') || '';
                      fetch('/api/assignments', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          id: assignment.id,
                          notes: updatedNotes,
                        })
                      }).then(() => onUpdate?.());
                    }}
                    className="border-amber-300 dark:border-amber-700"
                    data-testid={`dismiss-notification-${assignment.id}`}
                  >
                    No, Still Working
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {assignment.completionStatus !== 'completed' && (
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => handleStatusUpdate('completed')}
              className="flex items-center gap-1 bg-emerald hover:bg-emerald/90 text-emerald-foreground"
              data-testid={`button-complete-${assignment.id}`}
            >
              <CheckCircle className="h-3 w-3" />
              Complete
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusUpdate('needs_more_time')}
              className="flex items-center gap-1"
              data-testid={`button-more-time-${assignment.id}`}
            >
              <Clock className="h-3 w-3" />
              Need More Time
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusUpdate('stuck')}
              className="flex items-center gap-1 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/30"
              data-testid={`button-stuck-${assignment.id}`}
            >
              <AlertTriangle className="h-3 w-3" />
              Stuck
            </Button>
          </div>
        )}

        {assignment.completionStatus === 'completed' && (
          <div className="flex items-center gap-2 text-emerald text-sm font-medium">
            <CheckCircle className="h-4 w-4" />
            Completed! Great work! 🎉
          </div>
        )}
      </CardContent>
      <ConfettiBurst 
        trigger={showCelebration} 
        onComplete={() => setShowCelebration(false)}
        colors={['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4']}
        particleCount={40}
        duration={3000}
      />
    </Card>
  );
}