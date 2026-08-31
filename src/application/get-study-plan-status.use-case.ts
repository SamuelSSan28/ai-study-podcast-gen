import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PLAN_REPOSITORY, StudyPlanRepository } from './ports';
import { StudyPlanProvisioningStatus } from '../domain/models';

@Injectable()
export class GetStudyPlanStatusUseCase {
  constructor(@Inject(PLAN_REPOSITORY) private readonly plans: StudyPlanRepository) {}

  async execute(planId: string): Promise<{
    status: StudyPlanProvisioningStatus;
    provisioningError?: string | null;
  }> {
    const plan = await this.plans.findById(planId);
    if (!plan) throw new NotFoundException(`Study plan ${planId} not found`);
    return {
      status: plan.provisioningStatus,
      provisioningError: plan.provisioningError ?? null,
    };
  }
}
