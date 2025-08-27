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
  const [isTimerRunning, setIsTimerRunning] = useState(false);
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
    setExtraTime(prev => prev + 10); // Add 10 more minutes
    if (!isTimerRunning) setIsTimerRunning(true);
    
    toast({
      title: 'Time Extended',
      description: `Added 10 more minutes to ${currentBlock.title}`,
    });
  };

  const handleStuck = () => {
    setIsTimerRunning(false);
    
    toast({
      title: 'Help Requested',
      description: `You've flagged ${currentBlock.title} for help. Take your time!`,
      variant: 'default'
    });
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
    <div className="h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-900 p-2 flex flex-col">
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
        {/* Back button only */}
        <div className="flex justify-end mb-2">
          <Button
            variant="outline"
            onClick={onModeToggle}
            className="px-2 py-1 text-xs"
            data-testid="button-mode-toggle"
          >
            <ArrowLeft className="w-3 h-3 mr-1" />
            Overview
          </Button>
        </div>

        {/* Minimal Progress Bar */}
        <div className="mb-2 bg-white dark:bg-gray-800 rounded-lg p-2 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Block {currentIndex + 1} of {totalBlocks} • {progressPercentage}%
            </h2>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div 
              className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full h-1.5 transition-all duration-500"
              style={{ width: `${(completedBlocks.size / totalBlocks) * 100}%` }}
            />
          </div>
        </div>

        {/* Activity Card - Simplified */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 flex-1 flex flex-col">
          {/* Activity Title Only */}
          <div className="text-center mb-2">
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              {currentBlock.startTime} - {currentBlock.endTime}
            </Badge>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1 mb-1">
              {currentBlock.title}
            </h2>
          </div>

          {/* LARGE Timer - The Dominant Element */}
          <div className="flex justify-center flex-1 items-center">
            <CircularTimer
              durationMinutes={currentBlock.estimatedMinutes || 20}
              isRunning={isTimerRunning}
              onComplete={handleTimerComplete}
              onToggle={() => setIsTimerRunning(!isTimerRunning)}
              onReset={() => {
                setIsTimerRunning(false);
                setExtraTime(0);
              }}
              extraTime={extraTime}
            />
          </div>

          {/* Action Buttons - Essential Only */}
          <div className="space-y-1 mt-2">
            <Button 
              onClick={handleBlockComplete}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-1.5 text-sm font-medium"
              data-testid="button-block-complete"
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Done
            </Button>
            
            <div className="grid grid-cols-2 gap-1">
              <Button 
                onClick={handleNeedMoreTime}
                variant="outline"
                className="py-1.5 text-xs"
                data-testid="button-need-more-time"
              >
                <Clock className="w-3 h-3 mr-1" />
                More Time
              </Button>
              
              <Button 
                onClick={handleStuck}
                variant="outline"
                className="py-1.5 text-xs"
                data-testid="button-stuck"
              >
                <HelpCircle className="w-3 h-3 mr-1" />
                Stuck
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}