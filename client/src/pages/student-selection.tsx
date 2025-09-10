import { useState, useEffect } from 'react';
import { User, Settings, Clock, Calendar, Star, Camera, LogOut } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Link } from 'wouter';
import { ObjectUploader } from '@/components/ObjectUploader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/App';
import { Button } from '@/components/ui/button';

// StudyFlow theme colors - updated to match new design
const colors = {
  primary: '#6d28d8',        /* Deep violet */
  complete: '#00a348',       /* Forest green */
  progress: '#3b82f6',       /* Bright blue */
  support: '#f0ca33',        /* Golden amber */
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#212529',
  textMuted: '#6C7293',
  border: '#E9ECEF'
};

export default function FamilyDashboard() {
  const [hoveredStudent, setHoveredStudent] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  
  // Current date/time
  const now = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' };
  const dateDisplay = now.toLocaleDateString('en-US', dateOptions);
  const timeOfDay = now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening';
  const greeting = `Good ${timeOfDay}! Let's make it a great day!`;

  // Fetch student profiles
  const { data: profiles = { abigail: null, khalil: null } } = useQuery({
    queryKey: ['/api/students/profiles'],
    queryFn: async () => {
      const abigailProfile = await apiRequest('GET', '/api/students/abigail/profile').then(res => res.json()).catch(() => null);
      const khalilProfile = await apiRequest('GET', '/api/students/khalil/profile').then(res => res.json()).catch(() => null);
      return {
        abigail: abigailProfile,
        khalil: khalilProfile
      };
    }
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ studentName, uploadUrl }: { studentName: string; uploadUrl: string }) => {
      return apiRequest('POST', '/api/profile-image/complete', { uploadUrl, studentName }).then(res => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/students/profiles'] });
      setEditingStudent(null);
    }
  });

  const students = [
    { 
      id: 'abigail', 
      name: 'Abigail', 
      initial: 'A', 
      color: colors.primary,
      message: "You're doing amazing! Keep it up!",
      profileImage: profiles.abigail?.profileImageUrl
    },
    { 
      id: 'khalil', 
      name: 'Khalil', 
      initial: 'K', 
      color: colors.complete,
      message: "Ready for another great learning day!",
      profileImage: profiles.khalil?.profileImageUrl
    }
  ];

  const handleGetUploadParameters = async () => {
    const response = await apiRequest('POST', '/api/profile-image/upload');
    const data = await response.json();
    return {
      method: 'PUT' as const,
      url: data.url
    };
  };

  const handleUploadComplete = (uploadedUrl: string) => {
    if (editingStudent) {
      uploadMutation.mutate({ studentName: editingStudent, uploadUrl: uploadedUrl });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border p-5 md:px-10 flex justify-between items-center shadow-sm">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white text-2xl font-bold">
            S
          </div>
          <h1 className="text-3xl font-bold text-primary m-0">
            StudyFlow
          </h1>
        </Link>
        
        <div className="flex items-center gap-3">
          <Link
            href="/rewards"
            className="px-5 py-2.5 bg-transparent border border-border rounded-lg text-foreground text-base cursor-pointer flex items-center gap-2 transition-all duration-200 no-underline hover:bg-secondary hover:border-primary"
          >
            <Star size={18} />
            Rewards
          </Link>
          <Link
            href="/admin"
            className="px-5 py-2.5 bg-transparent border border-border rounded-lg text-foreground text-base cursor-pointer flex items-center gap-2 transition-all duration-200 no-underline hover:bg-secondary hover:border-primary"
          >
            <Settings size={18} />
            Admin
          </Link>
          <button
            onClick={async () => {
              console.log('🔴 LOGOUT BUTTON CLICKED in student-selection page');
              console.log('🔴 About to call logout function:', typeof logout);
              try {
                await logout();
                console.log('🔴 Logout function completed');
              } catch (error) {
                console.error('🔴 Logout function error:', error);
              }
            }}
            className="px-3 py-2 bg-transparent border border-border rounded-lg text-foreground text-sm cursor-pointer flex items-center gap-2 transition-all duration-200 hover:bg-secondary hover:border-primary"
            data-testid="button-logout"
          >
            <LogOut size={18} />
            Logout
          </button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-10 py-15 flex flex-col items-center gap-12">
        {/* Date and Greeting Card */}
        <div className="bg-card border border-border rounded-2xl px-12 py-8 text-center max-w-4xl w-full shadow-lg mt-8">
          <div className="text-muted-foreground text-sm font-medium mb-3 flex items-center justify-center gap-2">
            <Calendar size={16} />
            {dateDisplay.toUpperCase()}
          </div>
          <h2 className="text-3xl text-primary font-semibold m-0">
            {greeting}
          </h2>
        </div>

        {/* Student Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
          {students.map((student) => (
            <Link
              key={student.id}
              href={`/student/${student.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div
                onMouseEnter={() => setHoveredCard(student.id)}
                onMouseLeave={() => setHoveredCard(null)}
                className={`bg-card rounded-3xl p-8 text-center cursor-pointer transition-all duration-300 border-2 ${
                  (hoveredStudent === student.id || hoveredCard === student.id)
                    ? '-translate-y-1 shadow-xl' 
                    : 'shadow-sm'
                }`}
                style={{
                  borderColor: (hoveredStudent === student.id || hoveredCard === student.id) ? student.color : 'var(--border)',
                  boxShadow: (hoveredStudent === student.id || hoveredCard === student.id)
                    ? `0 12px 32px ${student.color}20` 
                    : undefined
                }}
              >
                {/* Student Avatar */}
                <div 
                  onMouseEnter={() => setHoveredStudent(student.id)}
                  onMouseLeave={() => setHoveredStudent(null)}
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5 text-white text-4xl font-bold overflow-hidden relative cursor-pointer"
                  style={{
                    backgroundColor: student.color,
                    boxShadow: `0 4px 12px ${student.color}30`
                  }}>
                  {student.profileImage ? (
                    <img 
                      src={student.profileImage} 
                      alt={student.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    student.initial
                  )}
                  
                  {/* Edit overlay */}
                  {hoveredStudent === student.id && (
                    <div
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingStudent(student.id);
                      }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        borderRadius: '50%'
                      }}
                    >
                      <Camera size={24} color="white" />
                    </div>
                  )}
                </div>

                {/* Student Name */}
                <h3 className="text-3xl font-semibold text-foreground mb-3">
                  {student.name}
                </h3>

                {/* Motivational Message */}
                <p className="text-muted-foreground text-base mb-6 min-h-6">
                  {student.message}
                </p>

                {/* Let's Go Button */}
                <button
                  data-testid={`button-select-${student.id}`}
                  className="w-full py-3.5 px-6 rounded-xl text-lg font-semibold cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 border-2"
                  style={{
                    backgroundColor: (hoveredStudent === student.id || hoveredCard === student.id) ? student.color : 'var(--background)',
                    borderColor: student.color,
                    color: (hoveredStudent === student.id || hoveredCard === student.id) ? 'white' : student.color
                  }}
                >
                  Let's Go!
                  <Star size={20} />
                </button>
              </div>
            </Link>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="p-8 text-center text-muted-foreground text-sm border-t border-border bg-card">
        <div className="flex items-center justify-center gap-2">
          StudyFlow
          <span className="text-primary">•</span>
          Built for focused learning
        </div>
      </footer>

      {/* Upload Modal */}
      {editingStudent && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)'
          }}>
            <h3 style={{ 
              margin: '0 0 20px 0', 
              fontSize: '20px', 
              fontWeight: '600',
              color: colors.text,
              textAlign: 'center'
            }}>
              Update {editingStudent.charAt(0).toUpperCase() + editingStudent.slice(1)}'s Profile Photo
            </h3>
            
            <ObjectUploader
              onGetUploadParameters={handleGetUploadParameters}
              onComplete={handleUploadComplete}
              accept="image/*"
              maxFileSize={5 * 1024 * 1024} // 5MB
              buttonClassName="dark-cta-button"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={18} />
                Choose Photo
              </div>
            </ObjectUploader>

            <button
              onClick={() => setEditingStudent(null)}
              style={{
                marginTop: '16px',
                width: '100%',
                padding: '12px',
                backgroundColor: 'transparent',
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.textMuted,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}