import { Switch, Route } from "wouter";
import { useState, useEffect, createContext, useContext } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import LandingPage from "@/pages/landing";
import StudentSelection from "@/pages/student-selection";
import FamilyDashboard from "@/pages/family-dashboard";
import StudentDashboard from "@/pages/student-dashboard";
import AdminPanel from "@/pages/admin-panel";
import AssignmentsPage from "@/pages/assignments";
import PrintQueue from "@/pages/print-queue";
import ScheduleTemplates from "@/pages/schedule-templates";
import ChecklistManager from "@/pages/checklist-manager";
import UnlockPage from "@/pages/unlock";
import AdminAuth from "@/components/AdminAuth";
import { apiRequest } from "@/lib/queryClient";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Auth context for global auth state management
const AuthContext = createContext<{
  isAuthenticated: boolean | null;
  setIsAuthenticated: (auth: boolean) => void;
}>({
  isAuthenticated: null,
  setIsAuthenticated: () => {},
});

export const useAuth = () => useContext(AuthContext);

function Router() {
  const { isAuthenticated, setIsAuthenticated } = useAuth();

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  // Show unlock page if not authenticated
  if (!isAuthenticated) {
    return <UnlockPage onUnlock={() => setIsAuthenticated(true)} />;
  }

  // Show app if authenticated
  return (
    <Switch>
      <Route path="/" component={StudentSelection} />
      <Route path="/landing" component={LandingPage} />
      <Route path="/family" component={FamilyDashboard} />
      <Route path="/students" component={StudentSelection} />
      <Route path="/student" component={StudentSelection} />
      <Route path="/student/:student" component={StudentDashboard} />
      <Route path="/admin">
        <AdminAuth>
          <AdminPanel />
        </AdminAuth>
      </Route>
      <Route path="/assignments" component={AssignmentsPage} />
      <Route path="/print-queue" component={PrintQueue} />
      <Route path="/schedule-templates" component={ScheduleTemplates} />
      <Route path="/checklist-manager" component={ChecklistManager} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check authentication status ONLY on initial app load
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/status', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setIsAuthenticated(data.authenticated);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
      }
    };
    
    // Only check auth once on app load
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, setIsAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <ErrorBoundary>
              <Router />
            </ErrorBoundary>
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
