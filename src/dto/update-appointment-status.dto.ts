import { IsEnum, IsNotEmpty } from 'class-validator';
import { AppointmentStatus } from 'generated/prisma/enums';


export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus, { message: 'Недійсний статус запису' })
  @IsNotEmpty()
  status: AppointmentStatus;
}