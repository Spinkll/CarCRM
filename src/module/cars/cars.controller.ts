import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { CarsService } from './cars.service';
import { CreateCarDto } from 'src/dto/create-car.dto';
import { UpdateCarDto } from 'src/dto/update-car.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('cars')
@UseGuards(AuthGuard('jwt'))
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  @Post()
  create(@Req() req, @Body() createCarDto: CreateCarDto) {
    return this.carsService.create(req.user.sub, createCarDto);
  }

  @Get()
  findAll(@Req() req) {
    return this.carsService.findAll(req.user['id'], req.user.role);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.carsService.findOne(req.user.sub, id);
  }

  @Patch(':id')
  update(@Req() req, @Param('id', ParseIntPipe) id: number, @Body() updateCarDto: UpdateCarDto) {
    return this.carsService.update(req.user.sub, id, updateCarDto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.carsService.remove(req.user.sub, id);
  }
}
