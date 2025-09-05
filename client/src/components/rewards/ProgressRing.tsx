import { cn } from "@/lib/utils";

interface ProgressRingProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
  showPercentage?: boolean;
  color?: 'primary' | 'gold' | 'emerald';
}

export function ProgressRing({
  progress,
  size = 120,
  strokeWidth = 8,
  className,
  children,
  showPercentage = false,
  color = 'primary'
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const colorClasses = {
    primary: 'stroke-violet',
    gold: 'stroke-gold',
    emerald: 'stroke-emerald'
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90 animate-scale-in"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          className="text-muted/20"
          fill="transparent"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke="currentColor"
          className={cn(colorClasses[color], "drop-shadow-lg transition-all duration-500 ease-out")}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{
            filter: color === 'gold' ? 'drop-shadow(0 0 8px hsl(var(--gold) / 0.6))' :
                    color === 'emerald' ? 'drop-shadow(0 0 8px hsl(var(--emerald) / 0.6))' :
                    'drop-shadow(0 0 8px hsl(var(--violet) / 0.6))'
          }}
        />
      </svg>

      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          {children}
          {showPercentage && (
            <div className="text-sm font-semibold">{Math.round(progress)}%</div>
          )}
        </div>
      </div>
    </div>
  );
}