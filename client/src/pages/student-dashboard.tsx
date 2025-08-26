import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, BookOpen, Target, Clock, Plus, User } from 'lucide-react';
import { GuidedDayView } from '@/components/GuidedDayView';
import { AssignmentCard } from '@/components/AssignmentCard';
import type { Assignment } from '@shared/schema';

export default function StudentDashboard() {
  const studentName = "Demo Student";
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
  const completedCount = todayAssignments.filter(a => a.completionStatus === 'completed').length;
  const totalCount = todayAssignments.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Weekend/Break Detection (from your TutorFlow features)
  const today = new Date();
  const isWeekend = today.getDay() === 0 || today.getDay() === 6;
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });

  if (isWeekend) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
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
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <User className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {studentName}!</h1>
            <p className="text-muted-foreground">Loading your assignments...</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-muted rounded w-1/2 mx-auto"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6" data-testid="student-dashboard">
      {/* Header with Progress */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <User className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="welcome-message">
              Welcome back, {studentName}!
            </h1>
            <p className="text-muted-foreground" data-testid="date-display">
              {today.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-bold text-primary" data-testid="progress-percentage">
              {progressPercentage}%
            </div>
            <div className="text-sm text-muted-foreground" data-testid="progress-text">
              {completedCount} of {totalCount} complete
            </div>
          </div>
          <div className="w-16 h-16 relative">
            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
              <circle
                cx="32" cy="32" r="28"
                fill="none" stroke="currentColor"
                strokeWidth="4" className="text-muted-foreground/20"
              />
              <circle
                cx="32" cy="32" r="28"
                fill="none" stroke="currentColor"
                strokeWidth="4" className="text-primary"
                strokeDasharray={`${progressPercentage * 1.75} 175`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4 flex items-center gap-3">
            <Calendar className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-blue-600">Today's Tasks</p>
              <p className="text-2xl font-bold text-blue-800" data-testid="total-assignments">
                {totalCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardContent className="p-4 flex items-center gap-3">
            <Target className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-green-600">Completed</p>
              <p className="text-2xl font-bold text-green-800" data-testid="completed-assignments">
                {completedCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-orange-600" />
            <div>
              <p className="text-sm text-orange-600">Need Help</p>
              <p className="text-2xl font-bold text-orange-800" data-testid="stuck-assignments">
                {todayAssignments.filter(a => a.completionStatus === 'stuck').length}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardContent className="p-4 flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-purple-600">Subjects</p>
              <p className="text-2xl font-bold text-purple-800" data-testid="unique-subjects">
                {new Set(todayAssignments.map(a => a.subject).filter(Boolean)).size}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="guided" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="guided" className="flex items-center gap-2" data-testid="tab-guided">
            <Target className="h-4 w-4" />
            Guided Mode
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
            <Calendar className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2" data-testid="tab-manage">
            <BookOpen className="h-4 w-4" />
            Manage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="guided" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Guided Study Mode
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Step-by-step guidance through your assignments. Focus on one task at a time with built-in breaks and executive function support.
              </p>
            </CardHeader>
            <CardContent>
              <GuidedDayView
                assignments={todayAssignments}
                studentName={studentName}
                onAssignmentUpdate={handleAssignmentUpdate}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Today's Assignments
              </CardTitle>
              <Badge variant="outline" data-testid="assignment-count-badge">
                {totalCount} assignments
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {todayAssignments.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No assignments for today</h3>
                  <p className="text-muted-foreground">
                    Great job staying on top of your work! Enjoy your free time.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {todayAssignments.map((assignment) => (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      onUpdate={handleAssignmentUpdate}
                      variant="compact"
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Assignment Management
              </CardTitle>
              <Button size="sm" className="flex items-center gap-2" data-testid="button-add-assignment">
                <Plus className="h-4 w-4" />
                Add Assignment
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {todayAssignments.length === 0 ? (
                <div className="text-center py-8">
                  <Plus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium text-foreground mb-2">No assignments yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add your first assignment to get started with StudyFlow.
                  </p>
                  <Button className="flex items-center gap-2" data-testid="button-add-first-assignment">
                    <Plus className="h-4 w-4" />
                    Add Your First Assignment
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {todayAssignments.map((assignment) => (
                    <AssignmentCard
                      key={assignment.id}
                      assignment={assignment}
                      onUpdate={handleAssignmentUpdate}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}