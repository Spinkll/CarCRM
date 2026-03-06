import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateServiceRequestDto {
  @IsInt()
  @IsNotEmpty()
  carId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsNotEmpty()
  @IsInt()
  @Min(0, { message: 'Пробіг не може бути від\'ємним' })
  mileage: number; 
}