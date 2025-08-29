import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Calendar,
  Home,
  Settings,
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
  SkipForward
} from 'lucide-react';
import { Link, useParams } from 'wouter';
import { GuidedDayView } from '@/components/GuidedDayView';
import { AssignmentCard } from '@/components/AssignmentCard';
import { FixedBlock } from '@/components/FixedBlock';
import { apiRequest } from '@/lib/queryClient';
import type { Assignment, DailyScheduleStatus, ScheduleTemplate } from '@shared/schema';

export default function StudentDashboard() {
  const params = useParams<{ student: string }>();
  // Capitalize student name for consistency, default to Abigail if no student provided
  const studentName = params.student ? params.student.charAt(0).toUpperCase() + params.student.slice(1) : "Abigail";
  const [isGuidedMode, setIsGuidedMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Set to September 2nd, 2025 to show assignments with instructions
    return '2025-09-02';
  });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const queryClient = useQueryClient();

  // Theme toggle functionality
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleHomeClick = () => {
    // Reset to today and overview mode
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setIsGuidedMode(false);
  };

  const handleSettingsClick = () => {
    // For now, just show an alert - can be expanded later
    alert('Settings panel coming soon!');
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
        date: targetDate.toISOString().split('T')[0],
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

  // Fetch daily schedule status for Overview Mode
  const { data: dailyScheduleStatus = [], isLoading: isStatusLoading } = useQuery<Array<DailyScheduleStatus & { template: ScheduleTemplate }>>({
    queryKey: ['/api/schedule', studentName, selectedDate, 'status'],
    queryFn: async () => {
      const response = await fetch(`/api/schedule/${studentName}/${selectedDate}/status`);
      if (!response.ok) throw new Error('Failed to fetch daily schedule status');
      return response.json();
    },
    staleTime: 1000 * 30, // 30 seconds for real-time updates
    enabled: !isGuidedMode, // Only fetch when in Overview Mode
  });

  const handleAssignmentUpdate = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['/api/assignments', selectedDate, studentName] });
  };

  // Status badge helpers for Overview Mode
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'not-started': {
        variant: 'outline' as const,
        color: 'text-gray-500 dark:text-muted-foreground bg-gray-50 dark:bg-muted/30 border-gray-200 dark:border-border/50',
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
  
  
  // Date utilities - Fix timezone issue by using UTC
  const selectedDateObj = new Date(selectedDate + 'T12:00:00.000Z'); // Noon UTC avoids timezone issues
  const today = new Date();
  const isToday = selectedDate === today.toISOString().split('T')[0];
  const isWeekend = selectedDateObj.getDay() === 0 || selectedDateObj.getDay() === 6;
  const dayName = selectedDateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const dateDisplay = selectedDateObj.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    timeZone: 'UTC'
  });
  
  // Debug current date calculation
  console.log('🗓️ Date Debug:', {
    selectedDate,
    selectedDateObj: selectedDateObj.toString(),
    dayName,
    dateDisplay,
    today: new Date().toISOString().split('T')[0]
  });

  // Schedule template for the selected day
  const isThursday = selectedDateObj.getDay() === 4;
  const weekdayName = selectedDateObj.toLocaleDateString('en-US', { weekday: 'long' });

  // Date navigation functions
  const goToPreviousDay = () => {
    const prevDay = new Date(selectedDateObj);
    prevDay.setDate(prevDay.getDate() - 1);
    setSelectedDate(prevDay.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const nextDay = new Date(selectedDateObj);
    nextDay.setDate(nextDay.getDate() + 1);
    setSelectedDate(nextDay.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
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

  // Fill assignment blocks with available assignments (no duplicates - each assignment used only once)
  const populatedAssignmentBlocks = assignmentBlocks.map((block, index) => {
    // Only assign if we have an assignment at this index (no round-robin duplicates)
    const assignment = index < assignments.length ? assignments[index] : null;
    
    return {
      ...block,
      assignment: assignment
    };
  });

  if (isWeekend) {
    return (
      <div className="min-h-screen p-6" style={{ background: 'linear-gradient(135deg, var(--background) 0%, var(--surface-secondary) 100%)' }}>
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
      <div className="min-h-screen p-6" style={{ background: 'linear-gradient(135deg, var(--background) 0%, var(--surface-secondary) 100%)' }}>
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
    <div className="min-h-screen p-4 sm:p-6 print-page" style={{ background: 'linear-gradient(135deg, var(--background) 0%, var(--surface-secondary) 100%)' }}>
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
            <Button 
              variant="ghost" 
              data-testid="button-theme"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="rounded-full hover:bg-muted/60 transition-all h-10 w-10 p-0"
              title="Toggle theme"
            >
              <Moon className="h-5 w-5" />
            </Button>
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
                  data-testid="button-settings"
                  onClick={handleSettingsClick}
                  className="rounded-full hover:bg-muted/60 transition-all duration-200 hover:scale-105 h-12 w-12 p-0 [&_svg]:!size-6"
                >
                  <Settings className="h-6 w-6" />
                </Button>
                <Button 
                  variant="ghost" 
                  data-testid="button-print"
                  onClick={() => window.print()}
                  className="rounded-full hover:bg-muted/60 transition-all duration-200 hover:scale-105 h-12 w-12 p-0 [&_svg]:!size-6"
                >
                  <Printer className="h-6 w-6" />
                </Button>
                <Button 
                  variant="ghost" 
                  data-testid="button-theme"
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="rounded-full hover:bg-muted/60 transition-all duration-200 hover:scale-105 h-12 w-12 p-0 [&_svg]:!size-6"
                >
                  <Moon className="h-6 w-6" />
                </Button>
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
                    {isToday ? 'Today' : dayName}
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
              onAssignmentUpdate={handleAssignmentUpdate}
              onModeToggle={() => setIsGuidedMode(false)}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Progress Bar - Apple Fitness style with real-time progress */}
            <div className="bg-white dark:bg-card rounded-xl p-4 border border-gray-200 dark:border-border/50 no-print">
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
                  className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-500" 
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
            <Card className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border/50 print:hidden">
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  {isToday ? "Today's" : `${dayName}'s`} Schedule
                </h3>
                  
                  <div className="space-y-1 print:space-y-0">
                    {/* Show ALL schedule blocks in chronological order with compact Apple-style layout */}
                    {allScheduleBlocks
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((block, index) => {
                        // Get appropriate icon component with consistent colored pill containers
                        const getBlockIcon = (blockType: string) => {
                          const iconClass = "h-4 w-4 text-white";
                          const pillBg = 'bg-gradient-to-br from-blue-500 to-blue-600'; // Same background for ALL pills
                          
                          let icon;
                          switch(blockType) {
                            case 'bible': 
                              icon = <BookOpen className={iconClass} />;
                              break;
                            case 'assignment': 
                              icon = <FileText className={iconClass} />;
                              break;
                            case 'movement': 
                              icon = <Activity className={iconClass} />;
                              break;
                            case 'lunch':
                            case 'prep/load': 
                              icon = <Utensils className={iconClass} />;
                              break;
                            case 'travel': 
                              icon = <Car className={iconClass} />;
                              break;
                            case 'co-op': 
                              icon = <Building2 className={iconClass} />;
                              break;
                            default: 
                              icon = <FileText className={iconClass} />;
                          }
                          
                          return (
                            <div className={`p-2 rounded-full ${pillBg}`}>
                              {icon}
                            </div>
                          );
                        };
                        
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
                        
                        // Get block title and details
                        let blockTitle = block.title;
                        let blockDetails = '';
                        
                        if (block.blockType === 'assignment') {
                          // Use round-robin assignment from our populated blocks
                          const populatedBlock = populatedAssignmentBlocks.find(pb => pb.id === block.id);
                          if (populatedBlock && populatedBlock.assignment) {
                            blockTitle = populatedBlock.assignment.title; // Show assignment title as the main title
                            blockDetails = ''; // No subtitle needed
                          } else {
                            blockTitle = 'Open Assignment Block';
                            blockDetails = '';
                          }
                        } else if (block.blockType === 'bible') {
                          blockTitle = 'Bible';
                          blockDetails = 'Daily Bible Reading';
                        }
                        
                        return (
                          <div 
                            key={block.id} 
                            className={`group flex items-center justify-between py-2.5 px-3 hover:bg-gray-50 dark:hover:bg-muted/30 rounded-lg transition-colors duration-150 print-schedule-item ${
                              block.blockType === 'assignment' ? 'print-assignment' : 
                              block.blockType === 'bible' ? 'print-bible' : ''
                            }`}
                          >
                            {/* Print-only time column */}
                            <div className="hidden print:block print-time">
                              {formatTime(block.startTime, block.endTime)}
                            </div>
                            
                            {/* Regular screen layout */}
                            <div className="flex items-center gap-3 flex-1 min-w-0 print:ml-0 print-content">
                              <div className="flex-shrink-0 print:hidden">
                                {getBlockIcon(block.blockType)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900 dark:text-foreground text-xl truncate print-title">{blockTitle}</span>
                                  {blockDetails && (
                                    <>
                                      <span className="text-gray-400 print:hidden">—</span>
                                      <span className="text-gray-600 dark:text-muted-foreground text-sm truncate print-description">{blockDetails}</span>
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center justify-between mt-0.5 print:hidden">
                                  <span className="text-gray-500 dark:text-muted-foreground text-sm">
                                    {formatTime(block.startTime, block.endTime)}
                                  </span>
                                  <button 
                                    onClick={() => updateBlockStatus(block.id, getNextStatus(getBlockStatus(block.id)))}
                                    className="hover:scale-105 transition-transform duration-150"
                                    data-testid={`button-status-${block.id}`}
                                  >
                                    {getStatusBadge(getBlockStatus(block.id))}
                                  </button>
                                </div>
                                
                                {/* Bible curriculum content for print */}
                                {block.blockType === 'bible' && (
                                  <div className="hidden print:block print-bible-reference mt-2">
                                    Genesis 1-2 (Daily Bible Reading)
                                  </div>
                                )}
                                
                                {/* Assignment details for print */}
                                {block.blockType === 'assignment' && populatedAssignmentBlocks.find(pb => pb.id === block.id)?.assignment && (
                                  <div className="hidden print:block print-description mt-2">
                                    Course: {populatedAssignmentBlocks.find(pb => pb.id === block.id)?.assignment?.courseName || 'Unknown'}
                                    {populatedAssignmentBlocks.find(pb => pb.id === block.id)?.assignment?.dueDate && (
                                      <div>Due: {new Date(populatedAssignmentBlocks.find(pb => pb.id === block.id)?.assignment?.dueDate).toLocaleDateString()}</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
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
                          blockTitle = populatedBlock.assignment.title;
                          blockDetails = populatedBlock.assignment.courseName || '';
                        } else {
                          blockTitle = 'Open Assignment Block';
                          blockDetails = '';
                        }
                      } else if (block.blockType === 'bible') {
                        blockTitle = 'Bible';
                        blockDetails = 'Genesis 1-2 (Daily Bible Reading)';
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