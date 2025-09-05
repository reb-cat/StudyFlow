import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Award, Star, Trophy, Gift, Clock, Target, Coins, Zap, TrendingUp } from 'lucide-react';

export default function RewardsPage() {
  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [showRedeemDialog, setShowRedeemDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current student - for now using hardcoded student names
  // In production this would come from auth context
  const currentStudent = 'abigail'; // or 'khalil' 

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

  // Calculate level progress
  const calculateLevelProgress = (lifetimePoints: number, level: number) => {
    const currentLevelStart = (level - 1) * 200;
    const nextLevelStart = level * 200;
    const progressInLevel = lifetimePoints - currentLevelStart;
    const levelRange = nextLevelStart - currentLevelStart;
    return (progressInLevel / levelRange) * 100;
  };

  const profile = (profileData as any)?.profile;
  const quests = (profileData as any)?.quests || [];
  const settings = (profileData as any)?.settings;

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
    // Show first-time setup message
    return (
      <div className="max-w-2xl mx-auto text-center space-y-6">
        <div className="p-8">
          <Trophy className="h-16 w-16 mx-auto text-primary mb-4" />
          <h1 className="text-2xl font-bold mb-2">Welcome to RewardBank!</h1>
          <p className="text-muted-foreground mb-6">
            Complete assignments and study sessions to earn points, level up, and redeem awesome rewards!
          </p>
          <div className="bg-muted/50 rounded-lg p-6 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-yellow-600" />
              Complete assignments: <strong>15+ points</strong>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600" />
              Finish study sessions: <strong>10+ points</strong>
            </div>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-green-600" />
              Complete quests: <strong>Bonus points</strong>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Your profile will be created automatically when you earn your first points!
          </p>
        </div>
      </div>
    );
  }

  const levelProgress = calculateLevelProgress(profile.lifetimePoints, profile.level);

  return (
    <div className="space-y-6" data-testid="rewards-page">
      
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="points-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Coins className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold" data-testid="current-points">{profile.points}</p>
                <p className="text-sm text-muted-foreground">Available Points</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="level-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Trophy className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold" data-testid="current-level">Level {profile.level}</p>
                <Progress value={levelProgress} className="mt-2 h-2" data-testid="level-progress" />
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.floor(levelProgress)}% to Level {profile.level + 1}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="lifetime-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold" data-testid="lifetime-points">{profile.lifetimePoints}</p>
                <p className="text-sm text-muted-foreground">Lifetime Points</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="streak-card">
          <CardContent className="p-6">
            <div className="flex items-center gap-2">
              <Zap className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold" data-testid="streak-days">{profile.streakDays}</p>
                <p className="text-sm text-muted-foreground">Day Streak</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="rewards" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rewards" data-testid="rewards-tab">🎁 Reward Shop</TabsTrigger>
          <TabsTrigger value="quests" data-testid="quests-tab">🎯 Quests</TabsTrigger>
          <TabsTrigger value="history" data-testid="history-tab">📊 History</TabsTrigger>
        </TabsList>

        {/* Reward Shop */}
        <TabsContent value="rewards" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Reward Shop
              </CardTitle>
              <CardDescription>
                Redeem your points for awesome rewards! All purchases need parent approval.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {catalogLoading ? (
                <div className="text-center py-4">Loading rewards...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="reward-catalog">
                  {Array.isArray(catalog) && catalog.map((item: any) => (
                    <Card key={item.id} className="relative" data-testid={`reward-item-${item.id}`}>
                      <CardHeader>
                        <CardTitle className="text-lg">{item.title}</CardTitle>
                        <CardDescription className="text-sm">{item.description}</CardDescription>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Coins className="h-3 w-3" />
                            {item.costPoints} points
                          </Badge>
                          {item.timesRedeemed > 0 && (
                            <Badge variant="outline" className="text-xs">
                              Redeemed {item.timesRedeemed}x
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button 
                          onClick={() => handleRedeemClick(item)}
                          disabled={profile.points < item.costPoints || redeemMutation.isPending}
                          className="w-full"
                          data-testid={`redeem-button-${item.id}`}
                        >
                          {profile.points < item.costPoints ? 
                            `Need ${item.costPoints - profile.points} more points` : 
                            'Request Redemption'
                          }
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {(!catalog || !Array.isArray(catalog) || catalog.length === 0) && (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                      No rewards available yet. Check back soon!
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Quests */}
        <TabsContent value="quests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Active Quests
              </CardTitle>
              <CardDescription>
                Complete special challenges for bonus points!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4" data-testid="quest-list">
                {Array.isArray(quests) && quests.map((quest: any) => (
                  <Card key={quest.id} className="p-4" data-testid={`quest-${quest.id}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold">{quest.title}</h4>
                        <p className="text-sm text-muted-foreground">{quest.description}</p>
                      </div>
                      <Badge className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        {quest.rewardPoints} pts
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <div className="flex justify-between text-sm text-muted-foreground mb-1">
                        <span>Progress: {quest.currentProgress}/{quest.targetValue}</span>
                        <span>Expires: {new Date(quest.expiresAt).toLocaleDateString()}</span>
                      </div>
                      <Progress 
                        value={(quest.currentProgress / quest.targetValue) * 100}
                        className="h-2"
                      />
                    </div>
                  </Card>
                ))}
                {(!quests || !Array.isArray(quests) || quests.length === 0) && (
                  <div className="text-center py-8 text-muted-foreground">
                    No active quests right now. New challenges coming soon!
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Point History
              </CardTitle>
              <CardDescription>
                Your recent earning activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="text-center py-4">Loading history...</div>
              ) : (
                <div className="space-y-2" data-testid="earning-history">
                  {Array.isArray(history) && history.map((event: any) => (
                    <div key={event.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50" data-testid={`history-${event.id}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          event.type === 'Assignment' ? 'bg-blue-100 text-blue-600' :
                          event.type === 'Session' ? 'bg-green-100 text-green-600' :
                          event.type === 'Quest' ? 'bg-purple-100 text-purple-600' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {event.type === 'Assignment' ? <Award className="h-4 w-4" /> :
                           event.type === 'Session' ? <Clock className="h-4 w-4" /> :
                           event.type === 'Quest' ? <Target className="h-4 w-4" /> :
                           <Coins className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-medium">{event.sourceDetails}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(event.createdAt).toLocaleDateString()} at {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <Badge variant={event.amount > 0 ? "default" : "destructive"} className="flex items-center gap-1">
                        {event.amount > 0 ? '+' : ''}{event.amount}
                        <Coins className="h-3 w-3" />
                      </Badge>
                    </div>
                  ))}
                  {(!history || !Array.isArray(history) || history.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      No earning history yet. Complete some assignments to get started!
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Redemption Dialog */}
      <Dialog open={showRedeemDialog} onOpenChange={setShowRedeemDialog}>
        <DialogContent data-testid="redeem-dialog">
          <DialogHeader>
            <DialogTitle>Redeem Reward</DialogTitle>
            <DialogDescription>
              Request parent approval to redeem this reward
            </DialogDescription>
          </DialogHeader>
          
          {selectedReward && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold">{selectedReward.title}</h3>
                  <p className="text-sm text-muted-foreground">{selectedReward.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className="flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      {selectedReward.costPoints} points
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              
              <div className="text-sm text-muted-foreground">
                <p>⏳ Your request will be sent to your parents for approval.</p>
                <p>💰 Points will only be deducted once approved.</p>
                {settings?.redemptionCooldownMinutes > 0 && (
                  <p>🕐 Cooldown: {settings.redemptionCooldownMinutes} minutes between redemptions.</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRedeemDialog(false)} data-testid="cancel-redeem">
              Cancel
            </Button>
            <Button 
              onClick={handleRedeemConfirm} 
              disabled={redeemMutation.isPending}
              data-testid="confirm-redeem"
            >
              {redeemMutation.isPending ? 'Requesting...' : 'Request Redemption'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}