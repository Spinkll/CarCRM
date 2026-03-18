import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/guards/roles.guard';
import { BuildReportDto } from 'src/dto/build-report.dto';

@Controller('reports')
@UseGuards(AuthGuard('jwt'), new RolesGuard(['ADMIN', 'MANAGER']))
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('build')
  async buildReport(@Body() dto: BuildReportDto) {
    return this.reportsService.buildDynamicReport(dto);
  }
}
