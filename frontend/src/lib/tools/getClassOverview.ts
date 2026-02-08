import { listTests, listStudents } from '../../services/api';
import type { Tool } from './types';

export const getClassOverviewTool: Tool = {
  name: 'getClassOverview',
  description: '[ACTION:getClassOverview] - summary across all tests: averages, total students, pass rates',
  loadingLabel: 'Getting class overview',
  execute: async (_arg, navigate) => {
    const [testsResult, studentsResult] = await Promise.all([
      listTests(),
      listStudents()
    ]);

    if (testsResult.tests.length === 0) {
      return { message: 'No tests found.', suggestions: ['Import test results'] };
    }

    navigate('/');

    const totalTests = testsResult.tests.length;
    const totalStudents = studentsResult.count;
    const overallAvg = testsResult.tests.reduce((sum, t) => sum + t.mean, 0) / totalTests;
    const highestTest = testsResult.tests.reduce((a, b) => a.mean > b.mean ? a : b);
    const lowestTest = testsResult.tests.reduce((a, b) => a.mean < b.mean ? a : b);

    const message = `### Class Overview

| Metric | Value |
|--------|-------|
| Total Tests | ${totalTests} |
| Total Students | ${totalStudents} |
| Overall Average | **${overallAvg.toFixed(0)}%** |
| Best Performing Test | [${highestTest.test_id}](/tests/${highestTest.test_id}) (${highestTest.mean.toFixed(0)}%) |
| Needs Attention | [${lowestTest.test_id}](/tests/${lowestTest.test_id}) (${lowestTest.mean.toFixed(0)}%) |`;

    return { message, suggestions: [] };
  },
};
