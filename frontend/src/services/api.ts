import type { TestAggregate, JobStatus } from '../types';

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

export async function importResults(xmlContent: string): Promise<JobStatus> {
  const response = await fetch(`${API_BASE}/import`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${AUTH}`,
      'Content-Type': 'text/xml+markr',
    },
    body: xmlContent,
  });
  if (!response.ok) {
    throw new Error(`Failed to import: ${response.statusText}`);
  }
  return response.json();
}

export async function healthCheck(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/health`);
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
