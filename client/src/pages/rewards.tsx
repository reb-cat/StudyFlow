import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { QuestCard } from '@/components/rewards/QuestCard';
import { Trophy, Gift, Star, TrendingUp, Flame, Target, Clock, Award } from 'lucide-react';

export default function RewardsPage() {
  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
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

  if (profileLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading your rewards...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-3xl mx-auto text-center space-y-8">
        <div className="p-12">
          <Trophy className="h-20 w-20 mx-auto text-primary mb-6" />
          <h1 className="text-2xl font-bold mb-4">Welcome to RewardBank!</h1>
          <p className="text-base text-muted-foreground mb-8 leading-relaxed">
            Complete assignments and study sessions to earn points, level up, and redeem awesome rewards!
          </p>
          <div className="bg-muted/50 rounded-lg p-8 space-y-4 text-base">
            <div className="flex items-center gap-2">
              <Award className="h-6 w-6 text-gold" />
              Complete assignments: <strong>100-500 points</strong>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-6 w-6 text-blue" />
              Finish study sessions: <strong>300+ points</strong>
            </div>
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-emerald" />
              Complete quests: <strong>500+ bonus points</strong>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Your profile will be created automatically when you earn your first points!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-8 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold mb-2">Your Rewards</h1>
              <p className="text-muted-foreground text-sm">
                Keep studying to earn more points!
              </p>
            </div>
            <Button 
              className="bg-primary hover:bg-primary/90" 
              onClick={() => setShowRedeemDialog(true)}
            >
              <Gift className="w-4 h-4 mr-2" />
              Shop
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid gap-8">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Current Points */}
            <Card className="p-4 bg-card border border-border" data-testid="points-card">
              <div className="text-center">
                <Trophy className="w-8 h-8 text-gold mx-auto mb-2" />
                <p className="text-lg font-bold text-gold mb-1" data-testid="current-points">
                  {profile.points}
                </p>
                <p className="text-xs text-muted-foreground">Points</p>
              </div>
            </Card>

            {/* Level */}
            <Card className="p-4 bg-card border border-border" data-testid="level-card">
              <div className="text-center">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mx-auto mb-2">
                  <span className="text-sm font-bold text-primary-foreground">{profile.level}</span>
                </div>
                <p className="text-xs text-muted-foreground">Level {profile.level}</p>
              </div>
            </Card>

            {/* Streak */}
            <Card className="p-4 bg-card border border-border" data-testid="streak-card">
              <div className="text-center">
                <Flame className="w-8 h-8 text-emerald mx-auto mb-2" />
                <p className="text-lg font-bold text-emerald mb-1" data-testid="streak-days">
                  {profile.streakDays}
                </p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </Card>

            {/* Lifetime Points */}
            <Card className="p-4 bg-card border border-border" data-testid="lifetime-card">
              <div className="text-center">
                <TrendingUp className="w-8 h-8 text-violet mx-auto mb-2" />
                <p className="text-lg font-bold text-violet mb-1" data-testid="lifetime-points">
                  {profile.lifetimePoints}
                </p>
                <p className="text-xs text-muted-foreground">Total Earned</p>
              </div>
            </Card>
          </div>

          {/* Quest Cards Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Daily Quests</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quests.map((quest: any) => (
                <QuestCard key={quest.id} quest={quest} />
              ))}
            </div>
          </div>

          {/* Reward Shop Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold">Reward Shop</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="reward-catalog">
              {catalogLoading ? (
                <div className="col-span-full text-center py-4">Loading rewards...</div>
              ) : (
                Array.isArray(catalog) && catalog.map((item: any) => {
                  const affordable = profile.points >= item.costPoints;
                  const emojiMatch = item.title.match(/^([^\w\s]+)/);
                  const emoji = emojiMatch ? emojiMatch[1] : '🎁';
                  const title = item.title.replace(/^[^\w\s]+\s*/, '');

                  return (
                    <Card
                      key={item.id}
                      className={`p-4 bg-card border border-border transition-all animate-fade-in ${
                        affordable ? 'hover:border-primary/50 hover:shadow-lg cursor-pointer' : 'opacity-60'
                      }`}
                      data-testid={`reward-item-${item.id}`}
                    >
                      <div className="text-center space-y-3">
                        <div className="w-10 h-10 mx-auto bg-primary/10 rounded-xl flex items-center justify-center text-lg">
                          {emoji}
                        </div>
                        <h3 className="font-semibold text-sm leading-tight">{title}</h3>
                        {item.description && (
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        )}
                        <div className="flex items-center justify-center gap-2">
                          <Badge
                            className={`text-sm px-2 py-1 ${
                              affordable
                                ? 'bg-gold/20 text-gold border-gold/30'
                                : 'bg-muted text-muted-foreground'
                            }`}
                            variant="outline"
                          >
                            <Star className="w-3 h-3 mr-1" />
                            {item.costPoints}
                          </Badge>
                        </div>
                        <Button
                          onClick={() => handleRedeemClick(item)}
                          disabled={!affordable || redeemMutation.isPending}
                          size="sm"
                          className={`w-full ${
                            affordable
                              ? 'bg-primary hover:bg-primary/90'
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
      </div>

      {/* Redeem Dialog */}
      <Dialog open={showRedeemDialog} onOpenChange={setShowRedeemDialog}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Confirm Redemption</DialogTitle>
            <DialogDescription>
              Request parent approval to redeem this reward?
            </DialogDescription>
          </DialogHeader>
          
          {selectedReward && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto bg-primary/10 rounded-xl flex items-center justify-center text-xl mb-2">
                  {selectedReward.title.match(/^([^\w\s]+)/)?.[1] || '🎁'}
                </div>
                <h3 className="font-semibold">{selectedReward.title.replace(/^[^\w\s]+\s*/, '')}</h3>
                <p className="text-muted-foreground text-sm">{selectedReward.description}</p>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <span className="text-sm">Cost:</span>
                <Badge className="bg-gold/20 text-gold border-gold/30">
                  <Star className="w-3 h-3 mr-1" />
                  {selectedReward.costPoints} points
                </Badge>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRedeemDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRedeemConfirm}
              disabled={redeemMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {redeemMutation.isPending ? "Requesting..." : "Request Approval"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}