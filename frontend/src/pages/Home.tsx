import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { healthCheck } from '../services/api';
import { useContextStore } from '../stores/contextStore';

export function Home() {
  const [health, setHealth] = useState<string | null>(null);
  const addPageVisit = useContextStore((state) => state.addPageVisit);
  const viewedTests = useContextStore((state) => state.viewedTests);

  useEffect(() => {
    addPageVisit('/', 'Home');
    healthCheck()
      .then((res) => setHealth(res.status))
      .catch(() => setHealth('error'));
  }, [addPageVisit]);

  return (
    <div className="page">
      <h1>Markr Dashboard</h1>

      <div className="status-card">
        <h2>API Status</h2>
        <p>
          Backend: {' '}
          <span className={health === 'ok' ? 'status-ok' : 'status-error'}>
            {health || 'checking...'}
          </span>
        </p>
      </div>

      <div className="card">
        <h2>Quick Actions</h2>
        <div className="actions">
          <Link to="/import" className="btn">Import Results</Link>
          <Link to="/tests/9863" className="btn">View Test 9863</Link>
        </div>
      </div>

      <div className="card">
        <h2>View Test</h2>
        <p>Enter a test ID to view its aggregate statistics:</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const input = form.elements.namedItem('testId') as HTMLInputElement;
            if (input.value) {
              window.location.href = `/tests/${input.value}`;
            }
          }}
        >
          <input type="text" name="testId" placeholder="Test ID (e.g., 9863)" />
          <button type="submit" className="btn">View</button>
        </form>
      </div>

      {viewedTests.size > 0 && (
        <div className="card">
          <h2>Recently Viewed Tests</h2>
          <ul>
            {Array.from(viewedTests.entries()).map(([testId, data]) => (
              <li key={testId}>
                <Link to={`/tests/${testId}`}>
                  Test {testId} - Mean: {data.aggregate.mean.toFixed(1)}%, Students: {data.aggregate.count}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
