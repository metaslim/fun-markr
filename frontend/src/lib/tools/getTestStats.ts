import { getAggregate } from '../../services/api';
import type { Tool } from './types';

export const getTestStatsTool: Tool = {
  name: 'getTestStats',
  description: '[ACTION:getTestStats:ID] - full stats: mean, median, stddev, percentiles, min/max',
  loadingLabel: 'Getting test statistics',
  execute: async (arg, navigate) => {
    if (!arg || arg === 'ID' || !/^\d+$/.test(arg)) {
      return { message: 'Which test? Please specify a test number.', suggestions: ['Show all tests'] };
    }
    const data = await getAggregate(arg);
    navigate(`/tests/${arg}`);

    const passRate = data.mean >= 50 ? 'Good' : 'Needs attention';
    const spread = data.max - data.min;

    const message = `### Test ${arg} Statistics

| Metric | Value |
|--------|-------|
| Average | **${data.mean.toFixed(1)}%** |
| Median | ${data.p50.toFixed(1)}% |
| Std Dev | ${data.stddev.toFixed(1)}% |
| Min | ${data.min.toFixed(0)}% |
| Max | ${data.max.toFixed(0)}% |
| Range | ${spread.toFixed(0)}% |
| 25th Percentile | ${data.p25.toFixed(0)}% |
| 75th Percentile | ${data.p75.toFixed(0)}% |
| Students | ${data.count} |

**Assessment:** ${passRate} (${data.mean >= 50 ? 'majority passing' : 'majority below 50%'})`;

    return { message, suggestions: [] };
  },
};
