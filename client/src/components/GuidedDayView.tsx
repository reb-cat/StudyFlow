import { useState, useEffect, useMemo } from 'react';
import { normalizeAssignment } from '@shared/normalize';
import { Play, Pause, RotateCcw, CheckCircle, Clock, HelpCircle, Volume2, VolumeX, AlertCircle, ChevronRight, Undo } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Assignment } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { getTodayString, formatDateShort } from '@shared/dateUtils';

// Timezone-safe New York date string function
const toNYDateString = (d = new Date()) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(d);
  const y = p.find(x=>x.type==='year')!.value, m=p.find(x=>x.type==='month')!.value, da=p.find(x=>x.type==='day')!.value;
  return `${y}-${m}-${da}`;
};

// Text-to-Speech hook for Khalil's guided day
const useTextToSpeech = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  const speak = async (text: string) => {
    try {
      // Stop any current audio
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      setIsPlaying(true);

      const response = await fetch('/api/tts/speak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, voice: 'Victor' }),
      });

      if (!response.ok) {
        throw new Error('TTS service unavailable');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      setCurrentAudio(audio);

      audio.onended = () => {
        setIsPlaying(false);
        setCurrentAudio(null);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsPlaying(false);
        setCurrentAudio(null);
        URL.revokeObjectURL(audioUrl);
        toast({
          title: "Audio Error",
          description: "Failed to play audio",
          variant: "destructive"
        });
      };

      await audio.play();
    } catch (error) {
      console.error('TTS error:', error);
      setIsPlaying(false);
      setCurrentAudio(null);
      toast({
        title: "Voice Assistant Error",
        description: `TTS error: ${(error as Error)?.message || 'Unknown error'}`,
        variant: "destructive"
      });
    }
  };

  const stop = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
    }
    setIsPlaying(false);
  };

  return { speak, stop, isPlaying };
};

// Minimal shape Guided can consume when parent pre-composes the day
type GuidedBlock = {
  id: string;
  type: 'assignment' | 'bible' | 'fixed';
  title: string;
  startTime: string; // 'HH:MM'
  endTime: string;   // 'HH:MM'
  estimatedMinutes?: number;
  assignmentId?: string | null;
};

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
  /** NEW: when provided, Guided will use this EXACT sequence (matches Overview) */
  composedSchedule?: GuidedBlock[];
  onAssignmentUpdate?: () => void;
  onModeToggle?: () => void;
}

