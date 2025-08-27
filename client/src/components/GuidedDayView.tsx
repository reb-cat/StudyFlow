import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle, Clock, HelpCircle, AlertCircle, Calendar, User, ArrowLeft, ExternalLink } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Assignment } from '@shared/schema';
import { FixedBlock } from './FixedBlock';
import { CircularTimer } from './CircularTimer';

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
  onModeToggle?: () => void;
}

export function GuidedDayView({ assignments, studentName, selectedDate, onAssignmentUpdate, scheduleTemplate = [], onModeToggle }: GuidedDayViewProps) {
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
  const [isTimerRunning, setIsTimerRunning] = useState(true); // Auto-start timer
  const [extraTime, setExtraTime] = useState(0);
  const [completedBlocks, setCompletedBlocks] = useState<Set<string>>(new Set());

  const currentBlock = scheduleBlocks[currentIndex];
  const totalBlocks = scheduleBlocks.length;
  const progressPercentage = Math.round((completedBlocks.size / totalBlocks) * 100);

  // Format date for display
  const dateObj = new Date(selectedDate + 'T12:00:00.000Z');
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const dateDisplay = dateObj.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric',
    timeZone: 'UTC'
  });

  // Auto-start timer when block changes
  useEffect(() => {
    if (currentBlock && !completedBlocks.has(currentBlock.id)) {
      setIsTimerRunning(true);
      setExtraTime(0);
    }
  }, [currentIndex, currentBlock]);

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

  const handleBlockComplete = () => {
    if (!currentBlock) return;
    
    setCompletedBlocks(prev => new Set(prev).add(currentBlock.id));
    setIsTimerRunning(false);
    onAssignmentUpdate?.();
    
    toast({
      title: 'Well Done!',
      description: `Great job completing ${currentBlock.title}! 🎉`,
    });
    
    // Move to next incomplete block
    let nextIndex = currentIndex + 1;
    while (nextIndex < scheduleBlocks.length && completedBlocks.has(scheduleBlocks[nextIndex].id)) {
      nextIndex++;
    }
    setCurrentIndex(nextIndex);
  };

  const handleNeedMoreTime = () => {
    // Complex backend process: duplicate assignment, mark as needing more time,
    // reschedule other blocks either same day or next day
    setIsTimerRunning(false);
    
    toast({
      title: 'Rescheduling',
      description: `${currentBlock.title} needs more time. Moving to next task.`,
    });
    
    // Mark current block as needing more time (would involve backend updates)
    // This duplicates the assignment and reschedules remaining blocks
    
    // Move to next block
    if (currentIndex < scheduleBlocks.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsTimerRunning(true); // Auto-start next block
      setExtraTime(0);
    } else {
      toast({
        title: 'Day Complete',
        description: 'Great job! You\'ve finished today\'s schedule.',
      });
      onModeToggle?.();
    }
  };

  const handleStuck = () => {
    // Backend process: mark as stuck, potentially reschedule or notify for help
    setIsTimerRunning(false);
    
    toast({
      title: 'Marked as Stuck',
      description: `${currentBlock.title} has been flagged for help. Moving to next task.`,
      variant: 'default'
    });
    
    // Move to next block after marking as stuck
    if (currentIndex < scheduleBlocks.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsTimerRunning(true); // Auto-start next block
      setExtraTime(0);
    } else {
      toast({
        title: 'Day Complete',
        description: 'You\'ve reached the end of today\'s schedule.',
      });
      onModeToggle?.();
    }
  };

  const handleTimerComplete = () => {
    setIsTimerRunning(false);
    toast({
      title: 'Time\'s Up!',
      description: `Time for ${currentBlock.title} has finished. How did it go?`,
    });
  };

  // All blocks completed or no blocks
  if (!currentBlock || currentIndex >= scheduleBlocks.length || scheduleBlocks.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-green-900 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-foreground">Wonderful work, {studentName}!</h1>
          <p className="text-xl text-muted-foreground">You've completed all your scheduled blocks for today.</p>
          <Button onClick={onModeToggle} size="lg" className="mt-6">
            Return to Overview
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Pure Focus Card - No Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 space-y-8">
          {/* Current Task - Minimal */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {currentBlock.title}
            </h2>
          </div>

          {/* HUGE Timer - Dominant Element */}
          <div className="flex justify-center">
            <CircularTimer
              durationMinutes={currentBlock.estimatedMinutes || 20}
              isRunning={isTimerRunning}
              onComplete={handleTimerComplete}
              onToggle={() => setIsTimerRunning(!isTimerRunning)}
              onReset={() => {
                setIsTimerRunning(false);
                setExtraTime(0);
              }}
              hideControls={true}
              extraTime={extraTime}
            />
          </div>

          {/* Essential Actions Only */}
          <div className="space-y-3">
            <Button 
              onClick={handleBlockComplete}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-medium text-lg"
              data-testid="button-block-complete"
            >
              Done
            </Button>
            
            <div className="flex space-x-3">
              <Button 
                onClick={handleNeedMoreTime}
                variant="outline"
                className="flex-1 py-3 rounded-2xl"
                data-testid="button-need-more-time"
              >
                Need More Time
              </Button>
              
              <Button 
                onClick={handleStuck}
                variant="outline"
                className="flex-1 py-3 rounded-2xl"
                data-testid="button-stuck"
              >
                Stuck
              </Button>
            </div>
            
            {/* Emergency Exit - Requires Double Tap */}
            <div className="pt-6 text-center">
              <Button
                variant="ghost"
                onDoubleClick={onModeToggle}
                className="text-xs text-gray-300 hover:text-gray-400 transition-colors"
                data-testid="button-mode-toggle"
                title="Double-tap to exit (emergency only)"
              >
                Emergency Exit
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}