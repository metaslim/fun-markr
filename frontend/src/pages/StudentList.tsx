import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listStudents } from '../services/api';
import { useContextStore } from '../stores/contextStore';
import type { Student } from '../types';

export function StudentList() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const addPageVisit = useContextStore((state) => state.addPageVisit);

  useEffect(() => {
    addPageVisit('/students', 'All Students');

    listStudents()
      .then((res) => {
        setStudents(res.students);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [addPageVisit]);

  const filteredStudents = students.filter((student) => {
    const search = searchTerm.toLowerCase();
    return (
      student.student_number.toLowerCase().includes(search) ||
      (student.name?.toLowerCase().includes(search) ?? false)
    );
  });

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
        <div className="text-6xl mb-4">!</div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Students</h2>
        <p className="text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-500 mt-1">{students.length} students enrolled</p>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-64 pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Students Grid */}
      {filteredStudents.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredStudents.map((student) => (
            <Link
              key={student.id}
              to={`/students/${student.student_number}`}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-emerald-300 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <span className="text-xl">👤</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">
                    {student.name || 'Unknown'}
                  </h3>
                  <p className="text-sm text-gray-500">ID: {student.student_number}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white border-2 border-dashed border-gray-200 rounded-2xl">
          <div className="text-4xl mb-4">👤</div>
          <div className="text-gray-500">
            {searchTerm ? 'No students match your search' : 'No students found'}
          </div>
        </div>
      )}
    </div>
  );
}
