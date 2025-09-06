import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ThemeToggle } from '@/components/ThemeToggle';
import { 
  ArrowLeft, 
  ArrowUp, 
  ArrowDown, 
  RefreshCw, 
  Calendar, 
  Clock, 
  User, 
  Edit3, 
  Save, 
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Shuffle,
  Plus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Link } from 'wouter';
import type { Assignment } from '@shared/schema';

interface ScheduleBlock {
  blockNumber: number;
  startTime: string;
  endTime: string;
  assignment: Assignment | null;
  blockType: string;
}

interface DailySchedule {
  date: string;
  studentName: string;
  blocks: ScheduleBlock[];
}

interface AvailableAssignment {
  id: string;
  title: string;
  subject: string | null;
  priority: string;
  dueDate: string | null;
  actualEstimatedMinutes: number;
  completionStatus: string;
}

const formatTime = (time: string): string => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'A': return 'bg-red-100 text-red-800 border-red-200';
    case 'B': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'C': return 'bg-green-100 text-green-800 border-green-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export default function ScheduleManager() {
  const [selectedStudent, setSelectedStudent] = useState<string>('Khalil');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [scheduleBlocks, setScheduleBlocks] = useState<ScheduleBlock[]>([]);
  const [showSubstitutionDialog, setShowSubstitutionDialog] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current schedule for the selected student and date
  const { data: currentSchedule, isLoading: scheduleLoading, refetch: refetchSchedule } = useQuery<DailySchedule>({
    queryKey: ['schedule-preview', selectedStudent, selectedDate],
    queryFn: async () => {
      const response = await fetch(`/api/schedule/${selectedStudent}/${selectedDate}/preview`);
      if (!response.ok) throw new Error('Failed to fetch schedule');
      return response.json();
    }
  });

  // Fetch available assignments for substitution
  const { data: availableAssignments = [], isLoading: assignmentsLoading } = useQuery<AvailableAssignment[]>({
    queryKey: ['available-assignments', selectedStudent],
    queryFn: async () => {
      const response = await fetch(`/api/assignments?student=${selectedStudent}&status=pending&unscheduled=true`);
      if (!response.ok) throw new Error('Failed to fetch assignments');
      return response.json();
    }
  });

  // Update local state when schedule data changes
  useEffect(() => {
    if (currentSchedule) {
      setScheduleBlocks(currentSchedule.blocks);
      setHasChanges(false);
    }
  }, [currentSchedule]);

  // Mutation to save schedule changes
  const saveScheduleMutation = useMutation({
    mutationFn: async (updatedBlocks: ScheduleBlock[]) => {
      const response = await apiRequest('PUT', `/api/schedule/${selectedStudent}/${selectedDate}/manual`, {
        blocks: updatedBlocks
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Schedule Updated",
        description: "Manual schedule changes saved successfully",
      });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['schedule-preview', selectedStudent, selectedDate] });
    },
    onError: (error: any) => {
      toast({
        title: "Save Failed",
        description: error.message || "Failed to save schedule changes",
        variant: "destructive",
      });
    }
  });

  // Mutation to regenerate schedule automatically
  const regenerateScheduleMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', `/api/schedule/${selectedStudent}/${selectedDate}/regenerate`);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Schedule Regenerated",
        description: "Fresh schedule created using automatic logic",
      });
      refetchSchedule();
    },
    onError: (error: any) => {
      toast({
        title: "Regeneration Failed",
        description: error.message || "Failed to regenerate schedule",
        variant: "destructive",
      });
    }
  });

  // Move assignment up in the schedule
  const moveAssignmentUp = (blockNumber: number) => {
    const currentIndex = scheduleBlocks.findIndex(b => b.blockNumber === blockNumber);
    if (currentIndex <= 0) return;

    const newBlocks = [...scheduleBlocks];
    const targetIndex = currentIndex - 1;

    // Swap assignments between blocks
    const currentAssignment = newBlocks[currentIndex].assignment;
    const targetAssignment = newBlocks[targetIndex].assignment;

    newBlocks[currentIndex] = { ...newBlocks[currentIndex], assignment: targetAssignment };
    newBlocks[targetIndex] = { ...newBlocks[targetIndex], assignment: currentAssignment };

    setScheduleBlocks(newBlocks);
    setHasChanges(true);
  };

  // Move assignment down in the schedule
  const moveAssignmentDown = (blockNumber: number) => {
    const currentIndex = scheduleBlocks.findIndex(b => b.blockNumber === blockNumber);
    if (currentIndex >= scheduleBlocks.length - 1) return;

    const newBlocks = [...scheduleBlocks];
    const targetIndex = currentIndex + 1;

    // Swap assignments between blocks
    const currentAssignment = newBlocks[currentIndex].assignment;
    const targetAssignment = newBlocks[targetIndex].assignment;

    newBlocks[currentIndex] = { ...newBlocks[currentIndex], assignment: targetAssignment };
    newBlocks[targetIndex] = { ...newBlocks[targetIndex], assignment: currentAssignment };

    setScheduleBlocks(newBlocks);
    setHasChanges(true);
  };

  // Open substitution dialog
  const openSubstitutionDialog = (blockNumber: number) => {
    setSelectedBlock(blockNumber);
    setShowSubstitutionDialog(true);
  };

  // Substitute assignment in a block
  const substituteAssignment = (assignmentId: string) => {
    if (selectedBlock === null) return;

    const selectedAssignment = availableAssignments.find(a => a.id === assignmentId);
    if (!selectedAssignment) return;

    const newBlocks = scheduleBlocks.map(block => 
      block.blockNumber === selectedBlock 
        ? { ...block, assignment: selectedAssignment as unknown as Assignment }
        : block
    );

    setScheduleBlocks(newBlocks);
    setHasChanges(true);
    setShowSubstitutionDialog(false);
    setSelectedBlock(null);

    toast({
      title: "Assignment Substituted",
      description: `Block ${selectedBlock} now contains "${selectedAssignment.title}"`,
    });
  };

  // Remove assignment from block
  const removeAssignment = (blockNumber: number) => {
    const newBlocks = scheduleBlocks.map(block => 
      block.blockNumber === blockNumber 
        ? { ...block, assignment: null }
        : block
    );

    setScheduleBlocks(newBlocks);
    setHasChanges(true);
  };

  if (scheduleLoading || assignmentsLoading) {
    return (
      <div className="container mx-auto p-6 space-y-8">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8" data-testid="schedule-manager">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="outline" size="sm" data-testid="back-to-admin">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Schedule Manager</h1>
              <p className="text-muted-foreground">Preview, reorder, and substitute assignments</p>
            </div>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Controls */}
      <Card className="bg-muted/50 border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Schedule Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Student</label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger data-testid="student-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Khalil">Khalil</SelectItem>
                  <SelectItem value="Abigail">Abigail</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Date</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                data-testid="date-select"
              />
            </div>

            <div className="flex items-end gap-2">
              <Button
                onClick={() => regenerateScheduleMutation.mutate()}
                variant="outline"
                disabled={regenerateScheduleMutation.isPending}
                data-testid="regenerate-schedule"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${regenerateScheduleMutation.isPending ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>

              <Button
                onClick={() => saveScheduleMutation.mutate(scheduleBlocks)}
                disabled={!hasChanges || saveScheduleMutation.isPending}
                data-testid="save-changes"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
            </div>
          </div>

          {hasChanges && (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">You have unsaved changes</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Preview */}
      <Card className="bg-muted/50 border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Daily Schedule Preview - {selectedDate}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {scheduleBlocks.sort((a, b) => a.blockNumber - b.blockNumber).map((block, index) => (
              <Card key={block.blockNumber} className="bg-background border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <div className="text-sm font-medium text-muted-foreground">Block</div>
                        <div className="text-2xl font-bold text-primary">{block.blockNumber}</div>
                      </div>
                      
                      <div className="text-center">
                        <div className="text-sm font-medium text-muted-foreground">Time</div>
                        <div className="text-sm text-foreground">
                          {formatTime(block.startTime)} - {formatTime(block.endTime)}
                        </div>
                      </div>

                      <div className="flex-1">
                        {block.assignment ? (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-foreground">{block.assignment.title}</h3>
                              <Badge className={`text-xs ${getPriorityColor(block.assignment.priority || 'C')}`}>
                                Priority {block.assignment.priority || 'C'}
                              </Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {block.assignment.subject || 'No subject'} • {block.assignment.actualEstimatedMinutes || 30} min
                              {block.assignment.dueDate && (
                                <span> • Due: {new Date(block.assignment.dueDate).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-muted-foreground italic">No assignment scheduled</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Move Up */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => moveAssignmentUp(block.blockNumber)}
                        disabled={index === 0}
                        data-testid={`move-up-${block.blockNumber}`}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>

                      {/* Move Down */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => moveAssignmentDown(block.blockNumber)}
                        disabled={index === scheduleBlocks.length - 1}
                        data-testid={`move-down-${block.blockNumber}`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>

                      {/* Substitute */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openSubstitutionDialog(block.blockNumber)}
                        data-testid={`substitute-${block.blockNumber}`}
                      >
                        <Shuffle className="w-4 h-4" />
                      </Button>

                      {/* Remove */}
                      {block.assignment && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeAssignment(block.blockNumber)}
                          data-testid={`remove-${block.blockNumber}`}
                        >
                          <Plus className="w-4 h-4 rotate-45" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Assignment Substitution Dialog */}
      <Dialog open={showSubstitutionDialog} onOpenChange={setShowSubstitutionDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Substitute Assignment - Block {selectedBlock}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {availableAssignments.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No available assignments for substitution
              </div>
            ) : (
              availableAssignments.map((assignment) => (
                <Card key={assignment.id} className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => substituteAssignment(assignment.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-foreground">{assignment.title}</h4>
                          <Badge className={`text-xs ${getPriorityColor(assignment.priority)}`}>
                            {assignment.priority}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {assignment.subject || 'No subject'} • {assignment.actualEstimatedMinutes} min
                          {assignment.dueDate && (
                            <span> • Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="outline">
                        Select
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubstitutionDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}