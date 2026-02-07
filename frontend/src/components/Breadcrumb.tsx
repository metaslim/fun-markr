import { Link, useLocation } from 'react-router-dom';

export function Breadcrumb() {
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
