import { Outlet, Link, useLocation } from 'react-router-dom';
import { ChatAgent } from './ChatAgent';

export function Layout() {
  const location = useLocation();

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-brand">
          <Link to="/">Markr</Link>
        </div>
        <div className="nav-links">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
            Dashboard
          </Link>
          <Link to="/import" className={location.pathname === '/import' ? 'active' : ''}>
            Import
          </Link>
        </div>
      </nav>

      <main className="main">
        <Outlet />
      </main>

      <ChatAgent />
    </div>
  );
}
