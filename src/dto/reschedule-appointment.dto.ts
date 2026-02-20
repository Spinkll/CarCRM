import { IsDateString, IsInt, IsNotEmpty, IsOptional } from 'class-validator';

export class RescheduleAppointmentDto {
  @IsDateString({}, { message: 'Недійсний формат дати' })
  @IsNotEmpty()
  scheduledAt: string;

  @IsInt()
  @IsOptional()
  estimatedMin?: number;
}