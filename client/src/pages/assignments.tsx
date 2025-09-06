import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CheckCircle, Circle, RefreshCw, Search, Filter, Clock, AlertCircle, ChevronDown, ChevronUp, Plus, Calendar, ArrowLeft, User, HelpCircle, CheckCircle2, Calendar as CalendarIcon, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Assignment } from '@shared/schema';

// Helper function to detect parent-only tasks
function isParentTask(title: string, courseName?: string | null): boolean {
  const lowerTitle = title.toLowerCase();
  const lowerCourse = (courseName || '').toLowerCase();
  
  const parentKeywords = [
    'fee', 'supply fee', 'copy fee', 'class fee', '$',
    'permission', 'permission form', 'consent form', 'waiver form', 'consent', 'waiver',
    'parent', 'guardian', 'signature required',
    'pay', 'payment', 'tuition', 'enrollment'
  ];
  
  return parentKeywords.some(keyword => 
    lowerTitle.includes(keyword) || lowerCourse.includes(keyword)
  );
}

// Helper function to extract numbers from assignment titles for proper sequencing
function extractSequenceNumbers(title: string): number[] {
  // Match patterns like "Unit 2", "Module 3", "Chapter 1", "Page 5", etc.
  const patterns = [
    /(?:unit|module|chapter|lesson|section|part|page|step|week|day)\s*(\d+)/gi,
    /(\d+)\s*(?:unit|module|chapter|lesson|section|part|page|step|week|day)/gi,
    /(\d+)/g // Fall back to any numbers
  ];
  
  for (const pattern of patterns) {
    const matches = [...title.matchAll(pattern)];
    if (matches.length > 0) {
      return matches.map(match => parseInt(match[1], 10)).filter(n => !isNaN(n));
    }
  }
  
  return [];
}

// Smart title comparison that handles numerical sequences
function compareAssignmentTitles(titleA: string, titleB: string): number {
  const numbersA = extractSequenceNumbers(titleA);
  const numbersB = extractSequenceNumbers(titleB);
  
  // If both have numbers, compare numerically
  if (numbersA.length > 0 && numbersB.length > 0) {
    // Compare each number in sequence
    const maxLength = Math.max(numbersA.length, numbersB.length);
    for (let i = 0; i < maxLength; i++) {
      const numA = numbersA[i] || 0;
      const numB = numbersB[i] || 0;
      if (numA !== numB) {
        return numA - numB;
      }
    }
  }
  
  // Fall back to alphabetical comparison
  return titleA.localeCompare(titleB);
}

