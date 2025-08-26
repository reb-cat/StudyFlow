import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Play, CheckCircle, Clock, HelpCircle, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Assignment } from '@shared/schema';

interface GuidedDayViewProps {
  assignments: Assignment[];
  studentName: string;
  onAssignmentUpdate?: () => void;
}

export function GuidedDayView({ assignments, studentName, onAssignmentUpdate }: GuidedDayViewProps) {
  const { toast } = useToast();
  
  // Filter out completed assignments
  const incompleteAssignments = assignments.filter(a => a.completionStatus !== 'completed');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'running' | 'break'>('idle');
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [breakRemaining, setBreakRemaining] = useState(0);

  const currentAssignment = incompleteAssignments[currentIndex];

  // Timer for running phase
  useEffect(() => {
    if (phase !== 'running' || !startedAt) return;

    const id = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          // Auto-complete when timer ends
          handleAction('completed');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [phase, startedAt]);

  // Timer for break phase
  useEffect(() => {
    if (phase !== 'break') return;

    const id = setInterval(() => {
      setBreakRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setPhase('idle');
          setCurrentIndex((idx) => Math.min(idx, Math.max(0, incompleteAssignments.length - 1)));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [phase, incompleteAssignments.length]);

  const handleStartAssignment = () => {
    const duration = (currentAssignment?.actualEstimatedMinutes || 30) * 60;
    setTimeRemaining(duration);
    setStartedAt(new Date());
    setPhase('running');
  };

  const handleAction = async (action: 'completed' | 'needs_more_time' | 'stuck') => {
    if (!currentAssignment) return;

    try {
      // Call API to update assignment status
      const response = await fetch('/api/assignments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentAssignment.id,
          completionStatus: action,
          timeSpent: (currentAssignment.actualEstimatedMinutes || 30) - Math.floor(timeRemaining / 60),
          notes: action === 'stuck' ? 'Student marked as stuck - needs help' : ''
        })
      });

      if (!response.ok) throw new Error('Failed to update assignment');

      if (action === 'needs_more_time') {
        // Move current assignment to end of queue
        const nextAssignments = incompleteAssignments.filter((_, i) => i !== currentIndex);
        nextAssignments.push(currentAssignment);
        setPhase('idle');
        setStartedAt(null);
        setTimeRemaining(0);
        
        toast({
          title: "Need More Time",
          description: "This assignment has been moved to the end of today's list.",
        });
      } else if (action === 'completed') {
        // Start break before next assignment
        const nextAssignment = incompleteAssignments[currentIndex + 1];
        if (nextAssignment) {
          setBreakRemaining(5 * 60); // 5 minute break
          setPhase('break');
        } else {
          setPhase('idle');
        }
        setStartedAt(null);
        setTimeRemaining(0);
        
        toast({
          title: "Great work! 🎉",
          description: "Assignment completed successfully.",
        });
      } else if (action === 'stuck') {
        // Remove from current queue
        setPhase('idle');
        setStartedAt(null);
        setTimeRemaining(0);
        
        toast({
          title: "Help is on the way!",
          description: "This task has been flagged for assistance.",
          variant: "default"
        });
      }

      onAssignmentUpdate?.();
    } catch (error) {
      console.error('Error updating assignment:', error);
      toast({
        title: "Error",
        description: "Could not update assignment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // All assignments completed
  if (!incompleteAssignments.length) {
    return (
      <Card className="bg-card border border-border">
        <CardContent className="p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-lg font-semibold text-foreground mb-2">All assignments complete!</h3>
          <p className="text-muted-foreground">Great work today, {studentName}!</p>
        </CardContent>
      </Card>
    );
  }

  // Break screen
  if (phase === 'break') {
    const nextAssignment = incompleteAssignments[currentIndex + 1];
    
    return (
      <div className="space-y-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {breakRemaining > 0 ? `Break time: ${formatTime(breakRemaining)}` : 'Starting next assignment...'}
          </p>
        </div>
        <Card className="bg-card border border-border">
          <CardContent className="p-8 text-center space-y-4">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Great work!</h3>
            {nextAssignment && (
              <p className="text-sm text-muted-foreground">
                Next: {nextAssignment.title}
              </p>
            )}
            {breakRemaining > 0 ? (
              <div className="space-y-2">
                <p className="text-lg font-mono font-bold text-primary">
                  {formatTime(breakRemaining)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Take a short break!
                </p>
              </div>
            ) : (
              <div className="animate-pulse">
                <p className="text-lg font-semibold text-primary">
                  Starting next assignment...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground" data-testid="progress-indicator">
          Assignment {currentIndex + 1} of {incompleteAssignments.length}
        </p>
      </div>

      <Card className="bg-card border border-border">
        <CardHeader>
          <div className="flex flex-col gap-1">
            <div className="text-lg font-semibold text-gray-600">
              {currentAssignment?.subject || currentAssignment?.courseName || 'Assignment'}
            </div>
            <h3 className="text-2xl font-bold" data-testid="assignment-title">
              {currentAssignment?.title}
            </h3>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span data-testid="estimated-time">
              Estimated: {currentAssignment?.actualEstimatedMinutes || 30} minutes
            </span>
            {currentAssignment?.courseName && (
              <span data-testid="course-name">Course: {currentAssignment.courseName}</span>
            )}
          </div>

          {/* Instructions section */}
          <div className="bg-muted/50 p-3 rounded-md">
            <h4 className="text-sm font-medium text-foreground mb-2">Instructions:</h4>
            <p className="text-sm text-muted-foreground" data-testid="assignment-instructions">
              {currentAssignment?.instructions || "Check your textbook or course materials"}
            </p>
          </div>

          {/* Executive function tip */}
          <Alert className="bg-blue-50 border-blue-200">
            <Play className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Before you start:</strong> Take 2-3 minutes to do some deep breathing or light stretching. This helps your brain get ready for focused work!
            </AlertDescription>
          </Alert>

          {phase === 'running' && (
            <div className="text-center">
              <div className="text-3xl font-mono font-bold text-foreground" data-testid="timer-display">
                {formatTime(timeRemaining)}
              </div>
              <p className="text-sm text-muted-foreground">Time remaining</p>
            </div>
          )}

          <div className="flex items-center justify-center gap-2">
            {phase !== 'running' ? (
              <Button
                onClick={handleStartAssignment}
                className="flex items-center gap-2"
                data-testid="button-start"
              >
                <Play className="h-4 w-4" />
                Start Assignment
              </Button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <Button
                  onClick={() => handleAction('completed')}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                  data-testid="button-complete"
                >
                  <CheckCircle className="h-4 w-4" />
                  Complete
                </Button>
                <Button
                  onClick={() => handleAction('needs_more_time')}
                  variant="outline"
                  className="flex items-center gap-2"
                  data-testid="button-more-time"
                >
                  <Clock className="h-4 w-4" />
                  Need More Time
                </Button>
                <Button
                  onClick={() => handleAction('stuck')}
                  variant="outline"
                  className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
                  data-testid="button-stuck"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Stuck - Need Help
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}