import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Settings, 
  FileText, 
  Calendar, 
  BarChart3, 
  Download, 
  Upload, 
  Printer, 
  BookOpen, 
  Target,
  Clock,
  RefreshCw
} from 'lucide-react';

interface AdminTile {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge?: string;
}

const adminTiles: AdminTile[] = [
  {
    title: "Assignment Manager",
    description: "Manage, edit, and track all student assignments",
    href: "/assignments",
    icon: FileText,
    color: "blue",
    badge: "Core"
  },
  {
    title: "Print Queue",
    description: "Review and manage items that need printing",
    href: "/print-queue", 
    icon: Printer,
    color: "purple"
  },
  {
    title: "Student Dashboard",
    description: "View individual student progress and schedules",
    href: "/students",
    icon: Users,
    color: "green"
  },
  {
    title: "Family Dashboard",
    description: "Parent overview of all students and family tasks",
    href: "/family",
    icon: Calendar,
    color: "orange"
  },
  {
    title: "Bible Curriculum",
    description: "Manage the 52-week sequential Bible study program",
    href: "#bible-curriculum",
    icon: BookOpen,
    color: "indigo",
    badge: "52 Week"
  },
  {
    title: "Schedule Templates", 
    description: "Configure daily schedule blocks and time allocations",
    href: "#schedule-templates",
    icon: Clock,
    color: "pink"
  },
  {
    title: "Canvas Integration",
    description: "Sync assignments and manage Canvas connections",
    href: "#canvas-integration", 
    icon: Download,
    color: "teal",
    badge: "API"
  },
  {
    title: "Analytics & Reports",
    description: "View performance metrics and generate reports",
    href: "#analytics",
    icon: BarChart3,
    color: "violet"
  },
  {
    title: "System Settings",
    description: "Configure global settings and preferences", 
    href: "#system-settings",
    icon: Settings,
    color: "gray"
  }
];

const getColorClasses = (color: string) => {
  const colorMap: Record<string, { bg: string; text: string; border: string; hover: string }> = {
    blue: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/20', hover: 'hover:bg-primary/15' },
    purple: { bg: 'bg-accent/10', text: 'text-accent-foreground', border: 'border-accent/20', hover: 'hover:bg-accent/15' },
    green: { bg: 'bg-green-500/10 dark:bg-green-400/10', text: 'text-green-700 dark:text-green-400', border: 'border-green-200 dark:border-green-800', hover: 'hover:bg-green-500/15 dark:hover:bg-green-400/15' },
    orange: { bg: 'bg-orange-500/10 dark:bg-orange-400/10', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800', hover: 'hover:bg-orange-500/15 dark:hover:bg-orange-400/15' },
    indigo: { bg: 'bg-indigo-500/10 dark:bg-indigo-400/10', text: 'text-indigo-700 dark:text-indigo-400', border: 'border-indigo-200 dark:border-indigo-800', hover: 'hover:bg-indigo-500/15 dark:hover:bg-indigo-400/15' },
    pink: { bg: 'bg-pink-500/10 dark:bg-pink-400/10', text: 'text-pink-700 dark:text-pink-400', border: 'border-pink-200 dark:border-pink-800', hover: 'hover:bg-pink-500/15 dark:hover:bg-pink-400/15' },
    teal: { bg: 'bg-teal-500/10 dark:bg-teal-400/10', text: 'text-teal-700 dark:text-teal-400', border: 'border-teal-200 dark:border-teal-800', hover: 'hover:bg-teal-500/15 dark:hover:bg-teal-400/15' },
    violet: { bg: 'bg-violet-500/10 dark:bg-violet-400/10', text: 'text-violet-700 dark:text-violet-400', border: 'border-violet-200 dark:border-violet-800', hover: 'hover:bg-violet-500/15 dark:hover:bg-violet-400/15' },
    gray: { bg: 'bg-muted/50', text: 'text-muted-foreground', border: 'border-muted', hover: 'hover:bg-muted/60' }
  };
  return colorMap[color] || colorMap.gray;
};

export default function AdminPanel() {
  const handleTileClick = (href: string) => {
    if (href.startsWith('#')) {
      // For future features, show a placeholder
      alert(`${href.replace('#', '').replace('-', ' ')} feature coming soon!`);
    } else {
      window.location.href = href;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8" data-testid="admin-panel">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <Target className="w-10 h-10 text-primary" />
          <h1 className="text-4xl font-bold text-foreground" data-testid="admin-title">
            StudyFlow Admin
          </h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Central hub for managing students, assignments, schedules, and system configuration. 
          Navigate to specialized tools and dashboards from here.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-primary">Active Students</p>
                <p className="text-2xl font-bold text-primary">2</p>
              </div>
              <Users className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-green-500/10 dark:bg-green-400/10 border-green-200 dark:border-green-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">System Status</p>
                <p className="text-lg font-bold text-green-700 dark:text-green-400">Operational</p>
              </div>
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-accent/10 border-accent/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-accent-foreground">Print Queue</p>
                <p className="text-2xl font-bold text-accent-foreground">16</p>
              </div>
              <Printer className="w-8 h-8 text-accent-foreground" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-indigo-500/10 dark:bg-indigo-400/10 border-indigo-200 dark:border-indigo-800">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-700 dark:text-indigo-400">Bible Week</p>
                <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">1</p>
              </div>
              <BookOpen className="w-8 h-8 text-indigo-700 dark:text-indigo-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Grid */}
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Admin Tools</h2>
          <p className="text-muted-foreground">Click any card to navigate to that feature</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminTiles.map((tile, index) => {
            const colors = getColorClasses(tile.color);
            const IconComponent = tile.icon;
            
            return (
              <Card
                key={index}
                className={`${colors.bg} ${colors.border} cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 ${colors.hover}`}
                onClick={() => handleTileClick(tile.href)}
                data-testid={`admin-tile-${tile.title.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-background/70">
                        <IconComponent className={`w-6 h-6 ${colors.text}`} />
                      </div>
                      <div>
                        <CardTitle className={`text-lg font-semibold ${colors.text}`}>
                          {tile.title}
                        </CardTitle>
                        {tile.badge && (
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full bg-background/70 ${colors.text} mt-1`}>
                            {tile.badge}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className={`text-sm ${colors.text} opacity-80`}>
                    {tile.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-foreground">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => window.location.href = '/assignments'}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90"
            data-testid="quick-assignments"
          >
            <FileText className="w-4 h-4" />
            Manage Assignments
          </Button>
          
          <Button
            onClick={() => window.location.href = '/print-queue'}
            variant="outline"
            className="flex items-center gap-2"
            data-testid="quick-print-queue"
          >
            <Printer className="w-4 h-4" />
            Print Queue
          </Button>
          
          <Button
            onClick={() => window.location.href = '/family'}
            variant="outline"
            className="flex items-center gap-2"
            data-testid="quick-family"
          >
            <Calendar className="w-4 h-4" />
            Family View
          </Button>
          
          <Button
            onClick={() => alert('Canvas sync feature coming soon!')}
            variant="outline"
            className="flex items-center gap-2"
            data-testid="quick-canvas-sync"
          >
            <RefreshCw className="w-4 h-4" />
            Sync Canvas
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pt-8 border-t border-border">
        <p className="text-sm text-muted-foreground">
          StudyFlow Admin Panel - Executive Function-Friendly Student Management
        </p>
        <p className="text-xs text-muted-foreground/60 mt-1">
          Navigate between tools using the cards above or quick action buttons
        </p>
      </div>
    </div>
  );
}