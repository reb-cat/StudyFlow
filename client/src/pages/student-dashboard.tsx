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
  ArrowLeft
} from 'lucide-react';
import { Link, useParams } from 'wouter';
import { GuidedDayView } from '@/components/GuidedDayView';
import { AssignmentCard } from '@/components/AssignmentCard';
import { FixedBlock } from '@/components/FixedBlock';
import type { Assignment } from '@shared/schema';

export default function StudentDashboard() {
  const params = useParams<{ student: string }>();
  // Capitalize student name for consistency, default to Abigail if no student provided
  const studentName = params.student ? params.student.charAt(0).toUpperCase() + params.student.slice(1) : "Abigail";
  const [isGuidedMode, setIsGuidedMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    // Always start with today's date 
    const today = new Date();
    return today.toISOString().split('T')[0];
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

  const handleAssignmentUpdate = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['/api/assignments', selectedDate, studentName] });
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

  // Fill assignment blocks with available assignments (round-robin if more blocks than assignments)
  const populatedAssignmentBlocks = assignmentBlocks.map((block, index) => {
    const assignmentIndex = assignments.length > 0 ? index % assignments.length : -1;
    const assignment = assignmentIndex >= 0 ? assignments[assignmentIndex] : null;
    
    return {
      ...block,
      assignment: assignment
    };
  });

  if (isWeekend) {
    return (
      <div className="min-h-screen bg-background p-6">
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
      <div className="min-h-screen bg-background p-6">
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-blue-900 p-4">
      <div className="max-w-5xl mx-auto">
        
        {/* Minimal Header - Just Theme Toggle */}
        <div className="flex justify-end mb-4">
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
            {/* Progress Bar - Apple Fitness style */}
            <div className="bg-white dark:bg-card rounded-xl p-4 border border-gray-200 dark:border-border/50">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium text-muted-foreground">Daily Progress</span>
                <span className="font-medium text-muted-foreground">0%</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-muted rounded-full h-1">
                <div className="bg-blue-500 h-1 rounded-full transition-all duration-500" style={{ width: '0%' }}></div>
              </div>
            </div>

            {/* Schedule Card - Compact Apple style */}
            <Card className="bg-white dark:bg-card rounded-xl border border-gray-200 dark:border-border/50">
              <CardContent className="p-4">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  {isToday ? "Today's" : `${dayName}'s`} Schedule
                </h3>
                  
                  <div className="space-y-1">
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
                            className="group flex items-center justify-between py-2.5 px-3 hover:bg-gray-50 dark:hover:bg-muted/30 rounded-lg transition-colors duration-150"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex-shrink-0">
                                {getBlockIcon(block.blockType)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900 dark:text-foreground text-base truncate">{blockTitle}</span>
                                  {blockDetails && (
                                    <>
                                      <span className="text-gray-400">—</span>
                                      <span className="text-gray-600 dark:text-muted-foreground text-sm truncate">{blockDetails}</span>
                                    </>
                                  )}
                                </div>
                                <div className="flex items-center justify-between mt-0.5">
                                  <span className="text-gray-500 dark:text-muted-foreground text-sm">
                                    {formatTime(block.startTime, block.endTime)}
                                  </span>
                                  <Badge variant="outline" className="text-xs px-2 py-0.5 bg-gray-50 dark:bg-muted/30 text-gray-600 dark:text-muted-foreground border-gray-200 dark:border-border/50 rounded-md">
                                    not started
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
          </div>
        )}
      </div>
    </div>
  );
}