export function GuidedDayView({ 
  assignments = [], 
  studentName = "Student", 
  selectedDate = getTodayString(),
  scheduleTemplate = [],
  composedSchedule = [],
  onAssignmentUpdate,
  onModeToggle 
}: GuidedDayViewProps) {
  
  // Text-to-Speech for Khalil's guided day
  const { speak, stop, isPlaying } = useTextToSpeech();
  
  // Build actual schedule from schedule template (fallback) OR use parent-composed
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

  const scheduleBlocks: any[] =
    (composedSchedule && composedSchedule.length > 0)
      ? composedSchedule
      : buildScheduleBlocks();

  // DEBUG LOGGING: Client Guided composition
  const DEBUG_ORDERING = process.env.NODE_ENV === 'development' && false; // Enable when needed
  if (DEBUG_ORDERING && studentName === 'Abigail') {
    const source = composedSchedule ? 'CLIENT_GUIDED (composed)' : 'CLIENT_GUIDED (local)';
    console.log(`\n🧭 ORDER TRACE / ${source.toUpperCase()}`);
    scheduleBlocks.forEach((block, i) => {
      const startMinute = block.startTime ? parseInt(block.startTime.split(':')[0]) * 60 + parseInt(block.startTime.split(':')[1]) : 999;
      console.log(`  [${i}] ${block.id} | ${startMinute}min (${block.startTime}) | ${block.type} | ${block.title}`);
    });
    
    // Verify strict ascending order
    for (let i = 1; i < scheduleBlocks.length; i++) {
      const prev = scheduleBlocks[i - 1];
      const curr = scheduleBlocks[i];
      const prevMinute = prev.startTime ? parseInt(prev.startTime.split(':')[0]) * 60 + parseInt(prev.startTime.split(':')[1]) : 999;
      const currMinute = curr.startTime ? parseInt(curr.startTime.split(':')[0]) * 60 + parseInt(curr.startTime.split(':')[1]) : 999;
      
      if (prevMinute > currMinute) {
        console.error(`❌ ORDER VIOLATION in ${source}: [${i-1}] ${prevMinute}min > [${i}] ${currMinute}min`);
      }
    }
  }

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true); // Auto-start timer
  const [completedBlocks, setCompletedBlocks] = useState(new Set<string>());
  const [timeRemaining, setTimeRemaining] = useState<number | null>(20 * 60);
  const [exitClickCount, setExitClickCount] = useState(0);
  const [showDoneDialog, setShowDoneDialog] = useState(false);
  const [showNeedTimeDialog, setShowNeedTimeDialog] = useState(false);
  const [showStuckDialog, setShowStuckDialog] = useState(false);
  const [stuckCountdown, setStuckCountdown] = useState(0);
  const [stuckPendingKey, setStuckPendingKey] = useState<string | null>(null);
  const [isProcessingStuck, setIsProcessingStuck] = useState(false);
  const [bibleData, setBibleData] = useState<any>(null);
  const { toast } = useToast();

  const currentBlock = scheduleBlocks[currentIndex];
  const normalized = useMemo(() => {
    if (currentBlock?.type === 'assignment' && currentBlock.assignment) {
      return normalizeAssignment({
        id: currentBlock.assignment.id,
        title: currentBlock.assignment.title,
        course: currentBlock.assignment.courseName,
        instructions: currentBlock.assignment.instructions,
        dueAt: currentBlock.assignment.dueDate
      });
    }
    return null;
  }, [currentBlock]);
  
  // Reset timer when block changes
  useEffect(() => {
    if (currentBlock) {
      setTimeRemaining((currentBlock.estimatedMinutes || 20) * 60);
      setIsTimerRunning(true); // Auto-start for new block
    }
  }, [currentIndex]);

  // Fetch Bible curriculum data for Bible blocks
  useEffect(() => {
    if (currentBlock?.type === 'bible') {
      const fetchBibleData = async () => {
        try {
          const response = await fetch(`/api/bible-curriculum/current?studentName=${studentName}&date=${selectedDate}`);
          if (response.ok) {
            const data = await response.json();
            setBibleData(data.curriculum);
          }
        } catch (error) {
          console.error('Failed to fetch Bible data:', error);
        }
      };
      fetchBibleData();
    }
  }, [currentBlock?.type, studentName, selectedDate]);
  const totalBlocks = scheduleBlocks.length;
  const completedCount = completedBlocks.size;
  const progressPercentage = Math.round((completedCount / totalBlocks) * 100);

  // Block type styling with StudyFlow colors
  const getBlockStyle = (blockType?: string) => {
    const styles = {
      assignment: { borderColor: colors.progress, bgColor: 'var(--card)', icon: Clock },
      bible: { borderColor: colors.primary, bgColor: 'var(--card)', icon: CheckCircle },
      fixed: { borderColor: colors.support, bgColor: 'var(--card)', icon: HelpCircle },
      lunch: { borderColor: colors.support, bgColor: 'var(--card)', icon: HelpCircle },
      movement: { borderColor: colors.complete, bgColor: 'var(--card)', icon: CheckCircle },
      'study hall': { borderColor: colors.progress, bgColor: 'var(--card)', icon: Clock }, // Similar to assignment but lighter
      'Study Hall': { borderColor: colors.progress, bgColor: 'var(--card)', icon: Clock }  // Case variation support
    };
    return styles[blockType as keyof typeof styles] || styles.assignment;
  };

  // Stuck countdown effect
  useEffect(() => {
    if (stuckCountdown > 0) {
      const timer = setTimeout(() => {
        setStuckCountdown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (stuckCountdown === 0 && stuckPendingKey) {
      // Countdown completed - assignment should now be marked as stuck on server
      setStuckPendingKey(null);
      setIsProcessingStuck(false);
      
      // Trigger refetch after server processing completes
      if (onAssignmentUpdate) {
        onAssignmentUpdate();
      }
    }
  }, [stuckCountdown, stuckPendingKey, onAssignmentUpdate]);

  const handleBlockComplete = async () => {
    if (!currentBlock) return;
    
    if (currentBlock.type === 'assignment' && currentBlock.assignment) {
      // Show Done dialog for assignments
      setShowDoneDialog(true);
    } else if (currentBlock.type === 'bible' && bibleData?.dailyReading) {
      // Complete Bible reading directly with proper parameters
      await apiRequest('POST', '/api/bible-curriculum/complete', {
        weekNumber: bibleData.dailyReading.weekNumber,
        dayOfWeek: bibleData.dailyReading.dayOfWeek,
        readingType: 'daily_reading',
        studentName: studentName
      });
      
      toast({
        title: "Bible Reading Completed!",
        description: "Your Bible reading has been completed and progress advanced.",
        variant: "default"
      });
      
      // Advance to the next block
      if (currentIndex < scheduleBlocks.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsTimerRunning(true);
      } else {
        // Day complete
        onModeToggle?.();
      }
    } else {
      // Complete other blocks immediately
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
        const response = await apiRequest('PATCH', `/api/assignments/${currentBlock.assignment.id}`, {
          completionStatus: 'completed',
          timeSpent: timeSpent || 0,
          earlyFinish: earlyFinish || false,
          bankMinutes: bankMinutes || 0
        }) as any;
        
        toast({
          title: "Assignment Completed!",
          description: "Assignment marked as complete",
          variant: "default"
        });
        
        // Refetch assignments and re-derive blocks
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
        return; // Don't advance if API call failed
      }
    } else if (currentBlock.type === 'bible' && bibleData?.dailyReading) {
      // Complete Bible reading and advance student position
      try {
        await apiRequest('POST', '/api/bible-curriculum/complete', {
          weekNumber: bibleData.dailyReading.weekNumber,
          dayOfWeek: bibleData.dailyReading.dayOfWeek,
          readingType: 'daily_reading',
          studentName: studentName
        });
        
        toast({
          title: "Bible Reading Completed!",
          description: `"${bibleData.dailyReading.readingTitle || 'Bible Reading'}" has been completed.`,
          variant: "default"
        });
      } catch (error) {
        console.error('Failed to complete Bible reading:', error);
        toast({
          title: "Error",
          description: "Failed to mark Bible reading as complete",
          variant: "destructive"
        });
        return; // Don't advance if API call failed
      }
    }
    
    // Move to next block (fallback - primary flow should refetch and re-derive)
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
      const response = await apiRequest('POST', `/api/guided/${studentName}/${selectedDate}/need-more-time`, {
        assignmentId: currentBlock.assignment.id
      }) as any;
      
      toast({
        title: "Assignment Rescheduled",
        description: response.message,
        variant: "default"
      });
      
      // Primary flow: refetch assignments and re-derive blocks
      if (onAssignmentUpdate) {
        onAssignmentUpdate();
      }
      
      // Fallback: Move to next block if refetch doesn't update currentIndex
      setTimeout(() => {
        if (currentIndex < scheduleBlocks.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setIsTimerRunning(true);
        }
      }, 100);
      
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
    
    setIsProcessingStuck(true);
    
    try {
      const response = await apiRequest('POST', `/api/guided/${studentName}/${selectedDate}/stuck`, {
        assignmentId: currentBlock.assignment.id,
        reason: reason,
        needsHelp: needsHelp
      }) as any;
      
      // Start 15-second countdown
      setStuckCountdown(15);
      setStuckPendingKey(response.pendingKey);
      
      toast({
        title: "Assignment Will Be Marked as Stuck",
        description: "15-second undo window started. Assignment will be marked as stuck unless cancelled.",
        variant: "default"
      });
      
      // Move to next block immediately (fallback)
      if (currentIndex < scheduleBlocks.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setIsTimerRunning(true);
      }
      
    } catch (error) {
      console.error('Failed to start stuck process:', error);
      toast({
        title: "Error",
        description: "Failed to mark assignment as stuck",
        variant: "destructive"
      });
      setIsProcessingStuck(false);
    }
    
    setShowStuckDialog(false);
  };

  const cancelStuck = async () => {
    if (!stuckPendingKey) return;
    
    try {
      await apiRequest('POST', `/api/guided/${studentName}/${selectedDate}/stuck/cancel`, {
        pendingKey: stuckPendingKey
      });
      
      setStuckCountdown(0);
      setStuckPendingKey(null);
      setIsProcessingStuck(false);
      
      toast({
        title: "Stuck Marking Cancelled",
        description: "Assignment will not be marked as stuck",
        variant: "default"
      });
      
    } catch (error) {
      console.error('Failed to cancel stuck marking:', error);
      toast({
        title: "Error",
        description: "Failed to cancel stuck marking",
        variant: "destructive"
      });
    }
  };

  // Completion screen
  if (!currentBlock || currentIndex >= scheduleBlocks.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-5">
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
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <div className="max-w-lg w-full bg-card rounded-3xl p-8 shadow-xl">
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
          <div className="bg-gray-200 dark:bg-slate-700" style={{
            height: '8px',
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

        {/* Title card + Instructions pill */}
        <div className="mb-4 rounded-2xl bg-blue-50/60 dark:bg-slate-800/80 border border-blue-200 dark:border-slate-600 px-5 py-4" style={{ marginBottom: '16px' }}>
          <div className="mb-2 flex items-start justify-between gap-3">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
              <h2 className="text-[20px] font-bold text-slate-800 dark:text-slate-100" style={{ 
                fontSize: '20px', 
                fontWeight: 'bold', 
                color: 'inherit',
                flex: 1
              }}>
                {currentBlock.type === 'bible'
                  ? (bibleData?.dailyReading?.readingTitle
                      ? `Bible — ${bibleData.dailyReading.readingTitle}`
                      : 'Bible')
                  : (normalized?.displayTitle || currentBlock.title)}
              </h2>
              
              {/* Speaker button for assignment title - only for Khalil */}
              {studentName.toLowerCase() === 'khalil' && (
                <button
                  onClick={() => {
                    if (isPlaying) {
                      stop();
                    } else {
                      const titleText = currentBlock.type === 'bible'
                        ? (bibleData?.dailyReading?.readingTitle
                            ? `Bible reading: ${bibleData.dailyReading.readingTitle}`
                            : 'Bible reading time')
                        : `Assignment: ${normalized?.displayTitle || currentBlock.title}`;
                      speak(titleText);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: isPlaying ? '#EF4444' : colors.primary,
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    flexShrink: 0
                  }}
                  title={isPlaying ? "Stop reading" : "Read title aloud"}
                  data-testid="button-speak-title"
                >
                  {isPlaying ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
              )}
            </div>
            {currentBlock.type === 'assignment' && (normalized?.courseLabel || currentBlock.assignment?.courseName || currentBlock.assignment?.subject) && (
              <span className="shrink-0 rounded-full border border-border bg-card/90 px-3 py-1 text-xs font-medium text-muted-foreground">
                {normalized?.courseLabel ?? currentBlock.assignment?.courseName ?? currentBlock.assignment?.subject}
              </span>
            )}
          </div>
          {currentBlock.type === 'assignment' && (normalized?.effectiveDueAt || currentBlock.assignment?.dueDate) && (
            <div style={{ 
              fontSize: '14px', 
              color: colors.textMuted, 
              marginBottom: '12px'
            }}>
              Due: {new Date(normalized?.effectiveDueAt ?? currentBlock.assignment!.dueDate!).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Instructions Panel - CRITICAL FOR STUDENTS */}
        {currentBlock.type === 'assignment' && currentBlock.assignment?.instructions && (
          <div className="mb-6 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <div 
                className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center"
                style={{ flexShrink: 0 }}
              >
                <span className="text-white text-xs font-bold">i</span>
              </div>
              <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200 uppercase tracking-wide">
                Instructions
              </h3>
              {/* Speaker button for instructions - only for Khalil */}
              {studentName.toLowerCase() === 'khalil' && (
                <button
                  onClick={() => {
                    if (isPlaying) {
                      stop();
                    } else {
                      speak(`Assignment instructions: ${currentBlock.assignment.instructions}`);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: isPlaying ? '#EF4444' : '#F59E0B',
                    color: 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    marginLeft: 'auto'
                  }}
                  title={isPlaying ? "Stop reading" : "Read instructions aloud"}
                  data-testid="button-speak-instructions"
                >
                  {isPlaying ? <VolumeX size={12} /> : <Volume2 size={12} />}
                </button>
              )}
            </div>
            <div 
              className="text-sm leading-relaxed text-amber-900 dark:text-amber-100"
              style={{ 
                whiteSpace: 'pre-wrap',
                lineHeight: '1.5'
              }}
              data-testid="assignment-instructions"
            >
              {currentBlock.assignment.instructions}
            </div>
          </div>
        )}

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

        {/* Stuck Countdown Banner (if active) */}
        {stuckCountdown > 0 && stuckPendingKey && (
          <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600" style={{
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span className="text-yellow-800 dark:text-yellow-200" style={{ fontSize: '14px' }}>
              Assignment will be marked as stuck in {stuckCountdown}s
            </span>
            <button
              onClick={cancelStuck}
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
              Cancel
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
              color: exitClickCount > 0 ? colors.support : 'var(--muted-foreground)',
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