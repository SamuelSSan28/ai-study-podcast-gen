import { Job, JobsOptions, Queue } from 'bullmq';

const ACTIVE_STATES = new Set(['active', 'waiting', 'delayed', 'waiting-children']);

/** Enqueues a job by stable id; removes completed/failed duplicates, skips if already in-flight. */
export async function enqueueUnique<T>(
  queue: Queue,
  name: string,
  data: T,
  jobId: string,
  options: JobsOptions = {},
): Promise<string> {
  const existing = await queue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (ACTIVE_STATES.has(state)) {
      return existing.id ?? jobId;
    }
    if (state === 'completed' || state === 'failed') {
      await existing.remove();
    }
  }
  const job = await queue.add(name, data, { ...options, jobId });
  return job.id ?? jobId;
}

export function isFinalJobAttempt(job: Job): boolean {
  const maxAttempts = job.opts.attempts ?? 1;
  return (job.attemptsMade ?? 0) >= maxAttempts;
}
