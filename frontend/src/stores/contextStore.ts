import { create } from 'zustand';
import type { TestAggregate, TestSummary } from '../types';

interface ViewedTest {
  testId: string;
  aggregate: TestAggregate;
  viewedAt: Date;
}

interface PageVisit {
  path: string;
  title: string;
  visitedAt: Date;
}

interface ContextState {
  // All tests the user has viewed
  viewedTests: Map<string, ViewedTest>;

  // Page navigation history
  pageHistory: PageVisit[];

  // Current page info
  currentPage: { path: string; title: string } | null;

  // All available tests from API
  availableTests: TestSummary[];

  // Actions
  addViewedTest: (testId: string, aggregate: TestAggregate) => void;
  addPageVisit: (path: string, title: string) => void;
  setCurrentPage: (path: string, title: string) => void;
  setAvailableTests: (tests: TestSummary[]) => void;

  // Get context for AI
  getContextForAI: () => string;

  // Get suggested questions based on current page
  getSuggestedQuestions: () => { text: string; query: string }[];

  // Clear context
  clearContext: () => void;
}

// App navigation and API knowledge for the AI
const APP_KNOWLEDGE = `
=== APP NAVIGATION ===

FRONTEND ROUTES:
- /                         - Dashboard with overview stats
- /tests                    - List all tests
- /tests/:testId            - Test details and statistics
- /tests/:testId/students   - All students in a test (with scores)
- /students                 - List all students
- /students/:studentNumber  - Student profile with all test results
- /import                   - Import new test results (XML upload)

HOW TO NAVIGATE:
- Use [[/path]] format to suggest navigation links to the user
- Example: "You can view this at [[/tests/9863]]"

=== BACKEND API ENDPOINTS ===

Tests:
- GET /tests - List all tests with aggregate stats
- GET /results/:test_id/aggregate - Get test statistics
- GET /tests/:test_id/students - List all students in a test

Students:
- GET /students - List all students
- GET /students/:student_number - Get student's all test results
- GET /students/:student_number/tests/:test_id - Get specific result

System:
- POST /import - Upload XML test results
- GET /jobs/:job_id - Check import job status
- GET /health - Health check

=== DATA MODEL ===

Students:
- student_number: Unique student ID
- name: Full name

Test Results:
- student_id: References student
- test_id: Test identifier
- marks_available/obtained: Score data
- percentage: Calculated score

Aggregate Stats (all percentages except count):
- mean, min, max, stddev, p25, p50, p75, count

`;

