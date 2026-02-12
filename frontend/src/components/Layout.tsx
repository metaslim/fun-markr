import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Breadcrumb } from './Breadcrumb';
import { AssistantPanel } from './AssistantPanel';
import { Tooltip } from './Tooltip';
import { useAssistantStore } from '../stores/assistantStore';
import { useJobStore } from '../stores/jobStore';

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: 'home' },
  { path: '/tests', label: 'Tests', icon: 'tests' },
  { path: '/students', label: 'Students', icon: 'students' },
  { path: '/import', label: 'Import', icon: 'import' },
];

function NavIcon({ type, className }: { type: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    home: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    tests: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    students: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    import: (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  };
  return icons[type] || null;
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [jobsPanelOpen, setJobsPanelOpen] = useState(false);
  const jobsPanelRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { isOpen: isAssistantOpen, open: openAssistant, isModelLoading, loadingProgress } = useAssistantStore();
  const { jobs, hasActiveJobs, startPolling, clearCompleted } = useJobStore();

  // Start polling on mount if there are active jobs
  useEffect(() => {
    if (hasActiveJobs()) {
      startPolling();
    }
  }, []);

  // LLM model is lazy-loaded when assistant panel opens (see assistantStore.open)

  // Close jobs panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (jobsPanelRef.current && !jobsPanelRef.current.contains(event.target as Node)) {
        setJobsPanelOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeJobCount = jobs.filter(j => j.status === 'queued' || j.status === 'processing').length;
  const recentJobs = jobs.slice(0, 5); // Show last 5 jobs

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Sidebar - Desktop */}
      <aside className={`hidden lg:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${sidebarCollapsed ? 'w-20' : 'w-64'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
          {!sidebarCollapsed && (
            <Link to="/" className="text-2xl font-bold text-emerald-500 hover:text-emerald-600 transition-colors">
              Markr
            </Link>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ${sidebarCollapsed ? 'mx-auto' : ''}`}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg className={`w-5 h-5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            const linkContent = (
              <Link
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'text-gray-600 hover:bg-gray-100'
                } ${sidebarCollapsed ? 'justify-center' : ''}`}
              >
                <NavIcon type={item.icon} className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-emerald-500' : 'text-gray-400'}`} />
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
            return sidebarCollapsed ? (
              <Tooltip key={item.path} content={item.label} position="right">
                {linkContent}
              </Tooltip>
            ) : (
              <div key={item.path}>{linkContent}</div>
            );
          })}
        </nav>
      </aside>

      {/* Main content area */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isAssistantOpen ? 'lg:mr-[28rem]' : ''}`}>
        {/* Mobile Header only */}
        <header className="lg:hidden bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="px-4">
            <div className="flex items-center justify-between h-16">
              {/* Mobile: Logo + Menu */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {mobileMenuOpen ? (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
                <Link to="/" className="text-2xl font-bold text-emerald-500">
                  Markr
                </Link>
              </div>

              {/* Right side: AI button */}
              <button
                onClick={openAssistant}
                className="p-2 hover:bg-emerald-50 rounded-lg transition-colors"
                title="AI Assistant"
              >
                <svg className="w-6 h-6 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M7 2L8.5 6.5L13 8L8.5 9.5L7 14L5.5 9.5L1 8L5.5 6.5L7 2Z" />
                  <path d="M16 6L17.5 10.5L22 12L17.5 13.5L16 18L14.5 13.5L10 12L14.5 10.5L16 6Z" />
                  <path d="M8 14L9 17L12 18L9 19L8 22L7 19L4 18L7 17L8 14Z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileMenuOpen && (
            <div className="border-t border-gray-200 bg-white">
              <nav className="px-4 py-3 space-y-1">
                {NAV_ITEMS.map(item => {
                  const isActive = location.pathname === item.path ||
                    (item.path !== '/' && location.pathname.startsWith(item.path));
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <NavIcon type={item.icon} className={`w-5 h-5 ${isActive ? 'text-emerald-500' : 'text-gray-400'}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}
        </header>

        {/* Main content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
          <Breadcrumb />
          {children}
        </main>
      </div>

      {/* Right Icon Bar - Desktop only */}
      <aside className="hidden lg:flex flex-col items-center w-14 bg-white border-l border-gray-200 py-4 gap-2">
        {/* Assistant button */}
        <Tooltip content={isModelLoading ? `Loading AI: ${Math.round(loadingProgress * 100)}%` : 'AI Assistant'} position="left">
          <button
            onClick={openAssistant}
            className={`relative p-3 rounded-xl transition-all ${
              isAssistantOpen
                ? 'bg-gray-800 text-white'
                : isModelLoading
                  ? 'text-gray-600'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            {/* Loading ring around button */}
            {isModelLoading && (
              <svg
                className="absolute inset-0 w-full h-full -rotate-90"
                viewBox="0 0 44 44"
              >
                <circle
                  cx="22" cy="22" r="20"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="2"
                />
                <circle
                  cx="22" cy="22" r="20"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={`${loadingProgress * 125.6} 125.6`}
                  className="transition-all duration-300"
                />
              </svg>
            )}
            <svg className="w-5 h-5 relative" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 2L8.5 6.5L13 8L8.5 9.5L7 14L5.5 9.5L1 8L5.5 6.5L7 2Z" />
              <path d="M16 6L17.5 10.5L22 12L17.5 13.5L16 18L14.5 13.5L10 12L14.5 10.5L16 6Z" />
              <path d="M8 14L9 17L12 18L9 19L8 22L7 19L4 18L7 17L8 14Z" />
            </svg>
          </button>
        </Tooltip>

        {/* Jobs button with dropdown */}
        <div className="relative" ref={jobsPanelRef}>
          <Tooltip content={jobsPanelOpen ? '' : 'Jobs'} position="left">
            <button
              onClick={() => setJobsPanelOpen(!jobsPanelOpen)}
              className={`relative p-3 rounded-xl transition-all ${
                jobsPanelOpen
                  ? 'bg-blue-500 text-white'
                  : activeJobCount > 0
                    ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              {/* Queue/Jobs icon */}
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
              {/* Badge for active jobs */}
              {activeJobCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                  {activeJobCount}
                </span>
              )}
            </button>
          </Tooltip>

          {/* Jobs dropdown panel */}
          {jobsPanelOpen && (
            <div className="absolute right-full mr-2 top-0 w-80 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Import Jobs</h3>
                {jobs.length > 0 && (
                  <button
                    onClick={clearCompleted}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear completed
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {recentJobs.length === 0 ? (
                  <div className="px-4 py-8 text-center text-gray-400 text-sm">
                    No recent import jobs
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {recentJobs.map((job) => (
                      <div key={job.id} className="px-4 py-3 hover:bg-gray-50">
                        <div className="flex items-center gap-3">
                          {/* Status indicator */}
                          {job.status === 'queued' && (
                            <div className="w-2 h-2 bg-gray-400 rounded-full" />
                          )}
                          {job.status === 'processing' && (
                            <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                          )}
                          {job.status === 'completed' && (
                            <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                          {job.status === 'failed' && (
                            <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 capitalize">
                                {job.status === 'processing' ? 'Processing...' : job.status}
                              </span>
                              <span className="text-xs text-gray-400 font-mono">
                                {job.id.slice(0, 8)}
                              </span>
                            </div>
                            {job.status === 'completed' && job.testIds.length > 0 && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {job.testIds.slice(0, 3).map((testId) => (
                                  <Link
                                    key={testId}
                                    to={`/tests/${testId}`}
                                    onClick={() => setJobsPanelOpen(false)}
                                    className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200"
                                  >
                                    Test {testId}
                                  </Link>
                                ))}
                                {job.testIds.length > 3 && (
                                  <span className="text-xs text-gray-400">
                                    +{job.testIds.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                            {job.status === 'failed' && job.error && (
                              <div className="text-xs text-red-500 mt-1 truncate">
                                {job.error}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {jobs.length > 5 && (
                <div className="px-4 py-2 border-t border-gray-100 text-center">
                  <span className="text-xs text-gray-400">
                    Showing last 5 of {jobs.length} jobs
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* AI Assistant Panel */}
      <AssistantPanel />
    </div>
  );
}
