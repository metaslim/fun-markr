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
    const lines: string[] = ['## CURRENT SESSION\n'];

    // Current page and context
    if (state.currentPage) {
      lines.push(`**Current Page:** ${state.currentPage.title} → \`${state.currentPage.path}\`\n`);

      // Extract test ID if viewing a test page
      const testMatch = state.currentPage.path.match(/^\/tests\/(\d+)/);
      if (testMatch) {
        lines.push(`**Current Test:** ${testMatch[1]} (use this ID for student queries)\n`);
      }

      // Extract student number if viewing a student page
      const studentMatch = state.currentPage.path.match(/^\/students\/([^/]+)$/);
      if (studentMatch) {
        lines.push(`**Current Student:** ${studentMatch[1]}\n`);
      }
    }

    // Tell LLM about available tests (IDs only, no data - force use of actions)
    if (state.availableTests.length > 0) {
      const testIds = state.availableTests.map(t => t.test_id).join(', ');
      lines.push(`**Available Tests:** ${testIds}`);
      lines.push('Use actions to get details.\n');
    } else {
      lines.push('**No tests imported yet.** User should go to /import to upload results.\n');
    }

    // Recent pages - simplified
    if (state.pageHistory.length > 0) {
      const recent = state.pageHistory.slice(-3);
      lines.push(`**Recent Pages:** ${recent.map(v => v.title).join(' → ')}`);
    }

    return lines.join('\n');
  },

  getSuggestedQuestions: () => {
    const state = get();
    const currentPath = state.currentPage?.path || '/';
    const questions: { text: string; query: string }[] = [];

    // Home page suggestions - generic, let agent ask which test
    if (currentPath === '/') {
      if (state.availableTests.length > 0) {
        questions.push(
          { text: 'Show top students', query: 'Show top students' },
          { text: 'Who needs help?', query: 'Which students are struggling?' },
          { text: 'Class overview', query: 'Give me a class overview' },
          { text: 'Find at-risk students', query: 'Find at-risk students' },
        );
      } else {
        questions.push(
          { text: 'Import my first results', query: 'How do I import test results?' },
          { text: 'What can you help me with?', query: 'What can you help me with in this app?' },
        );
      }
    }

    // Tests list page
    else if (currentPath === '/tests') {
      if (state.availableTests.length > 0) {
        const randomTest = state.availableTests[Math.floor(Math.random() * state.availableTests.length)];
        questions.push(
          { text: `Dive into test ${randomTest.test_id}`, query: `Show me details for test ${randomTest.test_id}` },
          { text: 'Find the hardest test', query: 'Which test has the lowest scores?' },
          { text: 'Show top performers', query: 'List all students sorted by performance' },
        );
      }
    }

    // Test detail page suggestions
    else if (currentPath.match(/^\/tests\/\d+$/)) {
      const testId = currentPath.split('/')[2];
      const testData = state.viewedTests.get(testId);

      questions.push(
        { text: 'Show me top 5 students', query: `Who are the top 5 students in test ${testId}?` },
        { text: 'Who scored below 50%?', query: `Which students scored below 50% on test ${testId}?` },
      );

      if (testData && testData.aggregate.stddev > 15) {
        questions.push({ text: 'Why such varied scores?', query: `Why is there such a big spread in scores for test ${testId}?` });
      }

      if (state.availableTests.length > 1) {
        questions.push({ text: 'Compare to other tests', query: `How does test ${testId} compare to other tests?` });
      }

      questions.push({ text: 'View all students', query: `Show all students who took test ${testId}` });
    }

    // Test students page
    else if (currentPath.match(/^\/tests\/\d+\/students$/)) {
      const testId = currentPath.split('/')[2];
      questions.push(
        { text: 'Who got 100%?', query: `Did anyone get a perfect score on test ${testId}?` },
        { text: 'Show failing students', query: `Which students failed test ${testId}?` },
        { text: 'What\'s the median score?', query: `What's the median score for test ${testId}?` },
        { text: 'Back to test stats', query: `Show me the statistics for test ${testId}` },
      );
    }

    // Students list page
    else if (currentPath === '/students') {
      questions.push(
        { text: 'Find top performers', query: 'Who has the highest average across all tests?' },
        { text: 'Who needs support?', query: 'Which students are consistently scoring below average?' },
        { text: 'How many students?', query: 'How many students are in the system?' },
        { text: 'View all tests', query: 'Show me the tests list' },
      );
    }

    // Student detail page
    else if (currentPath.match(/^\/students\/[^/]+$/)) {
      const studentNum = currentPath.split('/')[2];
      questions.push(
        { text: 'Overall performance?', query: `How is student ${studentNum} doing overall?` },
        { text: 'Best test result?', query: `What was student ${studentNum}'s best test?` },
        { text: 'Areas to improve?', query: `Which tests should student ${studentNum} focus on improving?` },
        { text: 'Compare to average', query: `How does student ${studentNum} compare to the class average?` },
      );
    }

    // Import page suggestions
    else if (currentPath === '/import') {
      questions.push(
        { text: 'What format do I need?', query: 'What XML format should I use for importing?' },
        { text: 'Show example XML', query: 'Give me an example XML file' },
        { text: 'See existing data', query: 'Show me the tests I already have' },
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
