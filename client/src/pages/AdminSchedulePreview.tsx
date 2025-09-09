import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, RefreshCw, AlertTriangle, Database, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";

interface Assignment {
  id: string;
  title: string;
  subject: string;
  dueDate: string | null;
  scheduledDate: string | null;
  completionStatus: string;
  userId: string;
  canvasId: string | null;
  timeEstimate: number;
  isManualSplit?: boolean;
}

interface CacheStats {
  assignmentCache: { size: number; keys: string[] };
  scheduleCache: { size: number; keys: string[] };
  canvasCache: { size: number; keys: string[] };
}

interface AssignmentSource {
  database: Assignment[];
  cached: Assignment[];
  phantoms: Assignment[];
}

export default function AdminSchedulePreview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Get cache statistics
  const { data: cacheStats } = useQuery<CacheStats>({
    queryKey: ['/api/debug/cache-stats'],
    refetchInterval: 10000, // Update every 10 seconds
  });

  // Get assignment sources for Khalil
  const { data: assignmentSources, refetch: refetchSources } = useQuery<AssignmentSource>({
    queryKey: ['/api/debug/assignment-sources', selectedDate],
    enabled: !!selectedDate,
  });

  // Delete assignment mutation
  const deleteAssignmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const response = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to delete assignment');
      }
    },
    onSuccess: () => {
      toast({
        title: "Assignment Deleted",
        description: "Assignment and related cache entries cleared",
      });
      refetchSources();
      queryClient.invalidateQueries({ queryKey: ['/api/debug/cache-stats'] });
    },
    onError: (error) => {
      toast({
        title: "Deletion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: async (cacheType: string) => {
      const response = await fetch('/api/debug/clear-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cacheType }),
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to clear cache');
      }
    },
    onSuccess: (_, cacheType) => {
      toast({
        title: "Cache Cleared",
        description: `${cacheType} cache has been cleared`,
      });
      refetchSources();
      queryClient.invalidateQueries({ queryKey: ['/api/debug/cache-stats'] });
    },
    onError: (error) => {
      toast({
        title: "Cache Clear Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      completed: "default",
      needs_more_time: "secondary",
      skipped: "destructive",
    };
    return variants[status] || "outline";
  };

  return (
    <div className="min-h-screen bg-background p-4 space-y-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Schedule Preview & Cache Management</h1>
            <p className="text-muted-foreground">Monitor assignments and clear phantom cache entries</p>
          </div>
          <Link href="/admin">
            <Button variant="outline">Back to Admin</Button>
          </Link>
        </div>

        {/* Date Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Select Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border rounded-md"
            />
          </CardContent>
        </Card>

        {/* Cache Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Cache Statistics
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/debug/cache-stats'] })}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cacheStats ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Assignment Cache</h3>
                  <p className="text-2xl font-bold text-blue-600">{cacheStats.assignmentCache.size}</p>
                  <p className="text-sm text-muted-foreground">entries</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => clearCacheMutation.mutate('assignment')}
                    disabled={clearCacheMutation.isPending}
                  >
                    Clear Assignment Cache
                  </Button>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Schedule Cache</h3>
                  <p className="text-2xl font-bold text-green-600">{cacheStats.scheduleCache.size}</p>
                  <p className="text-sm text-muted-foreground">entries</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => clearCacheMutation.mutate('schedule')}
                    disabled={clearCacheMutation.isPending}
                  >
                    Clear Schedule Cache
                  </Button>
                </div>
                <div className="p-4 border rounded-lg">
                  <h3 className="font-semibold mb-2">Canvas Cache</h3>
                  <p className="text-2xl font-bold text-purple-600">{cacheStats.canvasCache.size}</p>
                  <p className="text-sm text-muted-foreground">entries</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => clearCacheMutation.mutate('canvas')}
                    disabled={clearCacheMutation.isPending}
                  >
                    Clear Canvas Cache
                  </Button>
                </div>
              </div>
            ) : (
              <p>Loading cache statistics...</p>
            )}
          </CardContent>
        </Card>

        {/* Assignment Sources Analysis */}
        {assignmentSources && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Database Assignments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  Database ({assignmentSources.database.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {assignmentSources.database.map((assignment) => (
                  <div key={assignment.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-sm">{assignment.title}</h4>
                      <Badge variant={getStatusBadge(assignment.completionStatus)}>
                        {assignment.completionStatus}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{assignment.subject}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs">{formatTime(assignment.timeEstimate)}</span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteAssignmentMutation.mutate(assignment.id)}
                        disabled={deleteAssignmentMutation.isPending}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
                {assignmentSources.database.length === 0 && (
                  <p className="text-sm text-muted-foreground">No assignments in database</p>
                )}
              </CardContent>
            </Card>

            {/* Cached Assignments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-green-600" />
                  Cached ({assignmentSources.cached.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {assignmentSources.cached.map((assignment) => (
                  <div key={assignment.id} className="p-3 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-sm">{assignment.title}</h4>
                      <Badge variant={getStatusBadge(assignment.completionStatus)}>
                        {assignment.completionStatus}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{assignment.subject}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs">{formatTime(assignment.timeEstimate)}</span>
                    </div>
                  </div>
                ))}
                {assignmentSources.cached.length === 0 && (
                  <p className="text-sm text-muted-foreground">No cached assignments</p>
                )}
              </CardContent>
            </Card>

            {/* Phantom Assignments */}
            <Card className="border-red-200 dark:border-red-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                  Phantoms ({assignmentSources.phantoms.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {assignmentSources.phantoms.map((assignment) => (
                  <div key={assignment.id} className="p-3 border border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-950/20">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-sm">{assignment.title}</h4>
                      <Badge variant="destructive">
                        PHANTOM
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{assignment.subject}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs">{formatTime(assignment.timeEstimate)}</span>
                      <Badge variant="outline" className="text-xs">
                        Cache Only
                      </Badge>
                    </div>
                  </div>
                ))}
                {assignmentSources.phantoms.length === 0 && (
                  <p className="text-sm text-green-600">✅ No phantom assignments detected</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Emergency Actions */}
        <Card className="border-yellow-200 dark:border-yellow-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="w-5 h-5" />
              Emergency Cache Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                variant="destructive"
                onClick={() => clearCacheMutation.mutate('all')}
                disabled={clearCacheMutation.isPending}
              >
                Clear All Caches
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  refetchSources();
                  queryClient.invalidateQueries({ queryKey: ['/api/debug/cache-stats'] });
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh All Data
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Use these actions to clear phantom assignments from Production caches
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}