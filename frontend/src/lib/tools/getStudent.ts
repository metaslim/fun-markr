import { getStudent } from '../../services/api';
import type { Tool } from './types';

export const getStudentTool: Tool = {
  name: 'getStudent',
  description: '[ACTION:getStudent:NUM] - get student profile with all their test results',
  loadingLabel: 'Getting student details',
  execute: async (arg, navigate) => {
    if (!arg) return { message: 'Error: No student ID', suggestions: [] };
    const result = await getStudent(arg);
    navigate(`/students/${arg}`);
    const name = result.results[0]?.student_name || 'Student';
    const items = result.results.map(r =>
      `[Test ${r.test_id}](/tests/${r.test_id}) · **${r.percentage.toFixed(0)}%**`
    ).join('\n');
    return { message: `### [${name}](/students/${arg})\n\n${items}`, suggestions: [] };
  },
};
