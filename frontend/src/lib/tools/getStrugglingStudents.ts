import { getTestStudents } from '../../services/api';
import type { Tool } from './types';

export const getStrugglingStudentsTool: Tool = {
  name: 'getStrugglingStudents',
  description: '[ACTION:getStrugglingStudents:ID] - bottom 5 lowest scoring students in a test',
  loadingLabel: 'Getting struggling students',
  execute: async (arg, navigate) => {
    // Check for missing or placeholder ID
    if (!arg || arg === 'ID' || !/^\d+$/.test(arg)) {
      return { message: 'Which test? Please specify a test number.', suggestions: ['Show all tests'] };
    }
    const result = await getTestStudents(arg);
    navigate(`/tests/${arg}/students?sort=low`);
    const sorted = [...result.students].sort((a, b) => a.percentage - b.percentage);
    const struggling = sorted.slice(0, 5);
    const items = struggling.map((s, i) =>
      `${i + 1}. [${s.student_name || 'Student'}](/students/${s.student_number}) · **${s.percentage.toFixed(0)}%**`
    ).join('\n');
    return { message: `### Struggling Students · [Test ${arg}](/tests/${arg})\n\n${items}`, suggestions: [] };
  },
};
