// src/users/users.controller.ts
import { Body, Controller, Delete, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateEmployeeDto } from 'src/dto/create-employee.dto';
import { RolesGuard } from 'src/guards/roles.guard';
import { UsersService } from './users.service';
import { RegisterDto } from 'src/dto/auth';
import { CreateCustomerDto } from 'src/dto/create-customer.dto';
import { ChangePasswordDto } from 'src/dto/user';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }
    
  @UseGuards(AuthGuard('jwt'), new RolesGuard(['ADMIN']))
  @Post('employee')
  async createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.usersService.createEmployee(dto);
  }

  @UseGuards(AuthGuard('jwt'), new RolesGuard(['ADMIN','MANAGER']))
  @Get('employees')
  async getEmployees(@Req() req) {
    return this.usersService.findEmployees(); 
  }

  @UseGuards(AuthGuard('jwt'), new RolesGuard(['ADMIN']))
  @Delete(':id')
  async deleteUser(@Req() req, @Param('id', ParseIntPipe) id: number) {
    if (req.user.role !== 'ADMIN') throw new ForbiddenException();
    return this.usersService.deleteUser(id);
  }

  // --- КЛІЄНТИ ---

  @UseGuards(AuthGuard('jwt'), new RolesGuard(['ADMIN', 'MANAGER']))
  @Post('customer')
  async createCustomer(@Body() dto: CreateCustomerDto) {
    return this.usersService.createCustomer(dto);
  }
    
  @UseGuards(AuthGuard('jwt'), new RolesGuard(['ADMIN', 'MANAGER','MECHANIC']))
  @Get('customers')
  async getCustomers() {
    return this.usersService.findCustomers();
  }

  @UseGuards(AuthGuard('jwt'), new RolesGuard(['ADMIN', 'MANAGER']))
  @Get('mechanics')
  async getMechanics() {
    return this.usersService.findMechanics();
  }

  @UseGuards(AuthGuard('jwt')) 
  @Patch('change-password')
  async changePassword(
    @Req() req, 
    @Body() dto: ChangePasswordDto
  ) {
    return this.usersService.changePassword(req.user.id, dto);
  }
}