import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, Circle, RefreshCw, Search, Filter, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import type { Assignment } from '@shared/schema';
import { BibleResetButton } from '@/components/admin/BibleResetButton';

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
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get assignments for the selected student (limited to current week for better usability)
  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['/api/assignments', selectedStudent, dateFilter],
    queryFn: async () => {
      // Calculate date range for current week plus buffer
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 7); // 1 week back
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() + 14); // 2 weeks forward
      
      const params = new URLSearchParams({
        studentName: selectedStudent,
        includeCompleted: 'true', // Admin needs to see completed assignments
        startDate: weekStart.toISOString().split('T')[0],
        endDate: weekEnd.toISOString().split('T')[0]
      });
      
      const response = await apiRequest('GET', `/api/assignments?${params.toString()}`);
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
    <div className="min-h-screen" style={{ 
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, \'Segoe UI\', system-ui, sans-serif',
      background: 'linear-gradient(135deg, #F8F9FA 0%, #F1F3F4 100%)',
      color: '#212529'
    }}>
      {/* Header with breadcrumbs */}
      <div style={{
        background: '#FFFFFF',
        borderBottom: '1px solid #DEE2E6',
        padding: '1rem 2rem',
        boxShadow: '0 1px 2px rgba(33, 37, 41, 0.05)'
      }}>
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.875rem',
          color: '#6C757D',
          marginBottom: '0.5rem'
        }}>
          <a href="/khalil" style={{ color: '#844FC1', textDecoration: 'none' }}>Home</a>
          <span>›</span>
          <span>Assignment Management</span>
        </nav>
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: '700',
          color: '#212529',
          margin: 0
        }}>Assignment Management</h1>
      </div>

      {/* Main layout */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem',
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        gap: '2rem',
        alignItems: 'start'
      }}>
        {/* Left sidebar - simplified controls */}
        <aside style={{ position: 'sticky', top: '2rem' }}>
          {/* Primary Controls */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #DEE2E6',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '1rem',
            boxShadow: '0 1px 2px rgba(33, 37, 41, 0.05)'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#212529',
              marginBottom: '1rem'
            }}>Quick Filters</h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#212529',
                marginBottom: '0.5rem'
              }}>Student</label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger style={{
                  background: '#FFFFFF',
                  border: '1px solid #DEE2E6',
                  borderRadius: '8px'
                }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Abigail">Abigail</SelectItem>
                  <SelectItem value="Khalil">Khalil</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Bible Reset Controls */}
            <div style={{ marginBottom: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #DEE2E6' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#212529',
                marginBottom: '0.5rem'
              }}>Bible Curriculum</label>
              <BibleResetButton 
                studentName={selectedStudent} 
                onSuccess={() => {
                  toast({
                    title: 'Success',
                    description: `${selectedStudent}'s Bible progress has been reset`
                  });
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#212529',
                marginBottom: '0.5rem'
              }}>Search Assignments</label>
              <div style={{ position: 'relative' }}>
                <Search style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#6C757D',
                  width: '16px',
                  height: '16px'
                }} />
                <Input
                  placeholder="Search by title or subject..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    paddingLeft: '2.5rem',
                    background: '#FFFFFF',
                    border: '1px solid #DEE2E6',
                    borderRadius: '8px'
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#212529',
                marginBottom: '0.5rem'
              }}>Show Only</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger style={{
                  background: '#FFFFFF',
                  border: '1px solid #DEE2E6',
                  borderRadius: '8px'
                }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignments</SelectItem>
                  <SelectItem value="pending">Pending Only</SelectItem>
                  <SelectItem value="completed">Completed Only</SelectItem>
                  <SelectItem value="stuck">Need Help Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Advanced Controls - Collapsed */}
            <div style={{ marginTop: '1rem' }}>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#844FC1',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  padding: '0.5rem 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span>{showAdvanced ? 'Hide Filters' : 'Show More Filters'}</span>
                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {showAdvanced && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#212529',
                      marginBottom: '0.5rem'
                    }}>Date Range</label>
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                      <SelectTrigger style={{
                        background: '#FFFFFF',
                        border: '1px solid #DEE2E6',
                        borderRadius: '8px'
                      }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="upcoming">Next 3 Weeks</SelectItem>
                        <SelectItem value="this-week">This Week Only</SelectItem>
                        <SelectItem value="overdue">Overdue Items</SelectItem>
                        <SelectItem value="all">All Dates</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: '#212529',
                      marginBottom: '0.5rem'
                    }}>Source</label>
                    <Select value={sourceFilter} onValueChange={setSourceFilter}>
                      <SelectTrigger style={{
                        background: '#FFFFFF',
                        border: '1px solid #DEE2E6',
                        borderRadius: '8px'
                      }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sources</SelectItem>
                        <SelectItem value="canvas">Canvas Only</SelectItem>
                        <SelectItem value="manual">Manual Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Summary Stats */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #DEE2E6',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '1rem',
            boxShadow: '0 1px 2px rgba(33, 37, 41, 0.05)'
          }}>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#212529',
              marginBottom: '1rem'
            }}>Summary</h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              marginTop: '1rem'
            }}>
              <div style={{
                textAlign: 'center',
                padding: '0.75rem',
                background: '#F1F3F4',
                borderRadius: '8px'
              }}>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  marginBottom: '0.25rem',
                  color: '#844FC1'
                }}>{Array.isArray(assignments) ? assignments.length : 0}</div>
                <div style={{
                  fontSize: '0.75rem',
                  color: '#6C757D',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Total</div>
              </div>
              <div style={{
                textAlign: 'center',
                padding: '0.75rem',
                background: '#F1F3F4',
                borderRadius: '8px'
              }}>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  marginBottom: '0.25rem',
                  color: '#21BF06'
                }}>{completedCount}</div>
                <div style={{
                  fontSize: '0.75rem',
                  color: '#6C757D',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Done</div>
              </div>
              <div style={{
                textAlign: 'center',
                padding: '0.75rem',
                background: '#F1F3F4',
                borderRadius: '8px'
              }}>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  marginBottom: '0.25rem',
                  color: '#3B86D1'
                }}>{pendingCount}</div>
                <div style={{
                  fontSize: '0.75rem',
                  color: '#6C757D',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Pending</div>
              </div>
              <div style={{
                textAlign: 'center',
                padding: '0.75rem',
                background: '#F1F3F4',
                borderRadius: '8px'
              }}>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  marginBottom: '0.25rem',
                  color: '#6C7293'
                }}>{stuckCount}</div>
                <div style={{
                  fontSize: '0.75rem',
                  color: '#6C757D',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>Stuck</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content - Assignment List */}
        <main style={{
          background: '#FFFFFF',
          border: '1px solid #DEE2E6',
          borderRadius: '12px',
          boxShadow: '0 1px 2px rgba(33, 37, 41, 0.05)'
        }}>
          <div style={{
            padding: '1.5rem',
            borderBottom: '1px solid #DEE2E6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h2 style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                color: '#212529',
                margin: 0
              }}>Assignments for {selectedStudent}</h2>
              <p style={{
                fontSize: '0.875rem',
                color: '#6C757D',
                margin: '0.25rem 0 0 0'
              }}>Showing {filteredAssignments.length} of {Array.isArray(assignments) ? assignments.length : 0} assignments</p>
            </div>
          </div>

          <div style={{
            maxHeight: '70vh',
            overflowY: 'auto'
          }}>
            {/* Bulk Operations Controls */}
            <div style={{
              padding: '1rem 1.5rem',
              borderBottom: '1px solid #DEE2E6',
              background: '#F8F9FA',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Checkbox
                  checked={selectedAssignments.size === filteredAssignments.length && filteredAssignments.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span style={{ fontSize: '0.875rem' }}>
                  {selectedAssignments.size > 0 ? `${selectedAssignments.size} selected` : 'Select all'}
                </span>
              </div>
              
              <Select value={bulkOperation} onValueChange={setBulkOperation}>
                <SelectTrigger style={{
                  width: '200px',
                  background: '#FFFFFF',
                  border: '1px solid #DEE2E6',
                  borderRadius: '8px'
                }}>
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
              
              <Button 
                onClick={handleBulkAction}
                disabled={selectedAssignments.size === 0 || !bulkOperation || bulkUpdateMutation.isPending || bulkDeleteMutation.isPending}
                style={{
                  background: selectedAssignments.size === 0 || !bulkOperation ? '#F1F3F4' : '#844FC1',
                  color: selectedAssignments.size === 0 || !bulkOperation ? '#6C757D' : 'white',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: selectedAssignments.size === 0 || !bulkOperation ? 'not-allowed' : 'pointer'
                }}
              >
                {bulkUpdateMutation.isPending || bulkDeleteMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Apply to {selectedAssignments.size} items
              </Button>
            </div>

            {/* Assignment List */}
            {filteredAssignments.map((assignment) => (
              <div
                key={assignment.id}
                style={{
                  padding: '1rem 1.5rem',
                  borderBottom: '1px solid #DEE2E6',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#F1F3F4'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <Checkbox
                  checked={selectedAssignments.has(assignment.id)}
                  onCheckedChange={() => toggleAssignmentSelection(assignment.id)}
                  style={{ accentColor: '#844FC1' }}
                />
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: '600',
                    color: '#212529',
                    marginBottom: '0.25rem',
                    wordWrap: 'break-word'
                  }}>
                    {assignment.title}
                  </div>
                  <div style={{
                    fontSize: '0.875rem',
                    color: '#6C757D',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                  }}>
                    <span>{assignment.subject || assignment.courseName || 'No Subject'}</span>
                    <span>Due: {formatDate(assignment.dueDate ? assignment.dueDate.toString() : null)}</span>
                    <span>{assignment.isCanvasImport ? 'Canvas' : 'Manual'}</span>
                  </div>
                </div>
                
                <div style={{ marginLeft: 'auto' }}>
                  {getStatusBadge(assignment.completionStatus || 'pending')}
                </div>
              </div>
            ))}
            
            {filteredAssignments.length === 0 && (
              <div style={{
                padding: '3rem 1.5rem',
                textAlign: 'center',
                color: '#6C757D'
              }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📝</div>
                <div style={{ fontSize: '1.125rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                  No assignments found
                </div>
                <div style={{ fontSize: '0.875rem' }}>
                  Try adjusting your filters or check back later
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}