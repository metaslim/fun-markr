import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTests, listStudents } from '../services/api';
import type { TestSummary } from '../types';

export function Home() {
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listTests().then(res => { if (!cancelled) setTests(res.tests); }),
      listStudents().then(res => { if (!cancelled) setStudentCount(res.count); })
    ])
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const totalTests = tests.length;
  const avgScore = tests.length > 0
    ? tests.reduce((sum, t) => sum + t.mean, 0) / tests.length
    : 0;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link to="/tests" className="p-6 bg-white border border-gray-200 rounded-2xl hover:shadow-lg hover:border-emerald-200 transition-all">
          <div className="text-sm text-gray-500 mb-1">Total Tests</div>
          <div className="text-4xl font-bold text-emerald-500">{loading ? '...' : totalTests}</div>
        </Link>
        <Link to="/students" className="p-6 bg-white border border-gray-200 rounded-2xl hover:shadow-lg hover:border-emerald-200 transition-all">
          <div className="text-sm text-gray-500 mb-1">Total Students</div>
          <div className="text-4xl font-bold text-emerald-500">{loading ? '...' : studentCount ?? 0}</div>
        </Link>
        <div className="p-6 bg-white border border-gray-200 rounded-2xl">
          <div className="text-sm text-gray-500 mb-1">Average Score</div>
          <div className="text-4xl font-bold text-emerald-500">{loading ? '...' : `${avgScore.toFixed(1)}%`}</div>
        </div>
      </div>

      {/* Tests grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">All Tests</h2>
          <Link to="/import" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
            + Import Results
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500">Loading...</div>
        ) : tests.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tests.map((test) => (
              <Link
                key={test.test_id}
                to={`/tests/${test.test_id}`}
                className="block p-6 bg-white border border-gray-200 rounded-2xl hover:shadow-lg hover:border-emerald-200 transition-all group"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-gray-500">Test {test.test_id}</span>
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-500">
                    {test.count} students
                  </span>
                </div>

                <div className="text-4xl font-bold text-emerald-500 group-hover:text-emerald-600 transition-colors">
                  {test.mean.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-500 mt-1">Average Score</div>

                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-xs text-gray-400">
                  <span>Min: {test.min.toFixed(0)}%</span>
                  <span>Max: {test.max.toFixed(0)}%</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-white border-2 border-dashed border-gray-200 rounded-2xl">
            <div className="text-5xl mb-4">📊</div>
            <div className="text-gray-500 mb-4">No test results yet</div>
            <Link
              to="/import"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl transition-colors"
            >
              Import Results
              <span>&rarr;</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
