export interface TestResult {
  id: number;
  student_number: string;
  test_id: string;
  marks_available: number;
  marks_obtained: number;
  percentage: number;
  created_at: string;
}

export interface TestAggregate {
  mean: number;
  count: number;
  min: number;
  max: number;
  stddev: number;
  p25: number;
  p50: number;
  p75: number;
}

export interface JobStatus {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'dead';
  error?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface TestSummary {
  test_id: string;
  mean: number;
  count: number;
  min: number;
  max: number;
  stddev: number;
  p25: number;
  p50: number;
  p75: number;
  updated_at: string;
}

export interface TestListResponse {
  tests: TestSummary[];
  count: number;
}

export interface StudentResult {
  student_number: string;
  student_name?: string;
  test_id: string;
  marks_available: number;
  marks_obtained: number;
  percentage: number;
  scanned_on?: string;
}

export interface StudentResponse {
  student_number: string;
  results: StudentResult[];
  count: number;
}

export interface TestStudentsResponse {
  test_id: string;
  students: StudentResult[];
  count: number;
}

export interface Student {
  id: number;
  student_number: string;
  name?: string;
  created_at: string;
  updated_at: string;
}

export interface StudentListResponse {
  students: Student[];
  count: number;
}
