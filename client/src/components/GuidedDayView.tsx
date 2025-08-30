import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, CheckCircle, Clock, HelpCircle, Volume2, VolumeX, AlertCircle, ChevronRight, Undo } from 'lucide-react';
import type { Assignment } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { getTodayString, formatDateShort } from '@shared/dateUtils';

// StudyFlow color system
const colors = {
  primary: '#844FC1',
  complete: '#21BF06',
  progress: '#3B86D1',
  support: '#6C7293',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#212529',
  textMuted: '#6C7293'
};

// CircularTimer component with StudyFlow colors
interface CircularTimerProps {
  durationMinutes: number;
  isRunning: boolean;
  onComplete?: () => void;
  onToggle: () => void;
  onReset: () => void;
  extraTime?: number;
  hideControls?: boolean;
  externalTimeRemaining?: number | null;
  onTimeUpdate?: (time: number) => void;
}

const CircularTimer = ({ 
  durationMinutes, 
  isRunning, 
  onComplete, 
  onToggle, 
  onReset,
  extraTime = 0,
  hideControls = false,
  externalTimeRemaining = null,
  onTimeUpdate
}: CircularTimerProps) => {
  const [internalTimeRemaining, setInternalTimeRemaining] = useState(durationMinutes * 60 + extraTime * 60);
  
  const timeRemaining = externalTimeRemaining !== null ? externalTimeRemaining : internalTimeRemaining;
  const totalTime = durationMinutes * 60 + extraTime * 60;

  useEffect(() => {
    if (externalTimeRemaining === null) {
      setInternalTimeRemaining(durationMinutes * 60 + extraTime * 60);
    }
  }, [durationMinutes, extraTime, externalTimeRemaining]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        const newTime = timeRemaining - 1;
        if (newTime <= 0) {
          onComplete?.();
          if (onTimeUpdate) {
            onTimeUpdate(0);
          } else {
            setInternalTimeRemaining(0);
          }
        } else {
          if (onTimeUpdate) {
            onTimeUpdate(newTime);
          } else {
            setInternalTimeRemaining(newTime);
          }
        }
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [isRunning, timeRemaining, onComplete, onTimeUpdate]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const progress = (timeRemaining / totalTime) * 100;
  const radius = 130;
  const strokeWidth = 14;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDasharray = `${circumference} ${circumference}`;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Color based on time remaining - using StudyFlow color system
  const getTimerColor = () => {
    if (timeRemaining > 300) return colors.complete; // More than 5 min - green
    if (timeRemaining > 60) return colors.progress;  // 1-5 min - blue
    return colors.support;  // Less than 1 min - gray (not alarming red!)
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{ position: 'relative' }}>
        <svg height={radius * 2} width={radius * 2} style={{ transform: 'rotate(-90deg)' }}>
          {/* Background circle - soft gray */}
          <circle
            stroke={colors.background}
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          {/* Progress circle with StudyFlow colors */}
          <circle
            stroke={getTimerColor()}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            style={{ transition: 'all 1s linear' }}
          />
        </svg>
        
        {/* Time display in center */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column'
        }}>
          <div style={{ fontSize: '48px', fontWeight: 'bold', color: colors.text }}>
            {formatTime(timeRemaining)}
          </div>
          {extraTime > 0 && (
            <div style={{ fontSize: '14px', color: colors.textMuted }}>
              +{extraTime}min
            </div>
          )}
        </div>
      </div>

      {!hideControls && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onToggle}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: `1px solid ${colors.primary}`,
              backgroundColor: isRunning ? 'transparent' : colors.primary,
              color: isRunning ? colors.primary : 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'all 0.2s'
            }}
          >
            {isRunning ? <Pause size={16} /> : <Play size={16} />}
            {isRunning ? 'Pause' : 'Start'}
          </button>
          
          <button
            onClick={onReset}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: `1px solid ${colors.textMuted}`,
              backgroundColor: 'transparent',
              color: colors.textMuted,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>
      )}
    </div>
  );
};

