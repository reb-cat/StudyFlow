import { motion } from 'framer-motion';
import { CheckCircle, Star, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

interface CelebrationAnimationProps {
  trigger: boolean;
  onComplete?: () => void;
  type?: 'confetti' | 'pulse' | 'burst' | 'checkmark';
  size?: 'sm' | 'md' | 'lg';
}

export function CelebrationAnimation({ 
  trigger, 
  onComplete, 
  type = 'burst',
  size = 'md' 
}: CelebrationAnimationProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (trigger) {
      console.log('🎉 Celebration animation triggered!', { type, size });
      setIsAnimating(true);
      const timer = setTimeout(() => {
        console.log('🎉 Celebration animation complete');
        setIsAnimating(false);
        onComplete?.();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [trigger, onComplete, type, size]);

  if (!isAnimating) {
    console.log('🎉 Not animating, returning null');
    return null;
  }
  
  console.log('🎉 Rendering animation:', { type, size, isAnimating });

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12', 
    lg: 'w-16 h-16'
  };

  if (type === 'confetti') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            initial={{ 
              x: '50%', 
              y: '50%', 
              scale: 0,
              rotate: 0 
            }}
            animate={{ 
              x: `${50 + (Math.random() - 0.5) * 100}%`,
              y: `${50 + (Math.random() - 0.5) * 100}%`,
              scale: [0, 1, 0],
              rotate: 360 
            }}
            transition={{ 
              duration: 1.2,
              delay: i * 0.1,
              ease: "easeOut"
            }}
          >
            <Star className="w-3 h-3 text-yellow-400 fill-current" />
          </motion.div>
        ))}
      </div>
    );
  }

  if (type === 'pulse') {
    return (
      <motion.div
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 1.2, 1],
          opacity: [0, 1, 0]
        }}
        transition={{ 
          duration: 0.8,
          ease: "easeOut"
        }}
      >
        <div className="rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center p-4">
          <CheckCircle className={`${sizeClasses[size]} text-green-600`} />
        </div>
      </motion.div>
    );
  }

  if (type === 'checkmark') {
    return (
      <motion.div
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ 
          scale: [0, 1.3, 1],
          rotate: 0
        }}
        transition={{ 
          duration: 0.6,
          ease: "backOut"
        }}
      >
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            filter: ["hue-rotate(0deg)", "hue-rotate(30deg)", "hue-rotate(0deg)"]
          }}
          transition={{ 
            duration: 0.4,
            delay: 0.3,
            repeat: 2
          }}
        >
          <CheckCircle className={`${sizeClasses[size]} text-green-600 fill-green-100 dark:fill-green-900`} />
        </motion.div>
      </motion.div>
    );
  }

  // Default 'burst' animation
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Central burst */}
      <motion.div
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: [0, 1.5, 1],
          opacity: [0, 1, 0]
        }}
        transition={{ 
          duration: 0.8,
          ease: "easeOut"
        }}
      >
        <CheckCircle className={`${sizeClasses[size]} text-green-600`} />
      </motion.div>

      {/* Sparkle burst */}
      {Array.from({ length: 6 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute top-1/2 left-1/2"
          initial={{ 
            scale: 0, 
            x: 0, 
            y: 0,
            rotate: 0
          }}
          animate={{ 
            scale: [0, 1, 0],
            x: Math.cos((i * 60) * Math.PI / 180) * 40,
            y: Math.sin((i * 60) * Math.PI / 180) * 40,
            rotate: 360
          }}
          transition={{ 
            duration: 1,
            delay: 0.2,
            ease: "easeOut"
          }}
        >
          <Sparkles className="w-4 h-4 text-yellow-400 fill-current" />
        </motion.div>
      ))}
    </div>
  );
}