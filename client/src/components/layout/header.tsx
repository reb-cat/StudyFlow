import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu, Zap } from "lucide-react";

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <motion.header 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="sticky top-0 z-50 w-full border-b border-border/40 backdrop-blur"
      style={{ background: 'rgba(248, 249, 250, 0.95)' }}
      data-testid="header"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo/Brand */}
          <div className="flex items-center space-x-2" data-testid="logo">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)' }}>
              <Zap className="h-5 w-5" />
            </div>
            <span className="text-xl font-semibold" style={{ color: 'var(--primary)' }}>StudyFlow</span>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-6" data-testid="nav-desktop">
            <a href="#" className="text-sm font-medium text-foreground hover:text-primary transition-colors" data-testid="nav-dashboard">
              Dashboard
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-tasks">
              Tasks
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-calendar">
              Calendar
            </a>
            <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-analytics">
              Analytics
            </a>
          </nav>

          {/* User Menu */}
          <div className="flex items-center space-x-3" data-testid="user-menu">
            <Button variant="outline" size="sm" data-testid="button-settings">
              Settings
            </Button>
            <div className="flex items-center space-x-2">
              <Avatar className="h-8 w-8" data-testid="user-avatar">
                <AvatarFallback>SF</AvatarFallback>
              </Avatar>
              <span className="hidden sm:block text-sm font-medium text-foreground" data-testid="user-name">
                StudyFlow
              </span>
            </div>
          </div>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <motion.nav 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-border/40 py-4"
            data-testid="nav-mobile"
          >
            <div className="flex flex-col space-y-2">
              <a href="#" className="text-sm font-medium text-foreground hover:text-primary transition-colors py-2" data-testid="nav-mobile-dashboard">
                Dashboard
              </a>
              <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2" data-testid="nav-mobile-tasks">
                Tasks
              </a>
              <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2" data-testid="nav-mobile-calendar">
                Calendar
              </a>
              <a href="#" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2" data-testid="nav-mobile-analytics">
                Analytics
              </a>
            </div>
          </motion.nav>
        )}
      </div>
    </motion.header>
  );
}
