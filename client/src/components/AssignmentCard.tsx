import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertTriangle, PlayCircle, Zap, Star, Timer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { normalizeAssignment } from '@shared/normalize';
import type { Assignment } from '@shared/schema';

interface AssignmentCardProps {
  assignment: Assignment;
  onUpdate?: () => void;
  variant?: 'default' | 'compact';
}

export function AssignmentCard({ assignment, onUpdate, variant = 'default' }: AssignmentCardProps) {
  const { toast } = useToast();
  
  const normalized = normalizeAssignment({
    id: assignment.id,
    title: assignment.title,
    course: assignment.courseName,
    instructions: assignment.instructions,
    dueAt: assignment.dueDate ? new Date(assignment.dueDate).toISOString() : null
  });

  // Check if this is a split assignment (Part 2)
  const isPartTwo = assignment.title.includes('(Part 2)');
  
  // Enhanced priority badge configuration
  const getPriorityBadge = () => {
    if (!assignment.priority || assignment.priority === 'B') return null;
    
    const priorityConfig = {
      'A': { 
        label: 'High Priority', 
        color: 'bg-red-100 text-red-800 border-red-200', 
        icon: Zap,
        darkColor: 'dark:bg-red-950 dark:text-red-300 dark:border-red-800'
      },
      'C': { 
        label: 'Low Priority', 
        color: 'bg-gray-100 text-gray-600 border-gray-200', 
        icon: Timer,
        darkColor: 'dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600'
      }
    };
    
    const config = priorityConfig[assignment.priority as keyof typeof priorityConfig];
    if (!config) return null;
    
    const PriorityIcon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} ${config.darkColor} font-medium`}>
        <PriorityIcon className="h-3 w-3 mr-1" />
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
        <Badge className="bg-red-600 text-white border-red-700">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Overdue
        </Badge>
      );
    } else if (daysDiff === 0) {
      return (
        <Badge className="bg-orange-500 text-white border-orange-600">
          <Clock className="h-3 w-3 mr-1" />
          Due Today
        </Badge>
      );
    } else if (daysDiff === 1) {
      return (
        <Badge className="bg-yellow-500 text-white border-yellow-600">
          <Timer className="h-3 w-3 mr-1" />
          Due Tomorrow
        </Badge>
      );
    }
    
    return null;
  };

  const statusConfig = {
    pending: { label: 'Not Started', color: 'bg-gray-100 text-gray-800', icon: PlayCircle },
    in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-800', icon: Clock },
    completed: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle },
    stuck: { label: 'Stuck - Need Help', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
    needs_more_time: { label: 'Need More Time', color: 'bg-yellow-100 text-yellow-800', icon: Clock }
  };

  const status = statusConfig[assignment.completionStatus || 'pending'];
  const StatusIcon = status.icon;

  const handleStatusUpdate = async (newStatus: Assignment['completionStatus']) => {
    try {
      const response = await fetch('/api/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: assignment.id,
          completionStatus: newStatus,
          timeSpent: assignment.timeSpent || 0,
          notes: newStatus === 'stuck' ? 'Student marked as stuck - needs help' : ''
        })
      });

      if (!response.ok) throw new Error('Failed to update assignment');

      const messages = {
        completed: { title: "Great work! 🎉", description: "Assignment completed successfully." },
        stuck: { title: "Help is on the way!", description: "This task has been flagged for assistance." },
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
      <Card className="bg-card border border-border hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-medium text-foreground truncate" data-testid={`assignment-title-${assignment.id}`}>
                  {normalized.displayTitle}
                </h3>
                {normalized.courseLabel && (
                  <span className="shrink-0 rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-xs font-medium text-slate-600">
                    {normalized.courseLabel}
                  </span>
                )}
                {isPartTwo && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 text-xs px-2 py-0.5">
                    <Star className="h-3 w-3 mr-1" />
                    Split Task
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
      </Card>
    );
  }

  return (
    <Card className="bg-card border border-border hover:shadow-md transition-shadow">
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
                <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                  {normalized.courseLabel}
                </span>
              )}
              {isPartTwo && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800">
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
              Due: {new Date(assignment.dueDate).toLocaleDateString()}
            </span>
          )}
        </div>

        {assignment.instructions && (
          <div className="bg-muted/50 p-3 rounded-md">
            <p className="text-base text-muted-foreground" data-testid={`assignment-instructions-${assignment.id}`}>
              {assignment.instructions}
            </p>
          </div>
        )}

        {assignment.completionStatus !== 'completed' && (
          <div className="flex items-center gap-2 pt-2">
            <Button
              size="sm"
              onClick={() => handleStatusUpdate('completed')}
              className="flex items-center gap-1 bg-green-600 hover:bg-green-700"
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
              className="flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50"
              data-testid={`button-stuck-${assignment.id}`}
            >
              <AlertTriangle className="h-3 w-3" />
              Stuck
            </Button>
          </div>
        )}

        {assignment.completionStatus === 'completed' && (
          <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
            <CheckCircle className="h-4 w-4" />
            Completed! Great work! 🎉
          </div>
        )}
      </CardContent>
    </Card>
  );
}