export const useContextStore = create<ContextState>((set, get) => ({
  viewedTests: new Map(),
  pageHistory: [],
  currentPage: null,
  availableTests: [],

  addViewedTest: (testId: string, aggregate: TestAggregate) => {
    set((state) => {
      const newMap = new Map(state.viewedTests);
      newMap.set(testId, {
        testId,
        aggregate,
        viewedAt: new Date(),
      });
      return { viewedTests: newMap };
    });
  },

  addPageVisit: (path: string, title: string) => {
    set((state) => ({
      pageHistory: [
        ...state.pageHistory,
        { path, title, visitedAt: new Date() },
      ],
    }));
  },

  setCurrentPage: (path: string, title: string) => {
    set({ currentPage: { path, title } });
  },

  setAvailableTests: (tests: TestSummary[]) => {
    set({ availableTests: tests });
  },

  getContextForAI: () => {
    const state = get();
    const lines: string[] = [];

    // App knowledge first
    lines.push(APP_KNOWLEDGE);

    lines.push('=== USER SESSION DATA ===\n');

    // Current page
    if (state.currentPage) {
      lines.push(`CURRENT PAGE: ${state.currentPage.title} (${state.currentPage.path})\n`);
    }

    // Available tests
    if (state.availableTests.length > 0) {
      lines.push('ALL AVAILABLE TESTS IN SYSTEM:');
      state.availableTests.forEach((test) => {
        lines.push(`  - Test ${test.test_id}: ${test.count} students, mean ${test.mean.toFixed(1)}%`);
      });
      lines.push('');
    }

    // Tests viewed (with full details)
    if (state.viewedTests.size > 0) {
      lines.push('TESTS USER HAS VIEWED (FULL DETAILS):');
      state.viewedTests.forEach((test) => {
        const agg = test.aggregate;
        lines.push(`\nTest ID: ${test.testId}`);
        lines.push(`  - Students: ${agg.count}`);
        lines.push(`  - Mean: ${agg.mean.toFixed(2)}%`);
        lines.push(`  - Min: ${agg.min.toFixed(2)}%, Max: ${agg.max.toFixed(2)}%`);
        lines.push(`  - Std Dev: ${agg.stddev.toFixed(2)}`);
        lines.push(`  - Percentiles: P25=${agg.p25.toFixed(2)}%, P50=${agg.p50.toFixed(2)}%, P75=${agg.p75.toFixed(2)}%`);
      });
      lines.push('');
    }

    // Recent pages
    if (state.pageHistory.length > 0) {
      lines.push('USER NAVIGATION HISTORY:');
      const recent = state.pageHistory.slice(-5);
      recent.forEach((visit) => {
        lines.push(`  - ${visit.title} (${visit.path})`);
      });
    }

    return lines.join('\n');
  },

  getSuggestedQuestions: () => {
    const state = get();
    const currentPath = state.currentPage?.path || '/';
    const questions: { text: string; query: string }[] = [];

    // Home page suggestions
    if (currentPath === '/') {
      if (state.availableTests.length > 0) {
        const bestTest = state.availableTests.reduce((a, b) => a.mean > b.mean ? a : b);
        questions.push(
          { text: `View best performing test`, query: `Show me details for test ${bestTest.test_id}` },
          { text: `Who are the top students?`, query: `Who are the top performing students?` },
          { text: 'Compare all tests', query: 'Compare the performance across all tests' },
          { text: 'View all students', query: 'Take me to the students list' },
        );
      } else {
        questions.push(
          { text: 'How do I import test results?', query: 'How do I import test results?' },
          { text: 'What can this app do?', query: 'What features does this app have?' },
        );
      }
    }

    // Tests list page
    else if (currentPath === '/tests') {
      questions.push(
        { text: 'Which test has the most students?', query: 'Which test has the most students?' },
        { text: 'Which test needs attention?', query: 'Which test has the lowest average score?' },
        { text: 'View all students', query: 'Take me to the students list' },
      );
    }

    // Test detail page suggestions
    else if (currentPath.match(/^\/tests\/\d+$/)) {
      const testId = currentPath.split('/')[2];
      const testData = state.viewedTests.get(testId);

      questions.push(
        { text: 'Who are the top students?', query: `Who are the top 5 students in test ${testId}?` },
        { text: 'Who needs help?', query: `Which students scored lowest on test ${testId}?` },
        { text: 'View all students in test', query: `Show me all students in test ${testId}` },
      );

      if (testData) {
        questions.push(
          { text: 'Is this a good result?', query: `Is ${testData.aggregate.mean.toFixed(1)}% average a good score?` },
        );
      }

      if (state.availableTests.length > 1) {
        questions.push({ text: 'Compare with other tests', query: `How does test ${testId} compare to other tests?` });
      }
    }

    // Test students page
    else if (currentPath.match(/^\/tests\/\d+\/students$/)) {
      const testId = currentPath.split('/')[2];
      questions.push(
        { text: 'Who scored highest?', query: `Who got the highest score on test ${testId}?` },
        { text: 'Who needs help?', query: `Which students failed test ${testId}?` },
        { text: 'What\'s the grade distribution?', query: `How are scores distributed on test ${testId}?` },
        { text: 'Back to test details', query: `Show me the aggregate stats for test ${testId}` },
      );
    }

    // Students list page
    else if (currentPath === '/students') {
      questions.push(
        { text: 'Who are the top students?', query: 'Who are the best performing students overall?' },
        { text: 'How many students total?', query: 'How many students are in the system?' },
        { text: 'View all tests', query: 'Take me to the tests list' },
      );
    }

    // Student detail page
    else if (currentPath.match(/^\/students\/[^/]+$/)) {
      const studentNum = currentPath.split('/')[2];
      questions.push(
        { text: 'How did they do overall?', query: `What is student ${studentNum}'s overall performance?` },
        { text: 'Which test was best?', query: `Which test did student ${studentNum} perform best on?` },
        { text: 'Which test was worst?', query: `Which test did student ${studentNum} struggle with?` },
        { text: 'Compare to class average', query: `How does student ${studentNum} compare to the class average?` },
      );
    }

    // Import page suggestions
    else if (currentPath === '/import') {
      questions.push(
        { text: 'What XML format is needed?', query: 'What is the correct XML format for importing?' },
        { text: 'Show me an example', query: 'Give me an example XML for test results' },
        { text: 'What happens after import?', query: 'What happens after I import results?' },
        { text: 'View existing tests', query: 'Take me to the tests list' },
      );
    }

    return questions.slice(0, 4); // Limit to 4 suggestions
  },

  clearContext: () => {
    set({
      viewedTests: new Map(),
      pageHistory: [],
      currentPage: null,
      // Keep availableTests as they're from API
    });
  },
}));
