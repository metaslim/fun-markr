import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { healthCheck } from '../services/api';
import { useContextStore } from '../stores/contextStore';

export function Home() {
  const [health, setHealth] = useState<string | null>(null);
  const [testId, setTestId] = useState('');
  const navigate = useNavigate();
  const addPageVisit = useContextStore((state) => state.addPageVisit);
  const viewedTests = useContextStore((state) => state.viewedTests);

  useEffect(() => {
    addPageVisit('/', 'Home');
    healthCheck()
      .then((res) => setHealth(res.status))
      .catch(() => setHealth('error'));
  }, [addPageVisit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (testId.trim()) {
      navigate(`/tests/${testId.trim()}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">View and analyze test results</p>
        </div>

        {/* Status badge */}
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
          health === 'ok'
            ? 'bg-emerald-100 text-emerald-700'
            : health === 'error'
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-500'
        }`}>
          <span className={`w-2 h-2 rounded-full ${
            health === 'ok' ? 'bg-emerald-500'
            : health === 'error' ? 'bg-red-500'
            : 'bg-gray-400'
          }`} />
          {health === 'ok' ? 'API Online' : health === 'error' ? 'API Offline' : 'Checking...'}
        </div>
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="flex gap-4">
          <input
            type="text"
            value={testId}
            onChange={(e) => setTestId(e.target.value)}
            placeholder="Enter Test ID to view results..."
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
          />
          <button
            type="submit"
            disabled={!testId.trim()}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
          >
            View Test
          </button>
        </form>
      </div>

      {/* Recent Tests */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Tests</h2>

        {viewedTests.size > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from(viewedTests.entries()).reverse().map(([id, data]) => (
              <Link
                key={id}
                to={`/tests/${id}`}
                className="block p-6 bg-white border border-gray-200 rounded-2xl hover:shadow-lg hover:border-emerald-200 transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-500">Test {id}</span>
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-500">
                    {data.aggregate.count} students
                  </span>
                </div>

                <div className="text-4xl font-bold text-emerald-500 group-hover:text-emerald-600 transition-colors">
                  {data.aggregate.mean.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-500 mt-1">Average Score</div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-xs text-gray-400">
                  <span>Min: {data.aggregate.min.toFixed(0)}%</span>
                  <span>Max: {data.aggregate.max.toFixed(0)}%</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white border-2 border-dashed border-gray-200 rounded-2xl">
            <div className="text-5xl mb-4">📊</div>
            <div className="text-gray-500 mb-4">No tests viewed yet</div>
            <Link
              to="/tests/9863"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors"
            >
              View sample test
              <span>&rarr;</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
