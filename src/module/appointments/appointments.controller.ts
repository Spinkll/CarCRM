import { Controller, Get, Patch, Body, Param, UseGuards, Req, ParseIntPipe, BadRequestException, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { UpdateAppointmentStatusDto } from 'src/dto/update-appointment-status.dto';
import { RescheduleAppointmentDto } from 'src/dto/reschedule-appointment.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  findAll(@Req() req) {
    if (req.user.role === UserRole.CLIENT) {
      return this.appointmentsService.findByClient(req.user.id);
    }

    if (req.user.role === UserRole.MECHANIC) {
      return this.appointmentsService.findByMechanic(req.user.id)
    }
    return this.appointmentsService.findAll();
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppointmentStatusDto
  ) {
    return this.appointmentsService.updateStatus(id, dto.status);
  }

  @Patch(':id/reschedule')
  reschedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RescheduleAppointmentDto
  ) {
    return this.appointmentsService.reschedule(id, dto.scheduledAt, dto.estimatedMin);
  }

  @Get('available-slots')
  @UseGuards(AuthGuard('jwt'))
  async getAvailableSlots(@Query('date') date: string) {
    if (!date) {
      throw new BadRequestException('Вкажіть дату у параметрі ?date=YYYY-MM-DD');
    }
    return this.appointmentsService.getAvailableSlots(date);
  }
}