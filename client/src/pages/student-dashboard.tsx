import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
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
  const { data: scheduleTemplate = [] } = useQuery({
    queryKey: ['/api/schedule', studentName, selectedDate],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleAssignmentUpdate = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
  };

  const todayAssignments = assignments as Assignment[];
  
  console.log('Schedule template data:', { studentName, selectedDate, scheduleTemplate });
  
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

  // Use real schedule template data from database
  const allScheduleBlocks = scheduleTemplate.map((block: any) => ({
    id: block.id,
    title: block.subject,
    blockType: block.blockType.toLowerCase(),
    startTime: block.startTime.substring(0, 5), // Remove seconds from HH:MM:SS
    endTime: block.endTime.substring(0, 5),
    blockNumber: block.blockNumber,
    subject: block.subject
  }));

  // Separate Bible blocks from other fixed blocks
  const bibleBlocks = allScheduleBlocks.filter((block: any) => block.blockType === 'bible');
  const fixedBlocks = allScheduleBlocks.filter((block: any) => 
    ['travel', 'co-op', 'prep/load', 'movement', 'lunch'].includes(block.blockType)
  );
  const assignmentBlocks = allScheduleBlocks.filter((block: any) => block.blockType === 'assignment');

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
        
        {/* Clean Header with Date Navigation */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="welcome-message">
              Welcome, {studentName}!
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-lg text-muted-foreground" data-testid="date-display">
                {dateDisplay}
              </p>
              {!isToday && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  className="text-xs"
                  data-testid="button-go-to-today"
                >
                  Go to Today
                </Button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Date Navigation */}
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="flex items-center gap-2"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            
            {/* Simple Toggle - Just like your dashboards */}
            <div className="flex items-center bg-muted rounded-lg p-1">
              <Button
                variant={!isGuidedMode ? "default" : "ghost"}
                size="sm"
                onClick={() => setIsGuidedMode(false)}
                className="text-sm"
                data-testid="button-overview-mode"
              >
                Overview
              </Button>
              <Button
                variant={isGuidedMode ? "default" : "ghost"}
                size="sm"
                onClick={() => setIsGuidedMode(true)}
                className="text-sm"
                data-testid="button-guided-mode"
              >
                Guided
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
            {/* Daily Schedule - Fixed Blocks & Assignments */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {isToday ? "Today's" : `${dayName}'s`} Complete Schedule
                {!isToday && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({selectedDateObj.toLocaleDateString()})
                  </span>
                )}
              </h2>
              <div className="space-y-4">
                {/* Bible Block - always first (except Thursday has different time) */}
                <BibleBlock 
                  date={selectedDate}
                  blockStart={isThursday ? "8:30" : "9:00"}
                  blockEnd={isThursday ? "8:50" : "9:20"}
                />
                
                {/* Fixed Blocks */}
                {fixedBlocks
                  .filter(block => !block.thursdayOnly || (block.thursdayOnly && isThursday))
                  .map((block) => (
                    <FixedBlock
                      key={block.id}
                      blockId={block.id}
                      title={block.title}
                      blockType={block.blockType}
                      blockStart={block.startTime}
                      blockEnd={block.endTime}
                      date={selectedDate}
                    />
                  ))}
                
                {/* Assignment Blocks */}
                {todayAssignments.length === 0 ? (
                  <Card className="bg-card border border-border">
                    <CardContent className="p-8 text-center">
                      <h3 className="text-lg font-semibold text-foreground mb-2">No assignments for today</h3>
                      <p className="text-muted-foreground">Great job staying on top of your work! 🎉</p>
                    </CardContent>
                  </Card>
                ) : (
                  todayAssignments
                    .sort((a, b) => (a.scheduledBlock || 0) - (b.scheduledBlock || 0))
                    .map((assignment) => (
                      <AssignmentCard
                        key={assignment.id}
                        assignment={assignment}
                        onUpdate={handleAssignmentUpdate}
                        variant="compact"
                      />
                    ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}