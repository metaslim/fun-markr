import { listStudents, getStudent } from '../../services/api';
import type { Tool } from './types';

export const searchStudentTool: Tool = {
  name: 'searchStudent',
  description: '[ACTION:searchStudent:NAME] - find student by name and show their profile',
  loadingLabel: 'Searching for student',
  execute: async (arg, navigate) => {
    if (!arg) return { message: 'Error: No search term', suggestions: [] };
    const allStudents = await listStudents();
    const searchLower = arg.toLowerCase();
    const matches = allStudents.students.filter(s =>
      s.name?.toLowerCase().includes(searchLower) ||
      s.student_number.includes(arg)
    );
    if (matches.length === 0) {
      return { message: `No students found matching "${arg}"`, suggestions: ['List all students'] };
    }
    if (matches.length === 1) {
      const student = matches[0];
      const result = await getStudent(student.student_number);
      navigate(`/students/${student.student_number}`);
      const items = result.results.map(r =>
        `[Test ${r.test_id}](/tests/${r.test_id}) · **${r.percentage.toFixed(0)}%**`
      ).join('\n');
      return { message: `### [${student.name || 'Student'}](/students/${student.student_number})\n\n${items}`, suggestions: [] };
    }
    const items = matches.slice(0, 5).map(s =>
      `[${s.name || 'Student ' + s.student_number}](/students/${s.student_number})`
    ).join('\n');
    const more = matches.length > 5 ? `\n\n*...and ${matches.length - 5} more*` : '';
    return { message: `### Found ${matches.length} students matching "${arg}"\n\n${items}${more}`, suggestions: [] };
  },
};
