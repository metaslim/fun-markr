import { useEffect, useState, useMemo } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { getTestStudents, getAggregate } from '../services/api';
import { useContextStore } from '../stores/contextStore';
import type { StudentResult, TestAggregate } from '../types';

export function TestStudents() {
  const { testId } = useParams<{ testId: string }>();
  const [searchParams] = useSearchParams();
  const [students, setStudents] = useState<StudentResult[]>([]);
  const [aggregate, setAggregate] = useState<TestAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Get initial sort from URL query param (e.g., ?sort=low)
  const initialSort = searchParams.get('sort') === 'low' ? 'rank-low' : 'rank-high';
  const [sortBy, setSortBy] = useState<'rank-high' | 'rank-low' | 'student'>(initialSort);

  const addPageVisit = useContextStore((state) => state.addPageVisit);

  useEffect(() => {
    if (!testId) return;

    addPageVisit(`/tests/${testId}/students`, `Test ${testId} Students`);

    Promise.all([
      getTestStudents(testId),
      getAggregate(testId),
    ])
      .then(([studentsRes, aggRes]) => {
        setStudents(studentsRes.students);
        setAggregate(aggRes);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [testId, addPageVisit]);

  // Pre-compute rank lookup map (only once when data loads)
  // Must be before early returns to follow Rules of Hooks
  const rankMap = useMemo(() => {
    const sorted = [...students].sort((a, b) => b.percentage - a.percentage);
    const map = new Map<string, number>();
    sorted.forEach((s, i) => map.set(s.student_number, i + 1));
    return map;
  }, [students]);

  // Filter and sort students (memoized)
  const filteredStudents = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    const filtered = students.filter(s =>
      s.student_number.toLowerCase().includes(searchLower) ||
      (s.student_name?.toLowerCase().includes(searchLower) ?? false)
    );

    switch (sortBy) {
      case 'student':
        return [...filtered].sort((a, b) => a.student_number.localeCompare(b.student_number));
      case 'rank-low':
        return [...filtered].sort((a, b) => a.percentage - b.percentage); // Lowest first
      case 'rank-high':
      default:
        return [...filtered].sort((a, b) => b.percentage - a.percentage); // Highest first
    }
  }, [students, searchTerm, sortBy]);

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
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  // Calculate grade band
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Test {testId} - Students</h1>
            <Link
              to={`/tests/${testId}`}
              className="text-sm text-emerald-600 hover:text-emerald-700"
            >
              View Stats →
            </Link>
          </div>
          <p className="text-gray-500 mt-1">{students.length} students</p>
        </div>

        {aggregate && (
          <div className="flex items-center gap-4 text-sm">
            <div className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              Avg: {aggregate.mean.toFixed(1)}%
            </div>
            <div className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg">
              Median: {aggregate.p50.toFixed(1)}%
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search student number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('rank-high')}
            disabled={sortBy === 'rank-high'}
            className={`px-4 py-2.5 rounded-xl font-medium transition-colors ${
              sortBy === 'rank-high'
                ? 'bg-emerald-500 text-white cursor-default'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Top First
          </button>
          <button
            onClick={() => setSortBy('rank-low')}
            disabled={sortBy === 'rank-low'}
            className={`px-4 py-2.5 rounded-xl font-medium transition-colors ${
              sortBy === 'rank-low'
                ? 'bg-emerald-500 text-white cursor-default'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Lowest First
          </button>
          <button
            onClick={() => setSortBy('student')}
            disabled={sortBy === 'student'}
            className={`px-4 py-2.5 rounded-xl font-medium transition-colors ${
              sortBy === 'student'
                ? 'bg-emerald-500 text-white cursor-default'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            By Student #
          </button>
        </div>
      </div>

      {/* Students List */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {/* Student rows */}
        <div className="divide-y divide-gray-100">
          {filteredStudents.map((student, index) => {
            const grade = getGradeBand(student.percentage);
            const vsAvg = aggregate ? student.percentage - aggregate.mean : 0;
            // Get rank from pre-computed map (O(1) lookup)
            // Always show actual rank based on score, not display position
            const rank = rankMap.get(student.student_number) || index + 1;

            // Rank badge colors
            const rankStyle = rank === 1
              ? 'bg-amber-400 text-white'
              : rank === 2
                ? 'bg-gray-300 text-gray-700'
                : rank === 3
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-100 text-gray-500';

            return (
              <Link
                key={student.student_number}
                to={`/students/${student.student_number}`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                {/* Rank */}
                <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold flex-shrink-0 ${rankStyle}`}>
                  {rank}
                </span>

                {/* Student name */}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {student.student_name || student.student_number}
                  </div>
                  {student.student_name && (
                    <div className="text-xs text-gray-400">{student.student_number}</div>
                  )}
                </div>

                {/* Score */}
                <div className="text-sm text-gray-500 hidden sm:block">
                  {student.marks_obtained}/{student.marks_available}
                </div>

                {/* Percentage */}
                <div className={`text-lg font-bold w-16 text-right ${
                  student.percentage >= 70 ? 'text-emerald-600' :
                  student.percentage >= 50 ? 'text-amber-600' : 'text-red-500'
                }`}>
                  {student.percentage.toFixed(0)}%
                </div>

                {/* Grade badge */}
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${grade.color}`}>
                  {grade.label}
                </span>

                {/* vs Avg - hidden on mobile */}
                <div className="hidden sm:block w-16 text-right">
                  <span className={`text-sm font-medium ${
                    vsAvg > 0 ? 'text-emerald-600' : vsAvg < 0 ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    {vsAvg > 0 ? '+' : ''}{vsAvg.toFixed(1)}%
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {filteredStudents.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No students found matching "{searchTerm}"
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-emerald-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">
            {students.filter(s => s.percentage >= 80).length}
          </div>
          <div className="text-sm text-gray-600">Grade A (80%+)</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {students.filter(s => s.percentage >= 65 && s.percentage < 80).length}
          </div>
          <div className="text-sm text-gray-600">Grade B (65-79%)</div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">
            {students.filter(s => s.percentage >= 50 && s.percentage < 65).length}
          </div>
          <div className="text-sm text-gray-600">Grade C (50-64%)</div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-600">
            {students.filter(s => s.percentage < 50).length}
          </div>
          <div className="text-sm text-gray-600">Below 50%</div>
        </div>
      </div>
    </div>
  );
}
