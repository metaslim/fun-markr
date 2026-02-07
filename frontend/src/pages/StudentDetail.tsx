import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getStudent } from '../services/api';
import { useContextStore } from '../stores/contextStore';
import type { StudentResult } from '../types';

export function StudentDetail() {
  const { studentNumber } = useParams<{ studentNumber: string }>();
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const addPageVisit = useContextStore((state) => state.addPageVisit);

  useEffect(() => {
    if (!studentNumber) return;

    addPageVisit(`/students/${studentNumber}`, `Student ${studentNumber}`);

    getStudent(studentNumber)
      .then((res) => {
        setResults(res.results);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [studentNumber, addPageVisit]);

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
        <div className="text-6xl mb-4">👤</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Student Not Found</h2>
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  // Calculate overall stats
  const avgPercentage = results.length > 0
    ? results.reduce((sum, r) => sum + r.percentage, 0) / results.length
    : 0;

  const getGradeBand = (percentage: number) => {
    if (percentage >= 80) return { label: 'A', color: 'bg-emerald-100 text-emerald-700' };
    if (percentage >= 65) return { label: 'B', color: 'bg-blue-100 text-blue-700' };
    if (percentage >= 50) return { label: 'C', color: 'bg-amber-100 text-amber-700' };
    if (percentage >= 40) return { label: 'D', color: 'bg-orange-100 text-orange-700' };
    return { label: 'F', color: 'bg-red-100 text-red-700' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-6">
          {/* Avatar */}
          <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center">
            <span className="text-3xl">👤</span>
          </div>

          {/* Info */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">
              {results[0]?.student_name || `Student ${studentNumber}`}
            </h1>
            {results[0]?.student_name && (
              <p className="text-gray-400 text-sm">ID: {studentNumber}</p>
            )}
            <button
              onClick={() => document.getElementById('test-results')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-emerald-600 hover:text-emerald-700 mt-1 text-left transition-colors"
            >
              {results.length} test{results.length !== 1 ? 's' : ''} taken ↓
            </button>
          </div>

          {/* Overall stats */}
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-600">{avgPercentage.toFixed(1)}%</div>
              <div className="text-sm text-gray-500">Overall Avg</div>
            </div>
            <div className={`px-4 py-2 rounded-xl text-lg font-semibold ${getGradeBand(avgPercentage).color}`}>
              {getGradeBand(avgPercentage).label}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div id="test-results">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Results</h2>

        {results.length > 0 ? (
          <div className="grid gap-4">
            {results.map((result) => {
              const grade = getGradeBand(result.percentage);
              return (
                <div
                  key={result.test_id}
                  className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Link
                        to={`/tests/${result.test_id}`}
                        className="text-lg font-semibold text-gray-900 hover:text-emerald-600 transition-colors"
                      >
                        Test {result.test_id}
                      </Link>
                      <span className={`px-2.5 py-1 rounded-lg text-sm font-medium ${grade.color}`}>
                        {grade.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-sm text-gray-500">Score</div>
                        <div className="font-medium text-gray-900">
                          {result.marks_obtained} / {result.marks_available}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm text-gray-500">Percentage</div>
                        <div className={`text-xl font-bold ${
                          result.percentage >= 50 ? 'text-emerald-600' : 'text-red-500'
                        }`}>
                          {result.percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          result.percentage >= 50 ? 'bg-emerald-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${result.percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Link to test students */}
                  <div className="mt-3 flex justify-end">
                    <Link
                      to={`/tests/${result.test_id}/students`}
                      className="text-sm text-emerald-600 hover:text-emerald-700"
                    >
                      View all students in this test →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-white border-2 border-dashed border-gray-200 rounded-2xl">
            <div className="text-4xl mb-4">📋</div>
            <div className="text-gray-500">No test results found for this student</div>
          </div>
        )}
      </div>
    </div>
  );
}
