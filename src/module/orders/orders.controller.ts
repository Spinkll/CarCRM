import {
  Controller, Get, Post, Delete, Body, Patch,
  Param, UseGuards, Req, Query, ParseIntPipe,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from 'src/dto/create-order.dto';
import { AssignOrderDto } from 'src/dto/assign-order.dto';
import { CreateOrderItemDto } from 'src/dto/create-order-item.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from 'src/guards/roles.guard';
import { OrderStatus } from '@prisma/client';

@UseGuards(AuthGuard('jwt'))
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  @Post()
  create(@Req() req, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(req.user.id, req.user.role, dto);
  }

  @Get()
  findAll(
    @Req() req,
    @Query('status') status?: OrderStatus,
    @Query('mechanicId') mechanicId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.ordersService.findAll(req.user.id, req.user.role, {
      status,
      mechanicId: mechanicId ? parseInt(mechanicId) : undefined,
      from,
      to,
    });
  }

  @Get(':id')
  findOne(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(req.user.id, req.user.role, id);
  }

  @Patch(':id/status')
  @UseGuards(new RolesGuard(['ADMIN', 'MANAGER', 'MECHANIC']))
  updateStatus(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(req.user.id, id, dto);
  }

  @Patch(':id/assign')
  @UseGuards(new RolesGuard(['ADMIN', 'MANAGER']))
  assignOrder(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignOrderDto,
  ) {
    return this.ordersService.assignOrder(req.user.id, id, dto);
  }

  @Post(':id/items')
  @UseGuards(new RolesGuard(['ADMIN', 'MANAGER','MECHANIC']))
  addItem(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateOrderItemDto,
  ) {
    return this.ordersService.addItem(req.user.id, id, dto);
  }

  @Delete(':id/items/:itemId')
  @UseGuards(new RolesGuard(['ADMIN', 'MANAGER','MECHANIC']))
  removeItem(
    @Req() req,
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.ordersService.removeItem(req.user.id, id, itemId);
  }
}