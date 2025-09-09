import { useState, useEffect } from 'react';

interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  size: number;
  gravity: number;
  life: number;
}

interface ConfettiBurstProps {
  trigger: boolean;
  onComplete?: () => void;
  colors?: string[];
  particleCount?: number;
  duration?: number;
  origin?: { x: number; y: number };
}

export function ConfettiBurst({ 
  trigger, 
  onComplete, 
  colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd', '#98d8c8'],
  particleCount = 50,
  duration = 3000,
  origin = { x: 50, y: 50 }
}: ConfettiBurstProps) {
  const [particles, setParticles] = useState<ConfettiParticle[]>([]);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (trigger && !isActive) {
      startConfetti();
    }
  }, [trigger, isActive]);

  const startConfetti = () => {
    setIsActive(true);
    
    // Create particles
    const newParticles: ConfettiParticle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.5;
      const velocity = Math.random() * 15 + 5;
      
      newParticles.push({
        id: i,
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity - Math.random() * 10,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        gravity: Math.random() * 0.3 + 0.2,
        life: 1.0
      });
    }
    
    setParticles(newParticles);
    
    // Animation loop
    const animationDuration = duration;
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / animationDuration;
      
      if (progress >= 1) {
        setParticles([]);
        setIsActive(false);
        onComplete?.();
        return;
      }
      
      setParticles(prevParticles => 
        prevParticles.map(particle => ({
          ...particle,
          x: particle.x + particle.vx,
          y: particle.y + particle.vy,
          vx: particle.vx * 0.99,
          vy: particle.vy + particle.gravity,
          rotation: particle.rotation + particle.rotationSpeed,
          life: 1 - progress
        }))
      );
      
      requestAnimationFrame(animate);
    };
    
    requestAnimationFrame(animate);
  };

  if (!isActive || particles.length === 0) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 pointer-events-none z-[9999]"
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 9999
      }}
    >
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            backgroundColor: particle.color,
            borderRadius: Math.random() > 0.5 ? '50%' : '0%',
            transform: `rotate(${particle.rotation}deg)`,
            opacity: particle.life,
            transition: 'none'
          }}
        />
      ))}
    </div>
  );
}

// Hook for easy confetti triggering
export function useConfetti() {
  const [shouldTrigger, setShouldTrigger] = useState(false);
  
  const triggerConfetti = () => {
    setShouldTrigger(true);
  };
  
  const onComplete = () => {
    setShouldTrigger(false);
  };
  
  return {
    triggerConfetti,
    ConfettiBurst: () => (
      <ConfettiBurst 
        trigger={shouldTrigger} 
        onComplete={onComplete}
      />
    )
  };
}