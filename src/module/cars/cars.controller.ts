import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  ParseIntPipe, 
  Req, 
  UseGuards, 
  Query
} from '@nestjs/common';
import { CarsService } from './cars.service';
import { CreateCarDto } from 'src/dto/create-car.dto';
import { UpdateCarDto } from 'src/dto/update-car.dto';
import { AuthGuard } from '@nestjs/passport';
import { GetCarHistoryDto } from 'src/dto/get-car-history.dto';

@Controller('cars')
@UseGuards(AuthGuard('jwt'))
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  @Post()
  create(@Req() req, @Body() createCarDto: CreateCarDto) {
    const userRole = req.user.role; 
    const currentUserId = req.user.id;

    let targetOwnerId = currentUserId;

    if ((userRole === 'ADMIN' || userRole === 'MANAGER') && createCarDto.userId) {
      targetOwnerId = createCarDto.userId;
    } 
    
    return this.carsService.create(targetOwnerId, createCarDto);
  }

  @Get()
  findAll(@Req() req) {
    return this.carsService.findAll(req.user.id, req.user.role);
  }


  @Get('decode-vin/:vin')
  async decodeVin(@Param('vin') vin: string) {
    return this.carsService.decodeVin(vin);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.carsService.findOne(req.user.id, id, req.user.role);
  }

  @Patch(':id')
  update(
    @Req() req, 
    @Param('id', ParseIntPipe) id: number, 
    @Body() updateCarDto: UpdateCarDto
  ) {
    return this.carsService.update(req.user.id, id, updateCarDto, req.user.role);
  }

  @Delete(':id')
  async deleteCar(
    @Req() req, 
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.carsService.deleteCar(id, req.user.id, req.user.role);
  }

  @Get(':id/history')
  async getHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query() filters: GetCarHistoryDto 
  ) {
    return this.carsService.getCarHistory(id, filters);
  }
}