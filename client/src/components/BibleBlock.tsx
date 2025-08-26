import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';

interface BibleCurriculum {
  id: string;
  weekNumber: number;
  dayOfWeek: number;
  chapterReference: string;
  readingTitle: string;
  completed: boolean;
  completedAt?: string;
}

interface BibleBlockProps {
  date: string;
  blockStart?: string;
  blockEnd?: string;
  className?: string;
}

export function BibleBlock({ date, blockStart = "9:00", blockEnd = "9:20", className }: BibleBlockProps) {
  const queryClient = useQueryClient();

  // Get current week's Bible curriculum
  const { data: bibleData = [], isLoading } = useQuery<BibleCurriculum[]>({
    queryKey: ['/api/bible/current-week'],
  });

  // Get today's reading based on day of week
  const today = new Date(date);
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const todaysReading = bibleData.find(reading => reading.dayOfWeek === dayOfWeek);

  // Mutation to update completion status
  const completionMutation = useMutation({
    mutationFn: async ({ weekNumber, dayOfWeek, completed }: { weekNumber: number; dayOfWeek: number; completed: boolean }) => {
      const response = await fetch('/api/bible/completion', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekNumber, dayOfWeek, completed })
      });
      if (!response.ok) throw new Error('Failed to update Bible completion');
      return response.json();
    },
    onSuccess: () => {
      // Refresh the Bible curriculum data
      queryClient.invalidateQueries({ queryKey: ['/api/bible/current-week'] });
    }
  });

  const handleToggleCompletion = async () => {
    if (!todaysReading) return;
    
    await completionMutation.mutateAsync({
      weekNumber: todaysReading.weekNumber,
      dayOfWeek: todaysReading.dayOfWeek,
      completed: !todaysReading.completed
    });
  };

  if (isLoading) {
    return (
      <div className={`bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <div className="flex-1">
            <div className="font-medium text-sm text-blue-900 dark:text-blue-100">
              Bible Reading
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300">
              {blockStart} - {blockEnd}
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              Loading today's reading...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!todaysReading) {
    return (
      <div className={`bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 ${className}`}>
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <div className="flex-1">
            <div className="font-medium text-sm text-blue-900 dark:text-blue-100">
              Bible Reading
            </div>
            <div className="text-xs text-blue-700 dark:text-blue-300">
              {blockStart} - {blockEnd}
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              No reading scheduled for today
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4 ${className}`}
      data-testid="bible-block"
    >
      <div className="flex items-center gap-3">
        <BookOpen className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <div className="flex-1">
          <div className="font-medium text-sm text-blue-900 dark:text-blue-100">
            Bible Reading
          </div>
          <div className="text-xs text-blue-700 dark:text-blue-300">
            {blockStart} - {blockEnd}
          </div>
          <div className="text-sm text-blue-800 dark:text-blue-200 mt-1 font-medium">
            {todaysReading.chapterReference}
          </div>
          <div className="text-sm text-blue-600 dark:text-blue-400">
            {todaysReading.readingTitle}
          </div>
        </div>
        
        <Button
          onClick={handleToggleCompletion}
          disabled={completionMutation.isPending}
          variant={todaysReading.completed ? "default" : "outline"}
          size="sm"
          className={`flex items-center gap-2 ${
            todaysReading.completed 
              ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
              : 'border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-600 dark:text-blue-300 dark:hover:bg-blue-900'
          }`}
          data-testid={todaysReading.completed ? "button-mark-incomplete" : "button-mark-complete"}
        >
          <Check className={`h-4 w-4 ${todaysReading.completed ? 'text-white' : 'text-blue-600 dark:text-blue-400'}`} />
          {todaysReading.completed ? 'Complete' : 'Mark Done'}
        </Button>
      </div>
      
      {todaysReading.completed && todaysReading.completedAt && (
        <div className="mt-2 text-xs text-green-600 dark:text-green-400">
          ✓ Completed at {new Date(todaysReading.completedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}