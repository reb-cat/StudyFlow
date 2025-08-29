import { useState } from 'react';
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

// Your color system
const colors = {
  primary: '#844FC1',
  complete: '#21BF06',
  progress: '#3B86D1',
  support: '#6C7293',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#212529',
  textMuted: '#6C7293',
  border: '#E9ECEF'
};

export default function FamilyDashboard() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  // This data would come from your backend
  // Showing sample structure for integration reference
  const dashboardData = {
    students: [
      { 
        id: 'abigail',
        name: 'Abigail',
        initial: 'A',
        profileImage: null,
        currentMode: 'overview', // 'overview' or 'guided'
        todayStats: {
          completed: 2,
          total: 6,
          inProgress: 'Math - Algebra Practice',
          minutesWorked: 45,
          targetMinutes: 180
        },
        flags: {
          stuck: false,
          needsHelp: false,
          overtimeOnTask: false
        }
      },
      { 
        id: 'khalil',
        name: 'Khalil', 
        initial: 'K',
        profileImage: null,
        currentMode: 'guided',
        todayStats: {
          completed: 1,
          total: 5,
          inProgress: 'Science Lab Report',
          minutesWorked: 30,
          targetMinutes: 150
        },
        flags: {
          stuck: true, // This would trigger from Guided Mode "Stuck" button
          needsHelp: false,
          overtimeOnTask: true // Been on same task > estimated time
        }
      }
    ],
    
    // Items ready for parent review/printing
    printQueue: [
      { id: '1', student: 'Abigail', title: 'Math Worksheet', type: 'worksheet', pages: 2 },
      { id: '2', student: 'Khalil', title: 'Science Lab Instructions', type: 'instructions', pages: 1 },
      { id: '3', student: 'Abigail', title: 'Weekly Schedule', type: 'schedule', pages: 1 }
    ],
    
    // Assignments that need parent attention
    needsReview: [
      { student: 'Khalil', assignment: 'Science Lab Report', issue: 'Marked as stuck for 20+ minutes' },
      { student: 'Abigail', assignment: 'History Essay', issue: 'Due tomorrow - not started' }
    ]
  };

  const getTotalFlags = (student: any) => {
    return Object.values(student.flags).filter(Boolean).length;
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        padding: '20px 40px'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              backgroundColor: colors.primary,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '20px',
              fontWeight: 'bold'
            }}>
              S
            </div>
            <h1 style={{ 
              fontSize: '24px', 
              fontWeight: 'bold',
              color: colors.primary,
              margin: 0
            }}>
              StudyFlow Family
            </h1>
          </div>
          
          <div style={{ display: 'flex', gap: '12px' }}>
            {/* Print Queue */}
            <button 
              onClick={() => window.location.href = '/print-queue'}
              style={{
                padding: '8px 16px',
                backgroundColor: dashboardData.printQueue.length > 0 ? '#F4F0FA' : 'transparent',
                border: `1px solid ${dashboardData.printQueue.length > 0 ? colors.primary : colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: colors.text,
                position: 'relative'
              }}
            >
              <Printer size={18} />
              Print Queue
              {dashboardData.printQueue.length > 0 && (
                <span style={{
                  backgroundColor: colors.primary,
                  color: 'white',
                  borderRadius: '10px',
                  padding: '2px 6px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {dashboardData.printQueue.length}
                </span>
              )}
            </button>
            
            {/* Admin */}
            <button 
              onClick={() => window.location.href = '/admin'}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: colors.text
              }}
            >
              <Settings size={18} />
              Admin
            </button>
          </div>
        </div>
      </header>

      <main style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '40px'
      }}>
        {/* Date and Overview */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <Calendar size={24} color={colors.primary} />
            <h2 style={{ 
              fontSize: '28px', 
              fontWeight: '600',
              color: colors.text,
              margin: 0
            }}>
              {new Date(selectedDate + 'T12:00:00.000Z').toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </h2>
          </div>
          
          {/* Quick Stats */}
          <div style={{ display: 'flex', gap: '24px', marginTop: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={20} color={colors.complete} />
              <span style={{ color: colors.text }}>
                <strong>3</strong> tasks completed
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} color={colors.progress} />
              <span style={{ color: colors.text }}>
                <strong>8</strong> tasks remaining
              </span>
            </div>
            {dashboardData.needsReview.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={20} color={colors.support} />
                <span style={{ color: colors.support }}>
                  <strong>{dashboardData.needsReview.length}</strong> need attention
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Student Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '24px',
          marginBottom: '40px'
        }}>
          {dashboardData.students.map(student => {
            const flagCount = getTotalFlags(student);
            const progressPercent = (student.todayStats.completed / student.todayStats.total) * 100;
            
            return (
              <div
                key={student.id}
                style={{
                  backgroundColor: colors.surface,
                  border: `2px solid ${flagCount > 0 ? colors.support : colors.border}`,
                  borderRadius: '12px',
                  padding: '24px',
                  position: 'relative'
                }}
              >
                {/* Alert indicator */}
                {flagCount > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '20px',
                    backgroundColor: colors.support,
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    Needs Attention
                  </div>
                )}
                
                {/* Student Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                      width: '56px',
                      height: '56px',
                      backgroundColor: colors.primary,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '24px',
                      fontWeight: 'bold'
                    }}>
                      {student.initial}
                    </div>
                    <div>
                      <h3 style={{ 
                        fontSize: '22px', 
                        fontWeight: '600',
                        color: colors.text,
                        margin: '0 0 4px 0'
                      }}>
                        {student.name}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {student.currentMode === 'guided' ? (
                          <Play size={16} color={colors.progress} />
                        ) : (
                          <Grid3X3 size={16} color={colors.progress} />
                        )}
                        <span style={{ color: colors.textMuted, fontSize: '14px' }}>
                          {student.currentMode === 'guided' ? 'Guided Mode' : 'Overview Mode'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Go to Dashboard Button */}
                  <button
                    onClick={() => window.location.href = `/student/${student.id}`}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: colors.primary,
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '14px',
                      fontWeight: '500'
                    }}
                  >
                    Open Dashboard
                    <ChevronRight size={16} />
                  </button>
                </div>
                
                {/* Current Activity */}
                <div style={{
                  backgroundColor: colors.background,
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '16px'
                }}>
                  <div style={{ fontSize: '12px', color: colors.textMuted, marginBottom: '4px' }}>
                    Currently Working On:
                  </div>
                  <div style={{ fontSize: '16px', color: colors.text, fontWeight: '500' }}>
                    {student.todayStats.inProgress}
                  </div>
                  {student.flags.overtimeOnTask && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: colors.support, 
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <AlertCircle size={12} />
                      Over estimated time
                    </div>
                  )}
                </div>
                
                {/* Progress */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', color: colors.textMuted }}>
                      Daily Progress
                    </span>
                    <span style={{ fontSize: '14px', color: colors.text, fontWeight: '500' }}>
                      {student.todayStats.completed}/{student.todayStats.total} tasks
                    </span>
                  </div>
                  <div style={{
                    height: '8px',
                    backgroundColor: colors.border,
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${progressPercent}%`,
                      height: '100%',
                      backgroundColor: flagCount > 0 ? colors.support : colors.complete,
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
                
                {/* Flags */}
                {flagCount > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {student.flags.stuck && (
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: '#F1F2F5',
                        color: colors.support,
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <HelpCircle size={12} />
                        Stuck
                      </span>
                    )}
                    {student.flags.overtimeOnTask && (
                      <span style={{
                        padding: '4px 8px',
                        backgroundColor: '#FFF9E6',
                        color: '#F59E0B',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500'
                      }}>
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
          <div style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            padding: '24px'
          }}>
            <h3 style={{ 
              fontSize: '20px', 
              fontWeight: '600',
              color: colors.text,
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={20} color={colors.support} />
              Needs Your Attention
            </h3>
            
            <div style={{ display: 'grid', gap: '12px' }}>
              {dashboardData.needsReview.map((item, index) => (
                <div
                  key={index}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: colors.background,
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: '500', color: colors.text, marginBottom: '4px' }}>
                      {item.student}: {item.assignment}
                    </div>
                    <div style={{ color: colors.support, fontSize: '14px' }}>
                      {item.issue}
                    </div>
                  </div>
                  <ChevronRight size={20} color={colors.textMuted} />
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}