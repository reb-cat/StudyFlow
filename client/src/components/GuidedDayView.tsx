import { useState, useEffect, useMemo } from 'react';
import { normalizeAssignment } from '@shared/normalize';
import { Play, Pause, RotateCcw, CheckCircle, Clock, HelpCircle, Volume2, VolumeX, AlertCircle, ChevronRight, Undo, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Assignment, ChecklistItem } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { getTodayString, formatDateShort } from '@shared/dateUtils';
import { ConfettiBurst } from './ConfettiBurst';
import { CircularTimer } from '@/components/CircularTimer';

// Timezone-safe New York date string function
const toNYDateString = (d = new Date()) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(d);
  const y = p.find(x=>x.type==='year')!.value, m=p.find(x=>x.type==='month')!.value, da=p.find(x=>x.type==='day')!.value;
  return `${y}-${m}-${da}`;
};

// Strip HTML tags from text
const stripHtml = (html: string): string => {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
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

// Gaming color system
const colors = {
  primary: 'hsl(var(--violet))',
  complete: 'hsl(var(--emerald))',
  progress: 'hsl(var(--status-progress))',
  support: 'hsl(var(--gold))',
  background: 'var(--background)',
  surface: 'var(--card)',
  text: 'var(--foreground)',
  textMuted: 'var(--muted-foreground)'
};

// SINGLE DURATION CALCULATION FUNCTION - THE SOURCE OF TRUTH
const calculateBlockDuration = (startTime: string, endTime: string): number => {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return Math.max(1, endMinutes - startMinutes);
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
  /** Schedule block completion status for synchronization with Overview mode */
  dailyScheduleStatus?: Array<any>;
}

export function GuidedDayView({ 
  assignments = [], 
  studentName = "Student", 
  selectedDate = getTodayString(),
  scheduleTemplate = [],
  composedSchedule = [],
  onAssignmentUpdate,
  onModeToggle,
  dailyScheduleStatus = []
}: GuidedDayViewProps) {
  
  // Text-to-Speech for Khalil's guided day
  const { speak, stop, isPlaying } = useTextToSpeech();
  
  // Get user's custom checklist items
  const { data: customChecklistItems = [] } = useQuery<ChecklistItem[]>({
    queryKey: [`/api/checklist/${studentName}`],
    enabled: !!studentName,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
  
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
        // Convert student name to user ID (Abigail -> abigail-user, Khalil -> khalil-user)
        const userId = `${studentName.toLowerCase()}-user`;
        
        matchedAssignment = assignments.find(assignment => 
          assignment.userId === userId &&
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
    // Sort by start time chronologically
    .sort((a, b) => {
      const [hoursA, minutesA] = a.startTime.split(':').map(Number);
      const [hoursB, minutesB] = b.startTime.split(':').map(Number);
      const timeA = hoursA * 60 + minutesA;
      const timeB = hoursB * 60 + minutesB;
      return timeA - timeB;
    });
  };

  const scheduleBlocks: any[] = useMemo(() => {
    const hasComposed = composedSchedule && composedSchedule.length > 0;
    return hasComposed
      ? composedSchedule
      : buildScheduleBlocks();
  }, [composedSchedule, scheduleTemplate, assignments, selectedDate, studentName]);

  // Generate prep checklist based on co-op classes scheduled TODAY only
  const generatePrepChecklist = (customItems: ChecklistItem[] = []) => {
    const subjects = new Set<string>();
    const dueAssignments: Assignment[] = [];
    
    // Get co-op subjects scheduled for THIS specific day
    const todaysCoopSubjects = new Set<string>();
    scheduleTemplate.forEach(block => {
      if (block.blockType === 'Co-op' || block.blockType === 'co-op') {
        const subject = block.subject?.toLowerCase();
        if (subject && !subject.includes('study hall')) {
          todaysCoopSubjects.add(subject);
        }
      }
    });
    
    // DEBUG: Disabled for performance
    
    // Helper function to check if assignment subject matches today's co-op classes
    const matchesTodaysCoopClass = (assignmentSubject: string) => {
      if (!assignmentSubject) return false;
      
      const subjectLower = assignmentSubject.toLowerCase();
      for (const coopSubject of Array.from(todaysCoopSubjects)) {
        const coopLower = coopSubject.toLowerCase();
        
        // Direct contains matching (most important)
        if (subjectLower.includes(coopLower) || coopLower.includes(subjectLower)) return true;
        
        // Flexible subject-specific matching
        if (subjectLower.includes('health') && coopLower.includes('health')) return true;
        if ((subjectLower.includes('art') || subjectLower.includes('bible')) && coopLower.includes('art')) return true;
        
        // Enhanced English/Literature matching
        if ((subjectLower.includes('english') || subjectLower.includes('literature') || 
             subjectLower.includes('writing') || subjectLower.includes('american lit') ||
             subjectLower.includes('lit/comp') || subjectLower.includes('composition')) && 
            (coopLower.includes('english') || coopLower.includes('literature') || coopLower.includes('american'))) return true;
            
        // Enhanced Math matching  
        if ((subjectLower.includes('math') || subjectLower.includes('geometry') || 
             subjectLower.includes('algebra')) && 
            (coopLower.includes('math') || coopLower.includes('geometry'))) return true;
            
        if ((subjectLower.includes('history') || subjectLower.includes('social studies')) && 
            coopLower.includes('history')) return true;
        
        // Photography matching
        if (subjectLower.includes('photo') && coopLower.includes('photo')) return true;
        
        // Forensics/Science matching  
        if ((subjectLower.includes('forensic') || subjectLower.includes('science')) && 
            (coopLower.includes('forensic') || coopLower.includes('science'))) return true;
      }
      return false;
    };

    // Add Canvas assignments due TODAY for classes happening TODAY
    const selectedDateObj = new Date(selectedDate + 'T12:00:00');
    const todayAssignments = assignments.filter(a => {
      if (!a.dueDate || a.completionStatus !== 'pending') return false;
      
      // Handle ISO date strings from database (already proper Date objects)
      const dueDate = new Date(a.dueDate);
      const isSameDate = dueDate.toDateString() === selectedDateObj.toDateString();
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`📅 Assignment "${a.title}": due=${a.dueDate}, parsed=${dueDate.toDateString()}, selected=${selectedDateObj.toDateString()}, match=${isSameDate}`);
      }
      
      return isSameDate;
    });

    // DEBUG: Enhanced logging to see what's happening
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 ASSIGNMENT DEBUG:', {
        totalAssignments: assignments.length,
        pendingAssignments: assignments.filter(a => a.completionStatus === 'pending').length,
        todayAssignments: todayAssignments.length,
        selectedDate,
        sampleAssignments: assignments.slice(0, 3).map(a => ({ title: a.title, dueDate: a.dueDate, status: a.completionStatus }))
      });
    }

    todayAssignments.forEach(assignment => {
      const subject = assignment.courseName || assignment.subject;
      const matches = subject ? matchesTodaysCoopClass(subject) : false;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔍 Assignment "${assignment.title}": subject="${subject}", matches=${matches}`);
        console.log(`📚 Today's co-op subjects:`, Array.from(todaysCoopSubjects));
      }
      
      if (subject && matches) {
        subjects.add(subject);
        dueAssignments.push(assignment);
      }
    });

    // DEBUG: Disabled for performance

    // If no assignments due today for co-op classes, still show basic co-op prep items

    const checklist: { item: string; category: 'books' | 'materials' | 'homework' | 'general' }[] = [];
    const processedSubjects = new Set<string>(); // Track processed subjects to prevent duplicates

    // Process each co-op subject scheduled today exactly once
    todaysCoopSubjects.forEach(subject => {
      // Clean subject name for matching (remove ALL extraneous details)
      const cleanSubject = subject
        .replace(/\d{2}\/\d{2}\s+/g, '') // Remove dates like "25/26 "
        .replace(/T\d+\s+/g, '') // Remove codes like "T2 "
        .replace(/M\d+\s+/g, '') // Remove codes like "M5 "
        .replace(/\d+(th|st|nd|rd)\s*-?\s*\d*(th|st|nd|rd)?\s*(Gr|Grade)\s*/gi, '') // Remove grade ranges
        .replace(/HS\s+/gi, '') // Remove "HS "
        .replace(/\s*-\s*[a-z]\s+[a-z-]+$/gi, '') // Remove teacher names like "- B Scolaro", "- J Welch", "- L Cejas-brown"
        .replace(/\(\d+x\s+Week\)\s*/gi, '') // Remove "(2x Week)" patterns
        .replace(/\s+&\s+the\s+bible/gi, '') // Simplify "Art & the Bible" to just "Art"
        .replace(/fundamentals/gi, '') // Remove "Fundamentals" 
        .trim().toLowerCase();

      // Skip if we've already processed this subject (prevent duplicates)
      if (processedSubjects.has(cleanSubject)) {
        return;
      }
      processedSubjects.add(cleanSubject);

      // Find custom items for this subject
      const subjectItems = customItems.filter(item => 
        item.subject.toLowerCase() === cleanSubject ||
        cleanSubject.includes(item.subject.toLowerCase()) ||
        item.subject.toLowerCase().includes(cleanSubject)
      );

      if (subjectItems.length > 0) {
        // Add ONLY custom items (no fallback binder)
        subjectItems.forEach(item => {
          checklist.push({
            item: item.itemName,
            category: item.category as 'books' | 'materials' | 'general'
          });
        });
      } else if (cleanSubject) {
        // Add ONLY one binder/folder item (no hardcoded subject-specific items)
        const displaySubject = subject
          .replace(/\d{2}\/\d{2}\s+/g, '')
          .replace(/T\d+\s+/g, '')
          .replace(/M\d+\s+/g, '')
          .replace(/\d+(th|st|nd|rd)\s*-?\s*\d*(th|st|nd|rd)?\s*(Gr|Grade)\s*/gi, '')
          .replace(/HS\s+/gi, '')
          .replace(/\s*-\s*[a-z]\s+[a-z-]+$/gi, '') // Updated to match teacher names with hyphens
          .replace(/\(\d+x\s+Week\)\s*/gi, '') // Remove "(2x Week)" patterns
          .replace(/\s+&\s+the\s+bible/gi, '')
          .replace(/fundamentals/gi, '')
          .trim()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
          
        checklist.push({ item: `${displaySubject} binder/folder`, category: 'materials' });
      }
    });

    // Homework items for co-op assignments due today
    dueAssignments.forEach(assignment => {
      if (assignment.completionStatus === 'pending') {
        // Clean assignment title (remove term/grade info)
        const cleanTitle = assignment.title
          .replace(/\d{2}\/\d{2}\s+/g, '') // Remove dates like "25/26 "
          .replace(/T\d+\s+/g, '') // Remove codes like "T2 "
          .replace(/M\d+\s+/g, '') // Remove codes like "M5 "
          .replace(/\d+(th|st|nd|rd)\s*-?\s*\d*(th|st|nd|rd)?\s*(Gr|Grade)\s*/gi, '') // Remove grade ranges
          .replace(/HS\s+/g, '') // Remove "HS "
          .trim();
        
        checklist.push({ 
          item: `Completed: ${cleanTitle}`, 
          category: 'homework' 
        });
      }
    });

    // Always show basic co-op prep items during Prep/Load blocks on co-op days
    checklist.push(
      { item: 'Lunch and water bottle', category: 'general' },
      { item: 'Writing utensils (pens, pencils, highlighters)', category: 'general' }
    );

    // Remove duplicates
    return checklist.filter((item, index, arr) => 
      arr.findIndex(i => i.item === item.item) === index
    );
  };

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

  const [currentIndex, setCurrentIndex] = useState<number | null>(null); // Start with null - don't show anything until sync
  const [isTimerRunning, setIsTimerRunning] = useState(true); // Auto-start timer
  
  // FIXED: Only sync with overview completion status ONCE at startup, not continuously
  // This prevents auto-sync from interfering with manual progression (Bible reversion bug)
  const [hasInitializedIndex, setHasInitializedIndex] = useState(false);
  useEffect(() => {
    if (scheduleBlocks.length > 0 && dailyScheduleStatus.length > 0 && !hasInitializedIndex) {
      // Find the first block that is NOT completed/done
      const firstIncompleteIndex = scheduleBlocks.findIndex(block => {
        const blockStatus = dailyScheduleStatus.find(status => 
          status.templateBlockId === (block.templateBlockId || block.id)
        );
        // Block is incomplete if no status or status is not 'complete'/'done'/'overtime' 
        // 'overtime' blocks are considered complete for positioning purposes
        const isComplete = blockStatus && ['complete', 'done', 'overtime'].includes(blockStatus.status);
        
        console.log(`🔍 Block ${block.blockNumber} (${block.id}): status=${blockStatus?.status || 'none'}, isComplete=${isComplete}`);
        
        return !isComplete;
      });
      
      // Go to first incomplete block on initial load only
      const targetIndex = firstIncompleteIndex >= 0 ? firstIncompleteIndex : 0;
      
      console.log(`🎯 Guided INITIAL sync: Moving to block ${targetIndex} (first incomplete based on overview status)`);
      setCurrentIndex(targetIndex);
      setHasInitializedIndex(true); // Prevent future auto-syncs
    }
  }, [scheduleBlocks, dailyScheduleStatus, hasInitializedIndex]);
  const [completedBlocks, setCompletedBlocks] = useState(new Set<string>());
  const [exitClickCount, setExitClickCount] = useState(0);
  const [showDoneDialog, setShowDoneDialog] = useState(false);
  const [showStuckDialog, setShowStuckDialog] = useState(false);
  const [stuckCountdown, setStuckCountdown] = useState(0);
  const [stuckPendingKey, setStuckPendingKey] = useState<string | null>(null);
  const [actualTimeRemaining, setActualTimeRemaining] = useState<number | null>(null);
  const [isProcessingStuck, setIsProcessingStuck] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [bibleData, setBibleData] = useState<any>(null);
  const [checkedItems, setCheckedItems] = useState(new Set<string>());
  const [showInstructions, setShowInstructions] = useState(false);
  const { toast } = useToast();

  const currentBlock = currentIndex !== null ? scheduleBlocks[currentIndex] : null;
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`🎯 CURRENT BLOCK DEBUG: currentIndex=${currentIndex}, scheduleBlocks.length=${scheduleBlocks.length}, currentBlock exists=${!!currentBlock}`);
    if (currentBlock) {
      console.log(`🎯 CURRENT BLOCK: id="${currentBlock.id}", title="${currentBlock.title}", startTime="${currentBlock.startTime}", endTime="${currentBlock.endTime}"`);
    }
  }
  

  // Get day name from selectedDate for co-op day check (timezone-safe)
  const dayName = new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' });
  
  // Check if current block is Prep/Load time AND it's Monday or Thursday (co-op days only)
  const isPrepLoadBlock = currentBlock && (
    currentBlock.title?.toLowerCase().includes('prep') || 
    currentBlock.title?.toLowerCase().includes('load') ||
    currentBlock.blockType?.toLowerCase().includes('prep') ||
    currentBlock.blockType?.toLowerCase().includes('load') ||
    currentBlock.subject?.toLowerCase().includes('prep') ||
    currentBlock.subject?.toLowerCase().includes('load') ||
    currentBlock.type?.toLowerCase().includes('prep') ||
    currentBlock.type?.toLowerCase().includes('load')
  ) && (
    dayName === 'Monday' || dayName === 'Thursday'
  );
  
  const prepChecklist = generatePrepChecklist(customChecklistItems);
  
  // DEBUG: Log checklist detection
  if (process.env.NODE_ENV === 'development' && currentBlock && false) { // Disabled for performance
    console.log('🔍 Prep/Load Detection:', {
      blockTitle: currentBlock.title,
      blockType: currentBlock.blockType,
      subject: currentBlock.subject,
      dayName,
      selectedDate,
      isPrepLoadBlock,
      checklistLength: prepChecklist.length,
      conditions: {
        hasCurrentBlock: !!currentBlock,
        isCoopDay: dayName === 'Monday' || dayName === 'Thursday',
        titleHasPrep: currentBlock.title?.toLowerCase().includes('prep'),
        blockTypeHasPrep: currentBlock.blockType?.toLowerCase().includes('prep'),
        subjectHasPrep: currentBlock.subject?.toLowerCase().includes('prep'),
        typeHasPrep: currentBlock.type?.toLowerCase().includes('prep'),
        titleHasLoad: currentBlock.title?.toLowerCase().includes('load'),
        blockTypeHasLoad: currentBlock.blockType?.toLowerCase().includes('load'),
        subjectHasLoad: currentBlock.subject?.toLowerCase().includes('load'),
        typeHasLoad: currentBlock.type?.toLowerCase().includes('load')
      },
      renderCondition: isPrepLoadBlock && prepChecklist.length > 0
    });
  }
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
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 USEEFFECT TRIGGERED: currentIndex=${currentIndex}, currentBlock exists=${!!currentBlock}`);
      if (currentBlock) {
        console.log(`🔄 CURRENT BLOCK: "${currentBlock.title}" (${currentBlock.startTime}-${currentBlock.endTime})`);
      }
    }
    
    if (currentBlock) {
      // CRITICAL FIX: Use actual time block duration with safety net
      const getBlockDurationMinutes = (block: any): number => {
        const { startTime, endTime, blockType, title, estimatedMinutes, type } = block;
        
        // SAFETY NET: Force correct durations for specific block types regardless of API data
        if (blockType === 'Movement' || title?.toLowerCase().includes('movement')) {
          console.log(`🚨 SAFETY NET: Movement block forced to 10 minutes (API sent: ${startTime}-${endTime})`);
          return 10;
        }
        if (blockType === 'Travel' || title?.toLowerCase().includes('travel')) {
          console.log(`🚨 SAFETY NET: Travel block forced to 10 minutes (API sent: ${startTime}-${endTime})`);
          return 10;
        }
        if (blockType === 'Lunch' || title?.toLowerCase().includes('lunch')) {
          console.log(`🚨 SAFETY NET: Lunch block forced to 30 minutes (API sent: ${startTime}-${endTime})`);
          return 30;
        }
        
        // CRITICAL FIX: For assignment blocks, prefer estimatedMinutes over time slot calculation
        if (type === 'assignment' && estimatedMinutes && estimatedMinutes > 0) {
          console.log(`🎯 ASSIGNMENT: Using estimatedMinutes (${estimatedMinutes}) instead of time slot (${startTime}-${endTime}) for "${title}"`);
          return estimatedMinutes;
        }
        
        // For other blocks, calculate from time slot
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        const calculatedDuration = Math.max(1, endMinutes - startMinutes);
        
        // DEBUG: Log when API times produce suspicious durations
        if (calculatedDuration > 60 || calculatedDuration < 5) {
          console.log(`🐛 SUSPICIOUS DURATION: ${title} calculated as ${calculatedDuration} minutes from ${startTime}-${endTime}`);
        }
        
        return calculatedDuration;
      };
      
      const blockDurationMinutes = getBlockDurationMinutes(currentBlock);
      setIsTimerRunning(true); // Auto-start for new block
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 BLOCK CHANGE: Timer set to ${blockDurationMinutes} minutes (${currentBlock.startTime}-${currentBlock.endTime}) for "${currentBlock.title}"`);
        console.log(`🔄 SETTING isTimerRunning to: true`);
        // Wait a moment then check the actual state
        setTimeout(() => {
          console.log(`🔄 VERIFICATION: isTimerRunning is now ${isTimerRunning}`);
        }, 100);
      }
    }
  }, [currentIndex, currentBlock?.id, currentBlock?.startTime, currentBlock?.endTime]);

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

  const handleBlockComplete = async (timeRemainingSeconds?: number) => {
    if (!currentBlock) return;
    
    // Store the actual time remaining when user clicked "Done" for accurate completion dialog
    setActualTimeRemaining(timeRemainingSeconds || 0);
    
    if (currentBlock.type === 'assignment' && currentBlock.assignment) {
      // Show Done dialog for assignments
      setShowDoneDialog(true);
    } else if (currentBlock.type === 'bible' && bibleData?.dailyReading) {
      try {
        // Complete Bible reading directly with proper parameters
        await apiRequest('POST', '/api/bible-curriculum/complete', {
          weekNumber: bibleData.dailyReading.weekNumber,
          dayOfWeek: bibleData.dailyReading.dayOfWeek,
          type: 'daily_reading',
          studentName: studentName
        });
        
        // CRITICAL FIX: Also mark the Bible block as complete in daily schedule status
        // This prevents the reversion bug by updating the status table that guided view checks
        await apiRequest('PATCH', `/api/schedule/${studentName}/${selectedDate}/block/${currentBlock.templateBlockId || currentBlock.id}/status`, {
          status: 'complete'
        });
        
        toast({
          title: "Bible Reading Completed!",
          description: "Your Bible reading has been completed and progress advanced.",
          variant: "default"
        });
        
        // Refresh data to ensure guided view sees the updated status
        if (onAssignmentUpdate) {
          onAssignmentUpdate();
        }
        
        // Advance to the next block
        if (currentIndex !== null && currentIndex < scheduleBlocks.length - 1) {
          setCurrentIndex(prev => prev !== null ? prev + 1 : 0);
          setIsTimerRunning(true);
        } else {
          // Day complete
          onModeToggle?.();
        }
      } catch (error) {
        console.error('Failed to complete Bible reading:', error);
        toast({
          title: "Error",
          description: "Failed to mark Bible reading as complete",
          variant: "destructive"
        });
        return; // Don't advance if completion failed
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
    
    // Update schedule block status for synchronization with Overview mode
    try {
      await apiRequest('PATCH', `/api/schedule/${studentName}/${selectedDate}/block/${currentBlock.templateBlockId || currentBlock.id}/status`, {
        status: 'complete'
      });
      
      console.log(`✅ Updated block status to 'complete' for block ${currentBlock.templateBlockId || currentBlock.id}`);
      
      // Invalidate schedule status cache to sync with Overview mode
      queryClient.invalidateQueries({ queryKey: ['/api/schedule', studentName, selectedDate, 'status'] });
      
      if (onAssignmentUpdate) {
        onAssignmentUpdate(); // This will refresh both assignment and schedule status data
      }
    } catch (error) {
      console.error('Failed to update schedule block status:', error);
      // Don't fail the whole completion for this - it's a sync issue
    }
    
    // Call API for assignment completion
    if (currentBlock.type === 'assignment' && currentBlock.assignment) {
      try {
        const response = await apiRequest('PATCH', `/api/assignments/${currentBlock.assignment.id}`, {
          completionStatus: 'completed',
          timeSpent: timeSpent || 0,
          earlyFinish: earlyFinish || false,
          bankMinutes: bankMinutes || 0
        }) as any;
        
        // Trigger confetti celebration for assignment completion
        setShowConfetti(true);
        
        toast({
          title: "Assignment Completed!",
          description: "Assignment marked as complete",
          variant: "default"
        });
        
        // CRITICAL: Invalidate assignment cache to sync across all app components
        queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
        
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
        
        // Trigger confetti celebration for Bible reading completion
        setShowConfetti(true);
        
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
    if (currentIndex !== null && currentIndex < scheduleBlocks.length - 1) {
      setCurrentIndex(prev => prev !== null ? prev + 1 : 0);
      setIsTimerRunning(true);
    } else {
      // Day complete
      onModeToggle?.();
    }
    
    setShowDoneDialog(false);
  };

  const handleNeedMoreTime = () => {
    // Directly reschedule - no popup needed for better executive function UX
    rescheduleAssignment('Need more time');
  };

  const rescheduleAssignment = async (reason: string, estimatedMinutesNeeded?: number) => {
    // Handle assignment blocks
    if (currentBlock?.assignment) {
      try {
        // Update block status to show it needs more time
        await apiRequest('PATCH', `/api/schedule/${studentName}/${selectedDate}/block/${currentBlock.templateBlockId || currentBlock.id}/status`, {
          status: 'overtime'
        });
        
        const response = await apiRequest('POST', `/api/assignments/${currentBlock.assignment.id}/need-more-time`, {
          reason: reason,
          estimatedMinutesNeeded: estimatedMinutesNeeded
        }) as any;
        
        toast({
          title: "Assignment Rescheduled",
          description: response.message,
          variant: "default"
        });
        
        // Trigger status refetch for overview pills
        queryClient.invalidateQueries({ queryKey: ['/api/schedule', studentName, selectedDate, 'status'] });
        
        // Primary flow: refetch assignments and re-derive blocks
        if (onAssignmentUpdate) {
          onAssignmentUpdate();
        }
        
        // Fallback: Move to next block if refetch doesn't update currentIndex
        setTimeout(() => {
          if (currentIndex !== null && currentIndex < scheduleBlocks.length - 1) {
            setCurrentIndex(prev => prev !== null ? prev + 1 : 0);
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
      return;
    }
    
    // Handle Bible blocks - always reschedule to tomorrow (Bible only happens in morning)
    if (currentBlock?.type === 'bible') {
      try {
        // Mark Bible block as complete for today since it's rescheduled to tomorrow
        await apiRequest('PATCH', `/api/schedule/${studentName}/${selectedDate}/block/${currentBlock.templateBlockId || currentBlock.id}/status`, {
          status: 'complete'
        });
        
        // Bible always goes to tomorrow - it only happens first thing in the morning
        await apiRequest('POST', `/api/bible-curriculum/reschedule`, {
          studentName: studentName,
          date: selectedDate,
          skipToTomorrow: true
        }) as any;
        
        toast({
          title: "Bible Reading Rescheduled",
          description: "Bible reading moved to tomorrow morning.",
          variant: "default"
        });
        
        // Trigger status refetch for overview pills
        queryClient.invalidateQueries({ queryKey: ['/api/schedule', studentName, selectedDate, 'status'] });
        
        // Trigger refetch to update schedule
        if (onAssignmentUpdate) {
          onAssignmentUpdate();
        }
        
        // Move to next block
        if (currentIndex !== null && currentIndex < scheduleBlocks.length - 1) {
          setCurrentIndex(prev => prev !== null ? prev + 1 : 0);
          setIsTimerRunning(true);
        } else {
          onModeToggle?.();
        }
        
      } catch (error) {
        console.error('Failed to reschedule Bible reading:', error);
        toast({
          title: "Bible Reading Rescheduled", 
          description: "Bible reading moved to tomorrow morning.",
          variant: "default"
        });
        
        // Still move to next block even if API fails
        if (currentIndex !== null && currentIndex < scheduleBlocks.length - 1) {
          setCurrentIndex(prev => prev !== null ? prev + 1 : 0);
          setIsTimerRunning(true);
        } else {
          onModeToggle?.();
        }
      }
      return;
    }
  };

  const handleStuck = () => {
    setShowStuckDialog(true);
  };

  const markAsStuck = async (reason: string, needsHelp: boolean) => {
    if (!currentBlock?.assignment) return;
    
    setIsProcessingStuck(true);
    
    try {
      // Update block status to show it's stuck
      await apiRequest('PATCH', `/api/schedule/${studentName}/${selectedDate}/block/${currentBlock.templateBlockId || currentBlock.id}/status`, {
        status: 'stuck'
      });
      
      const response = await apiRequest('POST', `/api/guided/${studentName}/${selectedDate}/stuck`, {
        assignmentId: currentBlock.assignment.id,
        reason: reason,
        needsHelp: needsHelp
      }) as any;
      
      // Trigger status refetch for overview pills
      queryClient.invalidateQueries({ queryKey: ['/api/schedule', studentName, selectedDate, 'status'] });
      
      // Start 15-second countdown
      setStuckCountdown(15);
      setStuckPendingKey(response.pendingKey);
      
      toast({
        title: "Assignment Will Be Marked as Stuck",
        description: "15-second undo window started. Assignment will be marked as stuck unless cancelled.",
        variant: "default"
      });
      
      // Move to next block immediately (fallback)
      if (currentIndex !== null && currentIndex < scheduleBlocks.length - 1) {
        setCurrentIndex(prev => prev !== null ? prev + 1 : 0);
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
  if (!currentBlock || currentIndex === null || currentIndex >= scheduleBlocks.length) {
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

  // CRITICAL FIX: Check after all hooks are called to prevent hooks violation
  if (currentIndex === null || !currentBlock) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading schedule...
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
        <div className="mb-4 rounded-2xl bg-[hsl(var(--status-progress)_/_0.1)] border border-[hsl(var(--status-progress)_/_0.2)] px-5 py-4" style={{ marginBottom: '16px' }}>
          <div className="mb-2 flex items-start justify-between gap-3">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
              <h2 className="text-[20px] font-bold text-foreground" style={{ 
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
              
            </div>
            {/* Instructions Dropdown Button */}
            {currentBlock.type === 'assignment' && currentBlock.assignment?.instructions && (
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-[hsl(var(--status-progress))] hover:bg-[hsl(var(--status-progress)_/_0.2)] rounded transition-colors"
                data-testid="button-toggle-instructions"
              >
                Instructions {showInstructions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            )}
          </div>
          {/* Instructions Dropdown Content */}
          {currentBlock.type === 'assignment' && currentBlock.assignment?.instructions && showInstructions && (
            <div className="mt-3 p-3 bg-[hsl(var(--status-progress)_/_0.1)] rounded-lg border border-[hsl(var(--status-progress)_/_0.2)]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-[hsl(var(--status-progress))] flex items-center justify-center">
                  <span className="text-white text-xs font-bold">i</span>
                </div>
                <h4 className="text-sm font-medium text-foreground">Instructions</h4>
                {/* Speaker button for instructions - only for Khalil */}
                {studentName.toLowerCase() === 'khalil' && (
                  <button
                    onClick={() => {
                      if (isPlaying) {
                        stop();
                      } else {
                        speak(`Assignment instructions: ${stripHtml(currentBlock.assignment.instructions)}`);
                      }
                    }}
                    className="ml-auto w-7 h-7 rounded-full bg-[hsl(var(--status-progress))] hover:bg-[hsl(var(--status-progress)_/_0.9)] flex items-center justify-center text-[hsl(var(--background))] transition-colors"
                    title={isPlaying ? "Stop reading" : "Read instructions aloud"}
                    data-testid="button-speak-instructions"
                  >
                    {isPlaying ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  </button>
                )}
              </div>
              <div className="text-sm leading-relaxed text-foreground/90" data-testid="assignment-instructions">
                {stripHtml(currentBlock.assignment.instructions)}
              </div>
            </div>
          )}
        </div>


        {/* Co-op Prep Checklist - shows during Prep/Load blocks */}
        {isPrepLoadBlock && prepChecklist.length > 0 && (
          <div className="mb-6 rounded-2xl bg-[hsl(var(--status-progress)_/_0.1)] border border-[hsl(var(--status-progress)_/_0.2)] px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <div 
                className="w-6 h-6 rounded-full bg-[hsl(var(--status-progress))] flex items-center justify-center"
                style={{ flexShrink: 0 }}
              >
                <span className="text-white text-xs font-bold">✓</span>
              </div>
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                Co-op Prep Checklist
              </h3>
            </div>
            
            <div className="space-y-2">
              {/* Simple flat list - no category headers for EF-friendly design */}
              {prepChecklist.map((item, index) => (
                <label key={`item-${index}`} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedItems.has(`item-${index}`)}
                    onChange={(e) => {
                      const newChecked = new Set(checkedItems);
                      if (e.target.checked) {
                        newChecked.add(`item-${index}`);
                      } else {
                        newChecked.delete(`item-${index}`);
                      }
                      setCheckedItems(newChecked);
                    }}
                    className="w-4 h-4 rounded border-2 border-foreground/30"
                    data-testid={`checkbox-item-${index}`}
                  />
                  <span className={`text-sm transition-all duration-200 ${
                    checkedItems.has(`item-${index}`) 
                      ? 'line-through text-muted-foreground opacity-75' 
                      : 'text-foreground'
                  }`}>
                    {item.item}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Timer - Hidden for Co-op class blocks */}
        {(() => {
          const shouldHideTimer = currentBlock.type === 'fixed' && currentBlock.title?.includes('Co-op');
          return !shouldHideTimer;
        })() && (
          <div style={{ marginBottom: '32px' }}>
            {(() => {
              // CRITICAL FIX: Use actual time block duration, not assignment estimates
              const getBlockDurationMinutes = (block: any): number => {
                const { startTime, endTime, blockType, title, estimatedMinutes, type } = block;
                
                // SAFETY NET: Force correct durations for specific block types regardless of API data
                if (blockType === 'Movement' || title?.toLowerCase().includes('movement')) {
                  console.log(`🚨 SAFETY NET: Movement block forced to 10 minutes (API sent: ${startTime}-${endTime})`);
                  return 10;
                }
                if (blockType === 'Travel' || title?.toLowerCase().includes('travel')) {
                  console.log(`🚨 SAFETY NET: Travel block forced to 10 minutes (API sent: ${startTime}-${endTime})`);
                  return 10;
                }
                if (blockType === 'Lunch' || title?.toLowerCase().includes('lunch')) {
                  console.log(`🚨 SAFETY NET: Lunch block forced to 30 minutes (API sent: ${startTime}-${endTime})`);
                  return 30;
                }
                
                // CRITICAL FIX: For assignment blocks, prefer estimatedMinutes over time slot calculation
                if (type === 'assignment' && estimatedMinutes && estimatedMinutes > 0) {
                  console.log(`🎯 ASSIGNMENT: Using estimatedMinutes (${estimatedMinutes}) instead of time slot (${startTime}-${endTime}) for "${title}"`);
                  return estimatedMinutes;
                }
                
                // For other blocks, calculate from time slot
                const [startHour, startMin] = startTime.split(':').map(Number);
                const [endHour, endMin] = endTime.split(':').map(Number);
                const startMinutes = startHour * 60 + startMin;
                const endMinutes = endHour * 60 + endMin;
                const calculatedDuration = Math.max(1, endMinutes - startMinutes);
                
                // DEBUG: Log when API times produce suspicious durations
                if (calculatedDuration > 60 || calculatedDuration < 5) {
                  console.log(`🐛 SUSPICIOUS DURATION: ${title} calculated as ${calculatedDuration} minutes from ${startTime}-${endTime}`);
                }
                
                return calculatedDuration;
              };
              
              const blockDurationMinutes = getBlockDurationMinutes(currentBlock);

              return (
                <CircularTimer
                  durationMinutes={blockDurationMinutes}
                  isRunning={isTimerRunning}
                  onComplete={() => handleBlockComplete()}
                  onToggle={() => setIsTimerRunning(!isTimerRunning)}
                  onReset={() => setIsTimerRunning(false)}
                  hideControls={true}
                />
              );
            })()}
          </div>
        )}

        {/* Stuck Countdown Banner (if active) */}
        {stuckCountdown > 0 && stuckPendingKey && (
          <div className="bg-gold/20 border border-gold/30" style={{
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span className="text-foreground" style={{ fontSize: '14px' }}>
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
          {/* Simple Co-op Attendance Button */}
          {currentBlock.type === 'fixed' && currentBlock.title?.includes('Co-op') ? (
            <button
              onClick={() => handleBlockComplete()}
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
              data-testid="button-attended"
            >
              ✓ Attended
            </button>
          ) : (
            <button
              onClick={() => handleBlockComplete()}
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
          )}
          
          {/* Hide complex buttons for Co-op class blocks */}
          {!(currentBlock.type === 'fixed' && currentBlock.title?.includes('Co-op')) && (
            <div style={{ display: 'flex', gap: '12px' }}>
              {/* Show Need More Time button for assignment and Bible blocks */}
              {(currentBlock?.assignment || currentBlock?.type === 'bible') && (
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
              )}
            
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
          )}
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
              Great work! 🎉
            </h3>
            {(() => {
              // FIXED: Use actual block duration, not estimatedMinutes
              const getBlockDurationMinutes = (block: any): number => {
                const { startTime, endTime, blockType, title, estimatedMinutes, type } = block;
                
                // SAFETY NET: Force correct durations for specific block types regardless of API data
                if (blockType === 'Movement' || title?.toLowerCase().includes('movement')) {
                  return 10;
                }
                if (blockType === 'Travel' || title?.toLowerCase().includes('travel')) {
                  return 10;
                }
                if (blockType === 'Lunch' || title?.toLowerCase().includes('lunch')) {
                  return 30;
                }
                
                // CRITICAL FIX: For assignment blocks, prefer estimatedMinutes over time slot calculation
                if (type === 'assignment' && estimatedMinutes && estimatedMinutes > 0) {
                  return estimatedMinutes;
                }
                
                // For other blocks, calculate from time slot
                const [startHour, startMin] = startTime.split(':').map(Number);
                const [endHour, endMin] = endTime.split(':').map(Number);
                const startMinutes = startHour * 60 + startMin;
                const endMinutes = endHour * 60 + endMin;
                return Math.max(1, endMinutes - startMinutes);
              };
              const totalMinutes = getBlockDurationMinutes(currentBlock);
              // FIXED: Use actual time remaining instead of hardcoded assumption
              const timeRemainingMinutes = actualTimeRemaining !== null ? Math.floor(actualTimeRemaining / 60) : 0;
              const timeSpentMinutes = Math.max(1, totalMinutes - timeRemainingMinutes);
              const extraMinutes = Math.max(0, timeRemainingMinutes);
              
              if (extraMinutes > 0) {
                return (
                  <>
                    <p style={{ marginBottom: '20px', color: colors.textMuted }}>
                      You finished {extraMinutes} minutes early! What would you like to do?
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <button
                        onClick={() => completeBlock(timeSpentMinutes, true, 0)}
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
                        ➡️ Continue to Next Subject
                      </button>
                      <button
                        onClick={() => {
                          // Take a break - just pause timer
                          setIsTimerRunning(false);
                          setShowDoneDialog(false);
                          toast({
                            title: "Break Time! 🎈",
                            description: `Take a break and resume when ready!`,
                            variant: "default"
                          });
                        }}
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          backgroundColor: 'transparent',
                          border: `2px solid ${colors.progress}`,
                          color: colors.progress,
                          fontSize: '16px',
                          cursor: 'pointer'
                        }}
                      >
                        🎈 Take a {extraMinutes}-minute break
                      </button>
                    </div>
                  </>
                );
              } else {
                return (
                  <>
                    <p style={{ marginBottom: '20px', color: colors.textMuted }}>
                      Perfect timing! Ready for the next subject?
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <button
                        onClick={() => completeBlock()}
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
                        ➡️ Continue to Next Subject
                      </button>
                    </div>
                  </>
                );
              }
            })()}
            
            <button
              onClick={() => setShowDoneDialog(false)}
              style={{
                padding: '8px',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                border: 'none',
                color: colors.textMuted,
                fontSize: '14px',
                cursor: 'pointer',
                marginTop: '12px'
              }}
            >
              Cancel
            </button>
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
      
      {/* Confetti Animation */}
      <ConfettiBurst 
        trigger={showConfetti} 
        onComplete={() => setShowConfetti(false)}
        colors={['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16']}
        particleCount={60}
        duration={3500}
      />
    </div>
  );
}