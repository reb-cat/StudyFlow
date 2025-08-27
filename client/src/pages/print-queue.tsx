import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Printer, Check, X, Clock, AlertTriangle, BookOpen, FileText, Calendar } from "lucide-react";

interface PrintQueueItem {
  id: string;
  studentName: string;
  title: string;
  courseName?: string | null;
  subject?: string | null;
  dueDate?: Date | null;
  scheduledDate?: string | null;
  printReason: string;
  priority: 'high' | 'medium' | 'low';
  canvasUrl?: string | null;
  printStatus: 'needs_printing' | 'printed' | 'skipped';
  estimatedPages: number;
}

function getPriorityColor(priority: 'high' | 'medium' | 'low'): string {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-200';
    case 'medium': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-amber-200';
    case 'low': return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 border-teal-200';
  }
}

function getPrintReasonText(reason: string): string {
  switch (reason) {
    case 'worksheet': return '📄 Worksheet/Handout';
    case 'long_instructions': return '📋 Detailed Instructions';
    case 'contains_table': return '📊 Data Table';
    case 'multi_step_procedure': return '🔢 Step-by-Step Guide';
    case 'lab_activity': return '🔬 Science Lab';
    case 'math_problems': return '🔢 Math Problems';
    case 'reference_list': return '📝 Reference Material';
    case 'history_reference': return '📚 History Guide';
    default: return '📄 Printable Material';
  }
}

function getPrintStatusIcon(status: 'needs_printing' | 'printed' | 'skipped') {
  switch (status) {
    case 'needs_printing': return <Clock className="w-4 h-4 text-amber-600" />;
    case 'printed': return <Check className="w-4 h-4 text-emerald-600" />;
    case 'skipped': return <X className="w-4 h-4 text-slate-500" />;
  }
}

interface PrintQueueResponse {
  dateRange: { from: string; to: string };
  totalItems: number;
  groupsByDate: Array<{
    date: string;
    items: PrintQueueItem[];
    count: number;
    highPriorityCount: number;
  }>;
}

export default function PrintQueue() {
  const queryClient = useQueryClient();
  const [daysAhead, setDaysAhead] = useState(4); // Default to 4 days ahead

  const { data: printQueueData, isLoading } = useQuery<PrintQueueResponse>({
    queryKey: ['/api/print-queue', daysAhead],
    queryFn: async () => {
      const response = await fetch(`/api/print-queue?days=${daysAhead}`);
      if (!response.ok) throw new Error('Failed to fetch print queue');
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ assignmentId, status }: { assignmentId: string; status: string }) => {
      const response = await fetch(`/api/print-queue/${assignmentId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error('Failed to update print status');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/print-queue'] });
    },
  });

  // Extract all items from grouped data
  const allItems = printQueueData?.groupsByDate.flatMap(group => group.items) ?? [];
  const pendingItems = allItems.filter(item => item.printStatus === 'needs_printing');
  const completedItems = allItems.filter(item => item.printStatus !== 'needs_printing');

  const totalPages = pendingItems.reduce((sum, item) => sum + item.estimatedPages, 0);
  const highPriorityCount = pendingItems.filter(item => item.priority === 'high').length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-64"></div>
            <div className="h-32 bg-gray-300 dark:bg-gray-700 rounded"></div>
            <div className="h-32 bg-gray-300 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Printer className="w-7 h-7" />
              Print Queue
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Proactive printing support for tomorrow's assignments
            </p>
          </div>
          
          {/* Days Ahead Selector */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Print Range:
            </label>
            <select
              value={daysAhead}
              onChange={(e) => setDaysAhead(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
            >
              <option value={3}>Next 3 days</option>
              <option value={4}>Next 4 days</option>
              <option value={5}>Next 5 days</option>
              <option value={7}>Next week</option>
            </select>
          </div>
        </div>

        {/* Summary Cards */}
        {pendingItems.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <div className="font-semibold text-lg">{pendingItems.length}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Items to Print</div>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <div className="font-semibold text-lg">{highPriorityCount}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">High Priority</div>
                </div>
              </div>
            </Card>
            
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-lg">~{totalPages}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Est. Pages</div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Date Range Info */}
        {printQueueData && (
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Showing assignments due {new Date(printQueueData.dateRange.from).toLocaleDateString()} - {new Date(printQueueData.dateRange.to).toLocaleDateString()}
          </div>
        )}

        {/* Print Queue Items by Date */}
        {pendingItems.length === 0 ? (
          <Card className="p-8 text-center">
            <Check className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              All Set! 🎉
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              No items need printing in this date range. Try a different range!
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {printQueueData?.groupsByDate.map((dateGroup) => (
              <Card key={dateGroup.date} className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Due {new Date(dateGroup.date).toLocaleDateString('en-US', { 
                        weekday: 'long', 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    <span>{dateGroup.count} items</span>
                    {dateGroup.highPriorityCount > 0 && (
                      <span className="text-red-600 font-medium">
                        {dateGroup.highPriorityCount} high priority
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="grid gap-4">
                  {dateGroup.items.filter(item => item.printStatus === 'needs_printing').map((item) => (
                    <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge className={`${getPriorityColor(item.priority)} font-medium`}>
                              {item.priority.toUpperCase()}
                            </Badge>
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              {item.studentName}
                            </span>
                            {item.subject && (
                              <span className="text-sm text-gray-500">
                                • {item.subject}
                              </span>
                            )}
                          </div>
                          
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                            {item.title}
                          </h3>
                          
                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                            <span>{getPrintReasonText(item.printReason)}</span>
                            <span>~{item.estimatedPages} page{item.estimatedPages !== 1 ? 's' : ''}</span>
                            {item.courseName && (
                              <span>{item.courseName}</span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {item.canvasUrl && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex items-center gap-2"
                                onClick={() => window.open(item.canvasUrl!, '_blank')}
                              >
                                <ExternalLink className="w-4 h-4" />
                                Open in Canvas
                              </Button>
                            )}
                            
                            <Button
                              size="sm"
                              variant="default"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => updateStatusMutation.mutate({ assignmentId: item.id, status: 'printed' })}
                              disabled={updateStatusMutation.isPending}
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Mark Printed
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateStatusMutation.mutate({ assignmentId: item.id, status: 'skipped' })}
                              disabled={updateStatusMutation.isPending}
                            >
                              Skip
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Completed Items */}
        {completedItems.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Completed ({completedItems.length})
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {completedItems.map((item) => (
                <Card key={item.id} className="p-3 bg-gray-50 dark:bg-gray-800">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getPrintStatusIcon(item.printStatus)}
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                          {item.studentName}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {item.title}
                      </h4>
                    </div>
                    
                    {item.printStatus === 'printed' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateStatusMutation.mutate({ assignmentId: item.id, status: 'needs_printing' })}
                      >
                        Undo
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateStatusMutation.mutate({ assignmentId: item.id, status: 'needs_printing' })}
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}