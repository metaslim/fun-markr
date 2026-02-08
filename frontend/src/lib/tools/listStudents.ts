import { listStudents } from '../../services/api';
import type { Tool } from './types';

export const listStudentsTool: Tool = {
  name: 'listStudents',
  description: '[ACTION:listStudents] - show all students in the system',
  loadingLabel: 'Getting students',
  execute: async (_arg, navigate) => {
    const result = await listStudents();
    if (result.students.length === 0) {
      return { message: 'No students found.', suggestions: ['Import test results'] };
    }
    navigate('/students');
    const sample = result.students.slice(0, 8);
    const items = sample.map(s =>
      `[${s.name || 'Student ' + s.student_number}](/students/${s.student_number})`
    ).join('\n');
    const more = result.count > 8 ? `\n\n*...and ${result.count - 8} more*` : '';
    return { message: `### ${result.count} Students\n\n${items}${more}`, suggestions: [] };
  },
};
