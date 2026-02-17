import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateCarDto {
  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsInt()
  @Min(1900)
  @IsOptional()
  year?: number;

  @IsString()
  @IsOptional()
  vin?: string;

  @IsString()
  @IsOptional()
  plate?: string;

  @IsInt()
  @IsOptional()
  mileage?: number;
}