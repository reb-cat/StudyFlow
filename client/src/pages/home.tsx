import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import {
  GraduationCap,
  CheckCircle,
  Clock,
  AlertCircle,
  Printer,
  Settings,
  Shield
} from "lucide-react";

export default function Home() {
  // Fetch real stats from the API
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/stats'],
    queryFn: async () => {
      const response = await fetch('/api/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    }
  });

  // Create stats array with real data
  const stats = [
    {
      icon: GraduationCap,
      title: "Active Learners",
      value: statsLoading ? "..." : String(statsData?.activeStudents || 2),
      description: "Students engaged in today's learning journey",
      color: "primary",
      gradient: "linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)"
    },
    {
      icon: CheckCircle,
      title: "Completed",
      value: statsLoading ? "..." : String(statsData?.completed || 0),
      description: "Tasks completed today",
      color: "complete",
      gradient: "linear-gradient(135deg, var(--status-complete) 0%, #4ADE80 100%)"
    },
    {
      icon: Clock,
      title: "In Progress",
      value: statsLoading ? "..." : String(statsData?.inProgress || 0), 
      description: "Taking extra time to master concepts",
      color: "progress",
      gradient: "linear-gradient(135deg, var(--status-progress) 0%, #60A5FA 100%)"
    },
    {
      icon: AlertCircle,
      title: "Need Support",
      value: statsLoading ? "..." : String(statsData?.needSupport || 0),
      description: "Students ready for guidance",
      color: "blocked",
      gradient: "linear-gradient(135deg, var(--status-blocked) 0%, #8B93A8 100%)"
    }
  ];
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, var(--background) 0%, var(--surface-secondary) 100%)' }}>
      {/* Header */}
      <header style={{ 
        background: 'rgba(248, 249, 250, 0.8)', 
        backdropFilter: 'blur(12px) saturate(1.1)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div className="max-w-6xl mx-auto px-8 py-4 flex justify-between items-center">
          <a href="/" className="flex items-center text-2xl font-bold text-primary no-underline">
            <div style={{
              width: '36px',
              height: '36px',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)',
              borderRadius: '10px',
              marginRight: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 600,
              boxShadow: 'var(--shadow-sm)'
            }}>
              S
            </div>
            StudyFlow
          </a>
          
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="hover:text-foreground transition-colors cursor-pointer">Settings</span>
            <div className="flex items-center gap-2">
              <div style={{
                width: '36px',
                height: '36px',
                background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: 'var(--shadow-sm)'
              }} onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)';
              }} onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)';
              }} title="Parent/Admin Account">
                PA
              </div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto px-8 py-12">
        {/* Hero Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
          data-testid="hero-section"
        >
          <h1 
            className="text-5xl font-bold mb-4"
            style={{ 
              background: 'linear-gradient(135deg, var(--foreground) 0%, var(--primary) 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.025em'
            }}
            data-testid="hero-title"
          >
            Focus. Plan. Achieve.
          </h1>
          <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto" data-testid="hero-description">
            A thoughtful learning hub designed for focus and growth
          </p>
          
          <div className="flex justify-center gap-4 flex-wrap mb-8">
            <Button 
              size="lg" 
              className="h-12 px-8 shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)' }}
              data-testid="button-register"
              onClick={() => window.location.href = '/register'}
            >
              Register Account
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="h-12 px-8 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30"
              data-testid="button-login"
              onClick={() => window.location.href = '/login'}
            >
              Login
            </Button>
            <Button 
              size="lg" 
              className="h-12 px-8 shadow-lg hover:shadow-xl transition-all duration-200 hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, var(--status-blocked) 0%, #5A6B85 100%)' }}
              data-testid="button-print-queue"
              onClick={() => window.location.href = '/print-queue'}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Queue
            </Button>
          </div>
        </motion.section>

        {/* Quick Stats */}
        <section className="mb-16" data-testid="stats-section">
          <h2 className="text-3xl font-semibold mb-8 text-center text-foreground">
            Today's Learning Progress
          </h2>
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
            data-testid="stats-grid"
          >
            {stats.map((stat, index) => {
              const IconComponent = stat.icon;
              const getIconBg = (color: string) => {
                switch(color) {
                  case 'complete': return 'rgba(33, 191, 6, 0.1)';
                  case 'progress': return 'rgba(59, 134, 209, 0.1)';
                  case 'blocked': return 'rgba(108, 114, 147, 0.1)';
                  default: return 'var(--primary-subtle)';
                }
              };
              const getIconColor = (color: string) => {
                switch(color) {
                  case 'complete': return 'var(--status-complete)';
                  case 'progress': return 'var(--status-progress)';
                  case 'blocked': return 'var(--status-blocked)';
                  default: return 'var(--primary)';
                }
              };
              const getValueColor = (color: string) => {
                switch(color) {
                  case 'complete': return 'var(--status-complete)';
                  case 'progress': return 'var(--status-progress)';
                  case 'blocked': return 'var(--status-blocked)';
                  default: return 'var(--primary)';
                }
              };
              
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card 
                    className="p-8 relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border border-border"
                    style={{ 
                      background: 'var(--card)',
                      borderRadius: '20px'
                    }}
                    data-testid={`stat-card-${index}`}
                  >
                    <div 
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '4px',
                        background: stat.gradient
                      }}
                    />
                    <CardContent className="p-0">
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '1rem',
                        background: getIconBg(stat.color),
                        color: getIconColor(stat.color)
                      }}>
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        {stat.title}
                      </div>
                      <div 
                        className="text-4xl font-bold mb-2"
                        style={{ color: getValueColor(stat.color) }}
                        data-testid={`stat-value-${index}`}
                      >
                        {stat.value}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed" data-testid={`stat-description-${index}`}>
                        {stat.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ 
        background: 'var(--surface-tertiary)',
        borderTop: '1px solid var(--border)',
        marginTop: '5rem'
      }}>
        <div className="max-w-6xl mx-auto px-8 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            StudyFlow • Built for focused learning
          </p>
        </div>
      </footer>
    </div>
  );
}