interface ScheduleBlock {
  id: string;
  type: 'bible' | 'fixed' | 'assignment';
  title: string;
  startTime: string;
  endTime: string;
  estimatedMinutes?: number;
  assignment?: Assignment;
  blockType?: string;
  subject?: string;
}

interface GuidedDayViewProps {
  assignments: Assignment[];
  studentName: string;
  selectedDate: string;
  scheduleTemplate?: any[];
  onAssignmentUpdate?: () => void;
  onModeToggle?: () => void;
}

export function GuidedDayView({ 
  assignments = [], 
  studentName = "Student", 
  selectedDate = getTodayString(),
  scheduleTemplate = [],
  onAssignmentUpdate,
  onModeToggle 
}: GuidedDayViewProps) {
  
  // Build actual schedule from schedule template (like the existing system)
  const buildScheduleBlocks = (): ScheduleBlock[] => {
    if (scheduleTemplate.length === 0) {
      // Demo schedule for testing
      return [
        { id: '1', type: 'assignment', title: 'Math - Algebra Practice', startTime: '09:00', endTime: '10:00', estimatedMinutes: 30, blockType: 'assignment' },
        { id: '2', type: 'bible', title: 'Bible Reading', startTime: '10:15', endTime: '10:45', estimatedMinutes: 20, blockType: 'bible' },
        { id: '3', type: 'assignment', title: 'Science Lab Report', startTime: '11:00', endTime: '12:00', estimatedMinutes: 45, blockType: 'assignment' },
        { id: '4', type: 'fixed', title: 'Lunch Break', startTime: '12:00', endTime: '13:00', estimatedMinutes: 60, blockType: 'lunch' },
        { id: '5', type: 'assignment', title: 'English Essay Draft', startTime: '13:00', endTime: '14:00', estimatedMinutes: 40, blockType: 'assignment' }
      ];
    }

    // Convert schedule template to schedule blocks
    return scheduleTemplate.map((block) => {
      const blockType = block.blockType?.toLowerCase() || 'unknown';
      
      // Determine type and estimated time
      let type: 'bible' | 'fixed' | 'assignment' = 'fixed';
      let estimatedMinutes = 30;
      let matchedAssignment: Assignment | undefined;
      
      if (blockType === 'bible') {
        type = 'bible';
        estimatedMinutes = 20;
      } else if (blockType === 'assignment') {
        type = 'assignment';
        estimatedMinutes = block.estimatedMinutes || 30;
        
        // Find matching assignment for this block to get instructions
        matchedAssignment = assignments.find(assignment => 
          assignment.userId === studentName &&
          assignment.scheduledDate === selectedDate &&
          assignment.scheduledBlock === block.blockNumber
        );
      } else {
        type = 'fixed';
        estimatedMinutes = 15; // Short fixed blocks
      }

      return {
        id: block.id || `block-${block.blockNumber}`,
        type,
        title: block.subject || block.title || `Block ${block.blockNumber}`,
        startTime: block.startTime?.substring(0, 5) || '00:00',
        endTime: block.endTime?.substring(0, 5) || '00:00',
        estimatedMinutes,
        blockType,
        subject: block.subject,
        assignment: matchedAssignment
      };
    })
    // Filter out non-essential blocks for guided mode (keep assignments, bible, important fixed blocks)
    .filter(block => 
      block.type === 'assignment' || 
      block.type === 'bible' || 
      ['lunch', 'movement'].includes(block.blockType || '')
    )
    // Sort by start time
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  const scheduleBlocks = buildScheduleBlocks();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true); // Auto-start timer
  const [completedBlocks, setCompletedBlocks] = useState(new Set<string>());
  const [timeRemaining, setTimeRemaining] = useState<number | null>(20 * 60);
  const [exitClickCount, setExitClickCount] = useState(0);
  const [showDoneDialog, setShowDoneDialog] = useState(false);
  const [showNeedTimeDialog, setShowNeedTimeDialog] = useState(false);
  const [showStuckDialog, setShowStuckDialog] = useState(false);
  const [undoStuckState, setUndoStuckState] = useState<any>(null);
  const [undoTimeLeft, setUndoTimeLeft] = useState(0);
  const { toast } = useToast();

  const currentBlock = scheduleBlocks[currentIndex];
  
  // Reset timer when block changes
  useEffect(() => {
    if (currentBlock) {
      setTimeRemaining((currentBlock.estimatedMinutes || 20) * 60);
      setIsTimerRunning(true); // Auto-start for new block
    }
  }, [currentIndex]);
  const totalBlocks = scheduleBlocks.length;
  const completedCount = completedBlocks.size;
  const progressPercentage = Math.round((completedCount / totalBlocks) * 100);

  // Block type styling with StudyFlow colors
  const getBlockStyle = (blockType?: string) => {
    const styles = {
      assignment: { borderColor: colors.progress, bgColor: '#EBF4FC', icon: Clock },
      bible: { borderColor: colors.primary, bgColor: '#F4F0FA', icon: CheckCircle },
      fixed: { borderColor: colors.support, bgColor: colors.background, icon: HelpCircle },
      lunch: { borderColor: colors.support, bgColor: colors.background, icon: HelpCircle },
      movement: { borderColor: colors.complete, bgColor: '#E8F8E5', icon: CheckCircle }
    };
    return styles[blockType as keyof typeof styles] || styles.assignment;
  };

  // Undo countdown effect
  useEffect(() => {
    if (undoTimeLeft > 0) {
      const timer = setTimeout(() => {
        setUndoTimeLeft(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (undoTimeLeft === 0 && undoStuckState) {
      // Undo window expired
      setUndoStuckState(null);
    }
  }, [undoTimeLeft, undoStuckState]);

  const handleBlockComplete = async () => {
    if (!currentBlock) return;
    
    if (currentBlock.type === 'assignment' && currentBlock.assignment) {
      // Show Done dialog for assignments
      setShowDoneDialog(true);
    } else {
      // Complete non-assignment blocks immediately
      await completeBlock();
    }
  };

  const completeBlock = async (timeSpent?: number, earlyFinish?: boolean, bankMinutes?: number) => {
    if (!currentBlock) return;
    
    setCompletedBlocks(prev => new Set([...Array.from(prev), currentBlock.id]));
    setIsTimerRunning(false);
    
    // Call API for assignment completion
    if (currentBlock.type === 'assignment' && currentBlock.assignment) {
      try {
        const response = await apiRequest('POST', `/api/assignments/${currentBlock.assignment.id}/done`, {
          timeSpent: timeSpent || 0,
          earlyFinish: earlyFinish || false,
          bankMinutes: bankMinutes || 0
        }) as any;
        
        toast({
          title: "Assignment Completed!",
          description: response.message,
          variant: "default"
        });
        
        if (onAssignmentUpdate) {
          onAssignmentUpdate();
        }
      } catch (error) {
        console.error('Failed to complete assignment:', error);
        toast({
          title: "Error",
          description: "Failed to mark assignment as complete",
          variant: "destructive"
        });
      }
    }
    
    // Move to next block
    if (currentIndex < scheduleBlocks.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsTimerRunning(true);
    } else {
      // Day complete
      onModeToggle?.();
    }
    
    setShowDoneDialog(false);
  };

  const handleNeedMoreTime = () => {
    setShowNeedTimeDialog(true);
  };

  const rescheduleAssignment = async (reason: string, estimatedMinutesNeeded?: number) => {
    if (!currentBlock?.assignment) return;
    
    try {
      const response = await apiRequest('POST', `/api/assignments/${currentBlock.assignment.id}/need-more-time`, {
        reason,
        estimatedMinutesNeeded
      }) as any;
      
      toast({
        title: "Assignment Rescheduled",
        description: response.message,
        variant: "default"
      });
      
      if (onAssignmentUpdate) {
        onAssignmentUpdate();
      }
      
      // Move to next block
      if (currentIndex < scheduleBlocks.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsTimerRunning(true);
      }
      
    } catch (error) {
      console.error('Failed to reschedule assignment:', error);
      toast({
        title: "Error",
        description: "Failed to reschedule assignment",
        variant: "destructive"
      });
    }
    
    setShowNeedTimeDialog(false);
  };

  const handleStuck = () => {
    setShowStuckDialog(true);
  };

  const markAsStuck = async (reason: string, needsHelp: boolean) => {
    if (!currentBlock?.assignment) return;
    
    try {
      const response = await apiRequest('POST', `/api/assignments/${currentBlock.assignment.id}/stuck`, {
        reason,
        needsHelp
      }) as any;
      
      // Set up undo state with 15-second timer
      setUndoStuckState(response.originalState);
      setUndoTimeLeft(15);
      
      toast({
        title: "Assignment Marked as Stuck",
        description: `${response.message} Undo available for 15 seconds.`,
        variant: "default"
      });
      
      if (onAssignmentUpdate) {
        onAssignmentUpdate();
      }
      
      // Move to next block
      if (currentIndex < scheduleBlocks.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsTimerRunning(true);
      }
      
    } catch (error) {
      console.error('Failed to mark as stuck:', error);
      toast({
        title: "Error",
        description: "Failed to mark assignment as stuck",
        variant: "destructive"
      });
    }
    
    setShowStuckDialog(false);
  };

  const undoStuck = async () => {
    if (!undoStuckState || !currentBlock?.assignment) return;
    
    try {
      await apiRequest('POST', `/api/assignments/${currentBlock.assignment.id}/undo-stuck`, {
        originalState: undoStuckState
      });
      
      setUndoStuckState(null);
      setUndoTimeLeft(0);
      
      toast({
        title: "Undo Successful",
        description: "Assignment restored to original state",
        variant: "default"
      });
      
      if (onAssignmentUpdate) {
        onAssignmentUpdate();
      }
      
    } catch (error) {
      console.error('Failed to undo stuck:', error);
      toast({
        title: "Error",
        description: "Failed to undo stuck status",
        variant: "destructive"
      });
    }
  };

  // Completion screen
  if (!currentBlock || currentIndex >= scheduleBlocks.length) {
    return (
      <div style={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${colors.complete}20 0%, ${colors.background} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '72px', marginBottom: '24px' }}>🎉</div>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: colors.text, marginBottom: '16px' }}>
            Wonderful work, {studentName}!
          </h1>
          <p style={{ fontSize: '20px', color: colors.textMuted, marginBottom: '32px' }}>
            You've completed today's schedule
          </p>
          <button
            onClick={onModeToggle}
            style={{
              padding: '16px 32px',
              fontSize: '18px',
              borderRadius: '12px',
              backgroundColor: colors.primary,
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            Return to Overview
          </button>
        </div>
      </div>
    );
  }

  const blockStyle = getBlockStyle(currentBlock.blockType || currentBlock.type);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '480px',
        width: '100%',
        backgroundColor: colors.surface,
        borderRadius: '24px',
        padding: '32px',
        boxShadow: '0 20px 60px rgba(132, 79, 193, 0.1)'
      }}>
        {/* Progress indicator */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px', color: colors.textMuted }}>
              Task {currentIndex + 1} of {totalBlocks}
            </span>
            <span style={{ fontSize: '14px', color: colors.complete, fontWeight: '600' }}>
              {completedCount} completed
            </span>
          </div>
          <div style={{
            height: '8px',
            backgroundColor: colors.background,
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progressPercentage}%`,
              height: '100%',
              backgroundColor: colors.complete,
              transition: 'width 0.5s ease',
              borderRadius: '4px'
            }} />
          </div>
        </div>

        {/* Current Task Card */}
        <div style={{
          backgroundColor: blockStyle.bgColor,
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '32px'
        }}>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            color: colors.text,
            marginBottom: '8px'
          }}>
            {currentBlock.title}
          </h2>

          {/* Due date only - remove redundant time info */}
          {currentBlock.assignment?.dueDate && (
            <div style={{ 
              fontSize: '14px', 
              color: colors.textMuted, 
              marginBottom: '16px'
            }}>
              Due: {formatDateShort(currentBlock.assignment.dueDate)}
            </div>
          )}

          {/* Assignment Instructions - Always visible for assignments */}
          {currentBlock.type === 'assignment' && currentBlock.assignment && (
            <div style={{
              marginBottom: '12px',
              padding: '16px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.background}`,
              fontSize: '14px',
              lineHeight: '1.6'
            }}>
              {currentBlock.assignment.instructions ? (
                <div>
                  <div style={{ 
                    fontWeight: '600', 
                    color: colors.text, 
                    marginBottom: '8px',
                    fontSize: '15px'
                  }}>
                    📝 What to do:
                  </div>
                  <div 
                    style={{ color: colors.text }}
                    dangerouslySetInnerHTML={{ 
                      __html: currentBlock.assignment.instructions.replace(/\n/g, '<br/>') 
                    }}
                  />
                </div>
              ) : (
                <div>
                  <div style={{ 
                    fontWeight: '600', 
                    color: colors.text, 
                    marginBottom: '8px',
                    fontSize: '15px'
                  }}>
                    📚 {currentBlock.assignment.courseName || currentBlock.assignment.subject || 'Assignment'}:
                  </div>
                  <div style={{ color: colors.text }}>
                    Work on: {currentBlock.assignment.title}
                    {currentBlock.assignment.pointsValue && (
                      <div style={{ marginTop: '4px', fontSize: '13px', color: colors.textMuted }}>
                        Worth {currentBlock.assignment.pointsValue} points
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bible reading instructions */}
          {currentBlock.type === 'bible' && (
            <div style={{
              marginBottom: '12px',
              padding: '16px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.background}`,
              fontSize: '14px',
              lineHeight: '1.6'
            }}>
              <div style={{ 
                fontWeight: '600', 
                color: colors.text, 
                marginBottom: '8px',
                fontSize: '15px'
              }}>
                📖 Today's Bible Reading:
              </div>
              <div style={{ color: colors.text }}>
                Continue reading from where you left off yesterday. Take notes on key verses or insights.
              </div>
            </div>
          )}
        </div>

        {/* Timer */}
        <div style={{ marginBottom: '32px' }}>
          <CircularTimer
            durationMinutes={currentBlock.estimatedMinutes || 20}
            isRunning={isTimerRunning}
            onComplete={() => setIsTimerRunning(false)}
            onToggle={() => setIsTimerRunning(!isTimerRunning)}
            onReset={() => {
              setIsTimerRunning(false);
              setTimeRemaining((currentBlock.estimatedMinutes || 20) * 60);
            }}
            hideControls={true}
            externalTimeRemaining={timeRemaining}
            onTimeUpdate={setTimeRemaining}
          />
        </div>

        {/* Undo Stuck Banner (if active) */}
        {undoStuckState && undoTimeLeft > 0 && (
          <div style={{
            backgroundColor: '#FEF3C7',
            border: '1px solid #F59E0B',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '14px', color: '#92400E' }}>
              Assignment marked as stuck. Undo in {undoTimeLeft}s
            </span>
            <button
              onClick={undoStuck}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: '#F59E0B',
                color: 'white',
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Undo size={12} />
              Undo
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={handleBlockComplete}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '12px',
              backgroundColor: colors.complete,
              color: 'white',
              border: 'none',
              fontSize: '18px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'transform 0.1s',
              boxShadow: `0 4px 12px ${colors.complete}40`
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            data-testid="button-done"
          >
            ✓ Done
          </button>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={handleNeedMoreTime}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: 'transparent',
                border: `2px solid ${colors.progress}`,
                color: colors.progress,
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              data-testid="button-need-more-time"
            >
              Need More Time
            </button>
            
            <button
              onClick={handleStuck}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: 'transparent',
                border: `2px solid ${colors.support}`,
                color: colors.support,
                fontSize: '16px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              data-testid="button-stuck"
            >
              Stuck
            </button>
          </div>
        </div>

        {/* Emergency Exit */}
        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button
            onClick={() => {
              if (exitClickCount === 0) {
                setExitClickCount(1);
                setTimeout(() => setExitClickCount(0), 2000);
              } else {
                onModeToggle?.();
              }
            }}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              border: 'none',
              color: exitClickCount > 0 ? colors.support : '#D1D5DB',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'color 0.2s'
            }}
          >
            {exitClickCount > 0 ? '⚠️ Click Again to Exit' : 'Emergency Exit'}
          </button>
        </div>
      </div>

      {/* Done Dialog */}
      {showDoneDialog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
              Assignment Complete!
            </h3>
            <p style={{ marginBottom: '20px', color: colors.textMuted }}>
              Did you finish early and want to bank some time?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => {
                  const totalMinutes = currentBlock.estimatedMinutes || 20;
                  const timeSpentMinutes = Math.max(1, totalMinutes - Math.floor((timeRemaining || 0) / 60));
                  const bankMinutes = Math.max(0, totalMinutes - timeSpentMinutes);
                  completeBlock(timeSpentMinutes, bankMinutes > 0, bankMinutes);
                }}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: colors.complete,
                  color: 'white',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                ✅ Yes, finished early! (Bank time)
              </button>
              <button
                onClick={() => completeBlock()}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  border: `1px solid ${colors.textMuted}`,
                  color: colors.textMuted,
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                ✅ Used full time
              </button>
              <button
                onClick={() => setShowDoneDialog(false)}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: colors.textMuted,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Need More Time Dialog */}
      {showNeedTimeDialog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
              Need More Time?
            </h3>
            <p style={{ marginBottom: '20px', color: colors.textMuted }}>
              Why do you need more time for this assignment?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => rescheduleAssignment('More complex than expected', 60)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: colors.progress,
                  color: 'white',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                📚 More complex than expected (need 1hr)
              </button>
              <button
                onClick={() => rescheduleAssignment('Need to research/review', 45)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: colors.progress,
                  color: 'white',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                🔍 Need to research/review (need 45min)
              </button>
              <button
                onClick={() => rescheduleAssignment('Technical issues', 30)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: colors.progress,
                  color: 'white',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                💻 Technical issues (need 30min)
              </button>
              <button
                onClick={() => setShowNeedTimeDialog(false)}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: colors.textMuted,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stuck Dialog */}
      {showStuckDialog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '16px' }}>
              What's the Problem?
            </h3>
            <p style={{ marginBottom: '20px', color: colors.textMuted }}>
              Let us know what you're stuck on so we can help better:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button
                onClick={() => markAsStuck('Instructions unclear', true)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: colors.support,
                  color: 'white',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                ❓ Instructions unclear (need help)
              </button>
              <button
                onClick={() => markAsStuck('Missing information/resources', true)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: colors.support,
                  color: 'white',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                📋 Missing information/resources (need help)
              </button>
              <button
                onClick={() => markAsStuck('Too difficult right now', false)}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  backgroundColor: colors.support,
                  color: 'white',
                  border: 'none',
                  fontSize: '16px',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                😵 Too difficult right now (skip for now)
              </button>
              <button
                onClick={() => setShowStuckDialog(false)}
                style={{
                  padding: '8px',
                  borderRadius: '8px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: colors.textMuted,
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}