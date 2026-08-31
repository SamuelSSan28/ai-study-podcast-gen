import { IsBoolean, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { StudyPlanProvisioningStatus } from '../domain/models';

class StudyPlanSettingsDto {
  @IsOptional() @IsInt() @Min(30) @Max(60) targetSessionMinutes?: number;
}

export class GenerateStudyPlanDto {
  @IsString() title!: string;
  @IsString() goal!: string;
  @IsOptional() @ValidateNested() @Type(() => StudyPlanSettingsDto) settings?: StudyPlanSettingsDto;
}

export type CreateStudyPlanResponse = {
  id: string;
  title?: string;
  goal?: string;
  status: StudyPlanProvisioningStatus | 'PROCESSING';
  jobId?: string;
};

export type StudyPlanStatusResponse = {
  status: StudyPlanProvisioningStatus;
  provisioningError?: string | null;
};

export type AsyncJobResponse = {
  status: 'QUEUED';
  jobId: string;
  planId: string;
  sessionId?: string;
};

export class MarkTopicStudiedDto {
  @IsOptional() @IsBoolean() studied?: boolean;
}
