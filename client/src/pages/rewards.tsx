import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Trophy, Gift, Star, TrendingUp, Flame, Target, Clock, Award, ArrowLeft, GamepadIcon, Phone, Utensils, Monitor, Headphones, Palette, Calendar } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function RewardsPage() {
  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
  const [currentView, setCurrentView] = useState<'main' | 'shop'>('main');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current student - for now using hardcoded student names
  const currentStudent = 'abigail';

  // Fetch reward profile with points, level, quests
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['/api/rewards/profile', currentStudent],
    enabled: !!currentStudent,
  });

  // Fetch reward catalog
  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ['/api/rewards/catalog'],
  });

  // Fetch earning history
  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['/api/rewards/history', currentStudent],
    enabled: !!currentStudent,
  });

  // Redeem reward mutation
  const redeemMutation = useMutation({
    mutationFn: async (data: { catalogItemId: string }) => {
      return await apiRequest('/api/rewards/redeem', 'POST', {
        studentName: currentStudent,
        catalogItemId: data.catalogItemId
      });
    },
    onSuccess: (result: any) => {
      toast({
        title: "🎉 Redemption Requested!",
        description: result?.message || 'Redemption request submitted',
        className: "bg-green-50 border-green-200 text-green-800",
      });
      setShowRedeemDialog(false);
      setSelectedReward(null);
      queryClient.invalidateQueries({ queryKey: ['/api/rewards/profile'] });
    },
    onError: (error: any) => {
      const errorMessage = error?.message || 'Unable to request redemption';
      toast({
        title: "Redemption Failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleRedeemClick = (catalogItem: any) => {
    setSelectedReward(catalogItem);
    setShowRedeemDialog(true);
  };

  const handleRedeemConfirm = () => {
    if (selectedReward) {
      redeemMutation.mutate({ catalogItemId: selectedReward.id });
    }
  };

  const profile = (profileData as any)?.profile;
  const quests = (profileData as any)?.quests || [];

  // Sample quest data for demonstration (matching Lovable design)
  const sampleQuests = [
    {
      id: 1,
      title: "Focus for 45 minutes today",
      description: "Stay focused and complete 45 minutes of study time",
      progress: 32,
      target: 45,
      reward: "+10",
      color: "text-yellow-400",
      bgColor: "bg-yellow-400/20"
    },
    {
      id: 2,
      title: "Complete 2 tasks today",
      description: "Finish any 2 tasks to complete this quest",
      progress: 1,
      target: 2,
      reward: "+8",
      color: "text-purple-400",
      bgColor: "bg-purple-400/20"
    },
    {
      id: 3,
      title: "Defeat the Homework Dragon",
      description: "Finish 3 assignments this week",
      progress: 1,
      target: 3,
      reward: "+15",
      color: "text-purple-400",
      bgColor: "bg-purple-400/20"
    }
  ];

  // Sample activity data matching Lovable design
  const sampleActivity = [
    {
      id: 1,
      title: "Completed 25-minute study session",
      date: "9/4/2025 at 09:56 PM",
      points: "+5 points",
      icon: Trophy
    },
    {
      id: 2,
      title: "Completed high-priority task: Math homework",
      date: "9/4/2025 at 08:56 PM",
      points: "+5 points",
      icon: Trophy
    },
    {
      id: 3,
      title: "7-day study streak milestone reached!",
      date: "9/3/2025 at 10:56 PM",
      points: "+10 points",
      icon: Trophy
    }
  ];

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading your rewards...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="max-w-md text-center space-y-6 p-8">
          <Trophy className="h-20 w-20 mx-auto text-primary mb-6" />
          <h1 className="text-2xl font-bold text-foreground mb-4">Welcome to RewardBank!</h1>
          <p className="text-muted-foreground mb-8 leading-relaxed">
            Complete assignments and study sessions to earn points, level up, and redeem awesome rewards!
          </p>
          <div className="bg-card border border-border rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Award className="h-5 w-5" style={{ color: 'hsl(var(--gold))' }} />
              Complete assignments: <strong className="text-foreground">100-500 points</strong>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Clock className="h-5 w-5" style={{ color: 'hsl(var(--blue))' }} />
              Finish study sessions: <strong className="text-foreground">300+ points</strong>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Target className="h-5 w-5" style={{ color: 'hsl(var(--emerald))' }} />
              Complete quests: <strong className="text-foreground">500+ bonus points</strong>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Your profile will be created automatically when you earn your first points!
          </p>
        </div>
      </div>
    );
  }

  // Reward Shop View
  if (currentView === 'shop') {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {/* Shop Header */}
        <div className="border-b border-border bg-card">
          <div className="container mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  onClick={() => setCurrentView('main')}
                  className="text-foreground hover:bg-accent"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
                <div className="flex items-center gap-2">
                  <Gift className="w-6 h-6 text-primary" />
                  <div>
                    <h1 className="text-xl font-bold text-foreground">Reward Shop</h1>
                    <p className="text-sm text-muted-foreground">Spend your points on rewards</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div style={{ backgroundColor: 'hsl(var(--gold))', color: 'hsl(var(--gold-foreground))' }} className="px-4 py-2 rounded-lg font-bold">
                  Your Points: {profile.points}
                </div>
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>

        {/* Shop Grid */}
        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {catalogLoading ? (
              <div className="col-span-full text-center py-8 text-muted-foreground">Loading rewards...</div>
            ) : (
              Array.isArray(catalog) && catalog.map((item: any) => {
                const affordable = profile.points >= item.costPoints;
                
                // Map different reward types to appropriate icons
                const getRewardIcon = (title: string) => {
                  const titleLower = title.toLowerCase();
                  if (titleLower.includes('game') || titleLower.includes('video game')) return <GamepadIcon className="w-8 h-8" />;
                  if (titleLower.includes('phone')) return <Phone className="w-8 h-8" />;
                  if (titleLower.includes('treat') || titleLower.includes('snack')) return <Utensils className="w-8 h-8" />;
                  if (titleLower.includes('dinner') || titleLower.includes('meal')) return <Utensils className="w-8 h-8" />;
                  if (titleLower.includes('movie')) return <Monitor className="w-8 h-8" />;
                  if (titleLower.includes('music')) return <Headphones className="w-8 h-8" />;
                  if (titleLower.includes('art')) return <Palette className="w-8 h-8" />;
                  return <Gift className="w-8 h-8" />;
                };

                return (
                  <Card
                    key={item.id}
                    className="bg-card border-border p-6 hover:border-primary/50 hover:shadow-lg transition-all"
                    data-testid={`reward-item-${item.id}`}
                  >
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 mx-auto bg-muted rounded-2xl flex items-center justify-center text-muted-foreground">
                        {getRewardIcon(item.title)}
                      </div>
                      <h3 className="font-bold text-foreground text-lg">{item.title}</h3>
                      <p className="text-muted-foreground text-sm">{item.description}</p>
                      <div className="flex items-center justify-center">
                        <Badge style={{ backgroundColor: 'hsl(var(--gold))', color: 'hsl(var(--gold-foreground))' }} className="px-3 py-1 font-bold">
                          <Star className="w-3 h-3 mr-1" />
                          {item.costPoints}
                        </Badge>
                      </div>
                      <Button
                        onClick={() => handleRedeemClick(item)}
                        disabled={!affordable || redeemMutation.isPending}
                        className={`w-full py-3 font-bold ${
                          affordable
                            ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                            : 'bg-muted text-muted-foreground cursor-not-allowed'
                        }`}
                        data-testid={`redeem-button-${item.id}`}
                      >
                        {affordable ? 'Request' : 'Need More Points'}
                      </Button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main Rewards View
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Your Rewards</h1>
              <p className="text-muted-foreground">Keep studying to earn more points!</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => setCurrentView('shop')}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-6 py-3"
              >
                <Gift className="w-4 h-4 mr-2" />
                Shop
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Stats and Quests */}
          <div className="lg:col-span-2 space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card border-border p-6" data-testid="points-card">
                <div className="text-center">
                  <Trophy className="w-8 h-8 mx-auto mb-3" style={{ color: 'hsl(var(--gold))' }} />
                  <p className="text-3xl font-bold mb-1" style={{ color: 'hsl(var(--gold))' }} data-testid="current-points">
                    {profile.points}
                  </p>
                  <p className="text-muted-foreground text-sm">Points</p>
                </div>
              </Card>

              <Card className="bg-card border-border p-6" data-testid="level-card">
                <div className="text-center">
                  <Star className="w-8 h-8 mx-auto mb-3 text-primary" />
                  <p className="text-3xl font-bold mb-1 text-primary" data-testid="level-number">
                    {profile.level}
                  </p>
                  <p className="text-muted-foreground text-sm">Level</p>
                </div>
              </Card>

              <Card className="bg-card border-border p-6" data-testid="streak-card">
                <div className="text-center">
                  <Flame className="w-8 h-8 mx-auto mb-3" style={{ color: 'hsl(var(--emerald))' }} />
                  <p className="text-3xl font-bold mb-1" style={{ color: 'hsl(var(--emerald))' }} data-testid="streak-days">
                    {profile.streakDays}
                  </p>
                  <p className="text-muted-foreground text-sm">Day Streak</p>
                </div>
              </Card>

              <Card className="bg-card border-border p-6" data-testid="lifetime-card">
                <div className="text-center">
                  <TrendingUp className="w-8 h-8 mx-auto mb-3" style={{ color: 'hsl(var(--violet))' }} />
                  <p className="text-3xl font-bold mb-1" style={{ color: 'hsl(var(--violet))' }} data-testid="lifetime-points">
                    {profile.lifetimePoints}
                  </p>
                  <p className="text-muted-foreground text-sm">Total Earned</p>
                </div>
              </Card>
            </div>

            {/* Daily Quests */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Daily Quests</h2>
                <Badge className="bg-primary text-primary-foreground px-3 py-1">3 active</Badge>
              </div>
              <div className="space-y-4">
                {sampleQuests.map((quest) => (
                  <Card key={quest.id} className="bg-card border-border p-6">
                    <div className="flex items-center gap-4">
                      {/* Progress Circle */}
                      <div className="relative w-16 h-16 flex-shrink-0">
                        <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                            className="text-border"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                            strokeDasharray={`${(quest.progress / quest.target) * 175.93} 175.93`}
                            className={quest.color}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Clock className="w-6 h-6 text-muted-foreground" />
                        </div>
                      </div>
                      
                      {/* Quest Info */}
                      <div className="flex-1">
                        <h3 className="font-bold text-foreground mb-1">{quest.title}</h3>
                        <p className="text-muted-foreground text-sm mb-2">{quest.description}</p>
                        <p className="text-muted-foreground text-sm">{quest.progress}/{quest.target} tasks</p>
                      </div>
                      
                      {/* Reward */}
                      <div className="text-right">
                        <div className="bg-muted text-foreground px-3 py-1 rounded-lg font-bold text-sm">
                          {quest.reward}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              
              {/* New Quests Unlock Notice */}
              <Card className="bg-card border-border border-dashed p-6">
                <div className="text-center text-muted-foreground">
                  <Calendar className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">New quests unlock daily at midnight</p>
                </div>
              </Card>
            </div>
          </div>

          {/* Right Column - Recent Activity */}
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-4">Recent Activity</h2>
              <div className="space-y-4">
                {sampleActivity.map((activity) => (
                  <Card key={activity.id} className="bg-card border-border p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                        <activity.icon className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground font-medium text-sm">{activity.title}</p>
                        <p className="text-muted-foreground text-xs">{activity.date}</p>
                      </div>
                      <Badge style={{ backgroundColor: 'hsl(var(--gold))', color: 'hsl(var(--gold-foreground))' }} className="text-xs font-bold">
                        {activity.points}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Motivational Card */}
            <Card className="bg-gradient-to-br from-primary/20 to-primary/10 border-primary/30 p-6">
              <div className="text-center">
                <Trophy className="w-12 h-12 mx-auto mb-4" style={{ color: 'hsl(var(--gold))' }} />
                <h3 className="font-bold text-foreground mb-2">Keep up the great work!</h3>
                <p className="text-muted-foreground text-sm">
                  Complete more study sessions and tasks to earn points and level up.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Redeem Dialog */}
      <Dialog open={showRedeemDialog} onOpenChange={setShowRedeemDialog}>
        <DialogContent className="bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-foreground">Confirm Redemption</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Request parent approval to redeem this reward?
            </DialogDescription>
          </DialogHeader>
          
          {selectedReward && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto bg-muted rounded-2xl flex items-center justify-center mb-4">
                  <Gift className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-bold text-foreground text-lg">{selectedReward.title}</h3>
                <p className="text-muted-foreground">{selectedReward.description}</p>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <span className="text-muted-foreground">Cost:</span>
                <Badge style={{ backgroundColor: 'hsl(var(--gold))', color: 'hsl(var(--gold-foreground))' }} className="font-bold">
                  <Star className="w-3 h-3 mr-1" />
                  {selectedReward.costPoints} points
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowRedeemDialog(false)}
              className="border-border text-muted-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleRedeemConfirm}
              disabled={redeemMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {redeemMutation.isPending ? "Requesting..." : "Request Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}