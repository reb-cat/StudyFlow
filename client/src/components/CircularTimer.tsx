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
}: CircularTimerProps) {
  const totalSeconds = durationMinutes * 60 + extraTime * 60;
  const [timeRemaining, setTimeRemaining] = useState(totalSeconds);

  // Audio completion chime - gentle and supportive
  const playCompletionChime = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create a gentle two-tone chime
      const playTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, startTime);
        oscillator.type = 'sine'; // Gentle sine wave
        
        // Gentle fade in and out
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.1, startTime + 0.1); // Soft volume
        gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      const now = audioContext.currentTime;
      // Two-tone gentle chime: C5 -> G5 (pleasant, not jarring)
      playTone(523.25, now, 0.8); // C5
      playTone(783.99, now + 0.4, 0.8); // G5
      
    } catch (error) {
      console.log('Audio not available:', error);
      // Gracefully fail - visual feedback will still work
    }
  };

  // Reset timer when duration changes
  useEffect(() => {
    setTimeRemaining(totalSeconds);
  }, [totalSeconds]);

  // Countdown logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining(prev => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            playCompletionChime(); // 🔊 Play gentle completion sound
            onComplete?.();
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }
    
    return () => clearInterval(interval);
  }, [isRunning, timeRemaining, onComplete]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const progress = (timeRemaining / totalSeconds) * 100;
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
            className="text-gray-200 dark:text-slate-600"
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
                ? 'text-green-500 dark:text-green-400' 
                : timeRemaining > 60 
                ? 'text-blue-500 dark:text-blue-400' 
                : 'text-red-500 dark:text-red-400'
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
            <div className="text-6xl font-bold" style={{ color: 'var(--foreground)' }}>
              {formatTime(timeRemaining)}
            </div>
            {extraTime > 0 && (
              <div className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
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