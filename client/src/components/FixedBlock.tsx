import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Car, Coffee, Users, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';

interface FixedBlockProps {
  blockId: string;
  title: string;
  blockType: string; // Allow any block type from database
  blockStart: string;
  blockEnd: string;
  date: string;
  attended?: boolean;
  className?: string;
}

const blockIcons: Record<string, any> = {
  travel: Car,
  'prep/load': Package,
  lunch: Coffee,
  coop: Users,
  break: Clock,
  movement: Clock,
  'co-op': Users
};

const blockColors: Record<string, string> = {
  travel: 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800 text-orange-900 dark:text-orange-100',
  'prep/load': 'bg-purple-50 dark:bg-purple-950 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-100',
  lunch: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-900 dark:text-green-100',
  coop: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100',
  'co-op': 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100',
  break: 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100',
  movement: 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-gray-100'
};

export function FixedBlock({ 
  blockId, 
  title, 
  blockType, 
  blockStart, 
  blockEnd, 
  date, 
  attended = false,
  className 
}: FixedBlockProps) {
  const [isAttended, setIsAttended] = useState(attended);
  const queryClient = useQueryClient();
  
  const Icon = blockIcons[blockType] || Clock; // Default to Clock if not found
  const colorClasses = blockColors[blockType] || blockColors.break;

  // Mutation to update attendance
  const attendanceMutation = useMutation({
    mutationFn: async ({ attended }: { attended: boolean }) => {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'demo-user-1',
          blockId,
          date,
          attended,
          blockType
        })
      });
      if (!response.ok) throw new Error('Failed to update attendance');
      return response.json();
    },
    onSuccess: () => {
      // Refresh attendance data if we add a query for it later
      queryClient.invalidateQueries({ queryKey: ['/api/attendance'] });
    }
  });

  const handleToggleAttendance = async () => {
    const newAttendance = !isAttended;
    setIsAttended(newAttendance);
    
    try {
      await attendanceMutation.mutateAsync({ attended: newAttendance });
    } catch (error) {
      // Revert on error
      setIsAttended(!newAttendance);
    }
  };

  return (
    <div 
      className={`border rounded-lg p-4 ${colorClasses} ${className}`}
      data-testid={`fixed-block-${blockType}`}
    >
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5" />
        <div className="flex-1">
          <div className="font-medium text-sm">
            {title}
          </div>
          <div className="text-xs opacity-75">
            {blockStart} - {blockEnd}
          </div>
        </div>
        
        <Button
          onClick={handleToggleAttendance}
          disabled={attendanceMutation.isPending}
          variant={isAttended ? "default" : "outline"}
          size="sm"
          className={`flex items-center gap-2 ${
            isAttended 
              ? 'bg-green-600 hover:bg-green-700 text-white border-green-600' 
              : 'border-current text-current hover:bg-current hover:bg-opacity-10'
          }`}
          data-testid={isAttended ? "button-mark-not-attended" : "button-mark-attended"}
        >
          <Check className={`h-4 w-4 ${isAttended ? 'text-white' : 'text-current'}`} />
          {isAttended ? 'Attended' : 'Mark Done'}
        </Button>
      </div>
    </div>
  );
}