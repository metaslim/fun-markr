import { listTests } from '../../services/api';
import type { Tool } from './types';

export const getEasiestTestTool: Tool = {
  name: 'getEasiestTest',
  description: '[ACTION:getEasiestTest] - test with highest average',
  loadingLabel: 'Finding easiest test',
  execute: async (_arg, navigate) => {
    const result = await listTests();
    if (result.tests.length === 0) {
      return { message: 'No tests found.', suggestions: ['Import test results'] };
    }

    const sorted = [...result.tests].sort((a, b) => b.mean - a.mean);
    const easiest = sorted[0];

    navigate(`/tests/${easiest.test_id}`);

    const message = `### Easiest Test

[Test ${easiest.test_id}](/tests/${easiest.test_id}) has the highest average:

**${easiest.mean.toFixed(0)}%** average · ${easiest.count} students`;

    return { message, suggestions: [] };
  },
};
