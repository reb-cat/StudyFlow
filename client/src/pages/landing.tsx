import { useState } from 'react';
import { ArrowRight, CheckCircle, Clock, Heart, Brain, Shield, Star, ChevronRight } from 'lucide-react';

// Theme colors using CSS custom properties
const colors = {
  primary: 'var(--primary)',
  complete: 'var(--success)',
  progress: 'var(--accent)',
  support: 'var(--muted-foreground)',
  background: 'var(--background)',
  surface: 'var(--card)',
  text: 'var(--foreground)',
  textMuted: 'var(--muted-foreground)',
  border: 'var(--border)'
};

export default function LandingPage() {
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);

  const features = [
    {
      id: 'guided',
      icon: Brain,
      title: 'Guided Learning Mode',
      description: 'Step-by-step support through daily tasks with timers and gentle transitions',
      color: colors.primary
    },
    {
      id: 'executive',
      icon: Clock,
      title: 'Executive Function Support',
      description: 'Built-in timers, task breakdowns, and clear visual progress tracking',
      color: colors.progress
    },
    {
      id: 'sensory',
      icon: Heart,
      title: 'Sensory-Friendly Design',
      description: 'Calming colors, reduced visual clutter, and no overwhelming notifications',
      color: colors.complete
    },
    {
      id: 'flexible',
      icon: Shield,
      title: 'Flexible Scheduling',
      description: 'Easily adjust when tasks need more time or support without stress',
      color: colors.support
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border py-5 px-10 sticky top-0 z-[100]">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white text-xl font-bold">
              S
            </div>
            <span className="text-2xl font-bold text-primary">
              StudyFlow
            </span>
          </div>
          
          <button
            onClick={() => window.location.href = '/family'}
            className="py-2.5 px-6 bg-primary border-none rounded-lg text-white text-base font-medium cursor-pointer flex items-center gap-2 transition-transform duration-200"
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Sign In
            <ArrowRight size={18} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-10 bg-card border-b border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-foreground mb-6 leading-tight">
            Learning Made <span className="text-primary">Calm</span> and <span style={{ color: 'var(--success)' }}>Clear</span>
          </h1>
          
          <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
            A neurodivergent-friendly learning platform that adapts to how your brain works best.
            Built for students who need structure without rigidity.
          </p>
          
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => window.location.href = '/family'}
              className="px-8 py-3.5 bg-primary border-none rounded-xl text-primary-foreground text-lg font-semibold cursor-pointer shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-[0.98]"
            >
              Get Started
            </button>
            
            <button
              onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
              className="px-8 py-3.5 bg-transparent border-2 border-primary rounded-xl text-primary text-lg font-semibold cursor-pointer transition-all duration-200 hover:bg-primary/5"
            >
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-10">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-foreground text-center mb-12">
            Designed for Different Minds
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon as any;
              return (
                <div
                  key={feature.id}
                  onMouseEnter={() => setHoveredFeature(feature.id)}
                  onMouseLeave={() => setHoveredFeature(null)}
                  className={`bg-card border rounded-xl p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                    hoveredFeature === feature.id ? 'border-primary shadow-lg' : 'border-border shadow-sm'
                  }`}
                >
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Icon size={24} color={feature.color} />
                  </div>
                  
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    {feature.title}
                  </h3>
                  
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-10 bg-card border-t border-b border-border">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-4xl font-bold text-foreground text-center mb-12">
            Simple to Start, Easy to Use
          </h2>
          
          <div className="flex flex-col gap-8">
            {[
              { number: '1', title: 'Set up your schedule', desc: 'Add assignments and customize time blocks' },
              { number: '2', title: 'Choose your mode', desc: 'Overview for independence or Guided for support' },
              { number: '3', title: 'Work at your pace', desc: 'Timers and breaks adapt to your needs' }
            ].map((step, index) => (
              <div key={index} className="flex gap-5 items-start">
                <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-bold flex-shrink-0">
                  {step.number}
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-foreground mb-1">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground text-base">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-10 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold text-foreground mb-6">
            Ready to Transform Your Learning?
          </h2>
          
          <p className="text-lg text-muted-foreground mb-8">
            Join families who've discovered a calmer way to manage homeschool assignments.
          </p>
          
          <button
            onClick={() => window.location.href = '/family'}
            className="px-10 py-4 bg-primary border-none rounded-xl text-primary-foreground text-xl font-semibold cursor-pointer shadow-lg hover:shadow-xl inline-flex items-center gap-2 transition-all duration-200 hover:scale-[0.98]"
          >
            Start Free Trial
            <Star size={20} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="p-10 bg-card border-t border-border text-center text-muted-foreground text-sm">
        <div className="mb-4">
          StudyFlow • Built for focused learning
        </div>
        <div className="text-xs">
          © 2024 StudyFlow. Designed with neurodivergent learners in mind.
        </div>
      </footer>
    </div>
  );
}