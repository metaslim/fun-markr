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
