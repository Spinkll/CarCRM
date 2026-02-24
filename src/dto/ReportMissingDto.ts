import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReportMissingDto {
  @IsInt()
  @IsNotEmpty()
  partId: number;

  @IsString()
  @IsOptional()
  comment?: string;
}