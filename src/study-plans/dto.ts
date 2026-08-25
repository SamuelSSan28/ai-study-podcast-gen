import { IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
class StudyPlanSettingsDto {
  @IsOptional() @IsInt() @Min(30) @Max(60) targetSessionMinutes?: number;
}
export class GenerateStudyPlanDto {
  @IsString() title!: string;
  @IsString() goal!: string;
  @IsOptional() @ValidateNested() @Type(() => StudyPlanSettingsDto) settings?: StudyPlanSettingsDto;
}
