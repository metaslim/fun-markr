import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getJobStatus } from '../services/api';

export interface Job {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'unknown';
  testIds: string[];
  createdAt: number;
  error?: string;
}

interface JobStore {
  jobs: Job[];
  isPolling: boolean;

  // Actions
  addJob: (jobId: string) => void;
  updateJob: (jobId: string, updates: Partial<Job>) => void;
  removeJob: (jobId: string) => void;
  clearCompleted: () => void;

  // Computed
  activeJobs: () => Job[];
  completedJobs: () => Job[];
  hasActiveJobs: () => boolean;

  // Polling
  startPolling: () => void;
  stopPolling: () => void;
}

let pollingTimeout: ReturnType<typeof setTimeout> | null = null;
let pollCount = 0;

export const useJobStore = create<JobStore>()(
  persist(
    (set, get) => ({
      jobs: [],
      isPolling: false,

      addJob: (jobId: string) => {
        set((state) => ({
          jobs: [
            {
              id: jobId,
              status: 'queued',
              testIds: [],
              createdAt: Date.now(),
            },
            ...state.jobs,
          ],
        }));
        // Start polling when a job is added
        get().startPolling();
      },

      updateJob: (jobId: string, updates: Partial<Job>) => {
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === jobId ? { ...job, ...updates } : job
          ),
        }));
      },

      removeJob: (jobId: string) => {
        set((state) => ({
          jobs: state.jobs.filter((job) => job.id !== jobId),
        }));
      },

      clearCompleted: () => {
        set((state) => ({
          jobs: state.jobs.filter(
            (job) => job.status !== 'completed' && job.status !== 'failed'
          ),
        }));
      },

      activeJobs: () => {
        return get().jobs.filter(
          (job) => job.status === 'queued' || job.status === 'processing'
        );
      },

      completedJobs: () => {
        return get().jobs.filter(
          (job) => job.status === 'completed' || job.status === 'failed'
        );
      },

      hasActiveJobs: () => {
        return get().activeJobs().length > 0;
      },

      startPolling: () => {
        if (pollingTimeout) return;

        set({ isPolling: true });
        pollCount = 0;

        const poll = async () => {
          const { jobs, updateJob, stopPolling } = get();
          const activeJobs = jobs.filter(
            (job) => job.status === 'queued' || job.status === 'processing'
          );

          if (activeJobs.length === 0) {
            stopPolling();
            return;
          }

          // Poll all jobs in parallel instead of sequentially
          await Promise.allSettled(
            activeJobs.map(async (job) => {
              try {
                const result = await getJobStatus(job.id);

                if (result.status === 'completed') {
                  updateJob(job.id, {
                    status: 'completed',
                    testIds: result.test_ids || [],
                  });
                } else if (result.status === 'failed' || result.status === 'dead') {
                  updateJob(job.id, {
                    status: 'failed',
                    error: result.error || 'Job failed',
                  });
                } else if (result.status === 'processing' || result.status === 'working') {
                  updateJob(job.id, { status: 'processing' });
                }
              } catch (err) {
                console.error('Failed to poll job status:', err);
              }
            })
          );

          // Schedule next poll with exponential backoff (2s -> 3s -> 4.5s, cap at 10s)
          pollCount++;
          const interval = Math.min(2000 * Math.pow(1.5, Math.floor(pollCount / 3)), 10000);
          if (get().activeJobs().length > 0) {
            pollingTimeout = setTimeout(poll, interval);
          } else {
            get().stopPolling();
          }
        };

        // Poll immediately, then schedule with backoff
        poll();
      },

      stopPolling: () => {
        if (pollingTimeout) {
          clearTimeout(pollingTimeout);
          pollingTimeout = null;
        }
        pollCount = 0;
        set({ isPolling: false });
      },
    }),
    {
      name: 'markr-jobs',
      // Only persist jobs, not polling state
      partialize: (state) => ({ jobs: state.jobs }),
    }
  )
);
