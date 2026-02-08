import { getAggregate } from '../../services/api';
import type { Tool } from './types';

export const getTestTool: Tool = {
  name: 'getTest',
  description: '[ACTION:getTest:ID] - get test summary (average, range, student count)',
  loadingLabel: 'Getting test details',
  execute: async (arg, navigate) => {
    if (!arg || arg === 'ID' || !/^\d+$/.test(arg)) {
      return { message: 'Which test? Please specify a test number.', suggestions: ['Show all tests'] };
    }
    const data = await getAggregate(arg);
    navigate(`/tests/${arg}`);
    const message = `### [Test ${arg}](/tests/${arg})

**${data.mean.toFixed(0)}%** average · ${data.count} students

Range: ${data.min.toFixed(0)}% – ${data.max.toFixed(0)}%
Median: ${data.p50.toFixed(0)}%`;
    return { message, suggestions: [] };
  },
};
