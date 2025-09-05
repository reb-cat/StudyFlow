import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  User, 
  Settings, 
  Calendar, 
  CheckCircle, 
  AlertCircle,
  Clock,
  Printer,
  ChevronRight,
  FileText,
  HelpCircle,
  Play,
  Grid3X3
} from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

// StudyFlow theme colors using updated CSS custom properties
const colors = {
  primary: 'hsl(263, 71%, 50%)',        /* Deep violet #6d28d8 */
  complete: 'hsl(142, 100%, 32%)',      /* Forest green #00a348 */
  progress: 'hsl(213, 94%, 60%)',       /* Bright blue #3b82f6 */
  support: 'hsl(45, 86%, 57%)',         /* Golden amber #f0ca33 */
  background: 'var(--background)',
  surface: 'var(--card)',
  text: 'var(--foreground)',
  textMuted: 'var(--muted-foreground)',
  border: 'var(--border)'
};

export default function FamilyDashboard() {
  // Timezone-safe New York date string function
  const toNYDateString = (d = new Date()) => {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(d);
    const y = p.find(x=>x.type==='year')!.value, m=p.find(x=>x.type==='month')!.value, da=p.find(x=>x.type==='day')!.value;
    return `${y}-${m}-${da}`;
  };

  const [selectedDate, setSelectedDate] = useState(toNYDateString());
  
  // Fetch family dashboard data from API
  const { data: apiData, isLoading, error } = useQuery({
    queryKey: ['/api/family/dashboard'],
    refetchInterval: 30000, // Refresh every 30 seconds for real-time updates
    staleTime: 0, // Always consider data stale so it refetches
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading family dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state or no data
  if (error || !apiData) {
    return (
      <div className="min-h-screen bg-background p-4 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-muted-foreground mb-2">Unable to load dashboard data</p>
          <p className="text-sm text-muted-foreground/60">Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  // Transform API data to match component expectations
  const dashboardData = {
    students: (apiData?.students || []).map((student: any) => ({
      id: student.studentName,
      name: student.profile?.displayName || (student.studentName.charAt(0).toUpperCase() + student.studentName.slice(1)),
      initial: (student.profile?.displayName || student.studentName)[0].toUpperCase(),
      profileImage: student.profile?.profileImageUrl,
      currentMode: student.currentMode || 'overview',
      todayStats: {
        completed: student.completedToday || 0,
        total: student.totalToday || 0,
        inProgress: student.currentAssignmentTitle || 'No current assignment',
        minutesWorked: student.minutesWorkedToday || 0,
        targetMinutes: student.targetMinutesToday || 180
      },
      flags: {
        stuck: student.isStuck || false,
        needsHelp: student.needsHelp || false,
        overtimeOnTask: student.isOvertimeOnTask || false
      }
    })),
    
    // Items ready for parent review/printing (placeholder for now)
    printQueue: [
      // Will be populated from real print queue data when integrated
    ],
    
    // Assignments that need parent attention from API
    needsReview: apiData?.needsReview || []
  };

  const getTotalFlags = (student: any) => {
    return Object.values(student.flags).filter(Boolean).length;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border py-5 px-10">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white text-xl font-bold">
              S
            </div>
            <h1 className="text-2xl font-bold text-primary m-0">
              StudyFlow Family
            </h1>
          </div>
          
          <div className="flex gap-3 items-center">
            {/* Print Queue */}
            <button 
              onClick={() => window.location.href = '/print-queue'}
              className={`px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 text-foreground relative ${
                dashboardData.printQueue.length > 0 
                  ? 'bg-primary/10 border border-primary' 
                  : 'bg-transparent border border-border'
              }`}
            >
              <Printer size={18} />
              Print Queue
              {dashboardData.printQueue.length > 0 && (
                <span className="bg-primary text-primary-foreground rounded-md px-1.5 py-0.5 text-xs font-bold">
                  {dashboardData.printQueue.length}
                </span>
              )}
            </button>
            
            {/* Admin */}
            <button 
              onClick={() => window.location.href = '/admin'}
              className="px-4 py-2 bg-transparent border border-border rounded-lg cursor-pointer flex items-center gap-2 text-foreground"
            >
              <Settings size={18} />
              Admin
            </button>
            
            {/* Theme Toggle */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-10">
        {/* Date and Overview */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Calendar size={24} className="text-primary" />
            <h2 className="text-3xl font-semibold text-foreground m-0">
              {new Date(selectedDate + 'T12:00:00.000Z').toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </h2>
          </div>
          
          {/* Quick Stats */}
          <div className="flex gap-6 mt-4">
            <div className="flex items-center gap-2">
              <CheckCircle size={20} style={{ color: 'var(--success)' }} />
              <span className="text-foreground">
                <strong>{apiData?.stats?.totalCompleted || 0}</strong> tasks completed
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={20} className="text-accent" />
              <span className="text-foreground">
                <strong>{apiData?.stats?.totalRemaining || 0}</strong> tasks remaining
              </span>
            </div>
            {dashboardData.needsReview.length > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle size={20} className="text-muted-foreground" />
                <span className="text-muted-foreground">
                  <strong>{dashboardData.needsReview.length}</strong> need attention
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Student Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
          {dashboardData.students.map((student: any) => {
            const flagCount = getTotalFlags(student);
            const progressPercent = (student.todayStats.completed / student.todayStats.total) * 100;
            
            return (
              <div
                key={student.id}
                className={`bg-card rounded-xl p-6 relative ${
                  flagCount > 0 ? 'border-2 border-muted-foreground' : 'border-2 border-border'
                }`}
              >
                {/* Alert indicator */}
                {flagCount > 0 && (
                  <div className="absolute -top-2 right-5 bg-muted-foreground text-white px-3 py-1 rounded-xl text-xs font-bold">
                    Needs Attention
                  </div>
                )}
                
                {/* Student Header */}
                <div className="flex justify-between items-start mb-5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-2xl font-bold">
                      {student.initial}
                    </div>
                    <div>
                      <h3 className="text-2xl font-semibold text-foreground m-0 mb-1">
                        {student.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        {student.currentMode === 'guided' ? (
                          <Play size={16} style={{ color: colors.progress }} />
                        ) : (
                          <Grid3X3 size={16} style={{ color: colors.complete }} />
                        )}
                        <span className="text-muted-foreground text-sm">
                          {student.currentMode === 'guided' ? 'Guided Mode' : 'Overview Mode'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Go to Dashboard Button */}
                  <button
                    onClick={() => window.location.href = `/student/${student.id}`}
                    className="px-4 py-2 bg-primary border-none rounded-lg text-primary-foreground cursor-pointer flex items-center gap-1.5 text-sm font-medium"
                  >
                    Open Dashboard
                    <ChevronRight size={16} />
                  </button>
                </div>
                
                {/* Current Activity */}
                <div className="bg-background rounded-lg p-3 mb-4">
                  <div className="text-xs text-muted-foreground mb-1">
                    Currently Working On:
                  </div>
                  <div className="text-base text-foreground font-medium">
                    {student.todayStats.inProgress}
                  </div>
                  {student.flags.overtimeOnTask && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <AlertCircle size={12} />
                      Over estimated time
                    </div>
                  )}
                </div>
                
                {/* Progress */}
                <div className="mb-4">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      Daily Progress
                    </span>
                    <span className="text-sm text-foreground font-medium">
                      {student.todayStats.completed}/{student.todayStats.total} tasks
                    </span>
                  </div>
                  <div className="h-2 bg-border rounded overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        flagCount > 0 ? 'bg-gold' : 'bg-emerald'
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
                
                {/* Flags */}
                {flagCount > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {student.flags.stuck && (
                      <span className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs font-medium flex items-center gap-1">
                        <HelpCircle size={12} />
                        Stuck
                      </span>
                    )}
                    {student.flags.overtimeOnTask && (
                      <span className="px-2 py-1 bg-gold/20 text-gold rounded text-xs font-medium">
                        Overtime
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Needs Review Section */}
        {dashboardData.needsReview.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <AlertCircle size={20} className="text-muted-foreground" />
              Needs Your Attention
            </h3>
            
            <div className="grid gap-3">
              {dashboardData.needsReview.map((item: any, index: number) => (
                <div
                  key={index}
                  className="p-3 bg-background rounded-lg flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium text-foreground mb-1">
                      {item.student}: {item.assignment}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {item.issue}
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}