import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Assignment } from '@shared/schema';

interface OverviewBlockProps {
  assignment: Assignment;
  onUpdate?: () => void;
}

export function OverviewBlock({ assignment, onUpdate }: OverviewBlockProps) {
  const { toast } = useToast();

  const statusConfig = {
    pending: { label: 'Not Started', color: 'bg-muted text-muted-foreground', icon: Clock },
    in_progress: { label: 'In Progress', color: 'bg-blue/20 text-blue border-blue/30', icon: Clock },
    completed: { label: 'Completed', color: 'bg-emerald/20 text-emerald border-emerald/30', icon: CheckCircle },
    stuck: { label: 'Need Help', color: 'bg-destructive/20 text-destructive border-destructive/30', icon: AlertTriangle },
    needs_more_time: { label: 'Need More Time', color: 'bg-gold/20 text-gold border-gold/30', icon: Clock }
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
          timeSpent: assignment.timeSpent || 0
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

  return (
    <Card className="bg-card border border-border hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {assignment.blockStart && assignment.blockEnd && (
                <span>{assignment.blockStart} - {assignment.blockEnd}</span>
              )}
              <span>•</span>
              <span>{assignment.actualEstimatedMinutes || 30} min</span>
              {assignment.subject && (
                <>
                  <span>•</span>
                  <span>{assignment.subject}</span>
                </>
              )}
            </div>
            <h3 className="font-medium text-foreground mt-1 truncate" data-testid={`assignment-title-${assignment.id}`}>
              {assignment.title}
            </h3>
          </div>
          <Badge className={`${status.color} ml-3 flex items-center gap-1`} data-testid={`assignment-status-${assignment.id}`}>
            <StatusIcon className="h-3 w-3" />
            {status.label}
          </Badge>
        </div>

        {assignment.instructions && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2" data-testid={`assignment-instructions-${assignment.id}`}>
            {assignment.instructions}
          </p>
        )}

        {assignment.completionStatus !== 'completed' && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleStatusUpdate('completed')}
              className="flex items-center gap-1 bg-emerald hover:bg-emerald/90 text-emerald-foreground"
              data-testid={`button-complete-${assignment.id}`}
            >
              <CheckCircle className="h-3 w-3" />
              Done
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleStatusUpdate('needs_more_time')}
              className="flex items-center gap-1"
              data-testid={`button-more-time-${assignment.id}`}
            >
              <Clock className="h-3 w-3" />
              More Time
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
          <div className="flex items-center gap-2 text-emerald text-sm font-medium">
            <CheckCircle className="h-4 w-4" />
            Completed! Great work! 🎉
          </div>
        )}
      </CardContent>
    </Card>
  );
}