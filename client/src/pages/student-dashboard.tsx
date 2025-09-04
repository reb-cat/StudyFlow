import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Home,
  Moon,
  BookOpen,
  FileText,
  Users,
  Utensils,
  Package,
  Car,
  Building2,
  Grid3X3,
  Play,
  Activity,
  UtensilsCrossed,
  ArrowLeft,
  Printer,
  CheckCircle,
  Circle,
  AlertCircle,
  Pause,
  SkipForward,
  // New cleaner icon imports
  BookOpenText, 
  GraduationCap, 
  BusFront, 
  Coffee,
  Boxes, 
  Truck, 
  ClipboardList, 
  ListTodo, 
  Timer, 
  AlarmClock,
  CheckCircle2, 
  AlertTriangle, 
  Ban, 
  BookMarked, 
  CalendarClock, 
  School
} from 'lucide-react';
import { Link, useParams } from 'wouter';
import { GuidedDayView } from '@/components/GuidedDayView';
import { AssignmentCard } from '@/components/AssignmentCard';
import { FixedBlock } from '@/components/FixedBlock';
import { apiRequest } from '@/lib/queryClient';
import type { Assignment, DailyScheduleStatus, ScheduleTemplate } from '@shared/schema';
import { getTodayString, getToday, parseDateString, formatDateDisplay, getDayName, addDays, isToday } from '@shared/dateUtils';
import { normalizeAssignment } from '@shared/normalize';
import { toMinutes } from '@shared/debug';

// Timezone-safe New York date string function
const toNYDateString = (d = new Date()) => {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [{ value: y },,{ value: m },,{ value: da }] = (fmt.formatToParts(d));
  return `${y}-${m}-${da}`; // YYYY-MM-DD
};

// Clean icon mapping system
export type BlockKind = "bible" | "co-op" | "travel" | "lunch" | "break" | "prep" | "assignment" | "timer" | "done" | "needMoreTime" | "stuck" | "fixed" | "movement" | "prep/load" | "study hall";

export const iconFor = (kind: BlockKind, label?: string) => {
  switch (kind) {
    case "bible":        return BookOpenText;
    case "co-op":        return School;           // or GraduationCap
    case "study hall":   return ClipboardList;   // Assignment work during co-op study hall
    case "travel":       return Car;              // or BusFront if bus
    case "lunch":        return Utensils;
    case "break":        return Coffee;
    case "prep":         
    case "prep/load":    return Boxes;            // FIX: was Package; use Boxes/Package/Truck
    case "movement":     return Activity;
    case "assignment":   return ClipboardList;    // or ListTodo
    case "timer":        return Timer;            // or AlarmClock
    case "done":         return CheckCircle2;
    case "needMoreTime": return CalendarClock;
    case "stuck":        return AlertTriangle;
    case "fixed":        return BookMarked;       // generic fixed item
    default:             return ListTodo;
  }
};

