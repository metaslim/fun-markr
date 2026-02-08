import { getStudent, getAggregate } from '../../services/api';
import type { Tool } from './types';

export const compareStudentToClassTool: Tool = {
  name: 'compareStudentToClass',
  description: '[ACTION:compareStudentToClass:NUM] - show how student performs vs class average on each test',
  loadingLabel: 'Comparing to class',
  execute: async (arg, navigate) => {
    if (!arg) return { message: 'Error: No student number', suggestions: [] };

    const studentResult = await getStudent(arg);
    if (studentResult.results.length === 0) {
      return { message: `No results found for student ${arg}`, suggestions: ['Search for a student'] };
    }

    navigate(`/students/${arg}`);
    const name = studentResult.results[0]?.student_name || 'Student';

    // Compare each test to class average
    const comparisons = await Promise.all(
      studentResult.results.map(async (r) => {
        try {
          const agg = await getAggregate(r.test_id);
          const diff = r.percentage - agg.mean;
          const status = diff >= 0 ? '🟢' : '🔴';
          return `| [${r.test_id}](/tests/${r.test_id}) | ${r.percentage.toFixed(0)}% | ${agg.mean.toFixed(0)}% | ${status} ${diff >= 0 ? '+' : ''}${diff.toFixed(0)}% |`;
        } catch {
          return `| ${r.test_id} | ${r.percentage.toFixed(0)}% | - | - |`;
        }
      })
    );

    const avgStudent = studentResult.results.reduce((sum, r) => sum + r.percentage, 0) / studentResult.results.length;

    const message = `### ${name} vs Class Average

**Overall:** ${avgStudent.toFixed(0)}% average across ${studentResult.results.length} tests

| Test | Student | Class Avg | Diff |
|------|---------|-----------|------|
${comparisons.join('\n')}`;

    return { message, suggestions: [] };
  },
};
