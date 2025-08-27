import { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CircularTimerProps {
  durationMinutes: number;
  isRunning: boolean;
  onComplete?: () => void;
  onToggle?: () => void;
  onReset?: () => void;
  extraTime?: number;
  hideControls?: boolean;
  externalTimeRemaining?: number | null;
  onTimeUpdate?: (timeRemaining: number) => void;
}

export function CircularTimer({ 
  durationMinutes, 
  isRunning, 
  onComplete, 
  onToggle, 
  onReset,
  extraTime = 0,
  hideControls = false,
  externalTimeRemaining = null,
  onTimeUpdate
}: CircularTimerProps) {
  const [internalTimeRemaining, setInternalTimeRemaining] = useState(durationMinutes * 60 + extraTime * 60);
  
  // Use external time if provided, otherwise use internal
  const timeRemaining = externalTimeRemaining !== null ? externalTimeRemaining : internalTimeRemaining;
  const totalTime = durationMinutes * 60 + extraTime * 60;

  useEffect(() => {
    if (externalTimeRemaining === null) {
      setInternalTimeRemaining(durationMinutes * 60 + extraTime * 60);
    }
  }, [durationMinutes, extraTime, externalTimeRemaining]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        const newTime = timeRemaining - 1;
        if (newTime <= 0) {
          onComplete?.();
          if (onTimeUpdate) {
            onTimeUpdate(0);
          } else {
            setInternalTimeRemaining(0);
          }
        } else {
          if (onTimeUpdate) {
            onTimeUpdate(newTime);
          } else {
            setInternalTimeRemaining(newTime);
          }
        }
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [isRunning, timeRemaining, onComplete, onTimeUpdate]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const progress = (timeRemaining / totalTime) * 100;
  const radius = 130; // 260px diameter - larger circumference for clearance
  const strokeWidth = 14;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDasharray = `${circumference} ${circumference}`;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center space-y-2">
      {/* Circular Progress Timer */}
      <div className="relative">
        <svg
          height={radius * 2}
          width={radius * 2}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            stroke="currentColor"
            className="text-gray-200 dark:text-gray-700"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          {/* Progress circle */}
          <circle
            stroke="currentColor"
            className={`transition-all duration-1000 ease-linear ${
              timeRemaining > 300 
                ? 'text-green-500' 
                : timeRemaining > 60 
                ? 'text-gray-500' 
                : 'text-red-500'
            }`}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
        </svg>
        
        {/* Time display in center - larger for big timer */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-6xl font-bold text-gray-900 dark:text-white">
              {formatTime(timeRemaining)}
            </div>
            {extraTime > 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                +{extraTime}min
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timer Controls - Hidden when hideControls is true */}
      {!hideControls && (
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggle}
            className="flex items-center px-2 py-1 text-xs"
            data-testid="button-timer-toggle"
          >
            {isRunning ? (
              <>
                <Pause className="w-3 h-3 mr-1" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 mr-1" />
                <span>Start</span>
              </>
            )}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onReset}
            className="flex items-center px-2 py-1 text-xs"
            data-testid="button-timer-reset"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            <span>Reset</span>
          </Button>
        </div>
      )}
    </div>
  );
}