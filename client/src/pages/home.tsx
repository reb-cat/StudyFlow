import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDFDFD] to-[#F8F9FA]">
      {/* Header */}
      <header className="bg-[rgba(253,253,253,0.85)] border-b border-[#E5E5E5] p-4 sticky top-0 z-[100] backdrop-blur-[10px] backdrop-saturate-[1.2]">
        <div className="max-w-6xl mx-auto flex justify-between items-center px-8">
          <Link href="/" className="flex items-center text-2xl font-bold text-[#069494] no-underline" data-testid="logo-link">
            <div className="w-8 h-8 bg-gradient-to-br from-[#069494] to-[#014D4E] rounded-lg mr-3 flex items-center justify-center text-white font-semibold">
              S
            </div>
            StudyFlow
          </Link>
          
          <nav>
            <ul className="flex gap-8 list-none">
              <li><Link href="/student" className="no-underline text-[#525252] font-medium hover:text-[#069494] transition-colors" data-testid="nav-dashboard">Dashboard</Link></li>
              <li><Link href="/admin" className="no-underline text-[#525252] font-medium hover:text-[#069494] transition-colors" data-testid="nav-admin">Admin</Link></li>
              <li><Link href="/print-queue" className="no-underline text-[#525252] font-medium hover:text-[#069494] transition-colors" data-testid="nav-print">Print Queue</Link></li>
            </ul>
          </nav>
          
          <div className="flex items-center gap-4 text-sm text-[#525252]" data-testid="user-section">
            <span>Settings</span>
            <span>SF</span>
            <span>StudyFlow Admin</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-8 py-12">
        {/* Hero Section */}
        <section className="text-center mb-16" data-testid="hero-section">
          <h1 className="text-5xl font-bold tracking-tight mb-4 bg-gradient-to-br from-[#1A1A1A] to-[#069494] bg-clip-text text-transparent" data-testid="hero-title">
            Focus. Plan. Achieve.
          </h1>
          <p className="text-xl text-[#525252] mb-12" data-testid="hero-subtitle">
            Your family's learning hub
          </p>
          
          <div className="flex justify-center gap-4 flex-wrap mb-8" data-testid="action-buttons">
            <Link
              href="/student"
              className="px-8 py-4 border-none rounded-xl font-semibold text-base cursor-pointer transition-all duration-200 no-underline inline-flex items-center gap-2 bg-gradient-to-br from-[#069494] to-[#014D4E] text-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 hover:shadow-[0_10px_15px_rgba(0,0,0,0.1)]"
              data-testid="button-student-dashboard"
            >
              Student Dashboard
            </Link>
            <Link
              href="/admin"
              className="px-8 py-4 bg-[#F1F3F4] text-[#1A1A1A] border border-[#E5E5E5] rounded-xl font-semibold text-base cursor-pointer transition-all duration-200 no-underline inline-flex items-center gap-2 hover:bg-[#F8F9FA] hover:border-[#B8E6E6]"
              data-testid="button-admin-panel"
            >
              Admin Panel
            </Link>
            <Link
              href="/print-queue"
              className="px-8 py-4 bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-white rounded-xl font-semibold text-base cursor-pointer transition-all duration-200 no-underline inline-flex items-center gap-2 hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(245,158,11,0.4)]"
              data-testid="button-print-queue"
            >
              Print Queue
            </Link>
          </div>
        </section>

        {/* Quick Stats */}
        <section className="mb-16" data-testid="stats-section">
          <h2 className="text-2xl font-semibold mb-6 text-[#1A1A1A]" data-testid="stats-title">Today's Overview</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
            <div className="bg-[rgba(253,253,253,0.6)] border border-[rgba(229,229,229,0.6)] rounded-2xl p-6 transition-all duration-200 backdrop-blur-[10px] hover:-translate-y-0.5 hover:shadow-[0_4px_6px_rgba(0,0,0,0.1)] hover:bg-[rgba(253,253,253,0.8)]" data-testid="stat-card-students">
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm font-semibold text-[#525252] uppercase tracking-wide">Active Students</div>
              </div>
              <div className="text-3xl font-bold mb-2 text-[#069494]">2</div>
              <div className="text-sm text-[#737373]">Students working today</div>
            </div>
            
            <div className="bg-[rgba(253,253,253,0.6)] border border-[rgba(229,229,229,0.6)] rounded-2xl p-6 transition-all duration-200 backdrop-blur-[10px] hover:-translate-y-0.5 hover:shadow-[0_4px_6px_rgba(0,0,0,0.1)] hover:bg-[rgba(253,253,253,0.8)]" data-testid="stat-card-completed">
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm font-semibold text-[#525252] uppercase tracking-wide">Tasks Completed</div>
              </div>
              <div className="text-3xl font-bold mb-2 text-[#10B981]">8</div>
              <div className="text-sm text-[#737373]">Great progress today!</div>
            </div>
            
            <div className="bg-[rgba(253,253,253,0.6)] border border-[rgba(229,229,229,0.6)] rounded-2xl p-6 transition-all duration-200 backdrop-blur-[10px] hover:-translate-y-0.5 hover:shadow-[0_4px_6px_rgba(0,0,0,0.1)] hover:bg-[rgba(253,253,253,0.8)]" data-testid="stat-card-need-time">
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm font-semibold text-[#525252] uppercase tracking-wide">Need More Time</div>
              </div>
              <div className="text-3xl font-bold mb-2 text-[#F59E0B]">3</div>
              <div className="text-sm text-[#737373]">Working through challenges</div>
            </div>
            
            <div className="bg-[rgba(253,253,253,0.6)] border border-[rgba(229,229,229,0.6)] rounded-2xl p-6 transition-all duration-200 backdrop-blur-[10px] hover:-translate-y-0.5 hover:shadow-[0_4px_6px_rgba(0,0,0,0.1)] hover:bg-[rgba(253,253,253,0.8)]" data-testid="stat-card-stuck">
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm font-semibold text-[#525252] uppercase tracking-wide">Need Attention</div>
              </div>
              <div className="text-3xl font-bold mb-2 text-[#EF4444]">1</div>
              <div className="text-sm text-[#737373]">Students requesting help</div>
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="bg-[#F8F9FA] border-t border-[#E5E5E5] p-8 mt-16" data-testid="footer">
        <div className="max-w-6xl mx-auto px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div data-testid="footer-section-studyflow">
              <h4 className="font-semibold mb-4 text-[#1A1A1A]">StudyFlow</h4>
              <p className="text-sm text-[#525252] leading-6">
                Empowering students with executive function differences to achieve their academic potential.
              </p>
            </div>
            
            <div data-testid="footer-section-links">
              <h4 className="font-semibold mb-4 text-[#1A1A1A]">Quick Links</h4>
              <ul className="list-none">
                <li className="mb-2"><Link href="/help" className="text-[#525252] no-underline text-sm transition-colors hover:text-[#069494]" data-testid="footer-link-help">Help Center</Link></li>
                <li className="mb-2"><Link href="/contact" className="text-[#525252] no-underline text-sm transition-colors hover:text-[#069494]" data-testid="footer-link-contact">Contact Us</Link></li>
                <li className="mb-2"><Link href="/accessibility" className="text-[#525252] no-underline text-sm transition-colors hover:text-[#069494]" data-testid="footer-link-accessibility">Accessibility</Link></li>
                <li className="mb-2"><Link href="/status" className="text-[#525252] no-underline text-sm transition-colors hover:text-[#069494]" data-testid="footer-link-status">System Status</Link></li>
              </ul>
            </div>
            
            <div data-testid="footer-section-admin">
              <h4 className="font-semibold mb-4 text-[#1A1A1A]">Admin</h4>
              <ul className="list-none">
                <li className="mb-2"><Link href="/admin" className="text-[#525252] no-underline text-sm transition-colors hover:text-[#069494]" data-testid="footer-link-settings">Settings</Link></li>
                <li className="mb-2"><Link href="/admin" className="text-[#525252] no-underline text-sm transition-colors hover:text-[#069494]" data-testid="footer-link-users">Manage Users</Link></li>
                <li className="mb-2"><Link href="/admin" className="text-[#525252] no-underline text-sm transition-colors hover:text-[#069494]" data-testid="footer-link-reports">Reports</Link></li>
                <li className="mb-2"><Link href="/admin" className="text-[#525252] no-underline text-sm transition-colors hover:text-[#069494]" data-testid="footer-link-backup">Backup</Link></li>
              </ul>
            </div>
            
            <div data-testid="footer-section-resources">
              <h4 className="font-semibold mb-4 text-[#1A1A1A]">Resources</h4>
              <ul className="list-none">
                <li className="mb-2"><Link href="/guides" className="text-[#525252] no-underline text-sm transition-colors hover:text-[#069494]" data-testid="footer-link-guides">Study Guides</Link></li>
                <li className="mb-2"><Link href="/templates" className="text-[#525252] no-underline text-sm transition-colors hover:text-[#069494]" data-testid="footer-link-templates">Templates</Link></li>
                <li className="mb-2"><Link href="/tips" className="text-[#525252] no-underline text-sm transition-colors hover:text-[#069494]" data-testid="footer-link-tips">Executive Function Tips</Link></li>
                <li className="mb-2"><Link href="/documentation" className="text-[#525252] no-underline text-sm transition-colors hover:text-[#069494]" data-testid="footer-link-docs">API Docs</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="text-center mt-8 pt-8 border-t border-[#E5E5E5] text-sm text-[#737373]" data-testid="footer-bottom">
            © 2025 StudyFlow. Built with ❤️ for student success.
          </div>
        </div>
      </footer>
    </div>
  );
}