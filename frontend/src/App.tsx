import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { TestList } from './pages/TestList';
import { TestDetail } from './pages/TestDetail';
import { TestStudents } from './pages/TestStudents';
import { StudentList } from './pages/StudentList';
import { StudentDetail } from './pages/StudentDetail';
import { Import } from './pages/Import';
import { ChatAgent } from './components/ChatAgent';

// Breadcrumb component
function Breadcrumb() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);

  if (pathnames.length === 0) return null;

  const breadcrumbNames: Record<string, string> = {
    'tests': 'Tests',
    'students': 'Students',
    'import': 'Import',
  };

  return (
    <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
      <Link to="/" className="hover:text-emerald-500 transition-colors">
        Home
      </Link>
      {pathnames.map((name, index) => {
        const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        let displayName = breadcrumbNames[name] || name;
        // Handle test IDs
        if (name.match(/^\d+$/) && pathnames[index - 1] === 'tests') {
          displayName = `Test ${name}`;
        }
        // Handle student numbers
        if (pathnames[index - 1] === 'students') {
          displayName = `Student ${name}`;
        }

        return (
          <span key={name} className="flex items-center gap-2">
            <span className="text-gray-400">/</span>
            {isLast ? (
              <span className="text-gray-700">{displayName}</span>
            ) : (
              <Link to={routeTo} className="hover:text-emerald-500 transition-colors">
                {displayName}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/tests', label: 'Tests' },
    { path: '/students', label: 'Students' },
    { path: '/import', label: 'Import' },
  ];

  return (
    <div className="min-h-screen w-full bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-2xl font-bold text-emerald-500 hover:text-emerald-600 transition-colors">
                Markr
              </Link>

              {/* Desktop nav */}
              <nav className="hidden md:flex gap-1">
                {navItems.map(item => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-emerald-500 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 hover:text-gray-900 transition-colors"
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
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <nav className="px-4 py-3 space-y-1">
              {navItems.map(item => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-500 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb />
        {children}
      </main>

      {/* Chat Agent */}
      <ChatAgent />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><Home /></Layout>} />
        <Route path="/tests" element={<Layout><TestList /></Layout>} />
        <Route path="/tests/:testId" element={<Layout><TestDetail /></Layout>} />
        <Route path="/tests/:testId/students" element={<Layout><TestStudents /></Layout>} />
        <Route path="/students" element={<Layout><StudentList /></Layout>} />
        <Route path="/students/:studentNumber" element={<Layout><StudentDetail /></Layout>} />
        <Route path="/import" element={<Layout><Import /></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
