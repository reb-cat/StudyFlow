import { Switch, Route } from "wouter";
import { useState, useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import LandingPage from "@/pages/landing";
import StudentSelection from "@/pages/student-selection";
import FamilyDashboard from "@/pages/family-dashboard";
import StudentDashboard from "@/pages/student-dashboard";
import AdminPanel from "@/pages/admin-panel";
import PrintQueue from "@/pages/print-queue";
import UnlockPage from "@/pages/unlock";
import { apiRequest } from "@/lib/queryClient";

function Router() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check authentication status on app load
    const checkAuth = async () => {
      try {
        const response = await apiRequest('GET', '/api/auth/status') as { authenticated: boolean };
        setIsAuthenticated(response.authenticated);
      } catch (error) {
        setIsAuthenticated(false);
      }
    };
    
    checkAuth();
  }, []);

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
      <Route path="/student/:student" component={StudentDashboard} />
      <Route path="/admin" component={AdminPanel} />
      <Route path="/print-queue" component={PrintQueue} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
