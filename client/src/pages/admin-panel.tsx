import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Circle, RefreshCw, Search, Filter, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Assignment } from '@shared/schema';

export default function AdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStudent, setSelectedStudent] = useState<string>('Abigail');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('upcoming');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [bulkOperation, setBulkOperation] = useState<string>('');
  const [selectedAssignments, setSelectedAssignments] = useState<Set<string>>(new Set());

  // Get all assignments for the selected student
  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments', selectedStudent],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/assignments?studentName=${selectedStudent}`);
      return await response.json();
    }
  });

  // Update assignment completion status
  const updateAssignmentMutation = useMutation({
    mutationFn: async ({ id, completionStatus }: { id: string; completionStatus: string }) => {
      const response = await apiRequest('PATCH', `/api/assignments/${id}`, { completionStatus });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      toast({
        title: "Assignment Updated",
        description: "Assignment status has been updated successfully."
      });
    },
    onError: (error) => {
      toast({
        title: "Update Failed",
        description: "Failed to update assignment status.",
        variant: "destructive"
      });
    }
  });

  // Bulk update assignments
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ assignmentIds, status }: { assignmentIds: string[]; status: string }) => {
      const promises = assignmentIds.map(id => 
        apiRequest('PATCH', `/api/assignments/${id}`, { completionStatus: status })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      setSelectedAssignments(new Set());
      toast({
        title: "Bulk Update Complete",
        description: `Updated ${selectedAssignments.size} assignments successfully.`
      });
    }
  });

  // Bulk delete assignments (for problematic imports)
  const bulkDeleteMutation = useMutation({
    mutationFn: async (assignmentIds: string[]) => {
      const promises = assignmentIds.map(id => 
        apiRequest('DELETE', `/api/assignments/${id}`)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      setSelectedAssignments(new Set());
      toast({
        title: "Bulk Delete Complete",
        description: `Deleted ${selectedAssignments.size} assignments successfully.`
      });
    }
  });

  // Retroactive due date extraction
  const extractDueDatesMutation = useMutation({
    mutationFn: async ({ studentName, dryRun }: { studentName?: string; dryRun?: boolean }) => {
      const response = await apiRequest('POST', '/api/assignments/extract-due-dates', {
        studentName,
        dryRun
      });
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
      toast({
        title: "Due Date Extraction Complete",
        description: `✅ Updated ${data.results.updated} assignments, skipped ${data.results.skipped}`
      });
    },
    onError: (error) => {
      toast({
        title: "Extraction Failed",
        description: "Failed to extract due dates from assignments.",
        variant: "destructive"
      });
    }
  });

  // Smart date filtering helper
  const getDateFilteredAssignments = (assignments: Assignment[]) => {
    const now = new Date();
    const currentWeek = new Date(now);
    currentWeek.setDate(now.getDate() - now.getDay()); // Start of current week
    
    const threeWeeksOut = new Date(now);
    threeWeeksOut.setDate(now.getDate() + 21); // 3 weeks from now
    
    switch (dateFilter) {
      case 'upcoming':
        // Current week + next 3 weeks
        return assignments.filter(assignment => {
          if (!assignment.dueDate && !assignment.scheduledDate) return true; // Include assignments without dates
          
          const assignmentDate = assignment.dueDate ? new Date(assignment.dueDate) : 
                                assignment.scheduledDate ? new Date(assignment.scheduledDate) : null;
          
          if (!assignmentDate) return true;
          
          return assignmentDate >= currentWeek && assignmentDate <= threeWeeksOut;
        });
      
      case 'overdue':
        return assignments.filter(assignment => {
          if (!assignment.dueDate) return false;
          const dueDate = new Date(assignment.dueDate);
          return dueDate < now && assignment.completionStatus === 'pending';
        });
      
      case 'this-week':
        const endOfWeek = new Date(currentWeek);
        endOfWeek.setDate(currentWeek.getDate() + 6);
        return assignments.filter(assignment => {
          const assignmentDate = assignment.dueDate ? new Date(assignment.dueDate) : 
                                assignment.scheduledDate ? new Date(assignment.scheduledDate) : null;
          if (!assignmentDate) return false;
          return assignmentDate >= currentWeek && assignmentDate <= endOfWeek;
        });
        
      case 'all':
      default:
        return assignments;
    }
  };

  // Filter assignments based on search, status, source, and smart date filtering
  const filteredAssignments = Array.isArray(assignments) ? getDateFilteredAssignments(assignments).filter(assignment => {
    const matchesSearch = assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         assignment.subject?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
                         assignment.completionStatus === filterStatus;
    
    const matchesSource = sourceFilter === 'all' || 
                         (sourceFilter === 'canvas' && assignment.isCanvasImport) ||
                         (sourceFilter === 'manual' && !assignment.isCanvasImport) ||
                         (sourceFilter === 'canvas1' && assignment.canvasInstance === 1) ||
                         (sourceFilter === 'canvas2' && assignment.canvasInstance === 2);
    
    return matchesSearch && matchesStatus && matchesSource;
  }) : [];

  // Group assignments by completion status - with safety check
  const pendingCount = Array.isArray(assignments) ? assignments.filter(a => a.completionStatus === 'pending').length : 0;
  const completedCount = Array.isArray(assignments) ? assignments.filter(a => a.completionStatus === 'completed').length : 0;
  const needsMoreTimeCount = Array.isArray(assignments) ? assignments.filter(a => a.completionStatus === 'needs_more_time').length : 0;
  const stuckCount = Array.isArray(assignments) ? assignments.filter(a => a.completionStatus === 'stuck').length : 0;

  const handleStatusUpdate = (assignmentId: string, newStatus: string) => {
    updateAssignmentMutation.mutate({ id: assignmentId, completionStatus: newStatus });
  };

  const handleBulkAction = () => {
    if (selectedAssignments.size === 0) {
      toast({
        title: "No Selection",
        description: "Please select assignments first.",
        variant: "destructive"
      });
      return;
    }

    if (bulkOperation === 'delete') {
      if (confirm(`Are you sure you want to delete ${selectedAssignments.size} assignments? This cannot be undone.`)) {
        bulkDeleteMutation.mutate(Array.from(selectedAssignments));
      }
    } else if (bulkOperation) {
      bulkUpdateMutation.mutate({
        assignmentIds: Array.from(selectedAssignments),
        status: bulkOperation
      });
    }
  };

  const toggleAssignmentSelection = (assignmentId: string) => {
    const newSelection = new Set(selectedAssignments);
    if (newSelection.has(assignmentId)) {
      newSelection.delete(assignmentId);
    } else {
      newSelection.add(assignmentId);
    }
    setSelectedAssignments(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedAssignments.size === filteredAssignments.length) {
      setSelectedAssignments(new Set());
    } else {
      setSelectedAssignments(new Set(filteredAssignments.map(a => a.id)));
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'outline' as const, icon: Circle },
      completed: { label: 'Done', variant: 'default' as const, icon: CheckCircle },
      needs_more_time: { label: 'Need More Time', variant: 'secondary' as const, icon: Clock },
      stuck: { label: 'Stuck', variant: 'destructive' as const, icon: AlertCircle }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No due date';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, var(--background) 0%, var(--surface-secondary) 100%)' }}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ 
            background: 'linear-gradient(135deg, var(--foreground) 0%, var(--primary) 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Assignment Management</h1>
          <p className="text-muted-foreground">
            Manage assignment completion status to control what appears in daily planning
          </p>
        </div>

        {/* Controls */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Controls</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Executive Function Optimized - Single Column Layout */}
            <div className="admin-controls" style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              maxWidth: '400px'
            }}>
              {/* Student Selection */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{
                  display: 'block',
                  fontWeight: '600',
                  marginBottom: '0.5rem'
                }}>Student</label>
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select student..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Abigail">Abigail</SelectItem>
                    <SelectItem value="Khalil">Khalil</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{
                  display: 'block',
                  fontWeight: '600',
                  marginBottom: '0.5rem'
                }}>Search Assignments</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{
                  display: 'block',
                  fontWeight: '600',
                  marginBottom: '0.5rem'
                }}>Filter by Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending Only</SelectItem>
                    <SelectItem value="completed">Done Only</SelectItem>
                    <SelectItem value="needs_more_time">Need More Time Only</SelectItem>
                    <SelectItem value="stuck">Stuck Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Filter */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{
                  display: 'block',
                  fontWeight: '600',
                  marginBottom: '0.5rem'
                }}>Date Range</label>
                <Select value={dateFilter} onValueChange={setDateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select date range..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">📅 Next 3 Weeks</SelectItem>
                    <SelectItem value="this-week">📆 This Week Only</SelectItem>
                    <SelectItem value="overdue">⚠️ Overdue Items</SelectItem>
                    <SelectItem value="all">📋 All Assignments</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Source Filter */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label className="form-label" style={{
                  display: 'block',
                  fontWeight: '600',
                  marginBottom: '0.5rem'
                }}>Source</label>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select source..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="canvas">Canvas Only</SelectItem>
                    <SelectItem value="canvas1">Canvas Instance 1</SelectItem>
                    <SelectItem value="canvas2">Canvas Instance 2</SelectItem>
                    <SelectItem value="manual">Manual Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium mb-3">Summary</h4>
              <div className="text-sm space-y-1">
                <div>Pending: <span className="font-semibold">{pendingCount}</span></div>
                <div>Done: <span className="font-semibold text-green-600">{completedCount}</span></div>
                <div>Need More Time: <span className="font-semibold text-blue-600">{needsMoreTimeCount}</span></div>
                <div>Stuck: <span className="font-semibold text-red-600">{stuckCount}</span></div>
                <div className="text-xs text-muted-foreground border-t pt-1 mt-1">
                  Total: {Array.isArray(assignments) ? assignments.length : 0}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Operations */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Bulk Operations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedAssignments.size === filteredAssignments.length && filteredAssignments.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm">
                  {selectedAssignments.size > 0 ? `${selectedAssignments.size} selected` : 'Select all'}
                </span>
              </div>
              
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{
                  display: 'block',
                  fontWeight: '600',
                  marginBottom: '0.5rem'
                }}>Bulk Action</label>
                <Select value={bulkOperation} onValueChange={setBulkOperation}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Choose action..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Mark as Done</SelectItem>
                    <SelectItem value="pending">Mark as Pending</SelectItem>
                    <SelectItem value="needs_more_time">Mark as Need More Time</SelectItem>
                    <SelectItem value="stuck">Mark as Stuck</SelectItem>
                    <SelectItem value="delete">🗑️ Delete (Careful!)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={handleBulkAction}
                disabled={selectedAssignments.size === 0 || !bulkOperation || bulkUpdateMutation.isPending || bulkDeleteMutation.isPending}
                variant="outline"
              >
                {bulkUpdateMutation.isPending || bulkDeleteMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Apply to {selectedAssignments.size} items
              </Button>
            </div>
            
            {/* Retroactive Due Date Extraction */}
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <h4 className="text-sm font-medium mb-1">Smart Due Date Extraction</h4>
                  <p className="text-xs text-muted-foreground">
                    Automatically extract due dates from assignment titles with "Due 1/15", "Test on 10/6", etc.
                  </p>
                </div>
                <Button 
                  onClick={() => extractDueDatesMutation.mutate({ studentName: selectedStudent })}
                  disabled={extractDueDatesMutation.isPending}
                  variant="secondary"
                  size="sm"
                >
                  {extractDueDatesMutation.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Clock className="h-4 w-4 mr-2" />
                  )}
                  Extract Due Dates
                </Button>
                <Button 
                  onClick={() => extractDueDatesMutation.mutate({ studentName: selectedStudent, dryRun: true })}
                  disabled={extractDueDatesMutation.isPending}
                  variant="outline"
                  size="sm"
                >
                  Test Run
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assignment List */}
        <Card>
          <CardHeader>
            <CardTitle>
              Assignments for {selectedStudent}
              <span className="text-sm font-normal text-muted-foreground ml-2">
                ({filteredAssignments.length} of {Array.isArray(assignments) ? assignments.length : 0})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading assignments...</p>
              </div>
            ) : filteredAssignments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No assignments found matching your criteria.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAssignments.map((assignment) => (
                  <div 
                    key={assignment.id}
                    className={`border rounded-lg p-4 hover:bg-muted/50 transition-colors ${
                      selectedAssignments.has(assignment.id) ? 'ring-2 ring-primary bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Checkbox
                          checked={selectedAssignments.has(assignment.id)}
                          onCheckedChange={() => toggleAssignmentSelection(assignment.id)}
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-foreground truncate">
                              {assignment.title}
                            </h3>
                            {getStatusBadge(assignment.completionStatus || 'pending')}
                            {assignment.isCanvasImport && (
                              <Badge variant="secondary" className="text-xs">
                                Canvas {assignment.canvasInstance || ''}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{assignment.courseName || assignment.subject || 'No course'}</span>
                            <span>Due: {formatDate(assignment.dueDate ? assignment.dueDate.toString() : null)}</span>
                            {assignment.canvasCategory && (
                              <span className="text-xs bg-muted px-2 py-1 rounded">
                                {assignment.canvasCategory}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Select
                          value={assignment.completionStatus || 'pending'}
                          onValueChange={(value) => handleStatusUpdate(assignment.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="completed">Done</SelectItem>
                            <SelectItem value="needs_more_time">Need More Time</SelectItem>
                            <SelectItem value="stuck">Stuck</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}