export default function StudentDashboard() {
  const params = useParams<{ student: string }>();
  // Capitalize student name for consistency, default to Abigail if no student provided
  const studentName = params.student ? params.student.charAt(0).toUpperCase() + params.student.slice(1) : "Abigail";
  const [isGuidedMode, setIsGuidedMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Initialize to today using timezone-safe function
    return toNYDateString();
  });
  const queryClient = useQueryClient();

  const handleHomeClick = () => {
    // Reset to today and overview mode
    setSelectedDate(toNYDateString());
    setIsGuidedMode(false);
  };


  // Fetch assignments for today (get assignments due on or before this date)
  const { data: assignments = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/assignments', selectedDate, studentName],
    queryFn: async () => {
      // For scheduling purposes, show assignments due in the next few days
      const currentDate = new Date(selectedDate);
      const targetDate = new Date(currentDate);
      targetDate.setDate(currentDate.getDate() + 2); // Show assignments due within 2 days
      
      const params = new URLSearchParams({
        date: toNYDateString(targetDate),
        studentName: studentName
      });
      const response = await fetch(`/api/assignments?${params}`);
      if (!response.ok) throw new Error('Failed to fetch assignments');
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch schedule template for the student and date
  const { data: scheduleTemplate = [] } = useQuery<any[]>({
    queryKey: ['/api/schedule', studentName, selectedDate],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Initialize daily schedule for today
  useEffect(() => {
    const initializeSchedule = async () => {
      try {
        await apiRequest('POST', `/api/schedule/${studentName}/${selectedDate}/initialize`);
      } catch (error) {
        console.error('Failed to initialize schedule:', error);
      }
    };
    
    initializeSchedule();
  }, [studentName, selectedDate]);

  // Fetch daily schedule status for both Overview and Guided Mode synchronization
  const { data: dailyScheduleStatus = [], isLoading: isStatusLoading } = useQuery<Array<DailyScheduleStatus & { template: ScheduleTemplate }>>({
    queryKey: ['/api/schedule', studentName, selectedDate, 'status'],
    queryFn: async () => {
      const response = await fetch(`/api/schedule/${studentName}/${selectedDate}/status`);
      if (!response.ok) throw new Error('Failed to fetch daily schedule status');
      return response.json();
    },
    staleTime: 1000 * 30, // 30 seconds for real-time updates
    // Always fetch to maintain synchronization between modes
  });

  // Get Bible curriculum for printable schedule
  const { data: bibleResponse } = useQuery({
    queryKey: ['/api/bible-curriculum/current', studentName],
    enabled: !!studentName,
  });
  
  const bibleData = (bibleResponse as any)?.curriculum || {};

  const handleAssignmentUpdate = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['/api/assignments', selectedDate, studentName] });
  };

  // Status badge helpers for Overview Mode
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'not-started': {
        variant: 'outline' as const,
        color: 'text-muted-foreground bg-muted/30 border-border/50',
        icon: Circle,
        text: 'not started'
      },
      'in-progress': {
        variant: 'outline' as const,
        color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50',
        icon: Play,
        text: 'in progress'
      },
      'complete': {
        variant: 'outline' as const,
        color: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50',
        icon: CheckCircle,
        text: 'complete'
      },
      'stuck': {
        variant: 'outline' as const,
        color: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/50',
        icon: AlertCircle,
        text: 'stuck'
      },
      'overtime': {
        variant: 'outline' as const,
        color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/50',
        icon: SkipForward,
        text: 'overtime'
      }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig['not-started'];
    const IconComponent = config.icon;

    return (
      <Badge variant={config.variant} className={`text-xs px-2 py-0.5 rounded-md ${config.color}`}>
        <IconComponent className="h-3 w-3 mr-1" />
        {config.text}
      </Badge>
    );
  };

  // Get status for a specific schedule block
  const getBlockStatus = (blockId: string): string => {
    const statusEntry = dailyScheduleStatus.find(s => s.templateBlockId === blockId);
    return statusEntry?.status || 'not-started';
  };

  // Update block status functionality
  const updateBlockStatus = async (blockId: string, newStatus: string) => {
    try {
      await apiRequest('PATCH', `/api/schedule/${studentName}/${selectedDate}/block/${blockId}/status`, {
        status: newStatus
      });
      // Refresh status data immediately
      queryClient.invalidateQueries({ queryKey: ['/api/schedule', studentName, selectedDate, 'status'] });
    } catch (error) {
      console.error('Failed to update block status:', error);
    }
  };

  // Get next status in cycle: not-started -> in-progress -> complete -> not-started
  const getNextStatus = (currentStatus: string): string => {
    const statusCycle = ['not-started', 'in-progress', 'complete'];
    const currentIndex = statusCycle.indexOf(currentStatus);
    return statusCycle[(currentIndex + 1) % statusCycle.length];
  };

  const todayAssignments = assignments as Assignment[];
  
  // Time formatting utility
  const formatSingleTime = (timeStr: string) => {
    if (!timeStr || timeStr === '00:00') return '12:00 AM';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };
  
  // Date utilities - Fix timezone issue by using UTC
  const selectedDateObj = parseDateString(selectedDate);
  const todayString = getTodayString();
  const isTodaySelected = isToday(selectedDate);
  const isWeekend = selectedDateObj.getDay() === 0 || selectedDateObj.getDay() === 6;
  const dayName = getDayName(selectedDate);
  const dateDisplay = formatDateDisplay(selectedDate);
  
  // Debug current date calculation
  console.log('🗓️ Date Debug:', {
    selectedDate,
    selectedDateObj: selectedDateObj.toString(),
    dayName,
    dateDisplay,
    today: todayString
  });

  // Schedule template for the selected day
  const isThursday = selectedDateObj.getDay() === 4;
  const weekdayName = dayName;

  // Date navigation functions
  const goToPreviousDay = () => {
    setSelectedDate(addDays(selectedDate, -1));
  };

  const goToNextDay = () => {
    setSelectedDate(addDays(selectedDate, 1));
  };

  const goToToday = () => {
    setSelectedDate(getTodayString());
  };

  // Use real schedule template data from database (fix field mapping)
  const allScheduleBlocks = scheduleTemplate.map((block) => ({
    id: block.id,
    title: block.subject,
    blockType: block.blockType?.toLowerCase() || 'unknown',
    startTime: block.startTime?.substring(0, 5) || '00:00', // Remove seconds from HH:MM:SS
    endTime: block.endTime?.substring(0, 5) || '00:00',
    blockNumber: block.blockNumber,
    subject: block.subject
  }));

  // Separate Bible blocks from other fixed blocks using real data
  const bibleBlocks = allScheduleBlocks.filter((block) => block.blockType === 'bible');
  const fixedBlocks = allScheduleBlocks.filter((block) => 
    ['travel', 'co-op', 'prep/load', 'movement', 'lunch'].includes(block.blockType)
  );
  const assignmentBlocks = allScheduleBlocks.filter((block) => block.blockType === 'assignment');

  // INTELLIGENT ASSIGNMENT SCHEDULING with subject distribution and deduplication
  const populatedAssignmentBlocks = (() => {
    // Create a copy of assignments for scheduling
    const availableAssignments = [...assignments];
    const usedSubjects = new Set<string>();
    const scheduledAssignments: any[] = [];
    
    // Sort assignments by priority: overdue first, then by due date
    availableAssignments.sort((a, b) => {
      const aOverdue = a.dueDate && new Date(a.dueDate) < new Date();
      const bOverdue = b.dueDate && new Date(b.dueDate) < new Date();
      
      // Overdue assignments come first
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      
      // Then sort by due date
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return 0;
    });
    
    return assignmentBlocks.map((block, index) => {
      let selectedAssignment = null;
      
      // First pass: try to find assignment from unused subject
      for (let i = 0; i < availableAssignments.length; i++) {
        const assignment = availableAssignments[i];
        const subject = assignment.subject || 'General';
        
        if (!usedSubjects.has(subject)) {
          selectedAssignment = assignment;
          availableAssignments.splice(i, 1);
          usedSubjects.add(subject);
          break;
        }
      }
      
      // Second pass: if no unused subject, take next available (but avoid similar titles)
      if (!selectedAssignment && availableAssignments.length > 0) {
        for (let i = 0; i < availableAssignments.length; i++) {
          const assignment = availableAssignments[i];
          
          // Check for similar titles in already scheduled assignments
          const similarExists = scheduledAssignments.some(scheduled => {
            if (!scheduled) return false;
            const titleA = assignment.title.toLowerCase().replace(/[^a-z\s]/g, '');
            const titleB = scheduled.title.toLowerCase().replace(/[^a-z\s]/g, '');
            
            // Check for similar recipe assignments or identical prefixes
            if (titleA.includes('review recipe') && titleB.includes('review recipe')) {
              return true;
            }
            
            // Check for similar worksheet/homework patterns
            const wordsA = titleA.split(' ').filter((w: string) => w.length > 3);
            const wordsB = titleB.split(' ').filter((w: string) => w.length > 3);
            const commonWords = wordsA.filter((w: string) => wordsB.includes(w));
            
            return commonWords.length >= 2; // Similar if 2+ significant words match
          });
          
          if (!similarExists) {
            selectedAssignment = assignment;
            availableAssignments.splice(i, 1);
            break;
          }
        }
        
        // If still no assignment and we have extras, take next available anyway
        if (!selectedAssignment && availableAssignments.length > 0) {
          selectedAssignment = availableAssignments.shift();
        }
      }
      
      scheduledAssignments.push(selectedAssignment);
      
      return {
        ...block,
        assignment: selectedAssignment
      };
    });
  })();

  // NEW: Compose the exact sequence Guided should show (mirrors Overview)
  const composedForGuided = allScheduleBlocks.map((block) => {
    const base = {
      id: block.id ?? `block-${block.blockNumber ?? crypto.randomUUID()}`,
      startTime: block.startTime?.slice(0,5) || '00:00',
      endTime: block.endTime?.slice(0,5) || '00:00',
    };
    
    // 🎯 FIX: Calculate estimatedMinutes for ALL blocks using same logic as Overview
    const estimatedMinutes = toMinutes(block.endTime) - toMinutes(block.startTime);
    
    if (block.blockType === 'assignment' || block.blockType === 'Study Hall') {
      const pb = populatedAssignmentBlocks.find(pb => pb.id === block.id);
      const a = pb?.assignment;
      return {
        ...base,
        type: 'assignment' as const,
        title: a?.displayTitle || a?.title || 'Open Assignment Block',
        estimatedMinutes: a?.estimatedMinutes ?? 30, // Use assignment-specific time for assignments
        assignmentId: a?.id ?? null,
        assignment: a, // 🎯 FIX: Pass full assignment object with instructions
        blockType: block.blockType, // 🎯 NEW: Track original block type for Study Hall handling
      };
    }
    if (block.blockType === 'bible') {
      return { 
        ...base, 
        type: 'bible' as const, 
        title: 'Bible',
        estimatedMinutes: estimatedMinutes // Use calculated time
      };
    }
    // fixed: travel, co-op, lunch, movement, prep/load, etc.
    return { 
      ...base, 
      type: 'fixed' as const, 
      title: block.subject || 'Fixed Block',
      estimatedMinutes: estimatedMinutes // 🎯 CRITICAL: Use calculated time, not default!
    };
  });

  // DEBUG LOGGING: Client Overview composition
  const DEBUG_ORDERING = process.env.NODE_ENV === 'development' && false; // Enable when needed
  if (DEBUG_ORDERING && studentName === 'Abigail') {
    console.log('\n🧭 ORDER TRACE / CLIENT_OVERVIEW: allScheduleBlocks');
    allScheduleBlocks.forEach((block, i) => {
      const startMinute = block.startTime ? parseInt(block.startTime.split(':')[0]) * 60 + parseInt(block.startTime.split(':')[1]) : 999;
      console.log(`  [${i}] ${block.id} | ${startMinute}min (${block.startTime}) | ${block.blockType} | ${block.title}`);
    });
    
    // Verify strict ascending order
    for (let i = 1; i < allScheduleBlocks.length; i++) {
      const prev = allScheduleBlocks[i - 1];
      const curr = allScheduleBlocks[i];
      const prevMinute = prev.startTime ? parseInt(prev.startTime.split(':')[0]) * 60 + parseInt(prev.startTime.split(':')[1]) : 999;
      const currMinute = curr.startTime ? parseInt(curr.startTime.split(':')[0]) * 60 + parseInt(curr.startTime.split(':')[1]) : 999;
      
      if (prevMinute > currMinute) {
        console.error(`❌ ORDER VIOLATION in CLIENT_OVERVIEW: [${i-1}] ${prevMinute}min > [${i}] ${currMinute}min`);
      }
    }
  }

  if (isWeekend) {
    return (
      <div className="min-h-screen p-6 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🌟</div>
            <h1 className="text-3xl font-bold text-foreground mb-4">
              Happy {dayName}, {studentName}!
            </h1>
            <p className="text-lg text-muted-foreground mb-6">
              It's the weekend - time to recharge and do what you love!
            </p>
            <p className="text-muted-foreground">
              Your assignments will be waiting for you on Monday. Enjoy your break! 🎉
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Welcome, {studentName}!</h1>
              <p className="text-lg text-muted-foreground mt-1">{dateDisplay}</p>
            </div>
          </div>
          <Card className="bg-card border border-border">
            <CardContent className="p-8 text-center">
              <div className="text-muted-foreground">Loading schedule...</div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 print-page bg-background">
      <div className="max-w-5xl mx-auto">
        
        {/* Print Header - Hidden on screen, visible in print */}
        <div className="hidden print:block print-header">
          <div className="print-student-name">{studentName}'s Daily Schedule</div>
          <div className="print-date">{dateDisplay}</div>
          {isThursday && (
            <div className="print-coop-badge">Co-op Day</div>
          )}
        </div>
        
        {/* Header - Full navigation for Overview, minimal for Guided */}
        {isGuidedMode ? (
          // Minimal header for Guided mode - just theme toggle
          <div className="flex justify-end mb-4 no-print">
            <ThemeToggle />
          </div>
        ) : (
          // Full header for Overview mode
          <>
            <div className="flex items-center justify-between mb-6 px-4 no-print">
              <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight" data-testid="student-name">
                {studentName}
              </h1>
              <div className="flex items-center gap-3">
                <Link href="/student">
                  <Button 
                    variant="ghost" 
                    data-testid="button-student-selection"
                    className="rounded-full hover:bg-muted/60 transition-all duration-200 hover:scale-105 h-12 w-12 p-0 [&_svg]:!size-6"
                    title="Back to Student Selection"
                  >
                    <ArrowLeft className="h-6 w-6" />
                  </Button>
                </Link>
                <Button 
                  variant="ghost" 
                  data-testid="button-home"
                  onClick={handleHomeClick}
                  className="rounded-full hover:bg-muted/60 transition-all duration-200 hover:scale-105 h-12 w-12 p-0 [&_svg]:!size-6"
                  title="Today's Overview"
                >
                  <Home className="h-6 w-6" />
                </Button>
                <Button 
                  variant="ghost" 
                  data-testid="button-print"
                  onClick={() => window.print()}
                  className="rounded-full hover:bg-muted/60 transition-all duration-200 hover:scale-105 h-12 w-12 p-0 [&_svg]:!size-6"
                >
                  <Printer className="h-6 w-6" />
                </Button>
                <ThemeToggle />
              </div>
            </div>

            {/* Second row - Date/Co-op + Mode toggles */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 px-4 no-print">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-foreground">
                  <Calendar className="h-5 w-5" />
                  <span data-testid="date-display" className="text-base font-semibold">{dateDisplay}</span>
                </div>
                {isThursday && (
                  <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800 rounded-full px-4 py-1.5 text-sm font-medium">
                    Co-op Day
                  </Badge>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                {/* Date Navigation for testing (will be removed later) */}
                <div className="flex items-center gap-0 bg-muted/50 rounded-xl p-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToPreviousDay}
                    className="h-10 w-10 p-0 rounded-lg hover:bg-background/80"
                    data-testid="button-previous-day"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div className="px-4 text-base font-semibold min-w-[90px] text-center">
                    {isTodaySelected ? 'Today' : dayName}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToNextDay}
                    className="h-10 w-10 p-0 rounded-lg hover:bg-background/80"
                    data-testid="button-next-day"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>

                {/* Overview/Guided Mode Toggle */}
                <div className="flex items-center bg-muted/50 rounded-xl p-1.5">
                  <Button
                    variant={!isGuidedMode ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setIsGuidedMode(false)}
                    className="text-base flex items-center gap-2 rounded-lg px-5 py-2.5 transition-all font-semibold"
                    data-testid="button-overview-mode"
                  >
                    <Grid3X3 className="h-5 w-5" />
                    <span className="hidden sm:inline">Overview</span>
                    <span className="sm:hidden">Overview</span>
                  </Button>
                  <Button
                    variant={isGuidedMode ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setIsGuidedMode(true)}
                    className="text-base flex items-center gap-2 rounded-lg px-5 py-2.5 transition-all font-semibold"
                    data-testid="button-guided-mode"
                  >
                    <Play className="h-5 w-5" />
                    <span className="hidden sm:inline">Guided</span>
                    <span className="sm:hidden">Guided</span>
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Content */}
        {isGuidedMode ? (
          <div className="space-y-4">
            <GuidedDayView
              assignments={todayAssignments}
              studentName={studentName}
              selectedDate={selectedDate}
              scheduleTemplate={scheduleTemplate}
              composedSchedule={composedForGuided}
              onAssignmentUpdate={handleAssignmentUpdate}
              onModeToggle={() => setIsGuidedMode(false)}
              dailyScheduleStatus={dailyScheduleStatus}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Progress Bar - Apple Fitness style with real-time progress */}
            <div className="bg-card rounded-xl p-4 border border-border/50 no-print">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-muted-foreground">Daily Progress</span>
                <span className="font-medium text-muted-foreground">
                  {dailyScheduleStatus.length > 0 
                    ? `${Math.round((dailyScheduleStatus.filter(s => s.status === 'complete').length / dailyScheduleStatus.length) * 100)}% (${dailyScheduleStatus.filter(s => s.status === 'complete').length}/${dailyScheduleStatus.length})`
                    : '0%'
                  }
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-muted rounded-full h-3">
                <div 
                  className="bg-primary h-3 rounded-full transition-all duration-500" 
                  style={{ 
                    width: dailyScheduleStatus.length > 0 
                      ? `${(dailyScheduleStatus.filter(s => s.status === 'complete').length / dailyScheduleStatus.length) * 100}%`
                      : '0%'
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>Click status badges to update progress</span>
                <span>{dailyScheduleStatus.filter(s => s.status === 'in-progress').length} in progress • {dailyScheduleStatus.filter(s => s.status === 'stuck').length} stuck</span>
              </div>
            </div>

            {/* Schedule Card - Compact Apple style (screen only) */}
            <Card className="bg-card rounded-xl border border-border/50 print:hidden">
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  {isTodaySelected ? "Today's" : `${dayName}'s`} Schedule
                </h3>
                  
                  <div className="space-y-3 print:space-y-0">
                    {/* Show ALL schedule blocks in chronological order with compact Apple-style layout */}
                    {allScheduleBlocks
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((block, index) => {
                        // Get appropriate icon component using cleaner mapping
                        const getBlockIcon = (blockType: string) => {
                          const iconClass = "h-6 w-6 text-blue-600";
                          const IconComponent = iconFor(blockType.toLowerCase() as BlockKind);
                          return <IconComponent className={iconClass} />;
                        };
                        
                        
                        // Get block title and details
                        let blockTitle = block.title;
                        let blockDetails = '';
                        
                        if (block.blockType === 'assignment') {
                          // Use round-robin assignment from our populated blocks
                          const populatedBlock = populatedAssignmentBlocks.find(pb => pb.id === block.id);
                          if (populatedBlock && populatedBlock.assignment) {
                            blockTitle = populatedBlock.assignment.displayTitle || populatedBlock.assignment.title; // Use normalized title
                            blockDetails = ''; // No subtitle needed
                          } else {
                            blockTitle = 'Open Assignment Block';
                            blockDetails = '';
                          }
                        } else if (block.blockType === 'bible') {
                          blockTitle = 'Bible';
                          blockDetails = 'Daily Bible Reading';
                        }
                        
                        // Calculate duration
                        const getBlockDuration = (startTime: string, endTime: string) => {
                          const [startHour, startMin] = startTime.split(':').map(Number);
                          const [endHour, endMin] = endTime.split(':').map(Number);
                          const startMinutes = startHour * 60 + startMin;
                          const endMinutes = endHour * 60 + endMin;
                          const duration = endMinutes - startMinutes;
                          return `${duration} min`;
                        };

                        const currentStatus = getBlockStatus(block.id);
                        const isCurrentBlock = currentStatus === 'in-progress';
                        
                        // Different block types support different statuses
                        const getValidStatusForBlock = (blockType: string, status: string) => {
                          const lowerBlockType = blockType.toLowerCase();
                          
                          // Binary blocks (movement, lunch, travel) only support complete/not-started
                          if (['movement', 'lunch', 'travel', 'prep/load'].includes(lowerBlockType)) {
                            return status === 'complete' ? 'complete' : 'not-started';
                          }
                          
                          // All other blocks support full status range
                          return status;
                        };
                        
                        const effectiveStatus = getValidStatusForBlock(block.blockType, currentStatus);

                        return (
                          <div 
                            key={block.id} 
                            className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-200 ${
                              isCurrentBlock 
                                ? 'border-2 border-blue-300 bg-blue-50' 
                                : 'bg-card hover:bg-accent/10'
                            } print-schedule-item`}
                          >
                            {/* Start/End Time Vertical - Centered */}
                            <div className="flex flex-col justify-center text-center text-foreground min-w-[80px]">
                              <div className="text-base font-medium">{formatSingleTime(block.startTime)}</div>
                              <div className="text-sm text-muted-foreground">{formatSingleTime(block.endTime)}</div>
                            </div>

                            {/* Status-colored Pill with Consistent White Icons */}
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              effectiveStatus === 'complete' ? 'bg-green-100 border border-green-300' :
                              effectiveStatus === 'in-progress' ? 'bg-blue-100 border border-blue-300' :
                              effectiveStatus === 'stuck' ? 'bg-orange-100 border border-orange-300' :
                              'bg-gray-100 border border-gray-300'  // not-started
                            }`}>
                              {getBlockIcon(block.blockType)}
                            </div>

                            {/* Subject + Description */}
                            <div className="flex-1">
                              <div className="font-semibold text-foreground">{blockTitle}</div>
                              {blockDetails && <div className="text-muted-foreground text-sm">{blockDetails}</div>}
                            </div>

                            {/* Status Badge */}
                            <button 
                              onClick={() => {
                                // Binary blocks cycle between not-started and complete only
                                const lowerBlockType = block.blockType.toLowerCase();
                                if (['movement', 'lunch', 'travel', 'prep/load'].includes(lowerBlockType)) {
                                  const nextStatus = currentStatus === 'complete' ? 'not-started' : 'complete';
                                  updateBlockStatus(block.id, nextStatus);
                                } else {
                                  // Other blocks use full status cycle
                                  updateBlockStatus(block.id, getNextStatus(currentStatus));
                                }
                              }}
                              className="hover:scale-105 transition-transform duration-150"
                              data-testid={`button-status-${block.id}`}
                            >
                              {getStatusBadge(effectiveStatus)}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
              
              {/* Print-only clean layout */}
              <div className="hidden print:block">
                <div className="print-schedule-container">
                  {allScheduleBlocks
                    .sort((a, b) => a.startTime.localeCompare(b.startTime))
                    .map((block, index) => {
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
                      
                      let blockTitle = block.title;
                      let blockDetails = '';
                      
                      if (block.blockType === 'assignment') {
                        const populatedBlock = populatedAssignmentBlocks.find(pb => pb.id === block.id);
                        if (populatedBlock && populatedBlock.assignment) {
                          // Use normalizeAssignment to get rich display data like Guided mode
                          const normalized = normalizeAssignment({
                            id: populatedBlock.assignment.id,
                            title: populatedBlock.assignment.title,
                            course: populatedBlock.assignment.courseName,
                            instructions: populatedBlock.assignment.instructions,
                            dueAt: populatedBlock.assignment.dueDate
                          });
                          
                          blockTitle = normalized.displayTitle;
                          
                          // Build rich details: course + due date + time estimate
                          const detailParts = [];
                          if (normalized.courseLabel) {
                            detailParts.push(normalized.courseLabel);
                          }
                          if (normalized.effectiveDueAt) {
                            const dueDate = new Date(normalized.effectiveDueAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric'
                            });
                            detailParts.push(`Due: ${dueDate}`);
                          }
                          if (populatedBlock.assignment.estimatedMinutes) {
                            detailParts.push(`${populatedBlock.assignment.estimatedMinutes} min`);
                          }
                          
                          blockDetails = detailParts.join(' • ');
                        } else {
                          blockTitle = 'Open Assignment Block';
                          blockDetails = '';
                        }
                      } else if (block.blockType === 'bible') {
                        blockTitle = 'Bible';
                        // Use real Bible curriculum data instead of hardcoded Genesis
                        blockDetails = bibleData?.dailyReading 
                          ? `${bibleData.dailyReading.readingTitle} (Daily Bible Reading)`
                          : 'Daily Bible Reading';
                      }
                      
                      return (
                        <div key={block.id} className="print-schedule-row">
                          <div className="print-time-col">
                            {formatTime(block.startTime, block.endTime)}
                          </div>
                          <div className="print-activity-col">
                            <div className="print-activity-title">{blockTitle}</div>
                            {blockDetails && <div className="print-activity-details">{blockDetails}</div>}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
          </div>
        )}
        
        {/* Print Footer - Hidden on screen, visible in print */}
        <div className="hidden print:block print-footer">
          StudyFlow Daily Schedule • Executive Function Support System • Generated: {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}