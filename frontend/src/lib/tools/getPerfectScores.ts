import { getTestStudents } from '../../services/api';
import type { Tool } from './types';

export const getPerfectScoresTool: Tool = {
  name: 'getPerfectScores',
  description: '[ACTION:getPerfectScores:ID] - list students who scored 100% on a test',
  loadingLabel: 'Finding perfect scores',
  execute: async (arg, navigate) => {
    if (!arg || arg === 'ID' || !/^\d+$/.test(arg)) {
      return { message: 'Which test? Please specify a test number.', suggestions: ['Show all tests'] };
    }
    const result = await getTestStudents(arg);
    navigate(`/tests/${arg}/students`);

    const perfect = result.students.filter(s => s.percentage >= 100);

    if (perfect.length === 0) {
      return {
        message: `### No Perfect Scores · Test ${arg}\n\nNo students scored 100% on this test.`,
        suggestions: []
      };
    }

    const items = perfect.map((s, i) =>
      `${i + 1}. [${s.student_name || 'Student'}](/students/${s.student_number}) · **100%**`
    ).join('\n');

    return {
      message: `### Perfect Scores · [Test ${arg}](/tests/${arg})\n\n**${perfect.length}** student${perfect.length > 1 ? 's' : ''} scored 100%:\n\n${items}`,
      suggestions: []
    };
  },
};
