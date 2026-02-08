import { Link, useLocation } from 'react-router-dom';

export function Breadcrumb() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);

  // Only show breadcrumb for nested routes (e.g., /tests/9863, /tests/9863/students)
  // Hide for top-level routes: /, /tests, /students, /import
  if (pathnames.length < 2) return null;

  // Only show for /tests/:id paths
  if (pathnames[0] !== 'tests') return null;

  return (
    <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
      <Link to="/" className="hover:text-emerald-500 transition-colors">
        Home
      </Link>
      <span className="text-gray-400">/</span>
      <Link to="/tests" className="hover:text-emerald-500 transition-colors">
        Tests
      </Link>
      {pathnames.slice(1).map((name, index) => {
        const routeTo = `/tests/${pathnames.slice(1, index + 2).join('/')}`;
        const isLast = index === pathnames.length - 2;

        let displayName = name;
        if (name.match(/^\d+$/) && index === 0) {
          displayName = `Test ${name}`;
        } else if (name === 'students') {
          displayName = 'Students';
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
