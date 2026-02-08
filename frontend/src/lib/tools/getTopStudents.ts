import { getTestStudents } from '../../services/api';
import type { Tool } from './types';

export const getTopStudentsTool: Tool = {
  name: 'getTopStudents',
  description: '[ACTION:getTopStudents:ID] - top 5 highest scoring students in a test',
  loadingLabel: 'Getting top students',
  execute: async (arg, navigate) => {
    if (!arg || arg === 'ID' || !/^\d+$/.test(arg)) {
      return { message: 'Which test? Please specify a test number.', suggestions: ['Show all tests'] };
    }
    const result = await getTestStudents(arg);
    navigate(`/tests/${arg}/students`);
    const sorted = [...result.students].sort((a, b) => b.percentage - a.percentage);
    const top = sorted.slice(0, 5);
    const items = top.map((s, i) =>
      `${i + 1}. [${s.student_name || 'Student'}](/students/${s.student_number}) · **${s.percentage.toFixed(0)}%**`
    ).join('\n');
    return { message: `### Top Students · [Test ${arg}](/tests/${arg})\n\n${items}`, suggestions: [] };
  },
};
