import { CreateStudyPlanUseCase } from '../src/application/create-study-plan.use-case';
import { StudyPlanRepository } from '../src/application/ports';
import { QueueService } from '../src/queue/queue.service';
import { StudyPlan } from '../src/domain/models';
import { buildIdempotencyKey } from '../src/domain/idempotency';

function basePlan(overrides: Partial<StudyPlan> = {}): StudyPlan {
  return {
    id: 'plan-1',
    title: 'Kafka',
    goal: 'Learn Kafka',
    level: 'adaptive',
    durationWeeks: 6,
    sessionsPerWeek: 3,
    preferredDays: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    startDate: '2026-01-01',
    endDate: '2026-02-11',
    status: 'DRAFT',
    provisioningStatus: 'CREATING',
    idempotencyKey: buildIdempotencyKey('Kafka', 'Learn Kafka'),
    overview: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    targetSessionMinutes: 45,
    ...overrides,
  };
}

describe('CreateStudyPlanUseCase', () => {
  let plans: jest.Mocked<StudyPlanRepository>;
  let queue: {
    enqueuePlanGeneration: jest.Mock;
    enqueueNotionPlanPending: jest.Mock;
  };
  let notifier: {
    notifyPlanStarted: jest.Mock;
    notifyPlanRetry: jest.Mock;
  };
  let useCase: CreateStudyPlanUseCase;
  const events = { publish: jest.fn().mockResolvedValue(undefined) };

  beforeEach(() => {
    plans = {
      createPending: jest.fn((plan) => Promise.resolve(plan)),
      finalizePlan: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdempotencyKey: jest.fn(),
      findActiveByGoal: jest.fn(),
      findInFlightByGoal: jest.fn(),
      findActive: jest.fn(),
      updatePlan: jest.fn(),
      archivePlan: jest.fn(),
    };
    queue = {
      enqueuePlanGeneration: jest.fn().mockResolvedValue('job-1'),
      enqueueNotionPlanPending: jest.fn().mockResolvedValue(undefined),
    };
    notifier = {
      notifyPlanStarted: jest.fn().mockResolvedValue(undefined),
      notifyPlanRetry: jest.fn().mockResolvedValue(undefined),
    };
    useCase = new CreateStudyPlanUseCase(
      plans,
      queue as unknown as QueueService,
      notifier as never,
      events as never,
    );
  });

  it('creates a pending plan and enqueues generation', async () => {
    plans.findByIdempotencyKey.mockResolvedValue(null);
    plans.findInFlightByGoal.mockResolvedValue(null);
    plans.findActiveByGoal.mockResolvedValue(null);

    const result = await useCase.execute({
      title: 'Kafka',
      goal: 'Learn Kafka',
    });

    expect(result.kind).toBe('created');
    if (result.kind !== 'created') return;
    expect(result.plan.provisioningStatus).toBe('CREATING');
    expect(result.plan.status).toBe('DRAFT');
    expect(plans.createPending.mock.calls.length).toBe(1);
    expect(queue.enqueueNotionPlanPending).toHaveBeenCalledWith(result.plan.id);
    expect(queue.enqueuePlanGeneration).toHaveBeenCalledWith(result.plan.id);
  });

  it('returns processing when the idempotency key is still in flight', async () => {
    plans.findByIdempotencyKey.mockResolvedValue(
      basePlan({ id: 'existing', provisioningStatus: 'GENERATING' }),
    );

    const result = await useCase.execute({
      title: 'Kafka',
      goal: 'Learn Kafka',
    });

    expect(result).toEqual({ kind: 'processing', id: 'existing' });
    expect(plans.createPending.mock.calls).toHaveLength(0);
  });

  it('returns processing when an active plan already has the same goal', async () => {
    plans.findByIdempotencyKey.mockResolvedValue(null);
    plans.findInFlightByGoal.mockResolvedValue(null);
    plans.findActiveByGoal.mockResolvedValue(
      basePlan({ id: 'active-plan', status: 'ACTIVE', provisioningStatus: 'READY' }),
    );

    const result = await useCase.execute({
      title: 'Different title',
      goal: 'Learn Kafka',
    });

    expect(result).toEqual({ kind: 'processing', id: 'active-plan' });
  });

  it('re-enqueues a failed plan with the same idempotency key', async () => {
    const failed = basePlan({ provisioningStatus: 'FAILED', provisioningError: 'boom' });
    plans.findByIdempotencyKey.mockResolvedValue(failed);

    const result = await useCase.execute({
      title: 'Kafka',
      goal: 'Learn Kafka',
    });

    expect(result.kind).toBe('created');
    const updated = plans.updatePlan.mock.calls[0]?.[0];
    expect(updated?.provisioningStatus).toBe('CREATING');
    expect(updated?.provisioningError).toBeUndefined();
    expect(queue.enqueuePlanGeneration).toHaveBeenCalledWith('plan-1');
  });
});
