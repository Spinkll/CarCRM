import { Controller, Get, Patch, Body, Param, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { UpdateAppointmentStatusDto } from 'src/dto/update-appointment-status.dto';
import { RescheduleAppointmentDto } from 'src/dto/reschedule-appointment.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  // Отримати всі записи для календаря
  @Get()
  findAll(@Req() req) {
    // Якщо це клієнт, віддаємо тільки його записи
    if (req.user.role === UserRole.CLIENT) {
      return this.appointmentsService.findByClient(req.user.id);
    }
    // Адмінам, менеджерам та механікам віддаємо всі записи для календаря
    return this.appointmentsService.findAll();
  }

  // Змінити статус (ARRIVED, COMPLETED, CANCELLED тощо)
  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppointmentStatusDto
  ) {
    return this.appointmentsService.updateStatus(id, dto.status);
  }

  // Перенести запис (Drag & Drop в календарі на фронті)
  @Patch(':id/reschedule')
  reschedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RescheduleAppointmentDto
  ) {
    return this.appointmentsService.reschedule(id, dto.scheduledAt, dto.estimatedMin);
  }
}