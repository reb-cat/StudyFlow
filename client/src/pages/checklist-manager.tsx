import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { ChecklistItem, InsertChecklistItem } from '@shared/schema';
import { invalidateChecklistRelatedQueries } from '@/lib/cacheUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { ArrowLeft, Plus, Edit, Trash2, Save, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

type NewItem = {
  studentName: string;
  subject: string;
  itemName: string;
  category: 'books' | 'materials' | 'general';
};

export default function ChecklistManager() {
  const [selectedStudent, setSelectedStudent] = useState('Abigail');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newItem, setNewItem] = useState<NewItem>({
    studentName: 'Abigail',
    subject: '',
    itemName: '',
    category: 'materials'
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get checklist items for selected student
  const { data: checklistItems = [], isLoading } = useQuery<ChecklistItem[]>({
    queryKey: [`/api/checklist/${selectedStudent}`],
    enabled: !!selectedStudent,
  });

  // Get unique subjects from checklist items
  const subjects = Array.from(new Set(checklistItems.map(item => item.subject))).sort();

  // Filter items by selected subject
  const filteredItems = selectedSubject && selectedSubject !== 'all'
    ? checklistItems.filter(item => item.subject === selectedSubject)
    : checklistItems;

  // Create new item
  const createMutation = useMutation({
    mutationFn: async (data: InsertChecklistItem) => {
      const response = await apiRequest('POST', '/api/checklist', { body: JSON.stringify(data) });
      return response.json();
    },
    onSuccess: async () => {
      await invalidateChecklistRelatedQueries(selectedStudent);
      toast({ title: "Success", description: "Checklist item added successfully!" });
      setIsAddingNew(false);
      setNewItem({ studentName: selectedStudent, subject: '', itemName: '', category: 'materials' });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to add item", variant: "destructive" });
    }
  });

  // Update item
  const updateMutation = useMutation({
    mutationFn: async (item: ChecklistItem) => {
      const response = await apiRequest('PATCH', `/api/checklist/${item.id}`, { 
        body: JSON.stringify({ 
          itemName: item.itemName, 
          category: item.category,
          subject: item.subject
        }) 
      });
      return response.json();
    },
    onSuccess: async () => {
      await invalidateChecklistRelatedQueries(selectedStudent);
      toast({ title: "Success", description: "Item updated successfully!" });
      setEditingItem(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update item", variant: "destructive" });
    }
  });

  // Delete item
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/checklist/${id}`);
    },
    onSuccess: async () => {
      await invalidateChecklistRelatedQueries(selectedStudent);
      toast({ title: "Success", description: "Item deleted successfully!" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete item", variant: "destructive" });
    }
  });

  const handleAddNew = () => {
    if (!newItem.subject || !newItem.itemName) {
      toast({ title: "Error", description: "Subject and item name are required", variant: "destructive" });
      return;
    }
    createMutation.mutate(newItem as InsertChecklistItem);
  };

  const handleUpdateItem = () => {
    if (!editingItem) return;
    updateMutation.mutate(editingItem);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'books': return '📚';
      case 'materials': return '✏️';
      case 'general': return '📋';
      default: return '📝';
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-6 bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="sm" data-testid="button-back">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Admin
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Checklist Manager</h1>
              <p className="text-muted-foreground">Customize prep items for each subject</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <Label htmlFor="student-select">Student</Label>
            <Select value={selectedStudent} onValueChange={setSelectedStudent}>
              <SelectTrigger>
                <SelectValue placeholder="Select student" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Abigail">Abigail</SelectItem>
                <SelectItem value="Khalil">Khalil</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="subject-filter">Filter by Subject</Label>
            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
              <SelectTrigger>
                <SelectValue placeholder="All subjects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {subjects.map(subject => (
                  <SelectItem key={subject} value={subject}>{subject}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button 
              onClick={() => setIsAddingNew(true)} 
              className="w-full"
              data-testid="button-add-item"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Item
            </Button>
          </div>
        </div>

        {/* Add New Item Form */}
        {isAddingNew && (
          <Card className="mb-6 bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg">Add New Checklist Item</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="new-subject">Subject</Label>
                  <Input
                    id="new-subject"
                    value={newItem.subject}
                    onChange={(e) => setNewItem({ ...newItem, subject: e.target.value })}
                    placeholder="e.g., Math, English, Art"
                    data-testid="input-new-subject"
                  />
                </div>
                <div>
                  <Label htmlFor="new-category">Category</Label>
                  <Select 
                    value={newItem.category} 
                    onValueChange={(value) => setNewItem({ ...newItem, category: value as 'books' | 'materials' | 'general' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="books">📚 Books</SelectItem>
                      <SelectItem value="materials">✏️ Materials</SelectItem>
                      <SelectItem value="general">📋 General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="new-item">Item Name</Label>
                <Textarea
                  id="new-item"
                  value={newItem.itemName}
                  onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                  placeholder="Describe the specific item needed"
                  rows={2}
                  data-testid="input-new-item-name"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleAddNew} 
                  disabled={createMutation.isPending}
                  data-testid="button-save-new"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {createMutation.isPending ? 'Adding...' : 'Add Item'}
                </Button>
                <Button variant="outline" onClick={() => setIsAddingNew(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Items List */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>Checklist Items for {selectedStudent}</span>
              <Badge variant="secondary">{filteredItems.length} items</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading items...</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No items found. Add some custom prep items for your co-op classes!
              </div>
            ) : (
              <div className="space-y-4">
                {filteredItems.map((item) => (
                  <div 
                    key={item.id} 
                    className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30"
                  >
                    {editingItem?.id === item.id ? (
                      // Edit mode
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 mr-4">
                        <Input
                          value={editingItem.subject}
                          onChange={(e) => setEditingItem({ ...editingItem, subject: e.target.value })}
                          placeholder="Subject"
                        />
                        <Select 
                          value={editingItem.category} 
                          onValueChange={(value) => setEditingItem({ ...editingItem, category: value as 'books' | 'materials' | 'general' })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="books">📚 Books</SelectItem>
                            <SelectItem value="materials">✏️ Materials</SelectItem>
                            <SelectItem value="general">📋 General</SelectItem>
                          </SelectContent>
                        </Select>
                        <Textarea
                          value={editingItem.itemName}
                          onChange={(e) => setEditingItem({ ...editingItem, itemName: e.target.value })}
                          placeholder="Item name"
                          rows={1}
                        />
                      </div>
                    ) : (
                      // View mode
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{getCategoryIcon(item.category)}</span>
                          <div>
                            <div className="font-medium text-foreground">{item.itemName}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.subject} • {item.category}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {editingItem?.id === item.id ? (
                        <>
                          <Button 
                            size="sm" 
                            onClick={handleUpdateItem}
                            disabled={updateMutation.isPending}
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setEditingItem(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setEditingItem(item)}
                            data-testid={`button-edit-${item.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => deleteMutation.mutate(item.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${item.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Text */}
        <Card className="mt-6 bg-muted/50 border-muted">
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-2">💡 Tips:</p>
              <ul className="space-y-1 pl-4">
                <li>• Create specific items for each subject (e.g., "TI-84 calculator and graph paper" instead of generic "math supplies")</li>
                <li>• Use Books for textbooks and reading materials, Materials for supplies and tools</li>
                <li>• Items will appear in your Co-op Prep Checklist when those subjects are scheduled</li>
                <li>• Be specific about what you actually need - this replaces generic items like "Art supplies and sketchbook"</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}