export default function AssignmentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStudent, setSelectedStudent] = useState<string>('Abigail');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [dateFilter, setDateFilter] = useState<string>('upcoming');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [bulkOperation, setBulkOperation] = useState<string>('');
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Manual assignment creation state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualAssignment, setManualAssignment] = useState({
    title: '',
    subject: '',
    courseName: '',
    instructions: '',
    dueDate: '',
    priority: 'B' as 'A' | 'B' | 'C',
    actualEstimatedMinutes: 30
  });

  // Edit assignment state
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);

  // Parent resolution state
  const [showResolutionDialog, setShowResolutionDialog] = useState(false);
  const [resolvingAssignment, setResolvingAssignment] = useState<Assignment | null>(null);
  const [resolutionAction, setResolutionAction] = useState<'helped' | 'modified' | 'excused' | 'still_needs_work'>('helped');
  const [resolutionNotes, setResolutionNotes] = useState('');

  // Get assignments for the selected student (limited to current week for better usability)
  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments', selectedStudent, dateFilter, filterStatus],
    queryFn: async () => {
      // Calculate date range for current week plus buffer
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 7); // 1 week back
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + 14); // 2 weeks forward
      
      // Only include completed assignments when specifically requested
      const shouldIncludeCompleted = filterStatus === 'all' || filterStatus === 'completed';
      
      const params = new URLSearchParams({
        studentName: selectedStudent,
        includeCompleted: shouldIncludeCompleted.toString(),
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0]
      });
      
      const response = await apiRequest('GET', `/api/assignments?${params.toString()}`);
      return await response.json();
    }
  });

  // Get Bible curriculum items separately (assignments management only)
  const { data: bibleItems = [], isLoading: bibleLoading, refetch: refetchBible } = useQuery({
    queryKey: ['/api/bible-curriculum', selectedStudent],
    queryFn: async () => {
      const params = new URLSearchParams({ studentName: selectedStudent });
      const response = await apiRequest('GET', `/api/bible-curriculum?${params.toString()}`);
      return await response.json();
    },
    enabled: !!selectedStudent
  });

  // Edit assignment mutation
  const editAssignmentMutation = useMutation({
    mutationFn: async (updatedAssignment: Partial<Assignment> & { id: string }) => {
      const response = await apiRequest('PATCH', `/api/assignments/${updatedAssignment.id}`, updatedAssignment);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      toast({
        title: "Assignment Updated",
        description: "Assignment has been successfully updated.",
      });
      setShowEditForm(false);
      setEditingAssignment(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to update assignment: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Create manual assignment mutation
  const createAssignmentMutation = useMutation({
    mutationFn: async (assignment: typeof manualAssignment & { userId: string }) => {
      const response = await apiRequest('POST', '/api/assignments', assignment);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      toast({
        title: "Assignment Created",
        description: "Manual assignment has been created successfully.",
      });
      setShowManualForm(false);
      setManualAssignment({
        title: '',
        subject: '',
        courseName: '',
        instructions: '',
        dueDate: '',
        priority: 'B',
        actualEstimatedMinutes: 30
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create assignment: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Bible completion mutation
  const completeBibleMutation = useMutation({
    mutationFn: async ({ weekNumber, dayOfWeek, type }: { 
      weekNumber: number; 
      dayOfWeek: number | null; 
      type: 'daily_reading' | 'memory_verse' 
    }) => {
      const response = await apiRequest('POST', '/api/bible-curriculum/complete', {
        weekNumber,
        dayOfWeek,
        type,
        studentName: selectedStudent
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bible-curriculum'] });
      refetchBible();
      toast({
        title: "Bible Assignment Complete",
        description: "Bible curriculum item has been marked complete.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to complete Bible assignment: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Bulk update status mutation
  const bulkStatusMutation = useMutation({
    mutationFn: async ({ assignmentIds, status }: { assignmentIds: string[], status: string }) => {
      await Promise.all(
        assignmentIds.map(id =>
          apiRequest('PATCH', `/api/assignments/${id}`, { completionStatus: status })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      setSelectedAssignments(new Set());
      setBulkOperation('');
      toast({
        title: "Bulk Update Complete",
        description: "Selected assignments have been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Bulk update failed: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Parent resolution mutation
  const resolveAssignmentMutation = useMutation({
    mutationFn: async (data: {
      assignmentId: string;
      action: 'helped' | 'modified' | 'excused' | 'still_needs_work';
      notes: string;
      studentName: string;
    }) => {
      const response = await apiRequest('POST', `/api/assignments/${data.assignmentId}/resolve`, {
        action: data.action,
        notes: data.notes,
        studentName: data.studentName
      });
      return await response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      
      const actionMessages = {
        helped: 'Assignment resolved and rescheduled for today!',
        modified: 'Assignment modified and rescheduled!', 
        excused: 'Assignment marked as complete.',
        still_needs_work: 'Assignment rescheduled for later with additional time.'
      };
      
      toast({
        title: "Assignment Resolved",
        description: actionMessages[variables.action],
        className: "bg-green-50 border-green-200"
      });
      
      setShowResolutionDialog(false);
      setResolvingAssignment(null);
    },
    onError: (error) => {
      toast({
        title: "Resolution Failed",
        description: `Failed to resolve assignment: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Delete assignment mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      await apiRequest('DELETE', `/api/assignments/${assignmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      toast({
        title: "Assignment Deleted",
        description: "Assignment has been successfully deleted.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to delete assignment: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Canvas completion sync mutation
  const canvasSyncMutation = useMutation({
    mutationFn: async (studentName: string) => {
      const response = await apiRequest('POST', `/api/sync-canvas-completion/${studentName}`);
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      toast({
        title: "Canvas Sync Complete",
        description: `${data.updated} assignments updated from Canvas completion status`,
      });
    },
    onError: (error) => {
      toast({
        title: "Canvas Sync Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Extract due dates mutation
  const extractDueDatesMutation = useMutation({
    mutationFn: async (studentName: string) => {
      const response = await apiRequest('POST', `/api/assignments/extract-due-dates`, {
        studentName,
        dryRun: false
      });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      toast({
        title: "Due Date Extraction Complete", 
        description: `Updated ${data.results.updated} assignments with extracted due dates.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Due Date Extraction Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Convert Bible items to assignment-like objects for display
  const bibleAsAssignments = bibleItems.map((item: any) => ({
    id: item.id,
    title: item.title,
    subject: 'Bible',
    courseName: 'Bible Curriculum',
    instructions: `Week ${item.weekNumber}${item.dayOfWeek ? `, Day ${item.dayOfWeek}` : ''}`,
    completionStatus: 'pending',
    priority: 'A',
    actualEstimatedMinutes: item.estimatedMinutes,
    dueDate: null,
    creationSource: 'bible_curriculum',
    // Bible-specific metadata for completion
    bibleWeek: item.weekNumber,
    bibleDay: item.dayOfWeek,
    bibleType: item.type,
    isBibleItem: true
  }));

  // Combine assignments and Bible items for display
  const allDisplayItems = [...assignments, ...bibleAsAssignments];

  // Filter assignments based on current filters
  const filteredAssignments = allDisplayItems.filter(assignment => {
    // Search filter
    if (searchTerm && !assignment.title.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Status filter
    if (filterStatus !== 'all' && assignment.completionStatus !== filterStatus) {
      return false;
    }

    // Source filter
    if (sourceFilter !== 'all' && assignment.creationSource !== sourceFilter) {
      return false;
    }

    // Date filter (Bible assignments always pass date filters since they're ongoing curriculum)
    if (!assignment.isBibleItem) {
      const today = new Date();
      const dueDate = assignment.dueDate ? new Date(assignment.dueDate) : null;
      
      if (dateFilter === 'overdue' && (!dueDate || dueDate >= today)) {
        return false;
      }
      if (dateFilter === 'today' && (!dueDate || dueDate.toDateString() !== today.toDateString())) {
        return false;
      }
      if (dateFilter === 'this_week') {
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() + 7);
        if (!dueDate || dueDate > weekEnd) {
          return false;
        }
      }
    }

    return true;
  }).sort((a, b) => {
    // Sort by due date first (assignments with due dates come first, sorted by date)
    const aDate = a.dueDate ? new Date(a.dueDate) : null;
    const bDate = b.dueDate ? new Date(b.dueDate) : null;
    
    // If both have due dates, sort by date (earliest first), then by sequence
    if (aDate && bDate) {
      const dateComparison = aDate.getTime() - bDate.getTime();
      if (dateComparison !== 0) {
        return dateComparison;
      }
      // Same due date - sort by numerical sequence (Unit 2 before Unit 3)
      return compareAssignmentTitles(a.title, b.title);
    }
    
    // If only one has a due date, prioritize it
    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;
    
    // If neither has due date, sort by title with smart numerical ordering
    return compareAssignmentTitles(a.title, b.title);
  });

  const handleBulkOperation = () => {
    if (bulkOperation && selectedAssignments.size > 0) {
      bulkStatusMutation.mutate({
        assignmentIds: Array.from(selectedAssignments),
        status: bulkOperation
      });
    }
  };

  const handleCreateManualAssignment = () => {
    const userId = `${selectedStudent.toLowerCase()}-user`;
    createAssignmentMutation.mutate({ ...manualAssignment, userId });
  };

  const handleEditAssignment = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setShowEditForm(true);
  };

  // Helper function to strip HTML tags from text
  const stripHtml = (html: string): string => {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  };

  // Helper function to get Canvas URL for assignment
  const getCanvasUrl = (assignment: Assignment): string | null => {
    // Use stored canvasUrl if available (backend has proper base URLs)
    if (assignment.canvasUrl) {
      return assignment.canvasUrl;
    }
    
    return null;
  };

  const handleSaveEdit = () => {
    if (editingAssignment) {
      editAssignmentMutation.mutate(editingAssignment);
    }
  };
  
  const handleResolveAssignment = () => {
    if (!resolvingAssignment || !resolutionAction) return;
    
    resolveAssignmentMutation.mutate({
      assignmentId: resolvingAssignment.id,
      action: resolutionAction,
      notes: resolutionNotes,
      studentName: selectedStudent
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="assignments-page">
      {/* Header with Back to Admin */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/admin'}
            className="flex items-center gap-2"
            data-testid="button-back-admin"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">Assignment Manager</h1>
            <p className="text-muted-foreground">Manage assignments across all students</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button
            onClick={() => canvasSyncMutation.mutate(selectedStudent)}
            disabled={canvasSyncMutation.isPending}
            className="flex items-center gap-2"
            data-testid="button-canvas-sync"
          >
            <RefreshCw className={`w-4 h-4 ${canvasSyncMutation.isPending ? 'animate-spin' : ''}`} />
            Sync Canvas
          </Button>
          <Button
            onClick={() => setShowManualForm(true)}
            className="flex items-center gap-2"
            data-testid="button-create-assignment"
          >
            <Plus className="w-4 h-4" />
            Create Assignment
          </Button>
          <ThemeToggle />
        </div>
      </div>

      {/* Student Selector & Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger className="w-[180px]" data-testid="select-student">
                  <SelectValue placeholder="Select Student" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Abigail">Abigail</SelectItem>
                  <SelectItem value="Khalil">Khalil</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search assignments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 w-[200px]"
                    data-testid="input-search"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2"
                data-testid="button-advanced-filters"
              >
                <Filter className="w-4 h-4" />
                Filters
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {showAdvanced && (
            <div className="flex flex-col lg:flex-row gap-4 pt-4 border-t">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="stuck">Stuck</SelectItem>
                  <SelectItem value="grading_delay">Grading Delay</SelectItem>
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-date-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="today">Due Today</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="upcoming">Upcoming</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[150px]" data-testid="select-source-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="canvas_sync">Canvas</SelectItem>
                  <SelectItem value="auto_split">Auto Split</SelectItem>
                  <SelectItem value="student_need_more_time">Continued</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-2">
                <Button
                  onClick={() => extractDueDatesMutation.mutate(selectedStudent)}
                  disabled={extractDueDatesMutation.isPending}
                  variant="outline"
                  className="flex items-center gap-2"
                  data-testid="button-extract-dates"
                >
                  <Calendar className={`w-4 h-4 ${extractDueDatesMutation.isPending ? 'animate-spin' : ''}`} />
                  Extract Due Dates
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Bulk Operations */}
      {selectedAssignments.size > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedAssignments.size} assignments selected
              </span>
              <div className="flex gap-2">
                <Select value={bulkOperation} onValueChange={setBulkOperation}>
                  <SelectTrigger className="w-[180px]" data-testid="select-bulk-operation">
                    <SelectValue placeholder="Choose action..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Mark Completed</SelectItem>
                    <SelectItem value="pending">Mark Pending</SelectItem>
                    <SelectItem value="in_progress">Mark In Progress</SelectItem>
                    <SelectItem value="stuck">Mark Stuck</SelectItem>
                    <SelectItem value="grading_delay">Mark Grading Delay</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={handleBulkOperation}
                  disabled={!bulkOperation || bulkStatusMutation.isPending}
                  data-testid="button-apply-bulk"
                >
                  Apply
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => setSelectedAssignments(new Set())}
                  data-testid="button-clear-selection"
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assignment List */}
      <div className="space-y-4">
        {isLoading && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-4">
                <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                Loading assignments...
              </div>
            </CardContent>
          </Card>
        )}

        {!isLoading && filteredAssignments.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8 text-muted-foreground">
                No assignments found matching your filters.
              </div>
            </CardContent>
          </Card>
        )}

        {filteredAssignments.map((assignment) => {
          const isSelected = selectedAssignments.has(assignment.id);
          const isOverdue = assignment.dueDate && new Date(assignment.dueDate) < new Date();
          const parentTask = isParentTask(assignment.title, assignment.courseName);
          
          return (
            <Card
              key={assignment.id}
              className={`transition-all duration-200 ${isSelected ? 'ring-2 ring-primary' : ''} ${parentTask ? 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/30' : ''}`}
              data-testid={`assignment-${assignment.id}`}
            >
              <CardContent className="pt-4">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={(checked) => {
                      const newSelected = new Set(selectedAssignments);
                      if (checked) {
                        newSelected.add(assignment.id);
                      } else {
                        newSelected.delete(assignment.id);
                      }
                      setSelectedAssignments(newSelected);
                    }}
                    className="flex-shrink-0 w-5 h-5 min-w-5 min-h-5 max-w-5 max-h-5"
                    data-testid={`checkbox-${assignment.id}`}
                  />
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-foreground">{assignment.title}</h3>
                          
                          {/* Parent Task Pill */}
                          {parentTask && (
                            <Badge className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700 flex items-center gap-1">
                              <User className="w-3 h-3" />
                              Parent
                            </Badge>
                          )}
                          
                          {/* Status Badge */}
                          <Badge
                            variant={assignment.completionStatus === 'completed' ? 'default' : 'secondary'}
                            className={
                              assignment.completionStatus === 'completed' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' :
                              assignment.completionStatus === 'pending' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' :
                              assignment.completionStatus === 'stuck' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' :
                              'bg-muted text-muted-foreground'
                            }
                          >
                            {assignment.completionStatus === 'completed' && <CheckCircle className="w-3 h-3 mr-1" />}
                            {assignment.completionStatus === 'stuck' && <AlertCircle className="w-3 h-3 mr-1" />}
                            {assignment.completionStatus === 'needs_more_time' && <Clock className="w-3 h-3 mr-1" />}
                            {assignment.completionStatus === 'grading_delay' && <HelpCircle className="w-3 h-3 mr-1" />}
                            {assignment.completionStatus === 'pending' && <Circle className="w-3 h-3 mr-1" />}
                            {(assignment.completionStatus || 'pending').replace('_', ' ')}
                          </Badge>


                          {/* Overdue Indicator */}
                          {isOverdue && assignment.completionStatus !== 'completed' && (
                            <Badge className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Overdue
                            </Badge>
                          )}
                        </div>

                        {assignment.courseName && (
                          <p className="text-sm text-muted-foreground">
                            <strong>Course:</strong> {assignment.courseName}
                          </p>
                        )}


                        {assignment.dueDate && (
                          <p className="text-sm text-muted-foreground">
                            <strong>Due:</strong> {new Date(assignment.dueDate).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              timeZone: 'America/New_York'
                            })}
                          </p>
                        )}

                        {/* Show stuck reason for stuck assignments */}
                        {assignment.completionStatus === 'stuck' && assignment.notes && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3 my-2">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertCircle className="w-4 h-4 text-red-600" />
                              <span className="text-sm font-medium text-red-800">Student got stuck:</span>
                            </div>
                            <p className="text-sm text-red-700">
                              {assignment.notes.split('\n').find((line: any) => line.startsWith('STUCK:'))?.replace('STUCK: ', '') || 'No reason provided'}
                            </p>
                          </div>
                        )}


                        <div className="flex gap-4 text-xs text-muted-foreground/60">
                          <span>Priority: {assignment.priority}</span>
                          <span>Est. Time: {assignment.actualEstimatedMinutes || 30}min</span>
                          {assignment.scheduledDate && (
                            <span>Scheduled: {new Date(assignment.scheduledDate).toLocaleDateString('en-US', {
                              timeZone: 'America/New_York'
                            })}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {/* Canvas Link Button */}
                        {getCanvasUrl(assignment) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(getCanvasUrl(assignment)!, '_blank')}
                            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            data-testid={`button-canvas-${assignment.id}`}
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            Canvas
                          </Button>
                        )}

                        {/* Stuck Assignment - Parent Resolution Button */}
                        {assignment.completionStatus === 'stuck' && (
                          <Button
                            variant="default"
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white"
                            onClick={() => {
                              setResolvingAssignment(assignment);
                              setResolutionNotes('');
                              setResolutionAction('helped');
                              setShowResolutionDialog(true);
                            }}
                            data-testid={`button-resolve-${assignment.id}`}
                          >
                            🔧 Resolve & Reschedule
                          </Button>
                        )}

                        {/* Bible Completion Button */}
                        {assignment.isBibleItem && (
                          <Button
                            variant="default"
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white"
                            onClick={() => {
                              if (confirm(`Mark "${assignment.title}" as complete?`)) {
                                completeBibleMutation.mutate({
                                  weekNumber: assignment.bibleWeek,
                                  dayOfWeek: assignment.bibleDay,
                                  type: assignment.bibleType
                                });
                              }
                            }}
                            disabled={completeBibleMutation.isPending}
                            data-testid={`button-complete-bible-${assignment.id}`}
                          >
                            ✅ Mark Complete
                          </Button>
                        )}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditAssignment(assignment)}
                          data-testid={`button-edit-${assignment.id}`}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-violet-400 text-violet-400 hover:bg-violet-400 hover:text-white dark:border-violet-300 dark:text-violet-300 dark:hover:bg-violet-500"
                          onClick={() => {
                            if (confirm(`Are you sure you want to delete "${assignment.title}"?`)) {
                              deleteAssignmentMutation.mutate(assignment.id);
                            }
                          }}
                          disabled={deleteAssignmentMutation.isPending}
                          data-testid={`button-delete-${assignment.id}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Manual Assignment Creation Form */}
      {showManualForm && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle>Create Manual Assignment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <Input
                  value={manualAssignment.title}
                  onChange={(e) => setManualAssignment({...manualAssignment, title: e.target.value})}
                  placeholder="Assignment title"
                  data-testid="input-manual-title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <Input
                  value={manualAssignment.subject}
                  onChange={(e) => setManualAssignment({...manualAssignment, subject: e.target.value})}
                  placeholder="Subject"
                  data-testid="input-manual-subject"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Course Name</label>
              <Input
                value={manualAssignment.courseName}
                onChange={(e) => setManualAssignment({...manualAssignment, courseName: e.target.value})}
                placeholder="Course name"
                data-testid="input-manual-course"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Instructions</label>
              <Textarea
                value={manualAssignment.instructions}
                onChange={(e) => setManualAssignment({...manualAssignment, instructions: e.target.value})}
                placeholder="Assignment instructions"
                rows={3}
                data-testid="input-manual-instructions"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Due Date</label>
                <Input
                  type="datetime-local"
                  value={manualAssignment.dueDate}
                  onChange={(e) => setManualAssignment({...manualAssignment, dueDate: e.target.value})}
                  data-testid="input-manual-due-date"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <Select value={manualAssignment.priority} onValueChange={(value: 'A' | 'B' | 'C') => 
                  setManualAssignment({...manualAssignment, priority: value})
                }>
                  <SelectTrigger data-testid="select-manual-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A (High)</SelectItem>
                    <SelectItem value="B">B (Medium)</SelectItem>
                    <SelectItem value="C">C (Low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Estimated Minutes</label>
                <Input
                  type="number"
                  value={manualAssignment.actualEstimatedMinutes}
                  onChange={(e) => setManualAssignment({...manualAssignment, actualEstimatedMinutes: parseInt(e.target.value)})}
                  min="1"
                  data-testid="input-manual-minutes"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleCreateManualAssignment}
                disabled={createAssignmentMutation.isPending || !manualAssignment.title}
                data-testid="button-save-manual"
              >
                Create Assignment
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowManualForm(false)}
                data-testid="button-cancel-manual"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Assignment Form */}
      {showEditForm && editingAssignment && (
        <Dialog open={showEditForm} onOpenChange={setShowEditForm}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Assignment</DialogTitle>
              <DialogDescription>
                Make changes to the assignment details below.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <Input
                  value={editingAssignment?.title || ''}
                  onChange={(e) => editingAssignment && setEditingAssignment({...editingAssignment, title: e.target.value})}
                  data-testid="input-edit-title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <Input
                  value={editingAssignment?.subject || ''}
                  onChange={(e) => editingAssignment && setEditingAssignment({...editingAssignment, subject: e.target.value})}
                  data-testid="input-edit-subject"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Course Name</label>
              <Input
                value={editingAssignment?.courseName || ''}
                onChange={(e) => editingAssignment && setEditingAssignment({...editingAssignment, courseName: e.target.value})}
                data-testid="input-edit-course"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Instructions</label>
              <Textarea
                value={editingAssignment?.instructions ? stripHtml(editingAssignment.instructions) : ''}
                onChange={(e) => editingAssignment && setEditingAssignment({...editingAssignment, instructions: e.target.value})}
                rows={3}
                data-testid="input-edit-instructions"
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Due Date</label>
                <Input
                  type="datetime-local"
                  value={editingAssignment?.dueDate ? 
                    (() => {
                      const date = new Date(editingAssignment.dueDate);
                      // Format as YYYY-MM-DDTHH:MM without timezone conversion
                      const year = date.getFullYear();
                      const month = String(date.getMonth() + 1).padStart(2, '0');
                      const day = String(date.getDate()).padStart(2, '0');
                      const hours = String(date.getHours()).padStart(2, '0');
                      const minutes = String(date.getMinutes()).padStart(2, '0');
                      return `${year}-${month}-${day}T${hours}:${minutes}`;
                    })() : ''
                  }
                  onChange={(e) => editingAssignment && setEditingAssignment({
                    ...editingAssignment, 
                    dueDate: e.target.value ? new Date(e.target.value) : null
                  })}
                  data-testid="input-edit-due-date"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <Select value={editingAssignment?.priority || 'B'} onValueChange={(value: 'A' | 'B' | 'C') => 
                  editingAssignment && setEditingAssignment({...editingAssignment, priority: value})
                }>
                  <SelectTrigger data-testid="select-edit-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A (High)</SelectItem>
                    <SelectItem value="B">B (Medium)</SelectItem>
                    <SelectItem value="C">C (Low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <Select value={editingAssignment?.completionStatus || 'pending'} onValueChange={(value) => 
                  editingAssignment && setEditingAssignment({...editingAssignment, completionStatus: value as any})
                }>
                  <SelectTrigger data-testid="select-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="stuck">Stuck</SelectItem>
                    <SelectItem value="grading_delay">Grading Delay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Estimated Minutes</label>
                <Input
                  type="number"
                  value={editingAssignment?.actualEstimatedMinutes || 30}
                  onChange={(e) => editingAssignment && setEditingAssignment({
                    ...editingAssignment, 
                    actualEstimatedMinutes: parseInt(e.target.value)
                  })}
                  min="1"
                  data-testid="input-edit-minutes"
                />
              </div>
            </div>
            </div>

            <DialogFooter className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditForm(false);
                  setEditingAssignment(null);
                }}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={editAssignmentMutation.isPending}
                data-testid="button-save-edit"
              >
                {editAssignmentMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* Parent Resolution Dialog */}
      {showResolutionDialog && resolvingAssignment && (
        <Dialog open={showResolutionDialog} onOpenChange={setShowResolutionDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                🔧 Resolve Stuck Assignment
              </DialogTitle>
            </DialogHeader>
            
            {/* Assignment Context */}
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">Assignment: {resolvingAssignment.title}</h4>
              <div className="space-y-1 text-sm">
                <p><strong>Course:</strong> {resolvingAssignment.courseName}</p>
                <p><strong>Due Date:</strong> {resolvingAssignment.dueDate ? 
                  new Date(resolvingAssignment.dueDate).toLocaleDateString('en-US', {
                    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                  }) : 'No due date'}</p>
                <p><strong>Student's Issue:</strong> {resolvingAssignment.notes?.split('\n').find(line => line.startsWith('STUCK:'))?.replace('STUCK: ', '') || 'No reason provided'}</p>
                <p><strong>Marked Stuck:</strong> {resolvingAssignment.updatedAt ? 
                  new Date(resolvingAssignment.updatedAt).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                  }) : 'Unknown'}</p>
              </div>
            </div>
            
            {/* Resolution Options */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">How did you help resolve this?</Label>
                <RadioGroup value={resolutionAction} onValueChange={setResolutionAction as any} className="mt-3">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="helped" id="helped" />
                    <Label htmlFor="helped" className="cursor-pointer">
                      ✅ <strong>Helped - Ready to retry</strong> - Explained the problem, student understands now
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="modified" id="modified" />
                    <Label htmlFor="modified" className="cursor-pointer">
                      ✏️ <strong>Modified assignment</strong> - Changed requirements or approach
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="excused" id="excused" />
                    <Label htmlFor="excused" className="cursor-pointer">
                      ✅ <strong>Excused/Skipped</strong> - Assignment no longer needed
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="still_needs_work" id="still_needs_work" />
                    <Label htmlFor="still_needs_work" className="cursor-pointer">
                      📅 <strong>Still needs work</strong> - Reschedule for later with more time
                    </Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div>
                <Label htmlFor="resolution-notes">Resolution Notes (optional)</Label>
                <Textarea
                  id="resolution-notes"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder={resolutionAction === 'helped' ? 'What did you explain or help with?' :
                             resolutionAction === 'modified' ? 'What changes did you make?' :
                             resolutionAction === 'excused' ? 'Why is this assignment no longer needed?' :
                             'What additional support is still needed?'}
                  rows={3}
                  className="mt-2"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResolutionDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={() => handleResolveAssignment()}
                className="bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
                disabled={!resolutionAction}
              >
                {resolutionAction === 'helped' ? '✅ Resolve & Reschedule for Today' :
                 resolutionAction === 'modified' ? '✏️ Save Changes & Reschedule' :
                 resolutionAction === 'excused' ? '✅ Mark Complete' :
                 '📅 Reschedule for Later'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}