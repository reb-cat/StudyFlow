import { useState, useEffect } from 'react';
import { User, Settings, Clock, Calendar, Star, Camera } from 'lucide-react';
import { Link } from 'wouter';
import { ObjectUploader } from '@/components/ObjectUploader';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Your color system - matching the guided view
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

export default function StudentSelection() {
  const [hoveredStudent, setHoveredStudent] = useState<string | null>(null);
  const [editingStudent, setEditingStudent] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  // Current date/time
  const now = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const dateDisplay = now.toLocaleDateString('en-US', dateOptions);
  const timeOfDay = now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening';
  const greeting = `Good ${timeOfDay}! Let's make it a great day!`;

  // Fetch student profiles
  const { data: profiles = {} } = useQuery({
    queryKey: ['/api/students/profiles'],
    queryFn: async () => {
      const abigailProfile = await apiRequest('/api/students/abigail/profile').catch(() => null);
      const khalilProfile = await apiRequest('/api/students/khalil/profile').catch(() => null);
      return {
        abigail: abigailProfile,
        khalil: khalilProfile
      };
    }
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async ({ studentName, uploadUrl }: { studentName: string; uploadUrl: string }) => {
      return apiRequest('/api/profile-image/complete', {
        method: 'POST',
        body: JSON.stringify({ uploadUrl, studentName })
      });
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
      color: colors.progress,
      message: "Ready for another great learning day!",
      profileImage: profiles.khalil?.profileImageUrl
    }
  ];

  const handleGetUploadParameters = async () => {
    const response = await apiRequest('/api/profile-image/upload', {
      method: 'POST'
    });
    return {
      method: 'PUT' as const,
      url: response.url
    };
  };

  const handleUploadComplete = (uploadedUrl: string) => {
    if (editingStudent) {
      uploadMutation.mutate({ studentName: editingStudent, uploadUrl: uploadedUrl });
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        padding: '20px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <div style={{
            width: '48px',
            height: '48px',
            backgroundColor: colors.primary,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold'
          }}>
            S
          </div>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: 'bold',
            color: colors.primary,
            margin: 0
          }}>
            StudyFlow
          </h1>
        </Link>
        
        <Link
          href="/admin"
          style={{
            padding: '10px 20px',
            backgroundColor: 'transparent',
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            color: colors.text,
            fontSize: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.2s',
            textDecoration: 'none'
          }}
          onMouseEnter={(e) => {
            const target = e.currentTarget as HTMLElement;
            target.style.backgroundColor = colors.background;
            target.style.borderColor = colors.primary;
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget as HTMLElement;
            target.style.backgroundColor = 'transparent';
            target.style.borderColor = colors.border;
          }}
        >
          <Settings size={18} />
          Admin
        </Link>
      </header>

      {/* Main Content */}
      <main style={{
        flex: 1,
        padding: '60px 40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '48px'
      }}>
        {/* Date and Greeting Card */}
        <div style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: '16px',
          padding: '32px 48px',
          textAlign: 'center',
          maxWidth: '800px',
          width: '100%',
          boxShadow: '0 2px 8px rgba(132, 79, 193, 0.06)'
        }}>
          <div style={{ 
            color: colors.textMuted, 
            fontSize: '14px', 
            fontWeight: '500',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <Calendar size={16} />
            {dateDisplay.toUpperCase()}
          </div>
          <h2 style={{ 
            fontSize: '32px', 
            color: colors.primary,
            margin: 0,
            fontWeight: '600'
          }}>
            {greeting}
          </h2>
        </div>

        {/* Student Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '32px',
          maxWidth: '800px',
          width: '100%'
        }}>
          {students.map((student) => (
            <Link
              key={student.id}
              href={`/student/${student.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div
                onMouseEnter={() => setHoveredStudent(student.id)}
                onMouseLeave={() => setHoveredStudent(null)}
                style={{
                  backgroundColor: colors.surface,
                  border: `2px solid ${hoveredStudent === student.id ? student.color : colors.border}`,
                  borderRadius: '20px',
                  padding: '32px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  transform: hoveredStudent === student.id ? 'translateY(-4px)' : 'translateY(0)',
                  boxShadow: hoveredStudent === student.id 
                    ? `0 12px 32px ${student.color}20` 
                    : '0 2px 8px rgba(0,0,0,0.04)'
                }}
              >
                {/* Student Avatar */}
                <div style={{
                  width: '80px',
                  height: '80px',
                  backgroundColor: student.color,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  color: 'white',
                  fontSize: '36px',
                  fontWeight: 'bold',
                  boxShadow: `0 4px 12px ${student.color}30`,
                  overflow: 'hidden',
                  position: 'relative'
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
                <h3 style={{
                  fontSize: '28px',
                  fontWeight: '600',
                  color: colors.text,
                  margin: '0 0 12px 0'
                }}>
                  {student.name}
                </h3>

                {/* Motivational Message */}
                <p style={{
                  color: colors.textMuted,
                  fontSize: '16px',
                  margin: '0 0 24px 0',
                  minHeight: '24px'
                }}>
                  {student.message}
                </p>

                {/* Let's Go Button */}
                <button
                  data-testid={`button-select-${student.id}`}
                  style={{
                    width: '100%',
                    padding: '14px 24px',
                    backgroundColor: hoveredStudent === student.id ? student.color : colors.background,
                    border: `2px solid ${student.color}`,
                    borderRadius: '12px',
                    color: hoveredStudent === student.id ? 'white' : student.color,
                    fontSize: '18px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
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
      <footer style={{
        padding: '32px',
        textAlign: 'center',
        color: colors.textMuted,
        fontSize: '14px',
        borderTop: `1px solid ${colors.border}`,
        backgroundColor: colors.surface
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          StudyFlow
          <span style={{ color: colors.primary }}>•</span>
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