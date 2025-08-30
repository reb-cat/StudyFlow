import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface BibleResetButtonProps {
  studentName: string;
  onSuccess?: () => void;
}

export function BibleResetButton({ studentName, onSuccess }: BibleResetButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleReset = async () => {
    if (!confirm(`Reset Bible progress for ${studentName} to Week 1 Day 1?`)) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/bible/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          studentName, 
          scope: 'both' 
        })
      });

      if (!response.ok) throw new Error('Reset failed');

      toast({
        title: 'Bible Progress Reset',
        description: `${studentName}'s Bible progress has been reset to Week 1 Day 1`,
      });

      onSuccess?.();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reset Bible progress',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleReset}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
    >
      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      Clear Bible Progress
    </Button>
  );
}