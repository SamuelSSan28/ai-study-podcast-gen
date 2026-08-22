import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
export class GenerateStudyPlanDto {
  @IsString() title!: string;
  @IsInt() @Min(1) @Max(52) durationWeeks!: number;
  @IsInt() @Min(1) @Max(7) sessionsPerWeek!: number;
  @IsString() level!: string;
  @IsString() goal!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(7) @IsIn(DAYS, { each: true }) preferredDays!: string[];
  @IsOptional() @IsString() startDate?: string;
}
