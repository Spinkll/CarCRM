import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req, ParseIntPipe } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from 'src/dto/create-order.dto';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Req() req, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(req.user.id, req.user.role, dto);
  }

  @Get()
  findAll(@Req() req) {
    return this.ordersService.findAll(req.user.id, req.user.role);
  }

  @Get(':id')
  findOne(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(req.user.id, req.user.role, id);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() req,
    @Param('id', ParseIntPipe) id: number, 
    @Body() dto: UpdateOrderStatusDto
  ) {
    return this.ordersService.updateStatus(req.user.id, id, dto);
  }
}