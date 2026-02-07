import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getTestStudents, getAggregate } from '../services/api';
import { useContextStore } from '../stores/contextStore';
import type { StudentResult, TestAggregate } from '../types';

export function TestStudents() {
  const { testId } = useParams<{ testId: string }>();
  const [students, setStudents] = useState<StudentResult[]>([]);
  const [aggregate, setAggregate] = useState<TestAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'rank' | 'student'>('rank');

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

  // Filter and sort students
  const filteredStudents = students
    .filter(s =>
      s.student_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.student_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    )
    .sort((a, b) => {
      if (sortBy === 'student') {
        return a.student_number.localeCompare(b.student_number);
      }
      return b.percentage - a.percentage; // rank by score descending
    });

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
            onClick={() => setSortBy('rank')}
            className={`px-4 py-2.5 rounded-xl font-medium transition-colors ${
              sortBy === 'rank'
                ? 'bg-emerald-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            By Rank
          </button>
          <button
            onClick={() => setSortBy('student')}
            className={`px-4 py-2.5 rounded-xl font-medium transition-colors ${
              sortBy === 'student'
                ? 'bg-emerald-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            By Student #
          </button>
        </div>
      </div>

      {/* Students Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Student
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Percentage
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Grade
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                vs Avg
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredStudents.map((student, index) => {
              const grade = getGradeBand(student.percentage);
              const vsAvg = aggregate ? student.percentage - aggregate.mean : 0;
              const rank = sortBy === 'rank'
                ? index + 1
                : students.findIndex(s => s.student_number === student.student_number) + 1;

              return (
                <tr key={student.student_number} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                      rank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {rank}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      to={`/students/${student.student_number}`}
                      className="hover:text-emerald-600 transition-colors"
                    >
                      <div className="font-medium text-gray-900">
                        {student.student_name || student.student_number}
                      </div>
                      {student.student_name && (
                        <div className="text-xs text-gray-400">{student.student_number}</div>
                      )}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {student.marks_obtained} / {student.marks_available}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            student.percentage >= 50 ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${student.percentage}%` }}
                        />
                      </div>
                      <span className="font-medium text-gray-900">{student.percentage.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-sm font-medium ${grade.color}`}>
                      {grade.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-medium ${
                      vsAvg > 0 ? 'text-emerald-600' : vsAvg < 0 ? 'text-red-500' : 'text-gray-500'
                    }`}>
                      {vsAvg > 0 ? '+' : ''}{vsAvg.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

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
