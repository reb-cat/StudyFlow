import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Circle, RefreshCw, Search, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Assignment } from '@shared/schema';

export default function AdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStudent, setSelectedStudent] = useState<string>('Abigail');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');

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

  // Filter assignments based on search and status - with safety check
  const filteredAssignments = Array.isArray(assignments) ? assignments.filter(assignment => {
    const matchesSearch = assignment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         assignment.subject?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
                         assignment.completionStatus === filterStatus;
    
    return matchesSearch && matchesStatus;
  }) : [];

  // Group assignments by completion status - with safety check
  const pendingCount = Array.isArray(assignments) ? assignments.filter(a => a.completionStatus === 'pending').length : 0;
  const completedCount = Array.isArray(assignments) ? assignments.filter(a => a.completionStatus === 'completed').length : 0;
  const stuckCount = Array.isArray(assignments) ? assignments.filter(a => a.completionStatus === 'stuck').length : 0;

  const handleStatusUpdate = (assignmentId: string, newStatus: string) => {
    updateAssignmentMutation.mutate({ id: assignmentId, completionStatus: newStatus });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: 'Pending', variant: 'outline' as const, icon: Circle },
      completed: { label: 'Done', variant: 'default' as const, icon: CheckCircle },
      stuck: { label: 'Need Help', variant: 'destructive' as const, icon: AlertCircle }
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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Assignment Management</h1>
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Student Selection */}
              <div>
                <label className="text-sm font-medium mb-2 block">Student</label>
                <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Abigail">Abigail</SelectItem>
                    <SelectItem value="Khalil">Khalil</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div>
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search assignments..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label className="text-sm font-medium mb-2 block">Filter by Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending Only</SelectItem>
                    <SelectItem value="completed">Done Only</SelectItem>
                    <SelectItem value="stuck">Need Help Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Summary Stats */}
              <div>
                <label className="text-sm font-medium mb-2 block">Summary</label>
                <div className="text-sm space-y-1">
                  <div>Pending: <span className="font-semibold">{pendingCount}</span></div>
                  <div>Done: <span className="font-semibold text-green-600">{completedCount}</span></div>
                  <div>Need Help: <span className="font-semibold text-orange-600">{stuckCount}</span></div>
                  <div className="text-xs text-muted-foreground border-t pt-1 mt-1">
                    Total: {Array.isArray(assignments) ? assignments.length : 0}
                  </div>
                </div>
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
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-foreground truncate">
                            {assignment.title}
                          </h3>
                          {getStatusBadge(assignment.completionStatus)}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{assignment.subject || 'No subject'}</span>
                          <span>Due: {formatDate(assignment.dueDate ? assignment.dueDate.toString() : null)}</span>
                          {assignment.priority && (
                            <Badge variant="outline" className="text-xs">
                              Priority: {assignment.priority}
                            </Badge>
                          )}
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
                            <SelectItem value="stuck">Need Help</SelectItem>
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