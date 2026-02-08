import { listTests } from '../../services/api';
import type { Tool } from './types';

export const getHardestTestTool: Tool = {
  name: 'getHardestTest',
  description: '[ACTION:getHardestTest] - test with lowest average',
  loadingLabel: 'Finding hardest test',
  execute: async (_arg, navigate) => {
    const result = await listTests();
    if (result.tests.length === 0) {
      return { message: 'No tests found.', suggestions: ['Import test results'] };
    }

    const sorted = [...result.tests].sort((a, b) => a.mean - b.mean);
    const hardest = sorted[0];

    navigate(`/tests/${hardest.test_id}`);

    const message = `### Hardest Test

[Test ${hardest.test_id}](/tests/${hardest.test_id}) has the lowest average:

**${hardest.mean.toFixed(0)}%** average · ${hardest.count} students

This test may need review or additional student support.`;

    return { message, suggestions: [] };
  },
};
