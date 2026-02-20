import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApproveServiceRequestDto {
  @IsDateString()
  @IsNotEmpty()
  scheduledAt: string;

  @IsInt()
  @IsOptional()
  estimatedMin?: number;

  @IsInt()
  @IsOptional()
  mechanicId?: number;

  @IsString()
  @IsOptional()
  description?: string;
}