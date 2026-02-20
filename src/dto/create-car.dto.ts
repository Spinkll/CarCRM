import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateCarDto {
  @IsString()
  @IsNotEmpty()
  brand: string;

  @IsString()
  @IsNotEmpty()
  model: string;

  @IsInt()
  @Min(1900)
  @IsNotEmpty()
  year: number;

  @IsString()
  @IsNotEmpty()
  vin: string;

  @IsString()
  @IsNotEmpty()
  plate: string;

  @IsInt()
  @IsNotEmpty()
  mileage: number;

  @IsString()
  @IsNotEmpty()
  color: string

  @IsOptional()
  @IsInt()
  userId?: number;
}