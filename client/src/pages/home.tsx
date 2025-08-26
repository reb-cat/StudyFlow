import { motion } from "framer-motion";
import Header from "@/components/layout/header";
import Footer from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ClipboardList,
  Clock,
  BarChart3,
  Calendar,
  Heart,
  BookOpen,
  CheckCircle,
  Shield,
  Zap
} from "lucide-react";

const features = [
  {
    icon: ClipboardList,
    title: "Smart Task Management",
    description: "Break down complex assignments into manageable steps with automatic time estimates and gentle reminders.",
    color: "bg-blue-100 text-blue-600"
  },
  {
    icon: Clock,
    title: "Focus Timer",
    description: "Customizable Pomodoro sessions with break reminders and distraction blocking features.",
    color: "bg-green-100 text-green-600"
  },
  {
    icon: BarChart3,
    title: "Progress Analytics",
    description: "Visual progress tracking with encouraging insights to help you understand your productivity patterns.",
    color: "bg-purple-100 text-purple-600"
  },
  {
    icon: Calendar,
    title: "Flexible Scheduling",
    description: "Adaptive calendar that adjusts to your energy levels and accommodates unexpected changes.",
    color: "bg-orange-100 text-orange-600"
  },
  {
    icon: Heart,
    title: "Gentle Accountability",
    description: "Supportive check-ins and study buddy matching to keep you motivated without overwhelming pressure.",
    color: "bg-red-100 text-red-600"
  },
  {
    icon: BookOpen,
    title: "Study Resources",
    description: "Curated study techniques, accessibility tools, and executive function strategies from education experts.",
    color: "bg-teal-100 text-teal-600"
  }
];

const techStack = [
  { name: "Next.js 15", description: "App Router & TypeScript" },
  { name: "Supabase", description: "Real-time Database" },
  { name: "shadcn/ui", description: "Accessible Components" },
  { name: "Framer Motion", description: "Smooth Animations" }
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <motion.section 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="border-b border-border bg-secondary/50"
          data-testid="hero-section"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="max-w-3xl">
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl" data-testid="hero-title">
                Focus. Plan. Achieve.
              </h1>
              <p className="mt-4 text-xl text-muted-foreground leading-relaxed" data-testid="hero-description">
                A distraction-free productivity platform designed specifically for students with executive function needs. Organize your tasks, manage your time, and stay on track with gentle guidance.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Button 
                  size="lg" 
                  className="h-11 px-8"
                  data-testid="button-get-started"
                  onClick={() => window.location.href = '/student'}
                >
                  Student Dashboard
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="h-11 px-8"
                  data-testid="button-admin-panel"
                  onClick={() => window.location.href = '/admin'}
                >
                  Admin Panel
                </Button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* Features Grid */}
        <section className="py-16" data-testid="features-section">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground" data-testid="features-title">
                Built for Student Success
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="features-description">
                Every feature is designed with accessibility and executive function in mind, helping you build sustainable study habits.
              </p>
            </div>

            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="grid gap-8 md:grid-cols-2 lg:grid-cols-3"
              data-testid="features-grid"
            >
              {features.map((feature, index) => {
                const IconComponent = feature.icon;
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                  >
                    <Card className="p-6 h-full" data-testid={`feature-card-${index}`}>
                      <CardContent className="p-0">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-lg mb-4 ${feature.color}`}>
                          <IconComponent className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2" data-testid={`feature-title-${index}`}>
                          {feature.title}
                        </h3>
                        <p className="text-muted-foreground leading-relaxed" data-testid={`feature-description-${index}`}>
                          {feature.description}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </section>

        {/* Technology Stack */}
        <section className="py-16 bg-secondary/50 border-t border-border" data-testid="tech-section">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground" data-testid="tech-title">
                Built with Modern Technology
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="tech-description">
                Powered by the latest web technologies for performance, accessibility, and reliability.
              </p>
            </div>

            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
              data-testid="tech-grid"
            >
              {techStack.map((tech, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="p-4 text-center" data-testid={`tech-card-${index}`}>
                    <CardContent className="p-0">
                      <div className="text-2xl font-bold text-foreground mb-2" data-testid={`tech-name-${index}`}>
                        {tech.name}
                      </div>
                      <p className="text-sm text-muted-foreground" data-testid={`tech-description-${index}`}>
                        {tech.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>

            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              viewport={{ once: true }}
              className="mt-12 text-center"
              data-testid="compliance-badges"
            >
              <div className="inline-flex items-center space-x-2 text-sm text-muted-foreground">
                <CheckCircle className="w-4 h-4" />
                <span>WCAG 2.1 AA Compliant</span>
                <span>•</span>
                <Shield className="w-4 h-4" />
                <span>SOC 2 Type II</span>
                <span>•</span>
                <Zap className="w-4 h-4" />
                <span>99.9% Uptime</span>
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <motion.section 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="py-16"
          data-testid="cta-section"
        >
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <Card className="max-w-3xl mx-auto p-8 text-center" data-testid="cta-card">
              <CardContent className="p-0">
                <h2 className="text-3xl font-bold text-foreground mb-4" data-testid="cta-title">
                  Ready to Transform Your Study Habits?
                </h2>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed" data-testid="cta-description">
                  Join thousands of students who have found their focus and achieved their academic goals with StudyFlow.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button size="lg" className="h-11 px-8" data-testid="button-start-trial">
                    Start Free Trial
                  </Button>
                  <Button variant="outline" size="lg" className="h-11 px-8" data-testid="button-schedule-demo">
                    Schedule Demo
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground mt-4" data-testid="cta-disclaimer">
                  No credit card required • 14-day free trial • Cancel anytime
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.section>
      </main>

      <Footer />
    </div>
  );
}
