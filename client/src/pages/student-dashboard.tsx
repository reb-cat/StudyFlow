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
  Play
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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 p-3 sm:p-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header - Student name left, action buttons right */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent" data-testid="student-name">
            {studentName}
          </h1>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              data-testid="button-home"
              onClick={handleHomeClick}
              className="hover:bg-primary/10 transition-colors"
            >
              <Home className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              data-testid="button-settings"
              onClick={handleSettingsClick}
              className="hover:bg-primary/10 transition-colors"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              data-testid="button-theme"
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="hover:bg-primary/10 transition-colors"
            >
              <Moon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Second row - Date/Co-op + Mode toggles */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span data-testid="date-display" className="text-sm font-medium">{dateDisplay}</span>
            </div>
            {isThursday && (
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">
                Co-op Day
              </Badge>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
            {/* Date Navigation for testing (will be removed later) */}
            <div className="flex items-center gap-1 bg-muted/50 backdrop-blur-sm rounded-lg p-1 border">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPreviousDay}
                className="h-8 w-8 p-0 hover:bg-primary/10"
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
                className="h-8 w-8 p-0 hover:bg-primary/10"
                data-testid="button-next-day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Overview/Guided Mode Toggle */}
            <div className="flex items-center bg-muted/50 backdrop-blur-sm rounded-lg p-1 border">
              <Button
                variant={!isGuidedMode ? "default" : "ghost"}
                size="sm"
                onClick={() => setIsGuidedMode(false)}
                className="text-xs flex items-center gap-1 transition-all hover:scale-105"
                data-testid="button-overview-mode"
              >
                <Grid3X3 className="h-3 w-3" />
                <span className="hidden sm:inline">Overview Mode</span>
                <span className="sm:hidden">Overview</span>
              </Button>
              <Button
                variant={isGuidedMode ? "default" : "ghost"}
                size="sm"
                onClick={() => setIsGuidedMode(true)}
                className="text-xs flex items-center gap-1 transition-all hover:scale-105"
                data-testid="button-guided-mode"
              >
                <Play className="h-3 w-3" />
                <span className="hidden sm:inline">Guided Day</span>
                <span className="sm:hidden">Guided</span>
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
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span className="font-medium">Daily Progress</span>
                <span className="font-mono">0%</span>
              </div>
              <div className="w-full bg-muted/50 rounded-full h-2 shadow-inner">
                <div className="bg-gradient-to-r from-primary to-primary/80 h-2 rounded-full transition-all duration-500 shadow-sm" style={{ width: '0%' }}></div>
              </div>
            </div>

            {/* Single card with compact list layout */}
            <Card className="bg-card/50 backdrop-blur-sm border border-border/50 shadow-lg">
              <CardContent className="p-4 sm:p-5">
                <h3 className="text-lg font-bold text-foreground mb-4 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  {isToday ? "Today's" : `${dayName}'s`} Schedule
                </h3>
                  
                  <div className="space-y-1">
                    {/* Show ALL schedule blocks in chronological order with compact layout */}
                    {allScheduleBlocks
                      .sort((a, b) => a.startTime.localeCompare(b.startTime))
                      .map((block, index) => {
                        // Get appropriate icon component with theme colors
                        const getBlockIcon = (blockType: string) => {
                          const iconClass = "h-4 w-4";
                          const colorClass = {
                            'bible': 'text-purple-600 dark:text-purple-400',
                            'assignment': 'text-blue-600 dark:text-blue-400', 
                            'movement': 'text-green-600 dark:text-green-400',
                            'lunch': 'text-orange-600 dark:text-orange-400',
                            'prep/load': 'text-gray-600 dark:text-gray-400',
                            'travel': 'text-indigo-600 dark:text-indigo-400',
                            'co-op': 'text-teal-600 dark:text-teal-400'
                          }[blockType] || 'text-muted-foreground';
                          
                          const fullClass = `${iconClass} ${colorClass}`;
                          
                          switch(blockType) {
                            case 'bible': return <BookOpen className={fullClass} />;
                            case 'assignment': return <FileText className={fullClass} />;
                            case 'movement': return <Users className={fullClass} />;
                            case 'lunch': return <Utensils className={fullClass} />;
                            case 'prep/load': return <Package className={fullClass} />;
                            case 'travel': return <Car className={fullClass} />;
                            case 'co-op': return <Building2 className={fullClass} />;
                            default: return <FileText className={fullClass} />;
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
                          <div 
                            key={block.id} 
                            className={`group flex items-center justify-between py-3 px-3 rounded-lg transition-all duration-200 hover:bg-gradient-to-r hover:from-muted/30 hover:to-muted/10 hover:shadow-sm hover:scale-[1.01] ${
                              index % 2 === 0 ? 'bg-muted/10' : 'bg-background/50'
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex-shrink-0 p-2 bg-gradient-to-br from-background to-muted/30 rounded-lg border shadow-sm group-hover:shadow-md transition-shadow">
                                {getBlockIcon(block.blockType)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-foreground truncate">{blockTitle}</div>
                                {blockDetails && (
                                  <div className="text-xs text-muted-foreground truncate mt-0.5">{blockDetails}</div>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mr-3 flex-shrink-0 font-medium bg-muted/30 px-2 py-1 rounded">
                                {formatTime(block.startTime, block.endTime)}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs bg-gradient-to-r from-muted/50 to-muted/30 border-muted-foreground/20 hover:from-muted/70 hover:to-muted/50 transition-colors">
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