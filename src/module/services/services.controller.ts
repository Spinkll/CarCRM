import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ServicesService } from './services.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/guards/roles.guard';
import { CreateServiceDto } from 'src/dto/create-service.dto';
import { UpdateServiceDto } from 'src/dto/update-service.dto';


@Controller('services')
@UseGuards(AuthGuard('jwt')) 
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  async getAll() {
    return this.servicesService.findAllActive();
  }

  @Post()
  @UseGuards(new RolesGuard(['ADMIN', 'MANAGER']))
  async create(@Body() dto: CreateServiceDto) {
    return this.servicesService.createService(dto);
  }

  @Patch(':id')
  @UseGuards(new RolesGuard(['ADMIN', 'MANAGER']))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceDto
  ) {
    return this.servicesService.updateService(id, dto);
  }

  @Delete(':id')
  @UseGuards(new RolesGuard(['ADMIN', 'MANAGER']))
  async delete(@Param('id', ParseIntPipe) id: number) {
    return this.servicesService.deleteService(id);
  }
}