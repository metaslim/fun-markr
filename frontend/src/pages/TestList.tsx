import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTests } from '../services/api';
import { useContextStore } from '../stores/contextStore';
import type { TestSummary } from '../types';

export function TestList() {
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addPageVisit = useContextStore((state) => state.addPageVisit);

  useEffect(() => {
    addPageVisit('/tests', 'All Tests');

    listTests()
      .then((res) => {
        setTests(res.tests);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [addPageVisit]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Tests</h2>
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">All Tests</h1>
          <p className="text-gray-500 mt-1">{tests.length} test{tests.length !== 1 ? 's' : ''} available</p>
        </div>
        <Link
          to="/import"
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
        >
          Import New
        </Link>
      </div>

      {tests.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tests.map((test) => (
            <Link
              key={test.test_id}
              to={`/tests/${test.test_id}`}
              className="block p-6 bg-white border border-gray-200 rounded-2xl hover:shadow-lg hover:border-emerald-200 transition-all group"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-lg font-semibold text-gray-900">Test {test.test_id}</span>
                <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-500">
                  {test.count} students
                </span>
              </div>

              {/* Score gauge */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative w-16 h-16">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50" cy="50" r="40"
                      fill="none"
                      stroke="#e5e7eb"
                      strokeWidth="10"
                    />
                    <circle
                      cx="50" cy="50" r="40"
                      fill="none"
                      stroke={test.mean >= 70 ? '#10b981' : test.mean >= 50 ? '#f59e0b' : '#ef4444'}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${test.mean * 2.51} 251`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-bold text-gray-900">{test.mean.toFixed(0)}%</span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Average Score</div>
                  <div className={`text-lg font-semibold ${
                    test.mean >= 70 ? 'text-emerald-600' : test.mean >= 50 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {test.mean >= 70 ? 'Good' : test.mean >= 50 ? 'Average' : 'Needs Work'}
                  </div>
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-100 text-center">
                <div>
                  <div className="text-xs text-gray-400">Min</div>
                  <div className="text-sm font-medium text-red-500">{test.min.toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Median</div>
                  <div className="text-sm font-medium text-blue-500">{test.p50.toFixed(0)}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Max</div>
                  <div className="text-sm font-medium text-emerald-500">{test.max.toFixed(0)}%</div>
                </div>
              </div>

              {/* Arrow indicator */}
              <div className="mt-4 text-emerald-500 text-sm font-medium group-hover:translate-x-1 transition-transform">
                View Details →
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white border-2 border-dashed border-gray-200 rounded-2xl">
          <div className="text-5xl mb-4">📋</div>
          <div className="text-gray-500 mb-4">No tests imported yet</div>
          <Link
            to="/import"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors"
          >
            Import Test Results
            <span>→</span>
          </Link>
        </div>
      )}
    </div>
  );
}
