import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressRing } from "./ProgressRing";
import { Target, Clock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Quest {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  rewardPoints: number;
  goalType?: string;
  completed?: boolean;
}

interface QuestCardProps {
  quest: Quest;
  className?: string;
}

export function QuestCard({ quest, className }: QuestCardProps) {
  const progressPercentage = Math.min((quest.progress / quest.target) * 100, 100);
  const isCompleted = quest.completed || progressPercentage >= 100;

  const getIcon = () => {
    switch (quest.goalType) {
      case 'Tasks': return Target;
      case 'Minutes': return Clock;
      case 'Streak': return Zap;
      default: return Target;
    }
  };

  const Icon = getIcon();

  const getColor = () => {
    if (isCompleted) return 'emerald';
    if (progressPercentage > 50) return 'gold';
    return 'primary';
  };

  return (
    <Card className={cn(
      "p-4 bg-card border border-border hover:border-primary/50 transition-colors animate-fade-in",
      isCompleted && "bg-emerald/5 border-emerald/50",
      className
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <ProgressRing
            progress={progressPercentage}
            size={64}
            strokeWidth={6}
            color={getColor()}
          >
            <Icon className="w-5 h-5" />
          </ProgressRing>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-sm leading-tight">{quest.title}</h3>
            <Badge
              variant={isCompleted ? "default" : "secondary"}
              className={cn(
                "text-xs px-2 py-0.5",
                isCompleted && "bg-emerald text-emerald-foreground"
              )}
            >
              +{quest.rewardPoints}
            </Badge>
          </div>

          <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
            {quest.description}
          </p>

          <div className="flex items-center justify-between text-xs">
            <span className={cn(
              "font-medium",
              isCompleted ? "text-emerald" : "text-muted-foreground"
            )}>
              {quest.progress}/{quest.target}
            </span>

            {isCompleted && (
              <Badge className="bg-emerald text-emerald-foreground animate-pulse-glow">
                Complete!
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}