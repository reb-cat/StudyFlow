import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';
import { ArrowLeft, Calendar, AlertCircle, CheckCircle2, Save } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface StudentProfile {
  id: string;
  studentName: string;
  displayName: string;
  allowSaturdayScheduling: boolean;
}

export default function SaturdaySettings() {
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get student profiles with Saturday scheduling preferences
  const { data: students = [], isLoading } = useQuery<StudentProfile[]>({
    queryKey: ['/api/students/profiles/saturday-settings'],
  });

  // Update Saturday scheduling preference
  const updateSaturdayMutation = useMutation({
    mutationFn: async ({ studentName, allowSaturday }: { studentName: string; allowSaturday: boolean }) => {
      return apiRequest('PATCH', `/api/students/${studentName}/saturday-scheduling`, {
        allowSaturdayScheduling: allowSaturday
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/students/profiles/saturday-settings'] });
      toast({ 
        title: "Settings Updated", 
        description: "Saturday scheduling preferences have been saved successfully."
      });
      setHasChanges(false);
    },
    onError: (error) => {
      console.error('Error updating Saturday settings:', error);
      toast({ 
        title: "Error", 
        description: "Failed to update Saturday scheduling settings. Please try again.",
        variant: "destructive"
      });
    },
  });

  const handleToggleChange = (studentName: string, newValue: boolean) => {
    setHasChanges(true);
    updateSaturdayMutation.mutate({ studentName, allowSaturday: newValue });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Link href="/admin" className="p-2 hover:bg-accent rounded-lg">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <h1 className="text-3xl font-bold">Saturday Scheduling</h1>
            </div>
            <ThemeToggle />
          </div>
          <div className="text-center text-muted-foreground">Loading Saturday settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8" data-testid="saturday-settings">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Link href="/admin" className="p-2 hover:bg-accent rounded-lg transition-colors">
            <ArrowLeft className="h-5 w-5" data-testid="button-back" />
          </Link>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground" data-testid="heading-main">
              Saturday Scheduling
            </h1>
            <p className="text-muted-foreground">
              Control when Saturday blocks are used for overflow assignments
            </p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Information Card */}
      <Card className="border-muted bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <AlertCircle className="h-5 w-5 text-amber-600" />
            How Saturday Scheduling Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-foreground">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
            <p><strong>Primary Schedule:</strong> Monday-Friday blocks are always used first for assignment scheduling</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-500 mt-2 flex-shrink-0"></div>
            <p><strong>Saturday Overflow:</strong> When enabled, Saturday blocks handle assignments that don't fit in the regular week</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 mt-2 flex-shrink-0"></div>
            <p><strong>Individual Control:</strong> Each student can have Saturday scheduling enabled or disabled independently</p>
          </div>
        </CardContent>
      </Card>

      {/* Student Controls */}
      <div className="grid gap-6">
        <h2 className="text-xl font-semibold text-foreground">Student Settings</h2>
        
        {students.map((student) => (
          <Card key={student.id} className="border-muted bg-card/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-lg">
                    {student.displayName.charAt(0)}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-foreground" data-testid={`student-${student.studentName}-name`}>
                      {student.displayName}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        Saturday scheduling is {student.allowSaturdayScheduling ? 'enabled' : 'disabled'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {student.allowSaturdayScheduling ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Enabled
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                      Disabled
                    </Badge>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <Label htmlFor={`saturday-toggle-${student.studentName}`} className="text-sm font-medium">
                      Allow Saturday
                    </Label>
                    <Switch
                      id={`saturday-toggle-${student.studentName}`}
                      checked={student.allowSaturdayScheduling}
                      onCheckedChange={(checked) => handleToggleChange(student.studentName, checked)}
                      disabled={updateSaturdayMutation.isPending}
                      data-testid={`toggle-saturday-${student.studentName}`}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status Bar */}
      {updateSaturdayMutation.isPending && (
        <div className="fixed bottom-6 right-6 bg-card border border-muted rounded-lg p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="text-sm font-medium">Updating settings...</span>
          </div>
        </div>
      )}
    </div>
  );
}