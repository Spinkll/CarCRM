import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { ServiceRequestsService } from './service-requests.service';
import { AuthGuard } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { CreateServiceRequestDto } from 'src/dto/create-service-request.dto';
import { ApproveServiceRequestDto } from 'src/dto/approve-service-request.dto';

@UseGuards(AuthGuard('jwt'))
@Controller('service-requests')
export class ServiceRequestsController {
  constructor(private readonly requestsService: ServiceRequestsService) {}

  // Создать заявку (Клиент)
  @Post()
  create(@Req() req, @Body() dto: CreateServiceRequestDto) { 
    return this.requestsService.createRequest(req.user.id, dto.carId, dto.reason, dto.scheduledAt);
  }

  @Get()
  findAll(@Req() req) {
    if (req.user.role === UserRole.CLIENT) {
      return this.requestsService.findByClient(req.user.id);
    }
    return this.requestsService.findAll();
  }

  @Patch(':id/approve')
  approve(
    @Req() req, 
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveServiceRequestDto 
  ) {
    return this.requestsService.approveAndSchedule(id, req.user.id, dto);
  }

  // Отклонить заявку
  @Patch(':id/reject')
  reject(@Param('id', ParseIntPipe) id: number) {
    return this.requestsService.rejectRequest(id);
  }
}