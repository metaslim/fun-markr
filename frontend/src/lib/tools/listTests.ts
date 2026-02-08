import { listTests } from '../../services/api';
import type { Tool } from './types';

export const listTestsTool: Tool = {
  name: 'listTests',
  description: '[ACTION:listTests] - show all available tests with averages',
  loadingLabel: 'Getting tests',
  execute: async (_arg, navigate) => {
    const result = await listTests();
    if (result.tests.length === 0) {
      return { message: 'No tests found. [Import some results](/import).', suggestions: ['Import test results'] };
    }
    navigate('/tests');
    const items = result.tests.map(t =>
      `[Test ${t.test_id}](/tests/${t.test_id}) · **${t.mean.toFixed(0)}%** avg · ${t.count} students`
    ).join('\n\n');
    return { message: `### All Tests\n\n${items}\n\nWhich test would you like to explore?`, suggestions: [] };
  },
};
