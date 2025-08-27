import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle, Clock, HelpCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Assignment } from '@shared/schema';
import { FixedBlock } from './FixedBlock';

interface ScheduleBlock {
  id: string;
  type: 'bible' | 'fixed' | 'assignment';
  title: string;
  startTime: string;
  endTime: string;
  estimatedMinutes?: number;
  assignment?: Assignment;
  blockType?: string;
}

interface GuidedDayViewProps {
  assignments: Assignment[];
  studentName: string;
  selectedDate: string;
  scheduleTemplate?: any[];
  onAssignmentUpdate?: () => void;
}

export function GuidedDayView({ assignments, studentName, selectedDate, onAssignmentUpdate, scheduleTemplate = [] }: GuidedDayViewProps) {
  const { toast } = useToast();
  
  // Build complete schedule using real schedule template data (same as Overview mode)
  const allScheduleBlocks = scheduleTemplate.map((block) => ({
    id: block.id,
    title: block.subject,
    blockType: block.blockType?.toLowerCase() || 'unknown',
    startTime: block.startTime?.substring(0, 5) || '00:00', // Remove seconds from HH:MM:SS
    endTime: block.endTime?.substring(0, 5) || '00:00',
    blockNumber: block.blockNumber,
    subject: block.subject
  }));

  // Create complete schedule blocks in chronological order - IDENTICAL to Overview mode
  const scheduleBlocks: ScheduleBlock[] = [
    // Bible blocks from schedule template  
    ...allScheduleBlocks
      .filter((block) => block.blockType === 'bible')
      .map(block => ({
        id: block.id,
        type: 'bible' as const,
        title: block.subject,
        startTime: block.startTime,
        endTime: block.endTime,
        estimatedMinutes: 20,
        blockType: block.blockType
      })),
    // Fixed blocks from schedule template
    ...allScheduleBlocks
      .filter((block) => ['travel', 'co-op', 'prep/load', 'movement', 'lunch'].includes(block.blockType))
      .map(block => ({
        id: block.id,
        type: 'fixed' as const,
        title: block.subject,
        startTime: block.startTime,
        endTime: block.endTime,
        estimatedMinutes: parseInt(block.endTime.split(':')[0]) * 60 + parseInt(block.endTime.split(':')[1]) - 
                           (parseInt(block.startTime.split(':')[0]) * 60 + parseInt(block.startTime.split(':')[1])),
        blockType: block.blockType
      })),
    // Assignment blocks - use schedule template blocks AND fill with actual assignment data
    ...allScheduleBlocks
      .filter((block) => block.blockType === 'assignment')
      .map((block, index) => {
        // Fill assignment blocks with available assignments (round-robin if more blocks than assignments)
        const assignmentIndex = assignments.length > 0 ? index % assignments.length : -1;
        const matchingAssignment = assignmentIndex >= 0 ? assignments[assignmentIndex] : null;
        
        return {
          id: matchingAssignment ? matchingAssignment.id : block.id,
          type: 'assignment' as const,
          title: matchingAssignment ? matchingAssignment.title : 'Assignment',
          startTime: block.startTime,
          endTime: block.endTime,
          estimatedMinutes: matchingAssignment ? matchingAssignment.actualEstimatedMinutes || 30 : 30,
          assignment: matchingAssignment || undefined,
          blockType: block.blockType
        };
      })
  ].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'running' | 'break'>('idle');
  const [timeRemaining, setTimeRemaining] = useState(0);

  const currentBlock = scheduleBlocks[currentIndex];
  const totalBlocks = scheduleBlocks.length;

  // Timer for running phase
  useEffect(() => {
    if (phase !== 'running' || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAction('completed');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase, timeRemaining]);

  // Time formatting function
  const formatTime = (start: string, end: string) => {
    const formatTimeString = (timeStr: string) => {
      if (!timeStr || timeStr === '00:00') return '12:00 AM';
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    };
    return `${formatTimeString(start)} – ${formatTimeString(end)}`;
  };

  const handleAction = (action: 'completed' | 'needs_more_time' | 'stuck') => {
    if (!currentBlock) return;

    // Move to next block
    if (currentIndex < totalBlocks - 1) {
      setCurrentIndex(prev => prev + 1);
      setPhase('idle');
    }

    // Call the update callback
    onAssignmentUpdate?.();

    // Show feedback
    const messages = {
      completed: `Great job completing ${currentBlock.title}! 🎉`,
      needs_more_time: `${currentBlock.title} will be continued later. ⏰`,
      stuck: `No worries! Help is on the way for ${currentBlock.title}. 💪`
    };

    toast({
      title: action === 'completed' ? 'Well Done!' : 'Status Updated',
      description: messages[action],
      variant: action === 'stuck' ? 'destructive' : 'default'
    });
  };

  const startBlock = () => {
    if (currentBlock) {
      setPhase('running');
      setTimeRemaining((currentBlock.estimatedMinutes || 30) * 60);
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // If no blocks to work on
  if (scheduleBlocks.length === 0) {
    return (
      <Card className="bg-card border border-border">
        <CardContent className="p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">All blocks complete!</h3>
          <p className="text-muted-foreground">Great work today, {studentName}! 🎉</p>
        </CardContent>
      </Card>
    );
  }

  // All blocks completed
  if (currentIndex >= totalBlocks) {
    return (
      <Card className="bg-card border border-border">
        <CardContent className="p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">All blocks complete!</h3>
          <p className="text-muted-foreground">Great work today, {studentName}! 🎉</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <Card className="bg-card border border-border">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Progress</span>
            <span className="text-sm font-medium">{currentIndex + 1} of {totalBlocks}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentIndex) / totalBlocks) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Current Block */}
      <Card className="bg-card border border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">{currentBlock.title}</CardTitle>
            <Badge variant="outline">
              {formatTime(currentBlock.startTime, currentBlock.endTime)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Render actual block content */}
          {currentBlock.type === 'bible' && (
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 text-blue-600 dark:text-blue-400">📖</div>
                <div className="flex-1">
                  <div className="font-medium text-sm text-blue-900 dark:text-blue-100">
                    Bible Reading
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    {currentBlock.startTime} - {currentBlock.endTime}
                  </div>
                  <div className="text-sm text-blue-800 dark:text-blue-200 mt-1 font-medium">
                    {currentBlock.title}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {currentBlock.type === 'fixed' && (
            <FixedBlock
              blockId={currentBlock.id}
              title={currentBlock.title}
              blockType={currentBlock.blockType || 'fixed'}
              blockStart={currentBlock.startTime}
              blockEnd={currentBlock.endTime}
              date={selectedDate}
            />
          )}
          
          {currentBlock.type === 'assignment' && currentBlock.assignment && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Subject: {currentBlock.assignment.subject}</h4>
                {currentBlock.assignment.instructions && (
                  <p className="text-sm text-muted-foreground">
                    {currentBlock.assignment.instructions}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Timer Display */}
          {phase === 'running' && (
            <div className="text-center py-8">
              <div className="text-6xl font-mono font-bold text-primary mb-4">
                {formatTimeRemaining(timeRemaining)}
              </div>
              <div className="text-sm text-muted-foreground">
                Time remaining for {currentBlock.title}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {phase === 'idle' ? (
              <Button onClick={startBlock} className="flex-1">
                <Play className="h-4 w-4 mr-2" />
                Start Block
              </Button>
            ) : (
              <>
                <Button 
                  onClick={() => handleAction('completed')} 
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  size="lg"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Done
                </Button>
                <Button 
                  onClick={() => handleAction('needs_more_time')} 
                  variant="outline" 
                  className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                  size="lg"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Need More Time
                </Button>
                <Button 
                  onClick={() => handleAction('stuck')} 
                  variant="outline" 
                  className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
                  size="lg"
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Stuck
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Blocks */}
      {currentIndex < totalBlocks - 1 && (
        <Card className="bg-muted/50 border border-border">
          <CardHeader>
            <CardTitle className="text-lg">Next Up</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {scheduleBlocks.slice(currentIndex + 1, currentIndex + 4).map((block) => (
                <div key={block.id} className="flex items-center justify-between text-sm">
                  <span>{block.title}</span>
                  <span className="text-muted-foreground">
                    {formatTime(block.startTime, block.endTime)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}