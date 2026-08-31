import { Job, Queue } from 'bullmq';
import { enqueueUnique, isFinalJobAttempt } from '../src/queue/queue-dedup';

describe('queue-dedup', () => {
  it('removes completed jobs before re-enqueueing', async () => {
    const remove = jest.fn().mockResolvedValue(undefined);
    const add = jest.fn().mockResolvedValue({ id: 'job-1' });
    const getJob = jest.fn().mockResolvedValue({
      id: 'job-1',
      getState: jest.fn().mockResolvedValue('completed'),
      remove,
    });
    const queue = { getJob, add } as unknown as Queue;

    const id = await enqueueUnique(queue, 'test', { x: 1 }, 'stable-id');
    expect(remove).toHaveBeenCalled();
    expect(add).toHaveBeenCalledWith('test', { x: 1 }, expect.objectContaining({ jobId: 'stable-id' }));
    expect(id).toBe('job-1');
  });

  it('skips enqueue when job is already active', async () => {
    const add = jest.fn();
    const getJob = jest.fn().mockResolvedValue({
      id: 'job-2',
      getState: jest.fn().mockResolvedValue('active'),
    });
    const queue = { getJob, add } as unknown as Queue;

    const id = await enqueueUnique(queue, 'test', { x: 1 }, 'stable-id');
    expect(add).not.toHaveBeenCalled();
    expect(id).toBe('job-2');
  });

  it('detects final BullMQ attempt', () => {
    const job = { attemptsMade: 3, opts: { attempts: 3 } } as Job;
    expect(isFinalJobAttempt(job)).toBe(true);
    expect(isFinalJobAttempt({ attemptsMade: 1, opts: { attempts: 3 } } as Job)).toBe(false);
  });
});
