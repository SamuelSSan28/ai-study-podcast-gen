import { Test, TestingModule } from '@nestjs/testing';
import { CreateStudyPlanUseCase } from '../src/application/create-study-plan.use-case';
import { GetStudyPlanStatusUseCase } from '../src/application/get-study-plan-status.use-case';
import { ArchiveStudyPlanUseCase } from '../src/application/archive-study-plan.use-case';
import { MarkTopicStudiedUseCase } from '../src/application/mark-topic-studied.use-case';
import { PLAN_REPOSITORY, SESSION_REPOSITORY, TOPIC_REPOSITORY } from '../src/application/ports';
import { QueueService } from '../src/queue/queue.service';
import { StudyPlansController } from '../src/study-plans/study-plans.controller';
import type { Response } from 'express';

describe('StudyPlansController', () => {
  let controller: StudyPlansController;
  let createPlan: { execute: jest.Mock };
  let getStatus: { execute: jest.Mock };
  let res: { status: jest.Mock };

  beforeEach(async () => {
    createPlan = { execute: jest.fn() };
    getStatus = { execute: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudyPlansController],
      providers: [
        { provide: CreateStudyPlanUseCase, useValue: createPlan },
        { provide: GetStudyPlanStatusUseCase, useValue: getStatus },
        { provide: ArchiveStudyPlanUseCase, useValue: { execute: jest.fn() } },
        { provide: MarkTopicStudiedUseCase, useValue: { execute: jest.fn() } },
        {
          provide: QueueService,
          useValue: {
            enqueueGenerateSession: jest.fn(),
            enqueueAdvancePlan: jest.fn(),
          },
        },
        { provide: PLAN_REPOSITORY, useValue: { findAll: jest.fn(), findById: jest.fn() } },
        { provide: TOPIC_REPOSITORY, useValue: { findTopicsByPlan: jest.fn() } },
        { provide: SESSION_REPOSITORY, useValue: { findByPlan: jest.fn() } },
      ],
    }).compile();

    controller = module.get(StudyPlansController);
    res = { status: jest.fn().mockReturnThis() };
  });

  it('returns 202 for a newly accepted plan', async () => {
    createPlan.execute.mockResolvedValue({
      kind: 'created',
      plan: {
        id: 'plan-1',
        title: 'Kafka',
        goal: 'Learn Kafka',
        provisioningStatus: 'CREATING',
      },
    });

    const body = await controller.create(
      { title: 'Kafka', goal: 'Learn Kafka' },
      undefined,
      res as unknown as Response,
    );

    expect(res.status).toHaveBeenCalledWith(202);
    expect(body).toEqual({
      id: 'plan-1',
      title: 'Kafka',
      goal: 'Learn Kafka',
      status: 'PROCESSING',
    });
  });

  it('returns 200 PROCESSING for duplicate requests', async () => {
    createPlan.execute.mockResolvedValue({ kind: 'processing', id: 'plan-1' });

    const body = await controller.create(
      { title: 'Kafka', goal: 'Learn Kafka' },
      'custom-key',
      res as unknown as Response,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(body).toEqual({ id: 'plan-1', status: 'PROCESSING' });
    expect(createPlan.execute).toHaveBeenCalledWith(
      expect.objectContaining({ idempotencyKeyHeader: 'custom-key' }),
    );
  });

  it('exposes provisioning status by plan id', async () => {
    getStatus.execute.mockResolvedValue({ status: 'GENERATING' });
    await expect(controller.status('plan-1')).resolves.toEqual({ status: 'GENERATING' });
  });
});
