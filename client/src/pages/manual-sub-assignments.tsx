import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Book, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Assignment {
  id: string;
  title: string;
  subject: string;
  canvasId: number;
  instructions: string;
  dueDate: string;
  notes?: string;
}

interface SubAssignment {
  title: string;
  instructions: string;
  estimatedMinutes: number;
  order: number;
}

export default function ManualSubAssignments() {
  const [selectedParentId, setSelectedParentId] = useState('');
  const [subAssignments, setSubAssignments] = useState<SubAssignment[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch ACTIVE assignments that can be split (pending work only)
  const { data: canvasAssignments = [] } = useQuery({
    queryKey: ['/api/assignments', 'splittable'],
    queryFn: async () => {
      // Get only PENDING assignments (not completed) for both students
      const [khalilResponse, abigailResponse] = await Promise.all([
        fetch('/api/assignments?studentName=Khalil'), // Remove includeCompleted=true
        fetch('/api/assignments?studentName=Abigail') // Remove includeCompleted=true
      ]);
      
      if (!khalilResponse.ok || !abigailResponse.ok) {
        throw new Error('Failed to fetch assignments');
      }
      
      const khalilAssignments = await khalilResponse.json();
      const abigailAssignments = await abigailResponse.json();
      
      // Combine and filter for splittable assignments
      const allAssignments = [...khalilAssignments, ...abigailAssignments];
      const now = new Date();
      const twoMonthsFromNow = new Date(now.getTime() + (60 * 24 * 60 * 60 * 1000)); // 60 days
      
      return allAssignments.filter((a: Assignment) => {
        // Must not already be a sub-assignment
        if (a.notes?.includes('PARENT_CANVAS_ID')) return false;
        
        // Must have a meaningful title
        if (!a.title || a.title.length < 10) return false;
        
        // Filter out administrative assignments (fees, forms, etc.)
        const title = a.title.toLowerCase();
        if (title.includes('fee') || 
            title.includes('syllabus') || 
            title.includes('sign') || 
            title.includes('honor code') ||
            title.includes('supply fee') ||
            title.includes('copy fee')) {
          return false;
        }
        
        // Only show assignments due within next 60 days (or overdue)
        if (a.dueDate) {
          const dueDate = new Date(a.dueDate);
          if (dueDate > twoMonthsFromNow) return false;
        }
        
        return true;
      });
    }
  });

  // Get selected parent assignment
  const selectedParent = canvasAssignments.find((a: Assignment) => a.id === selectedParentId);

  // Create sub-assignments mutation
  const createSubAssignmentsMutation = useMutation({
    mutationFn: async ({ parentId, subAssignments }: { parentId: string; subAssignments: SubAssignment[] }) => {
      return await apiRequest('POST', `/api/assignments/${parentId}/create-sub-assignments`, {
        subAssignments
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Sub-assignments created successfully!",
      });
      setSubAssignments([]);
      setSelectedParentId('');
      queryClient.invalidateQueries({ queryKey: ['/api/assignments'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to create sub-assignments: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Add a new sub-assignment
  const addSubAssignment = () => {
    const newOrder = subAssignments.length + 1;
    setSubAssignments([...subAssignments, {
      title: `Lesson ${newOrder}`,
      instructions: '',
      estimatedMinutes: 30,
      order: newOrder
    }]);
  };

  // Remove a sub-assignment
  const removeSubAssignment = (index: number) => {
    const updated = subAssignments.filter((_, i) => i !== index);
    // Reorder
    const reordered = updated.map((sub, i) => ({ ...sub, order: i + 1 }));
    setSubAssignments(reordered);
  };

  // Update sub-assignment
  const updateSubAssignment = (index: number, field: keyof SubAssignment, value: string | number) => {
    const updated = [...subAssignments];
    updated[index] = { ...updated[index], [field]: value };
    setSubAssignments(updated);
  };

  // Create sub-assignments
  const handleCreate = () => {
    if (!selectedParentId || subAssignments.length === 0) {
      toast({
        title: "Error",
        description: "Please select a parent assignment and add sub-assignments",
        variant: "destructive",
      });
      return;
    }

    createSubAssignmentsMutation.mutate({
      parentId: selectedParentId,
      subAssignments
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Manual Sub-Assignment Creator</h1>
        <p className="text-muted-foreground">
          Break down large Canvas assignments into smaller, executive function-friendly tasks
        </p>
      </div>

      <div className="grid gap-6">
        {/* Parent Assignment Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Book className="h-5 w-5" />
              Select Canvas Assignment to Split
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="parent-select">Parent Assignment</Label>
                <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose active assignment to break down..." />
                  </SelectTrigger>
                  <SelectContent>
                    {canvasAssignments.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No active assignments available for breakdown
                      </SelectItem>
                    ) : (
                      canvasAssignments.map((assignment: Assignment) => (
                        <SelectItem key={assignment.id} value={assignment.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{assignment.title}</span>
                            <span className="text-sm text-muted-foreground">
                              {assignment.subject} • Due: {assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'No date'}
                              {assignment.canvasId && <Badge variant="outline" className="ml-2">Canvas</Badge>}
                            </span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              {selectedParent && (
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Selected Assignment:</h4>
                  <p className="text-sm mb-2"><strong>Title:</strong> {selectedParent.title}</p>
                  <p className="text-sm mb-2"><strong>Subject:</strong> {selectedParent.subject}</p>
                  {selectedParent.canvasId ? (
                    <Badge variant="outline">Canvas ID: {selectedParent.canvasId}</Badge>
                  ) : (
                    <Badge variant="secondary">Manual Assignment</Badge>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sub-Assignment Builder */}
        {selectedParentId && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Create Sub-Assignments
                <Button onClick={addSubAssignment} size="sm" className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Sub-Assignment
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {subAssignments.map((subAssignment, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <Label htmlFor={`title-${index}`}>Title</Label>
                        <Input
                          id={`title-${index}`}
                          value={subAssignment.title}
                          onChange={(e) => updateSubAssignment(index, 'title', e.target.value)}
                          placeholder="e.g., Read Lesson 1 + Answer Questions"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`time-${index}`}>Estimated Minutes</Label>
                        <Input
                          id={`time-${index}`}
                          type="number"
                          value={subAssignment.estimatedMinutes}
                          onChange={(e) => updateSubAssignment(index, 'estimatedMinutes', parseInt(e.target.value) || 30)}
                          min="10"
                          max="120"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          onClick={() => removeSubAssignment(index)}
                          variant="destructive"
                          size="sm"
                          className="flex items-center gap-2"
                        >
                          <Trash2 className="h-4 w-4" />
                          Remove
                        </Button>
                      </div>
                    </div>
                    
                    {/* Instructions field - full width */}
                    <div className="mb-3">
                      <Label htmlFor={`instructions-${index}`}>Instructions (what exactly should the student do?)</Label>
                      <Textarea
                        id={`instructions-${index}`}
                        value={subAssignment.instructions}
                        onChange={(e) => updateSubAssignment(index, 'instructions', e.target.value)}
                        placeholder="e.g., Read pages 15-20 in your textbook, then answer questions 1-5 on the worksheet. Focus on identifying key historical events and their causes."
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                    
                    <Badge variant="secondary">Order: {subAssignment.order}</Badge>
                  </div>
                ))}

                {subAssignments.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Click "Add Sub-Assignment" to start breaking down the assignment
                  </div>
                )}

                {subAssignments.length > 0 && (
                  <div className="flex justify-end pt-4">
                    <Button 
                      onClick={handleCreate}
                      disabled={createSubAssignmentsMutation.isPending}
                      className="flex items-center gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {createSubAssignmentsMutation.isPending ? 'Creating...' : 'Create Sub-Assignments'}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}