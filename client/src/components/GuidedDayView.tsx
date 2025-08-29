import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, CheckCircle, Clock, HelpCircle, Volume2, VolumeX, AlertCircle, ChevronRight } from 'lucide-react';
import type { Assignment } from '@shared/schema';

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
  selectedDate = new Date().toISOString().split('T')[0],
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

  const handleBlockComplete = () => {
    if (!currentBlock) return;
    
    setCompletedBlocks(prev => new Set([...Array.from(prev), currentBlock.id]));
    setIsTimerRunning(false);
    
    // Call assignment update if this was an assignment
    if (currentBlock.type === 'assignment' && onAssignmentUpdate) {
      onAssignmentUpdate();
    }
    
    // Move to next block
    if (currentIndex < scheduleBlocks.length - 1) {
      setCurrentIndex(prev => prev + 1);
      // Timer will be reset by useEffect when currentIndex changes
      setIsTimerRunning(true);
    } else {
      // Day complete
      onModeToggle?.();
    }
  };

  const handleNeedMoreTime = () => {
    if (currentIndex < scheduleBlocks.length - 1) {
      setCurrentIndex(prev => prev + 1);
      // Timer will be reset by useEffect when currentIndex changes
      setIsTimerRunning(true);
    }
  };

  const handleStuck = () => {
    if (currentIndex < scheduleBlocks.length - 1) {
      setCurrentIndex(prev => prev + 1);
      // Timer will be reset by useEffect when currentIndex changes
      setIsTimerRunning(true);
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
              Due: {new Date(currentBlock.assignment.dueDate).toLocaleDateString()}
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
    </div>
  );
}