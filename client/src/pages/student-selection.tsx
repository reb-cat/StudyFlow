import { Link } from 'wouter';

export default function StudentSelection() {
  // Get current date
  const today = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  const formattedDate = today.toLocaleDateString('en-US', dateOptions);

  // Get time-based greeting
  const hour = today.getHours();
  let greeting = 'Good morning!';
  if (hour >= 12 && hour < 17) {
    greeting = 'Good afternoon!';
  } else if (hour >= 17) {
    greeting = 'Good evening!';
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, var(--surface-primary) 0%, var(--surface-secondary) 100%)' }}>
      {/* Header */}
      <header className="sticky top-0 z-100 backdrop-blur-sm border-b" style={{ 
        background: 'rgba(248, 249, 250, 0.8)', 
        borderColor: 'var(--border-subtle)' 
      }}>
        <div className="max-w-6xl mx-auto flex justify-between items-center px-8 py-4">
          <Link href="/" className="flex items-center text-decoration-none">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-semibold mr-3 shadow-sm" style={{
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)'
            }}>
              S
            </div>
            <span className="text-xl font-bold" style={{ color: 'var(--primary)' }}>StudyFlow</span>
          </Link>
          <Link href="/admin" className="text-sm font-medium px-4 py-2 rounded-lg transition-all duration-200 text-decoration-none" style={{
            color: 'var(--text-secondary)'
          }} onMouseEnter={(e) => {
            (e.target as HTMLElement).style.background = 'var(--primary-subtle)';
            (e.target as HTMLElement).style.color = 'var(--primary)';
          }} onMouseLeave={(e) => {
            (e.target as HTMLElement).style.background = 'transparent';
            (e.target as HTMLElement).style.color = 'var(--text-secondary)';
          }}>
            Admin
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-8 py-16">
        {/* Welcome Section */}
        <div className="text-center rounded-2xl p-8 mb-12 shadow-sm border" style={{
          background: 'var(--surface-elevated)',
          borderColor: 'var(--border-subtle)'
        }}>
          <div className="text-sm font-medium uppercase tracking-wide mb-2" style={{
            color: 'var(--text-tertiary)',
            letterSpacing: '0.05em'
          }}>
            {formattedDate}
          </div>
          <div className="text-xl font-semibold" style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--status-progress) 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            {greeting} Let's make it a great day!
          </div>
        </div>

        {/* Students Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Abigail */}
          <Link href="/student/abigail">
            <div className="group cursor-pointer">
              <div className="rounded-3xl p-8 transition-all duration-300 border relative overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1" style={{
                background: 'var(--surface-elevated)',
                borderColor: 'var(--border-subtle)'
              }} onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary-light)';
              }} onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}>
                {/* Top border accent */}
                <div className="absolute top-0 left-0 right-0 h-1" style={{
                  background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)'
                }}></div>

                {/* Student Header */}
                <div className="flex items-center mb-6">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mr-4 shadow-md" style={{
                    background: 'linear-gradient(135deg, #844FC1 0%, #9D6DD1 100%)'
                  }}>
                    A
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                      Abigail
                    </h3>
                  </div>
                </div>

                {/* Status Message */}
                <div className="mb-6">
                  <div className="text-sm text-center p-3 rounded-lg" style={{
                    color: 'var(--text-secondary)',
                    background: 'var(--surface-secondary)'
                  }}>
                    You're doing amazing! Keep it up!
                  </div>
                </div>

                {/* Action Button */}
                <button className="w-full py-4 px-8 rounded-xl text-white font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5" style={{
                  background: 'radial-gradient(circle, #844FC1 30%, #3B86D1 100%)'
                }} data-testid="button-select-abigail">
                  Let's Go!
                </button>
              </div>
            </div>
          </Link>

          {/* Khalil */}
          <Link href="/student/khalil">
            <div className="group cursor-pointer">
              <div className="rounded-3xl p-8 transition-all duration-300 border relative overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1" style={{
                background: 'var(--surface-elevated)',
                borderColor: 'var(--border-subtle)'
              }} onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary-light)';
              }} onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
              }}>
                {/* Top border accent */}
                <div className="absolute top-0 left-0 right-0 h-1" style={{
                  background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)'
                }}></div>

                {/* Student Header */}
                <div className="flex items-center mb-6">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold mr-4 shadow-md" style={{
                    background: 'linear-gradient(135deg, #3B86D1 0%, #60A5FA 100%)'
                  }}>
                    K
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                      Khalil
                    </h3>
                  </div>
                </div>

                {/* Status Message */}
                <div className="mb-6">
                  <div className="text-sm text-center p-3 rounded-lg" style={{
                    color: 'var(--text-secondary)',
                    background: 'var(--surface-secondary)'
                  }}>
                    Ready for another great learning day!
                  </div>
                </div>

                {/* Action Button */}
                <button className="w-full py-4 px-8 rounded-xl text-white font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5" style={{
                  background: 'radial-gradient(circle, #3B86D1 30%, #844FC1 100%)'
                }} data-testid="button-select-khalil">
                  Let's Go!
                </button>
              </div>
            </div>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center pb-8" style={{ color: 'var(--text-tertiary)' }}>
        <div className="text-sm">StudyFlow • Built for focused learning</div>
      </footer>
    </div>
  );
}