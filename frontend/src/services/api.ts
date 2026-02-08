import type { TestAggregate, JobStatus, TestListResponse, StudentResponse, StudentResult, TestStudentsResponse, StudentListResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4567';
const AUTH = btoa(`${import.meta.env.VITE_API_USER || 'markr'}:${import.meta.env.VITE_API_PASS || 'secret'}`);

const headers = {
  'Authorization': `Basic ${AUTH}`,
  'Content-Type': 'application/json',
};

export async function getAggregate(testId: string): Promise<TestAggregate> {
  const response = await fetch(`${API_BASE}/results/${testId}/aggregate`, { headers });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Test ${testId} not found`);
    }
    throw new Error(`Failed to fetch aggregate: ${response.statusText}`);
  }
  return response.json();
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetch(`${API_BASE}/jobs/${jobId}`, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch job status: ${response.statusText}`);
  }
  return response.json();
}

export type ImportFormat = 'xml' | 'csv';

export async function importResults(content: string, format: ImportFormat = 'xml'): Promise<JobStatus> {
  const contentType = format === 'csv' ? 'text/csv+markr' : 'text/xml+markr';
  const response = await fetch(`${API_BASE}/import`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${AUTH}`,
      'Content-Type': contentType,
    },
    body: content,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Failed to import: ${response.statusText}`);
  }
  return response.json();
}

export async function healthCheck(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/health`);
  return response.json();
}

export async function listTests(): Promise<TestListResponse> {
  const response = await fetch(`${API_BASE}/tests`, { headers });
  if (!response.ok) {
    throw new Error(`Failed to list tests: ${response.statusText}`);
  }
  return response.json();
}

export async function listStudents(): Promise<StudentListResponse> {
  const response = await fetch(`${API_BASE}/students`, { headers });
  if (!response.ok) {
    throw new Error(`Failed to list students: ${response.statusText}`);
  }
  return response.json();
}

export async function getStudent(studentNumber: string): Promise<StudentResponse> {
  const response = await fetch(`${API_BASE}/students/${studentNumber}`, { headers });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Student ${studentNumber} not found`);
    }
    throw new Error(`Failed to fetch student: ${response.statusText}`);
  }
  return response.json();
}

export async function getStudentTestResult(studentNumber: string, testId: string): Promise<StudentResult> {
  const response = await fetch(`${API_BASE}/students/${studentNumber}/tests/${testId}`, { headers });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Result not found for student ${studentNumber} on test ${testId}`);
    }
    throw new Error(`Failed to fetch result: ${response.statusText}`);
  }
  return response.json();
}

export async function getTestStudents(testId: string): Promise<TestStudentsResponse> {
  const response = await fetch(`${API_BASE}/tests/${testId}/students`, { headers });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Test ${testId} not found or no students`);
    }
    throw new Error(`Failed to fetch students: ${response.statusText}`);
  }
  return response.json();
}

// Poll job until complete
export async function waitForJob(jobId: string, maxAttempts = 20): Promise<JobStatus> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getJobStatus(jobId);
    if (status.status === 'completed' || status.status === 'failed' || status.status === 'dead') {
      return status;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Job timed out');
}
