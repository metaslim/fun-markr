import { getTestStudents } from '../../services/api';
import type { Tool } from './types';

export const getPassingStudentsTool: Tool = {
  name: 'getPassingStudents',
  description: '[ACTION:getPassingStudents:ID] - list students scoring 50% or above on a test',
  loadingLabel: 'Getting passing students',
  execute: async (arg, navigate) => {
    if (!arg || arg === 'ID' || !/^\d+$/.test(arg)) {
      return { message: 'Which test? Please specify a test number.', suggestions: ['Show all tests'] };
    }
    const result = await getTestStudents(arg);
    navigate(`/tests/${arg}/students`);

    const passing = result.students.filter(s => s.percentage >= 50);
    const passRate = (passing.length / result.students.length * 100).toFixed(0);

    if (passing.length === 0) {
      return {
        message: `### No Passing Students · Test ${arg}\n\nNo students scored 50% or above.`,
        suggestions: []
      };
    }

    const sorted = [...passing].sort((a, b) => b.percentage - a.percentage);
    const items = sorted.slice(0, 10).map((s, i) =>
      `${i + 1}. [${s.student_name || 'Student'}](/students/${s.student_number}) · **${s.percentage.toFixed(0)}%**`
    ).join('\n');

    const more = passing.length > 10 ? `\n\n*...and ${passing.length - 10} more passing*` : '';

    return {
      message: `### Passing Students · [Test ${arg}](/tests/${arg})\n\n**${passing.length}/${result.students.length}** students passed (${passRate}%)\n\n${items}${more}`,
      suggestions: []
    };
  },
};
