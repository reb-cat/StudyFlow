import { useState } from 'react';
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
  Building2
} from 'lucide-react';
import { GuidedDayView } from '@/components/GuidedDayView';
import { AssignmentCard } from '@/components/AssignmentCard';
import { BibleBlock } from '@/components/BibleBlock';
import { FixedBlock } from '@/components/FixedBlock';
import type { Assignment } from '@shared/schema';

export default function StudentDashboard() {
  const studentName = "Abigail"; // Use actual student name from database
  const [isGuidedMode, setIsGuidedMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const queryClient = useQueryClient();

  // Fetch assignments for today
  const { data: assignments = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/assignments', selectedDate],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Fetch schedule template for the student and date
  const { data: scheduleTemplate = [] } = useQuery<any[]>({
    queryKey: ['/api/schedule', studentName, selectedDate],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleAssignmentUpdate = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
  };

  const todayAssignments = assignments as Assignment[];
  
  
  // Date utilities
  const selectedDateObj = new Date(selectedDate);
  const today = new Date();
  const isToday = selectedDate === today.toISOString().split('T')[0];
  const isWeekend = selectedDateObj.getDay() === 0 || selectedDateObj.getDay() === 6;
  const dayName = selectedDateObj.toLocaleDateString('en-US', { weekday: 'long' });
  const dateDisplay = selectedDateObj.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
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
    blockType: block.block_type?.toLowerCase() || 'unknown',
    startTime: block.start_time?.substring(0, 5) || '00:00', // Remove seconds from HH:MM:SS
    endTime: block.end_time?.substring(0, 5) || '00:00',
    blockNumber: block.block_number,
    subject: block.subject
  }));

  // Separate Bible blocks from other fixed blocks using real data
  const bibleBlocks = allScheduleBlocks.filter((block) => block.blockType === 'bible');
  const fixedBlocks = allScheduleBlocks.filter((block) => 
    ['travel', 'co-op', 'prep/load', 'movement', 'lunch'].includes(block.blockType)
  );
  const assignmentBlocks = allScheduleBlocks.filter((block) => block.blockType === 'assignment');

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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Header - Student name left, action buttons right */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-foreground" data-testid="student-name">
            {studentName}
          </h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" data-testid="button-home">
              <Home className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" data-testid="button-settings">
              <Settings className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" data-testid="button-theme">
              <Moon className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Second row - Date/Co-op + Mode toggles */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span data-testid="date-display">{dateDisplay}</span>
            </div>
            {isThursday && (
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Co-op Day
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {/* Date Navigation for testing (will be removed later) */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPreviousDay}
                className="h-8 w-8 p-0"
                data-testid="button-previous-day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="px-2 text-sm font-medium min-w-[80px] text-center">
                {isToday ? 'Today' : dayName}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={goToNextDay}
                className="h-8 w-8 p-0"
                data-testid="button-next-day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Overview/Guided Mode Toggle */}
            <div className="flex items-center bg-muted rounded-lg p-1">
              <Button
                variant={!isGuidedMode ? "default" : "ghost"}
                size="sm"
                onClick={() => setIsGuidedMode(false)}
                className="text-sm"
                data-testid="button-overview-mode"
              >
                👁 Overview Mode
              </Button>
              <Button
                variant={isGuidedMode ? "default" : "ghost"}
                size="sm"
                onClick={() => setIsGuidedMode(true)}
                className="text-sm"
                data-testid="button-guided-mode"
              >
                ▶ Guided Day
              </Button>
            </div>
          </div>
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
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>0 of {allScheduleBlocks.length} blocks completed</span>
                <span>0%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '0%' }}></div>
              </div>
            </div>

            {/* Single card with compact list layout matching screenshot */}
            <Card className="bg-card border border-border">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  {isToday ? "Today's" : `${dayName}'s`} Schedule
                </h3>
                  
                  <div className="space-y-3">
                    {/* Show ALL schedule blocks in chronological order with compact layout */}
                    {allScheduleBlocks
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((block) => {
                        // Get appropriate icon component (simple, ADHD-friendly)
                        const getBlockIcon = (blockType: string) => {
                          const iconClass = "h-4 w-4 text-muted-foreground";
                          switch(blockType) {
                            case 'bible': return <BookOpen className={iconClass} />;
                            case 'assignment': return <FileText className={iconClass} />;
                            case 'movement': return <Users className={iconClass} />;
                            case 'lunch': return <Utensils className={iconClass} />;
                            case 'prep/load': return <Package className={iconClass} />;
                            case 'travel': return <Car className={iconClass} />;
                            case 'co-op': return <Building2 className={iconClass} />;
                            default: return <FileText className={iconClass} />;
                          }
                        };
                        
                        const formatTime = (start: string, end: string) => {
                          const formatTimeString = (timeStr: string) => {
                            const [hours, minutes] = timeStr.split(':');
                            const hour = parseInt(hours);
                            const ampm = hour >= 12 ? 'PM' : 'AM';
                            const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
                            return `${displayHour}:${minutes} ${ampm}`;
                          };
                          return `${formatTimeString(start)}–${formatTimeString(end)}`;
                        };
                        
                        // Get block title and details
                        let blockTitle = block.title;
                        let blockDetails = '';
                        
                        if (block.blockType === 'assignment') {
                          const matchingAssignment = todayAssignments.find(
                            assignment => assignment.scheduledBlock === block.blockNumber
                          );
                          if (matchingAssignment) {
                            blockTitle = 'Assignment';
                            blockDetails = matchingAssignment.title;
                          } else {
                            blockTitle = 'Assignment';
                            blockDetails = 'Assignment Assignment';
                          }
                        } else if (block.blockType === 'bible') {
                          blockTitle = 'Bible';
                          blockDetails = 'Daily Bible Reading';
                        }
                        
                        return (
                          <div key={block.id} className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-3 flex-1">
                              <div className="flex-shrink-0">{getBlockIcon(block.blockType)}</div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-foreground">{blockTitle}</div>
                                {blockDetails && (
                                  <div className="text-sm text-muted-foreground truncate">{blockDetails}</div>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground mr-4 flex-shrink-0">
                                {formatTime(block.startTime, block.endTime)}
                              </div>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              not started
                            </Badge>
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