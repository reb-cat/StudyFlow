import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useToast } from '@/hooks/use-toast';
import { Clock, Save, RotateCcw, Home, Edit3, Users, Upload, FileText, Calendar, CheckCircle2 } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface ScheduleBlock {
  id: string;
  studentName: string;
  weekday: string;
  blockNumber: number | null;
  startTime: string;
  endTime: string;
  subject: string;
  blockType: 'Bible' | 'Assignment' | 'Travel' | 'Co-op' | 'Study Hall' | 'Prep/Load' | 'Movement' | 'Lunch';
}

interface StudentProfile {
  id: string;
  studentName: string;
  displayName: string;
  allowSaturdayScheduling: boolean;
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const BLOCK_TYPES = ['Bible', 'Assignment', 'Travel', 'Co-op', 'Study Hall', 'Prep/Load', 'Movement', 'Lunch'];

const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
};

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':');
  return parseInt(hours) * 60 + parseInt(minutes);
};

export default function ScheduleTemplates() {
  const [selectedStudent, setSelectedStudent] = useState<string>('Abigail');
  const [selectedWeekday, setSelectedWeekday] = useState<string>('Thursday');
  const [editingBlocks, setEditingBlocks] = useState<ScheduleBlock[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const { data: scheduleBlocks = [], isLoading } = useQuery<ScheduleBlock[]>({
    queryKey: ['/api/schedule-template', selectedStudent, selectedWeekday],
    enabled: !!selectedStudent && !!selectedWeekday,
  });

  // Get student profiles for Saturday scheduling toggles
  const { data: studentProfiles = [] } = useQuery<StudentProfile[]>({
    queryKey: ['/api/students/profiles/saturday-settings'],
  });

  const saveScheduleMutation = useMutation({
    mutationFn: async (blocks: ScheduleBlock[]) => {
      return apiRequest('PUT', `/api/schedule-template/${selectedStudent}/${selectedWeekday}`, { blocks });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule-template'] });
      setHasChanges(false);
      toast({
        title: "Success",
        description: "Schedule template updated successfully",
      });
    },
    onError: (error: any) => {
      console.error('Admin panel save error:', error);
      toast({
        title: "Error", 
        description: error?.message || "Failed to update schedule template",
        variant: "destructive",
      });
    },
  });

  const csvUploadMutation = useMutation({
    mutationFn: async (csvData: any[]) => {
      return apiRequest('POST', '/api/schedule-template/upload-csv', { csvData });
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule-template'] });
      setCsvFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      toast({
        title: "Success",
        description: `Schedule template replaced successfully with ${response.recordsProcessed} records`,
      });
    },
    onError: (error: any) => {
      console.error('CSV upload error:', error);
      toast({
        title: "Error", 
        description: error?.message || "Failed to upload CSV schedule template",
        variant: "destructive",
      });
    },
  });

  // Saturday scheduling mutation
  const saturdayMutation = useMutation({
    mutationFn: async ({ studentName, allowSaturday }: { studentName: string; allowSaturday: boolean }) => {
      return apiRequest('PATCH', `/api/students/${studentName}/saturday-scheduling`, {
        allowSaturdayScheduling: allowSaturday
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/students/profiles/saturday-settings'] });
      toast({ 
        title: "Success", 
        description: "Saturday scheduling preference updated successfully."
      });
    },
    onError: (error) => {
      console.error('Error updating Saturday settings:', error);
      toast({ 
        title: "Error", 
        description: "Failed to update Saturday scheduling settings.",
        variant: "destructive"
      });
    },
  });

  // Helper function to format time for HTML time inputs (requires HH:MM format)
  const formatTimeForInput = (time: string): string => {
    if (!time) return '';
    // If time is already in HH:MM format, return as is
    if (time.match(/^\d{2}:\d{2}/)) return time.substring(0, 5);
    // If time is in H:MM format, pad the hour with zero
    if (time.match(/^\d:\d{2}/)) return `0${time}`;
    return time;
  };

  // Initialize editing blocks when data changes and sort them chronologically
  useEffect(() => {
    if (scheduleBlocks && scheduleBlocks.length > 0) {
      const sorted = [...scheduleBlocks]
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
        .map(block => ({
          ...block,
          startTime: formatTimeForInput(block.startTime),
          endTime: formatTimeForInput(block.endTime)
        }));
      setEditingBlocks(sorted);
      setHasChanges(false);
    }
  }, [scheduleBlocks]);

  const updateBlock = (index: number, field: keyof ScheduleBlock, value: any) => {
    const newBlocks = [...editingBlocks];
    newBlocks[index] = { ...newBlocks[index], [field]: value };
    setEditingBlocks(newBlocks);
    setHasChanges(true);
  };

  const addBlock = () => {
    const newBlock: ScheduleBlock = {
      id: `temp-${Date.now()}`,
      studentName: selectedStudent,
      weekday: selectedWeekday,
      blockNumber: null,
      startTime: '08:00:00',
      endTime: '09:00:00',
      subject: 'New Block',
      blockType: 'Study Hall'
    };
    setEditingBlocks([...editingBlocks, newBlock]);
    setHasChanges(true);
  };

  const removeBlock = (index: number) => {
    const newBlocks = editingBlocks.filter((_, i) => i !== index);
    setEditingBlocks(newBlocks);
    setHasChanges(true);
  };

  const saveChanges = () => {
    // Sort blocks by start time and ensure correct student/weekday before saving
    const sortedBlocks = [...editingBlocks]
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
      .map(block => ({
        ...block,
        studentName: selectedStudent,
        weekday: selectedWeekday
      }));
    saveScheduleMutation.mutate(sortedBlocks);
  };

  const resetChanges = () => {
    if (scheduleBlocks) {
      setEditingBlocks([...scheduleBlocks]);
      setHasChanges(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a valid CSV file",
        variant: "destructive",
      });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const parseCsvFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const csv = event.target?.result as string;
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        
        // Map CSV headers to expected database field names
        const fieldMapping: Record<string, string> = {
          'id': 'id',
          'student_name': 'student_name',
          'studentName': 'student_name',
          'student': 'student_name',
          'name': 'student_name',
          'weekday': 'weekday',
          'day': 'weekday',
          'block_number': 'block_number',
          'blockNumber': 'block_number',
          'block': 'block_number',
          'start_time': 'start_time',
          'startTime': 'start_time',
          'start': 'start_time',
          'end_time': 'end_time',
          'endTime': 'end_time',
          'end': 'end_time',
          'subject': 'subject',
          'block_type': 'block_type',
          'blockType': 'block_type',
          'type': 'block_type'
        };
        
        const data = lines.slice(1)
          .filter(line => line.trim()) // Remove empty lines
          .map(line => {
            const values = line.split(',');
            const row: any = {};
            headers.forEach((header, index) => {
              const value = values[index]?.trim();
              if (value && value !== '') {
                // Map header to the correct database field name
                const fieldName = fieldMapping[header] || header;
                if (fieldName) {
                  row[fieldName] = value;
                }
              }
            });
            
            // Only include rows that have required fields
            if (row.student_name && row.weekday) {
              return row;
            }
            return null;
          })
          .filter(row => row !== null); // Remove null rows
        
        resolve(data);
      };
      reader.onerror = () => reject(new Error('Failed to read CSV file'));
      reader.readAsText(file);
    });
  };

  const handleCsvUpload = async () => {
    if (!csvFile) return;
    
    try {
      const csvData = await parseCsvFile(csvFile);
      console.log('Parsed CSV data:', csvData.slice(0, 3)); // Log first 3 rows for debugging
      csvUploadMutation.mutate(csvData);
    } catch (error) {
      console.error('CSV parsing error:', error);
      toast({
        title: "Error",
        description: "Failed to parse CSV file",
        variant: "destructive",
      });
    }
  };

  const getBlockTypeBadgeColor = (blockType: string) => {
    const colors: Record<string, string> = {
      'Bible': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      'Assignment': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      'Co-op': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      'Travel': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      'Lunch': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      'Prep/Load': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
      'Movement': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      'Study Hall': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
    };
    return colors[blockType] || colors['Study Hall'];
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading schedule templates...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="schedule-templates">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="h-8 w-8 text-pink-600" />
          <div>
            <h1 className="text-3xl font-bold">Schedule Templates</h1>
            <p className="text-muted-foreground">Configure daily schedule blocks and time allocations</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/admin'}
            data-testid="button-back-admin"
          >
            <Home className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
          <ThemeToggle />
        </div>
      </div>
      {/* Student and Weekday Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Schedule Selection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Student</label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger data-testid="select-student">
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start">
                  <SelectItem value="Abigail">Abigail</SelectItem>
                  <SelectItem value="Khalil">Khalil</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Weekday</label>
              <Select value={selectedWeekday} onValueChange={setSelectedWeekday}>
                <SelectTrigger data-testid="select-weekday">
                  <SelectValue placeholder="Select weekday" />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" align="start">
                  {WEEKDAYS.map(day => (
                    <SelectItem key={day} value={day}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* CSV Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Replace Schedule Template from CSV
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-yellow-600 mt-1 flex-shrink-0" />
              <div className="space-y-2">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">⚠️ Complete Replacement</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Uploading a CSV will <strong>completely replace</strong> the entire schedule template for both students across all weekdays. 
                  This action cannot be undone. Ensure your CSV contains all required schedule data.
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select CSV File</label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                data-testid="input-csv-file"
              />
            </div>
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                {csvFile ? `Selected: ${csvFile.name}` : 'No file selected'}
              </div>
            </div>
            <Button 
              onClick={handleCsvUpload}
              disabled={!csvFile || csvUploadMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="button-upload-csv"
            >
              <Upload className="h-4 w-4 mr-2" />
              {csvUploadMutation.isPending ? 'Uploading...' : 'Replace All Templates'}
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground">
            <p><strong>Expected CSV format:</strong> id, student_name, weekday, block_number, start_time, end_time, subject, block_type</p>
            <p><strong>Supported block types:</strong> Bible, Assignment, Travel, Co-op, Study Hall, Prep/Load, Movement, Lunch</p>
          </div>
        </CardContent>
      </Card>
      {/* Saturday Scheduling Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Saturday Scheduling Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Control when Saturday blocks are used for overflow assignments that don't fit in the regular Monday-Friday schedule.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {studentProfiles.map((student) => (
              <div key={student.id} className="p-4 border border-muted rounded-lg bg-muted/30 space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 min-w-[2.5rem] min-h-[2.5rem] flex-shrink-0 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                    {student.displayName?.charAt(0) || '?'}
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">{student.displayName || 'Unknown'}</h3>
                    <p className="text-sm text-muted-foreground">
                      Saturday scheduling is {student.allowSaturdayScheduling ? 'enabled' : 'disabled'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <Label htmlFor={`saturday-${student.studentName}`} className="text-sm font-medium">
                    Allow Saturday scheduling
                  </Label>
                  <button
                    id={`saturday-${student.studentName}`}
                    onClick={() => saturdayMutation.mutate({ 
                      studentName: student.studentName, 
                      allowSaturday: !student.allowSaturdayScheduling 
                    })}
                    disabled={saturdayMutation.isPending}
                    className={`relative w-14 h-[25px] rounded-full transition-colors duration-200 flex-shrink-0 ${
                      student.allowSaturdayScheduling 
                        ? 'bg-blue-600' 
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <div 
                      className={`absolute top-[1px] left-[1px] w-[23px] h-[23px] bg-white rounded-full shadow-lg transition-transform duration-200 ${
                        student.allowSaturdayScheduling ? 'translate-x-[31px]' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {/* Schedule Editor */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            {selectedStudent}'s {selectedWeekday} Schedule
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                Unsaved Changes
              </Badge>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={resetChanges}
              disabled={!hasChanges}
              data-testid="button-reset"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button 
              onClick={saveChanges}
              disabled={!hasChanges || saveScheduleMutation.isPending}
              data-testid="button-save"
            >
              <Save className="h-4 w-4 mr-2" />
              {saveScheduleMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Schedule Blocks */}
          <div className="space-y-3">
            {editingBlocks.map((block, index) => (
              <div key={block.id || index} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={getBlockTypeBadgeColor(block.blockType)}>
                      {block.blockType}
                    </Badge>
                    {block.blockNumber && (
                      <Badge variant="outline">Block {block.blockNumber}</Badge>
                    )}
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => removeBlock(index)}
                    data-testid={`button-remove-${index}`}
                  >
                    Remove
                  </Button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Start Time</label>
                    <Input
                      type="time"
                      value={block.startTime}
                      onChange={(e) => updateBlock(index, 'startTime', e.target.value)}
                      data-testid={`input-start-time-${index}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">End Time</label>
                    <Input
                      type="time"
                      value={block.endTime}
                      onChange={(e) => updateBlock(index, 'endTime', e.target.value)}
                      data-testid={`input-end-time-${index}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Subject</label>
                    <Input
                      value={block.subject}
                      onChange={(e) => updateBlock(index, 'subject', e.target.value)}
                      placeholder="Subject name"
                      data-testid={`input-subject-${index}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Block Type</label>
                    <Select 
                      value={block.blockType} 
                      onValueChange={(value) => updateBlock(index, 'blockType', value)}
                    >
                      <SelectTrigger data-testid={`select-block-type-${index}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" side="bottom" align="start">
                        {BLOCK_TYPES.map(type => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Block Number</label>
                    <Input
                      type="number"
                      value={block.blockNumber || ''}
                      onChange={(e) => updateBlock(index, 'blockNumber', e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="Auto"
                      data-testid={`input-block-number-${index}`}
                    />
                  </div>
                </div>
                
                <div className="text-sm text-muted-foreground">
                  Duration: {formatTime(block.startTime)} - {formatTime(block.endTime)} 
                  ({Math.round((timeToMinutes(block.endTime) - timeToMinutes(block.startTime)))} minutes)
                </div>
              </div>
            ))}
          </div>

          {/* Add Block Button */}
          <Button 
            variant="outline" 
            onClick={addBlock}
            className="w-full"
            data-testid="button-add-block"
          >
            Add New Time Block
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}