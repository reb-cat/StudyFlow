import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Clock, Save, RotateCcw, Home, Edit3, Users } from 'lucide-react';
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
  const { toast } = useToast();

  const { data: scheduleBlocks = [], isLoading } = useQuery<ScheduleBlock[]>({
    queryKey: ['/api/schedule-template', selectedStudent, selectedWeekday],
    enabled: !!selectedStudent && !!selectedWeekday,
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

  // Initialize editing blocks when data changes
  useEffect(() => {
    if (scheduleBlocks && scheduleBlocks.length > 0) {
      setEditingBlocks([...scheduleBlocks]);
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
    // Sort blocks by start time before saving
    const sortedBlocks = [...editingBlocks].sort((a, b) => 
      timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );
    saveScheduleMutation.mutate(sortedBlocks);
  };

  const resetChanges = () => {
    if (scheduleBlocks) {
      setEditingBlocks([...scheduleBlocks]);
      setHasChanges(false);
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
        <Button 
          variant="outline" 
          onClick={() => window.location.href = '/admin'}
          data-testid="button-back-admin"
        >
          <Home className="h-4 w-4 mr-2" />
          Back to Admin
        </Button>
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