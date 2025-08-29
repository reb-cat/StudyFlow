import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import LandingPage from "@/pages/landing";
import FamilyDashboard from "@/pages/student-selection";
import StudentDashboard from "@/pages/student-dashboard";
import AdminPanel from "@/pages/admin-panel";
import PrintQueue from "@/pages/print-queue";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/family" component={FamilyDashboard} />
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
