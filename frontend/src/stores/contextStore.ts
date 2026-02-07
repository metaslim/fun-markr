import { create } from 'zustand';
import type { TestAggregate } from '../types';

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

  // Actions
  addViewedTest: (testId: string, aggregate: TestAggregate) => void;
  addPageVisit: (path: string, title: string) => void;

  // Get context for AI
  getContextForAI: () => string;

  // Clear context
  clearContext: () => void;
}

// App navigation and API knowledge for the AI
const APP_KNOWLEDGE = `
=== APP NAVIGATION ===

FRONTEND ROUTES:
- /                    - Home page, dashboard overview
- /tests/:testId       - View test details and aggregate statistics
- /import              - Import new test results (XML upload)

HOW TO NAVIGATE:
- To view a specific test: Go to /tests/{testId} where testId is the test number (e.g., /tests/9863)
- To import new data: Go to /import and upload XML file
- Home shows available tests and quick stats

=== BACKEND API ===

BASE URL: http://localhost:4567
AUTH: Basic Auth (markr:secret)

ENDPOINTS:
1. POST /import
   - Upload test results as XML (Content-Type: text/xml+markr)
   - Returns: { job_id, status: "queued" }
   - Must poll /jobs/:job_id for completion

2. GET /jobs/:job_id
   - Check import job status
   - Statuses: queued, processing, completed, failed, dead

3. GET /results/:test_id/aggregate
   - Get statistics for a test (only after import completes)
   - Returns: { mean, count, min, max, stddev, p25, p50, p75 }
   - All values are percentages except count

4. GET /health
   - Health check (no auth required)

=== DATA MODEL ===

Test Result:
- student_number: Student ID
- test_id: Test identifier
- marks_available: Maximum possible marks
- marks_obtained: Marks the student got
- percentage: (obtained/available) * 100

Aggregate Statistics (all percentages):
- mean: Average score
- count: Number of students
- min/max: Lowest/highest scores
- stddev: Standard deviation
- p25/p50/p75: 25th, 50th, 75th percentiles

`;

export const useContextStore = create<ContextState>((set, get) => ({
  viewedTests: new Map(),
  pageHistory: [],

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

  getContextForAI: () => {
    const state = get();
    const lines: string[] = [];

    // App knowledge first
    lines.push(APP_KNOWLEDGE);

    lines.push('=== USER SESSION DATA ===\n');

    // Tests viewed
    if (state.viewedTests.size > 0) {
      lines.push('TESTS VIEWED BY USER:');
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
    } else {
      lines.push('No tests viewed yet. User can navigate to /tests/:testId to view test details.\n');
    }

    // Recent pages
    if (state.pageHistory.length > 0) {
      lines.push('USER NAVIGATION HISTORY:');
      const recent = state.pageHistory.slice(-10);
      recent.forEach((visit) => {
        lines.push(`  - ${visit.title} (${visit.path})`);
      });
    }

    return lines.join('\n');
  },

  clearContext: () => {
    set({
      viewedTests: new Map(),
      pageHistory: [],
    });
  },
}));
