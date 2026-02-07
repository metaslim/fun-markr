import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getAggregate } from '../services/api';
import { useContextStore } from '../stores/contextStore';
import type { TestAggregate } from '../types';

export function TestDetail() {
  const { testId } = useParams<{ testId: string }>();
  const [aggregate, setAggregate] = useState<TestAggregate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const addPageVisit = useContextStore((state) => state.addPageVisit);
  const addViewedTest = useContextStore((state) => state.addViewedTest);

  useEffect(() => {
    if (!testId) return;

    addPageVisit(`/tests/${testId}`, `Test ${testId}`);

    setLoading(true);
    setError(null);

    getAggregate(testId)
      .then((data) => {
        setAggregate(data);
        addViewedTest(testId, data);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [testId, addPageVisit, addViewedTest]);

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
        <div className="text-6xl mb-4">📭</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Test Not Found</h2>
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  if (!aggregate) return null;

  // Calculate performance level
  const getPerformanceLevel = (mean: number) => {
    if (mean >= 80) return { label: 'Excellent', color: 'text-emerald-600', bg: 'bg-emerald-500' };
    if (mean >= 65) return { label: 'Good', color: 'text-blue-600', bg: 'bg-blue-500' };
    if (mean >= 50) return { label: 'Average', color: 'text-amber-600', bg: 'bg-amber-500' };
    return { label: 'Needs Improvement', color: 'text-red-600', bg: 'bg-red-500' };
  };

  const performance = getPerformanceLevel(aggregate.mean);

  return (
    <div className="space-y-6">
      {/* Header with main score */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Test info */}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">Test {testId}</h1>
            <p className="text-gray-500 mt-1">
              <Link
                to={`/tests/${testId}/students`}
                className="hover:text-emerald-600 transition-colors"
              >
                {aggregate.count} students completed this test →
              </Link>
            </p>
          </div>

          {/* Main score gauge */}
          <div className="flex items-center gap-6">
            {/* Circular progress */}
            <div className="relative w-32 h-32">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="12"
                />
                {/* Progress circle */}
                <circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke={aggregate.mean >= 80 ? '#10b981' : aggregate.mean >= 65 ? '#3b82f6' : aggregate.mean >= 50 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${aggregate.mean * 2.64} 264`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-900">{aggregate.mean.toFixed(1)}%</span>
                <span className="text-xs text-gray-500">Average</span>
              </div>
            </div>

            {/* Performance badge */}
            <div className={`px-4 py-2 rounded-xl ${performance.bg} bg-opacity-10`}>
              <div className={`text-lg font-semibold ${performance.color}`}>{performance.label}</div>
              <div className="text-sm text-gray-500">Class Performance</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm text-gray-500 mb-1">Median Score</div>
          <div className="text-2xl font-bold text-blue-600">{aggregate.p50.toFixed(1)}%</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm text-gray-500 mb-1">Std Deviation</div>
          <div className="text-2xl font-bold text-gray-700">{aggregate.stddev.toFixed(1)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm text-gray-500 mb-1">Lowest Score</div>
          <div className="text-2xl font-bold text-red-500">{aggregate.min.toFixed(1)}%</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm text-gray-500 mb-1">Highest Score</div>
          <div className="text-2xl font-bold text-emerald-500">{aggregate.max.toFixed(1)}%</div>
        </div>
      </div>

      {/* Score Distribution - Box Plot */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Score Distribution</h2>
        <p className="text-sm text-gray-500 mb-8">Box plot showing the spread of student scores</p>

        {/* Box Plot Visualization */}
        <div className="relative mx-4">
          {/* Background scale lines */}
          <div className="absolute inset-x-0 top-0 bottom-0 flex justify-between pointer-events-none">
            {[0, 25, 50, 75, 100].map((tick) => (
              <div key={tick} className="w-px bg-gray-100 h-full" />
            ))}
          </div>

          {/* Box plot container */}
          <div className="relative h-24 my-4">
            {/* Whisker line (min to max) */}
            <div
              className="absolute top-1/2 h-0.5 bg-gray-300 -translate-y-1/2"
              style={{ left: `${aggregate.min}%`, right: `${100 - aggregate.max}%` }}
            />

            {/* Min whisker cap */}
            <div
              className="absolute top-1/2 w-0.5 h-8 bg-gray-400 -translate-y-1/2 -translate-x-px"
              style={{ left: `${aggregate.min}%` }}
            />

            {/* Max whisker cap */}
            <div
              className="absolute top-1/2 w-0.5 h-8 bg-gray-400 -translate-y-1/2"
              style={{ left: `${aggregate.max}%` }}
            />

            {/* IQR Box (P25 to P75) */}
            <div
              className="absolute top-1/2 h-16 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-lg -translate-y-1/2 shadow-md"
              style={{ left: `${aggregate.p25}%`, width: `${aggregate.p75 - aggregate.p25}%` }}
            />

            {/* Median line */}
            <div
              className="absolute top-1/2 w-1 h-20 bg-white -translate-y-1/2 -translate-x-0.5 rounded shadow-sm"
              style={{ left: `${aggregate.p50}%` }}
            />

            {/* Mean marker (diamond) */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-2"
              style={{ left: `${aggregate.mean}%` }}
            >
              <div className="w-4 h-4 bg-yellow-400 rotate-45 border-2 border-white shadow-md" />
            </div>

            {/* Value labels */}
            <div
              className="absolute -bottom-6 text-xs font-medium text-red-500 -translate-x-1/2"
              style={{ left: `${aggregate.min}%` }}
            >
              {aggregate.min.toFixed(0)}%
            </div>
            <div
              className="absolute -bottom-6 text-xs font-medium text-gray-400 -translate-x-1/2"
              style={{ left: `${aggregate.p25}%` }}
            >
              {aggregate.p25.toFixed(0)}%
            </div>
            <div
              className="absolute -bottom-6 text-xs font-medium text-blue-600 -translate-x-1/2"
              style={{ left: `${aggregate.p50}%` }}
            >
              {aggregate.p50.toFixed(0)}%
            </div>
            <div
              className="absolute -bottom-6 text-xs font-medium text-gray-400 -translate-x-1/2"
              style={{ left: `${aggregate.p75}%` }}
            >
              {aggregate.p75.toFixed(0)}%
            </div>
            <div
              className="absolute -bottom-6 text-xs font-medium text-emerald-500 -translate-x-1/2"
              style={{ left: `${aggregate.max}%` }}
            >
              {aggregate.max.toFixed(0)}%
            </div>
          </div>

          {/* Scale labels */}
          <div className="flex justify-between mt-10 text-xs text-gray-400">
            <span>0%</span>
            <span>25%</span>
            <span>50%</span>
            <span>75%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-6 justify-center mt-8 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-6 h-4 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded" />
            <span className="text-sm text-gray-600">Middle 50% (IQR)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-white border border-gray-300 rounded" />
            <span className="text-sm text-gray-600">Median ({aggregate.p50.toFixed(1)}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rotate-45" />
            <span className="text-sm text-gray-600">Mean ({aggregate.mean.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* Percentile breakdown */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Percentile Breakdown</h2>

        <div className="space-y-4">
          {/* P75 */}
          <div className="flex items-center gap-4">
            <div className="w-16 text-sm font-medium text-gray-500">Top 25%</div>
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${aggregate.p75}%` }}
              />
            </div>
            <div className="w-16 text-sm font-semibold text-gray-700 text-right">{aggregate.p75.toFixed(1)}%+</div>
          </div>

          {/* P50 */}
          <div className="flex items-center gap-4">
            <div className="w-16 text-sm font-medium text-gray-500">Top 50%</div>
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${aggregate.p50}%` }}
              />
            </div>
            <div className="w-16 text-sm font-semibold text-gray-700 text-right">{aggregate.p50.toFixed(1)}%+</div>
          </div>

          {/* P25 */}
          <div className="flex items-center gap-4">
            <div className="w-16 text-sm font-medium text-gray-500">Top 75%</div>
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all"
                style={{ width: `${aggregate.p25}%` }}
              />
            </div>
            <div className="w-16 text-sm font-semibold text-gray-700 text-right">{aggregate.p25.toFixed(1)}%+</div>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-4">
          These thresholds show the minimum score needed to be in each percentile group.
        </p>
      </div>

      {/* Summary insights */}
      <div className="bg-gradient-to-br from-emerald-50 to-blue-50 border border-emerald-100 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <span className="text-emerald-600 text-sm">📊</span>
            </div>
            <div>
              <div className="font-medium text-gray-900">Central Tendency</div>
              <div className="text-sm text-gray-600">
                Mean ({aggregate.mean.toFixed(1)}%) is {aggregate.mean > aggregate.p50 ? 'above' : aggregate.mean < aggregate.p50 ? 'below' : 'equal to'} median ({aggregate.p50.toFixed(1)}%),
                indicating {aggregate.mean > aggregate.p50 ? 'a right-skewed distribution with some high performers pulling up the average' : aggregate.mean < aggregate.p50 ? 'a left-skewed distribution with some low scores pulling down the average' : 'a symmetric distribution'}.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-600 text-sm">📈</span>
            </div>
            <div>
              <div className="font-medium text-gray-900">Score Spread</div>
              <div className="text-sm text-gray-600">
                IQR of {(aggregate.p75 - aggregate.p25).toFixed(1)}% with std dev of {aggregate.stddev.toFixed(1)} shows
                {aggregate.stddev < 10 ? ' consistent performance across students' : aggregate.stddev < 20 ? ' moderate variation in student abilities' : ' wide variation in student performance'}.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
