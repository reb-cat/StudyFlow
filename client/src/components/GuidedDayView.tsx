import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, CheckCircle, Clock, HelpCircle, AlertCircle, Calendar, User, ArrowLeft, ExternalLink, Volume2, VolumeX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Assignment } from '@shared/schema';
import { FixedBlock } from './FixedBlock';
import { CircularTimer } from './CircularTimer';

interface ScheduleBlock {
  id: string;
  type: 'bible' | 'fixed' | 'assignment';
  title: string;
  startTime: string;
  endTime: string;
  estimatedMinutes?: number;
  assignment?: Assignment;
  blockType?: string;
}

interface GuidedDayViewProps {
  assignments: Assignment[];
  studentName: string;
  selectedDate: string;
  scheduleTemplate?: any[];
  onAssignmentUpdate?: () => void;
  onModeToggle?: () => void;
}

export function GuidedDayView({ assignments, studentName, selectedDate, onAssignmentUpdate, scheduleTemplate = [], onModeToggle }: GuidedDayViewProps) {
  const { toast } = useToast();
  
  // Persistence key for this student's session
  const persistenceKey = `guidedMode_${studentName}_${selectedDate}`;
  
  // Emergency exit state
  const [exitClickCount, setExitClickCount] = useState(0);
  
  // TTS state (only for Khalil)
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSpeech, setCurrentSpeech] = useState<SpeechSynthesisUtterance | HTMLAudioElement | null>(null);
  const [showFullInstructions, setShowFullInstructions] = useState(false);
  
  
  // Build complete schedule using real schedule template data (same as Overview mode)
  const allScheduleBlocks = scheduleTemplate.map((block) => ({
    id: block.id,
    title: block.subject,
    blockType: block.blockType?.toLowerCase() || 'unknown',
    startTime: block.startTime?.substring(0, 5) || '00:00', // Remove seconds from HH:MM:SS
    endTime: block.endTime?.substring(0, 5) || '00:00',
    blockNumber: block.blockNumber,
    subject: block.subject
  }));

  // Create complete schedule blocks in chronological order - IDENTICAL to Overview mode
  const scheduleBlocks: ScheduleBlock[] = [
    // Bible blocks from schedule template  
    ...allScheduleBlocks
      .filter((block) => block.blockType === 'bible')
      .map(block => ({
        id: block.id,
        type: 'bible' as const,
        title: block.subject,
        startTime: block.startTime,
        endTime: block.endTime,
        estimatedMinutes: 20,
        blockType: block.blockType
      })),
    // Fixed blocks from schedule template
    ...allScheduleBlocks
      .filter((block) => ['travel', 'co-op', 'prep/load', 'movement', 'lunch'].includes(block.blockType))
      .map(block => ({
        id: block.id,
        type: 'fixed' as const,
        title: block.subject,
        startTime: block.startTime,
        endTime: block.endTime,
        estimatedMinutes: parseInt(block.endTime.split(':')[0]) * 60 + parseInt(block.endTime.split(':')[1]) - 
                           (parseInt(block.startTime.split(':')[0]) * 60 + parseInt(block.startTime.split(':')[1])),
        blockType: block.blockType
      })),
    // Assignment blocks - use schedule template blocks AND fill with actual assignment data
    ...allScheduleBlocks
      .filter((block) => block.blockType === 'assignment')
      .map((block, index) => {
        // Fill assignment blocks with available assignments (round-robin if more blocks than assignments)
        const assignmentIndex = assignments.length > 0 ? index % assignments.length : -1;
        const matchingAssignment = assignmentIndex >= 0 ? assignments[assignmentIndex] : null;
        
        return {
          id: matchingAssignment ? matchingAssignment.id : block.id,
          type: 'assignment' as const,
          title: matchingAssignment ? matchingAssignment.title : 'Assignment',
          startTime: block.startTime,
          endTime: block.endTime,
          estimatedMinutes: matchingAssignment ? matchingAssignment.actualEstimatedMinutes || 30 : 30,
          assignment: matchingAssignment || undefined,
          blockType: block.blockType
        };
      })
  ].sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Load persisted state or use defaults
  const loadPersistedState = () => {
    try {
      const saved = localStorage.getItem(persistenceKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          currentIndex: parsed.currentIndex || 0,
          isTimerRunning: parsed.isTimerRunning || true,
          extraTime: parsed.extraTime || 0,
          completedBlocks: new Set(parsed.completedBlocks || []),
          timeRemaining: parsed.timeRemaining || null,
          lastSaved: parsed.lastSaved || Date.now()
        };
      }
    } catch (error) {
      console.warn('Failed to load guided mode state:', error);
    }
    return {
      currentIndex: 0,
      isTimerRunning: true,
      extraTime: 0,
      completedBlocks: new Set(),
      timeRemaining: null,
      lastSaved: Date.now()
    };
  };

  const persistedState = loadPersistedState();
  const [currentIndex, setCurrentIndex] = useState(persistedState.currentIndex);
  const [isTimerRunning, setIsTimerRunning] = useState(persistedState.isTimerRunning);
  const [extraTime, setExtraTime] = useState(persistedState.extraTime);
  const [completedBlocks, setCompletedBlocks] = useState<Set<string>>(new Set<string>((persistedState.completedBlocks || []) as string[]));
  const [timeRemaining, setTimeRemaining] = useState<number | null>(persistedState.timeRemaining);

  const currentBlock = scheduleBlocks[currentIndex];
  const totalBlocks = scheduleBlocks.length;
  const progressPercentage = Math.round((completedBlocks.size / totalBlocks) * 100);
  
  // TTS Functions (Khalil only) - Now using ElevenLabs
  const speakText = async (text: string) => {
    if (studentName !== 'Khalil') return;
    
    try {
      // Stop any current audio
      if (currentSpeech) {
        const audioElements = document.querySelectorAll('audio');
        audioElements.forEach(audio => {
          audio.pause();
          audio.currentTime = 0;
        });
      }
      
      setIsPlaying(true);
      
      // Call ElevenLabs API
      const response = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          studentName: studentName,
        }),
      });
      
      if (!response.ok) {
        throw new Error('TTS generation failed');
      }
      
      // Get audio blob and create playable URL
      const audioBlob = await response.blob();
      console.log('Audio blob created:', audioBlob.size, 'bytes, type:', audioBlob.type);
      
      // Validate blob before proceeding
      if (audioBlob.size === 0) {
        throw new Error('Received empty audio blob');
      }
      
      if (!audioBlob.type || !audioBlob.type.startsWith('audio/')) {
        console.warn('Unexpected blob type:', audioBlob.type, 'proceeding anyway...');
      }
      
      const audioUrl = URL.createObjectURL(audioBlob);
      console.log('Created blob URL:', audioUrl);
      
      const audio = new Audio();
      
      // Set up comprehensive error handling
      const cleanup = () => {
        console.log('Cleaning up audio resources');
        setIsPlaying(false);
        setCurrentSpeech(null);
        // Delay URL revocation to ensure audio has finished using it
        setTimeout(() => URL.revokeObjectURL(audioUrl), 1000);
      };
      
      // Set preload to ensure audio loads properly
      audio.preload = 'auto';
      
      audio.onloadstart = () => console.log('Audio load started');
      audio.onloadedmetadata = () => console.log('Audio metadata loaded');
      audio.oncanplay = () => console.log('Audio can start playing');
      audio.oncanplaythrough = () => {
        console.log('Audio can play through, starting playback...');
        audio.play().then(() => {
          console.log('Audio playback started successfully');
        }).catch(err => {
          console.error('Audio play failed:', err);
          cleanup();
        });
      };
      
      audio.onended = () => {
        console.log('Audio playback ended');
        cleanup();
      };
      
      audio.onerror = (e) => {
        console.error('Audio error event:', e);
        console.error('Audio error code:', audio.error?.code, 'message:', audio.error?.message);
        cleanup();
      };
      
      setCurrentSpeech(audio);
      
      // Set source and start loading
      console.log('Setting audio source...');
      audio.src = audioUrl;
      audio.load(); // Explicitly trigger loading
      
    } catch (error) {
      console.error('TTS error:', error);
      setIsPlaying(false);
      setCurrentSpeech(null);
      
      // Fallback to browser TTS
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      
      utterance.onend = () => {
        setIsPlaying(false);
        setCurrentSpeech(null);
      };
      
      setCurrentSpeech(utterance);
      speechSynthesis.speak(utterance);
    }
  };
  
  const stopSpeech = () => {
    if (currentSpeech) {
      if (currentSpeech instanceof HTMLAudioElement) {
        currentSpeech.pause();
        currentSpeech.currentTime = 0;
      } else {
        speechSynthesis.cancel();
      }
      setIsPlaying(false);
      setCurrentSpeech(null);
    }
  };
  
  const toggleSpeech = () => {
    if (isPlaying) {
      stopSpeech();
    } else {
      if (currentBlock?.type === 'assignment' && currentBlock.assignment) {
        // Create executive function-friendly TTS - just the essentials
        const title = currentBlock.assignment.title;
        const instructions = currentBlock.assignment.instructions || '';
        
        // Extract just the first actionable step or main objective
        const cleanInstructions = instructions.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        const firstSentence = cleanInstructions.split('.')[0] + '.';
        const briefInstructions = firstSentence.length > 100 
          ? `Get started with ${title}. Check the full instructions for details.`
          : firstSentence;
        
        const textToSpeak = `${title}. ${briefInstructions}`;
        console.log('TTS text length:', textToSpeak.length, 'characters');
        speakText(textToSpeak);
      }
    }
  };

  // Format date for display
  const dateObj = new Date(selectedDate + 'T12:00:00.000Z');
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const dateDisplay = dateObj.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric',
    timeZone: 'UTC'
  });

  // Persist state whenever it changes
  useEffect(() => {
    const stateToSave = {
      currentIndex,
      isTimerRunning,
      extraTime,
      completedBlocks: Array.from(completedBlocks),
      timeRemaining,
      lastSaved: Date.now()
    };
    localStorage.setItem(persistenceKey, JSON.stringify(stateToSave));
  }, [currentIndex, isTimerRunning, extraTime, completedBlocks, timeRemaining, persistenceKey]);

  // Auto-start timer when block changes (only for new blocks)
  useEffect(() => {
    if (currentBlock && !completedBlocks.has(currentBlock.id)) {
      // Only reset timer if we don't have saved time remaining for this block
      if (timeRemaining === null) {
        setIsTimerRunning(true);
        setExtraTime(0);
        setTimeRemaining((currentBlock.estimatedMinutes || 20) * 60);
      }
    }
  }, [currentIndex, currentBlock]);
  
  // Clear persistence when exiting guided mode
  useEffect(() => {
    return () => {
      // Only clear if we're completing the entire day or user explicitly exits
      // Individual block completions shouldn't clear the state
    };
  }, []);

  // Time formatting function
  const formatTime = (start: string, end: string) => {
    const formatTimeString = (timeStr: string) => {
      if (!timeStr || timeStr === '00:00') return '12:00 AM';
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    };
    return `${formatTimeString(start)} – ${formatTimeString(end)}`;
  };

  const handleBlockComplete = () => {
    if (!currentBlock) return;
    
    setCompletedBlocks(prev => new Set([...Array.from(prev), currentBlock.id]));
    setIsTimerRunning(false);
    onAssignmentUpdate?.();
    
    toast({
      title: 'Well Done!',
      description: `Great job completing ${currentBlock.title}! 🎉`,
    });
    
    // Move to next incomplete block
    let nextIndex = currentIndex + 1;
    while (nextIndex < scheduleBlocks.length && completedBlocks.has(scheduleBlocks[nextIndex].id)) {
      nextIndex++;
    }
    setCurrentIndex(nextIndex);
    
    // Reset timer for next block
    setTimeRemaining(null);
  };

  const handleNeedMoreTime = () => {
    // Complex backend process: duplicate assignment, mark as needing more time,
    // reschedule other blocks either same day or next day
    setIsTimerRunning(false);
    
    toast({
      title: 'Rescheduling',
      description: `${currentBlock.title} needs more time. Moving to next task.`,
    });
    
    // Mark current block as needing more time (would involve backend updates)
    // This duplicates the assignment and reschedules remaining blocks
    
    // Move to next block
    if (currentIndex < scheduleBlocks.length - 1) {
      setCurrentIndex((prev: number) => prev + 1);
      setIsTimerRunning(true); // Auto-start next block
      setExtraTime(0);
      setTimeRemaining(null); // Reset timer for next block
    } else {
      // Clear persistence when day is actually completed
      localStorage.removeItem(persistenceKey);
      toast({
        title: 'Day Complete',
        description: 'Great job! You\'ve finished today\'s schedule.',
      });
      onModeToggle?.();
    }
  };

  const handleStuck = () => {
    // Backend process: mark as stuck, potentially reschedule or notify for help
    setIsTimerRunning(false);
    
    toast({
      title: 'Marked as Stuck',
      description: `${currentBlock.title} has been flagged for help. Moving to next task.`,
      variant: 'default'
    });
    
    // Move to next block after marking as stuck
    if (currentIndex < scheduleBlocks.length - 1) {
      setCurrentIndex((prev: number) => prev + 1);
      setIsTimerRunning(true); // Auto-start next block
      setExtraTime(0);
      setTimeRemaining(null); // Reset timer for next block
    } else {
      toast({
        title: 'Day Complete',
        description: 'You\'ve reached the end of today\'s schedule.',
      });
      onModeToggle?.();
    }
  };

  const handleTimerComplete = () => {
    setIsTimerRunning(false);
    toast({
      title: 'Time\'s Up!',
      description: `Time for ${currentBlock.title} has finished. How did it go?`,
    });
  };

  // All blocks completed or no blocks
  if (!currentBlock || currentIndex >= scheduleBlocks.length || scheduleBlocks.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-green-900 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-foreground">Wonderful work, {studentName}!</h1>
          <p className="text-xl text-muted-foreground">You've completed all your scheduled blocks for today.</p>
          <Button onClick={onModeToggle} size="lg" className="mt-6">
            Return to Overview
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Pure Focus Card - No Navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-8 space-y-8">
          {/* Current Task - Minimal */}
          <div className="text-center space-y-2 relative">
            {/* TTS Speaker Icon - Only for Khalil on assignment blocks */}
            {studentName === 'Khalil' && currentBlock.type === 'assignment' && (
              <button
                onClick={toggleSpeech}
                className="absolute top-0 right-0 p-2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                title={isPlaying ? "Stop reading" : "Read assignment aloud"}
                data-testid="button-tts-toggle"
              >
                {isPlaying ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
            )}
            
            <h2 className="text-xl font-bold text-gray-900 dark:text-white !text-xl">
              {currentBlock.title}
            </h2>
            
            {/* Assignment Instructions - Executive Function Optimized */}
            {currentBlock.type === 'assignment' && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mx-4 space-y-2">
                {(() => {
                  const instructions = currentBlock.assignment?.instructions;
                  
                  // Check if instructions exist and are meaningful
                  const hasRealInstructions = instructions && 
                    instructions.trim() !== '' &&
                    instructions.trim() !== 'Assignment from Canvas' &&
                    !instructions.toLowerCase().includes('no additional details were added for this assignment') &&
                    instructions.length > 50;

                  if (hasRealInstructions) {
                    // Extract smart summary - first actionable step or main objective
                    const cleanInstructions = instructions.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                    const sentences = cleanInstructions.split(/[.!?]+/).filter(s => s.trim().length > 10);
                    const firstActionable = sentences[0]?.trim() + '.';
                    const isVeryLong = cleanInstructions.length > 300;
                    
                    return (
                      <div className="space-y-2">
                        {/* Smart Summary - Always Show */}
                        <div className="text-base text-gray-700 dark:text-gray-300 leading-relaxed !text-base">
                          <div className="font-medium text-blue-600 dark:text-blue-400 text-sm mb-1">
                            {isVeryLong ? '📋 Next Step:' : '📋 Instructions:'}
                          </div>
                          {isVeryLong ? (
                            <p>{firstActionable}</p>
                          ) : (
                            <div dangerouslySetInnerHTML={{ __html: instructions }} />
                          )}
                        </div>
                        
                        {/* Show More Toggle for Long Instructions */}
                        {isVeryLong && (
                          <div>
                            <button
                              onClick={() => setShowFullInstructions(!showFullInstructions)}
                              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                            >
                              {showFullInstructions ? '📄 Hide Full Instructions' : '📄 Show Full Instructions'}
                            </button>
                            
                            {showFullInstructions && (
                              <div className="mt-2 p-3 bg-white dark:bg-gray-700 rounded border-l-4 border-blue-500">
                                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2 italic">
                                  💡 Tip: Use "Need Help?" button for step-by-step guidance
                                </div>
                                <div 
                                  className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed max-h-40 overflow-y-auto"
                                  dangerouslySetInnerHTML={{ __html: instructions }}
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    return (
                      <div className="text-base text-gray-500 dark:text-gray-400 leading-relaxed !text-base">
                        <div className="font-medium text-gray-600 dark:text-gray-500 text-sm mb-1">
                          📋 Instructions:
                        </div>
                        <p className="italic">
                          Work on this assignment based on your course materials and previous lessons.
                        </p>
                      </div>
                    );
                  }
                })()}
              </div>
            )}
          </div>

          {/* HUGE Timer - Dominant Element */}
          <div className="flex justify-center">
            <CircularTimer
              durationMinutes={currentBlock.estimatedMinutes || 20}
              isRunning={isTimerRunning}
              onComplete={handleTimerComplete}
              onToggle={() => setIsTimerRunning(!isTimerRunning)}
              onReset={() => {
                setIsTimerRunning(false);
                setExtraTime(0);
                setTimeRemaining((currentBlock.estimatedMinutes || 20) * 60);
              }}
              hideControls={true}
              extraTime={extraTime}
              externalTimeRemaining={timeRemaining}
              onTimeUpdate={setTimeRemaining}
            />
          </div>

          {/* Essential Actions Only */}
          <div className="space-y-3">
            <Button 
              onClick={handleBlockComplete}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-2xl font-medium text-lg"
              data-testid="button-block-complete"
            >
              Done
            </Button>
            
            <div className="flex space-x-3">
              <Button 
                onClick={handleNeedMoreTime}
                variant="outline"
                className="flex-1 py-3 rounded-2xl"
                data-testid="button-need-more-time"
              >
                Need More Time
              </Button>
              
              <Button 
                onClick={handleStuck}
                variant="outline"
                className="flex-1 py-3 rounded-2xl"
                data-testid="button-stuck"
              >
                Stuck
              </Button>
            </div>
            
            {/* Emergency Exit - Requires Double Tap */}
            <div className="pt-6 text-center">
              <Button
                variant="ghost"
                onClick={() => {
                  if (exitClickCount === 0) {
                    setExitClickCount(1);
                    toast({
                      title: "Emergency Exit",
                      description: "Click again within 2 seconds to exit",
                      duration: 2000
                    });
                    // Reset counter after 2 seconds
                    setTimeout(() => setExitClickCount(0), 2000);
                  } else {
                    // Second click - actually exit
                    console.log("Emergency exit triggered, calling onModeToggle");
                    if (onModeToggle) {
                      onModeToggle();
                    } else {
                      console.error("onModeToggle is not defined");
                    }
                  }
                }}
                className={`text-xs transition-colors ${
                  exitClickCount > 0 
                    ? 'text-orange-400 hover:text-orange-300' 
                    : 'text-gray-300 hover:text-gray-400'
                }`}
                data-testid="button-mode-toggle"
                title={exitClickCount > 0 ? "Click again to exit" : "Click twice to exit (emergency only)"}
              >
                {exitClickCount > 0 ? "Click Again to Exit" : "Emergency Exit"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}