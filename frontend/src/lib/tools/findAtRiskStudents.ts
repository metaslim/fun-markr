import { listTests, getTestStudents } from '../../services/api';
import type { Tool } from './types';

export const findAtRiskStudentsTool: Tool = {
  name: 'findAtRiskStudents',
  description: '[ACTION:findAtRiskStudents] - students scoring below 50% on 2 or more tests',
  loadingLabel: 'Finding at-risk students',
  execute: async (_arg, navigate) => {
    const testsResult = await listTests();
    if (testsResult.tests.length === 0) {
      return { message: 'No tests found.', suggestions: ['Import test results'] };
    }

    // Get students from all tests
    const studentScores: Record<string, { name: string; fails: number; total: number; tests: string[] }> = {};

    for (const test of testsResult.tests.slice(0, 10)) { // Limit to 10 tests for performance
      try {
        const students = await getTestStudents(test.test_id);
        for (const s of students.students) {
          const key = s.student_number;
          if (!studentScores[key]) {
            studentScores[key] = { name: s.student_name || 'Student', fails: 0, total: 0, tests: [] };
          }
          studentScores[key].total++;
          if (s.percentage < 50) {
            studentScores[key].fails++;
            studentScores[key].tests.push(test.test_id);
          }
        }
      } catch {
        // Skip failed fetches
      }
    }

    // Find students failing 2+ tests
    const atRisk = Object.entries(studentScores)
      .filter(([_, data]) => data.fails >= 2)
      .sort((a, b) => b[1].fails - a[1].fails)
      .slice(0, 10);

    if (atRisk.length === 0) {
      return { message: 'No at-risk students found (failing 2+ tests).', suggestions: [] };
    }

    navigate('/students');
    const items = atRisk.map(([num, data]) =>
      `[${data.name}](/students/${num}) · **${data.fails}/${data.total}** tests below 50%`
    ).join('\n');

    return {
      message: `### At-Risk Students\n\nStudents failing 2 or more tests:\n\n${items}`,
      suggestions: []
    };
  },
};
