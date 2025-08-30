import { useState } from 'react';
import { ArrowRight, CheckCircle, Clock, Heart, Brain, Shield, Star, ChevronRight } from 'lucide-react';

// Your color system
const colors = {
  primary: '#844FC1',
  complete: '#21BF06',
  progress: '#3B86D1',
  support: '#6C7293',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  text: '#212529',
  textMuted: '#6C7293',
  border: '#E9ECEF'
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
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background
    }}>
      {/* Header */}
      <header style={{
        backgroundColor: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        padding: '20px 40px',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              backgroundColor: colors.primary,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '20px',
              fontWeight: 'bold'
            }}>
              S
            </div>
            <span style={{ 
              fontSize: '24px', 
              fontWeight: 'bold',
              color: colors.primary
            }}>
              StudyFlow
            </span>
          </div>
          
          <button
            onClick={() => window.location.href = '/family'}
            style={{
              padding: '10px 24px',
              backgroundColor: colors.primary,
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'transform 0.2s'
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Sign In
            <ArrowRight size={18} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{
        padding: '80px 40px',
        backgroundColor: colors.surface,
        borderBottom: `1px solid ${colors.border}`
      }}>
        <div style={{
          maxWidth: '800px',
          margin: '0 auto',
          textAlign: 'center'
        }}>
          <h1 style={{
            fontSize: '48px',
            fontWeight: 'bold',
            color: colors.text,
            marginBottom: '24px',
            lineHeight: '1.2'
          }}>
            Learning Made <span style={{ color: colors.primary }}>Calm</span> and <span style={{ color: colors.complete }}>Clear</span>
          </h1>
          
          <p style={{
            fontSize: '20px',
            color: colors.textMuted,
            marginBottom: '40px',
            lineHeight: '1.6'
          }}>
            A neurodivergent-friendly learning platform that adapts to how your brain works best.
            Built for students who need structure without rigidity.
          </p>
          
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
            <button
              onClick={() => window.location.href = '/family'}
              style={{
                padding: '14px 32px',
                backgroundColor: colors.primary,
                border: 'none',
                borderRadius: '10px',
                color: 'white',
                fontSize: '18px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: `0 4px 12px ${colors.primary}30`,
                transition: 'transform 0.2s'
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              Get Started
            </button>
            
            <button
              onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
              style={{
                padding: '14px 32px',
                backgroundColor: 'transparent',
                border: `2px solid ${colors.primary}`,
                borderRadius: '10px',
                color: colors.primary,
                fontSize: '18px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" style={{
        padding: '80px 40px'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 'bold',
            color: colors.text,
            textAlign: 'center',
            marginBottom: '48px'
          }}>
            Designed for Different Minds
          </h2>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px'
          }}>
            {features.map((feature) => {
              const Icon = feature.icon as any;
              return (
                <div
                  key={feature.id}
                  onMouseEnter={() => setHoveredFeature(feature.id)}
                  onMouseLeave={() => setHoveredFeature(null)}
                  style={{
                    backgroundColor: colors.surface,
                    border: `1px solid ${hoveredFeature === feature.id ? feature.color : colors.border}`,
                    borderRadius: '12px',
                    padding: '28px',
                    transition: 'all 0.3s ease',
                    transform: hoveredFeature === feature.id ? 'translateY(-4px)' : 'translateY(0)',
                    boxShadow: hoveredFeature === feature.id 
                      ? `0 8px 24px ${feature.color}20` 
                      : '0 2px 8px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{
                    width: '48px',
                    height: '48px',
                    backgroundColor: `${feature.color}15`,
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '16px'
                  }}>
                    <Icon size={24} color={feature.color} />
                  </div>
                  
                  <h3 style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: colors.text,
                    marginBottom: '12px'
                  }}>
                    {feature.title}
                  </h3>
                  
                  <p style={{
                    color: colors.textMuted,
                    fontSize: '15px',
                    lineHeight: '1.5'
                  }}>
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section style={{
        padding: '80px 40px',
        backgroundColor: colors.surface,
        borderTop: `1px solid ${colors.border}`,
        borderBottom: `1px solid ${colors.border}`
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 'bold',
            color: colors.text,
            textAlign: 'center',
            marginBottom: '48px'
          }}>
            Simple to Start, Easy to Use
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {[
              { number: '1', title: 'Set up your schedule', desc: 'Add assignments and customize time blocks' },
              { number: '2', title: 'Choose your mode', desc: 'Overview for independence or Guided for support' },
              { number: '3', title: 'Work at your pace', desc: 'Timers and breaks adapt to your needs' }
            ].map((step, index) => (
              <div key={index} style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  backgroundColor: colors.primary,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  {step.number}
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', color: colors.text, marginBottom: '4px' }}>
                    {step.title}
                  </h3>
                  <p style={{ color: colors.textMuted, fontSize: '16px' }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={{
        padding: '80px 40px',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '36px',
            fontWeight: 'bold',
            color: colors.text,
            marginBottom: '24px'
          }}>
            Ready to Transform Your Learning?
          </h2>
          
          <p style={{
            fontSize: '18px',
            color: colors.textMuted,
            marginBottom: '32px'
          }}>
            Join families who've discovered a calmer way to manage homeschool assignments.
          </p>
          
          <button
            onClick={() => window.location.href = '/family'}
            style={{
              padding: '16px 40px',
              backgroundColor: colors.primary,
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontSize: '20px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: `0 6px 20px ${colors.primary}30`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'transform 0.2s'
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            Start Free Trial
            <Star size={20} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        padding: '40px',
        backgroundColor: colors.surface,
        borderTop: `1px solid ${colors.border}`,
        textAlign: 'center',
        color: colors.textMuted,
        fontSize: '14px'
      }}>
        <div style={{ marginBottom: '16px' }}>
          StudyFlow • Built for focused learning
        </div>
        <div style={{ fontSize: '13px' }}>
          © 2024 StudyFlow. Designed with neurodivergent learners in mind.
        </div>
      </footer>
    </div>
  );
}