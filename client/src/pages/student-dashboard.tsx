import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { GuidedDayView } from '@/components/GuidedDayView';
import { AssignmentCard } from '@/components/AssignmentCard';
import { BibleBlock } from '@/components/BibleBlock';
import { FixedBlock } from '@/components/FixedBlock';
import type { Assignment } from '@shared/schema';

export default function StudentDashboard() {
  const studentName = "Demo Student";
  const [isGuidedMode, setIsGuidedMode] = useState(false);
  const [selectedDate] = useState(new Date().toISOString().split('T')[0]);
  const queryClient = useQueryClient();

  // Fetch assignments for today
  const { data: assignments = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/assignments', selectedDate],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleAssignmentUpdate = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
  };

  const todayAssignments = assignments as Assignment[];
  
  // Weekend/Break Detection 
  const today = new Date();
  const isWeekend = today.getDay() === 0 || today.getDay() === 6;
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
  const dateDisplay = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Fixed blocks for the day (sample schedule)
  const isThursday = today.getDay() === 4;
  const fixedBlocks = [
    // Bible is handled separately as it has special logic
    // Travel/prep block
    {
      id: 'travel-1',
      title: 'Travel to Co-op',
      blockType: 'travel' as const,
      startTime: '8:00',
      endTime: '8:30',
      showOnThursday: true
    },
    // Lunch break
    {
      id: 'lunch-1',
      title: 'Lunch Break',
      blockType: 'lunch' as const,
      startTime: '12:00',
      endTime: '12:30',
      showOnThursday: true
    },
    // Co-op classes (Thursday only)
    {
      id: 'coop-1',
      title: 'Co-op Classes',
      blockType: 'coop' as const,
      startTime: '9:00',
      endTime: '15:00',
      showOnThursday: true,
      thursdayOnly: true
    }
  ];

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
        
        {/* Clean Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="welcome-message">
              Welcome, {studentName}!
            </h1>
            <p className="text-lg text-muted-foreground mt-1" data-testid="date-display">
              {dateDisplay}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
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
              onAssignmentUpdate={handleAssignmentUpdate}
            />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Daily Schedule - Fixed Blocks & Assignments */}
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-4">Today's Complete Schedule</h2>
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