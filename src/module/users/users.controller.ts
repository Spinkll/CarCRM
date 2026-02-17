import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateEmployeeDto } from 'src/dto/create-employee.dto';
import { RolesGuard } from 'src/guards/roles.guard';
import { UsersService } from './users.service';
import { UserRole } from 'generated/prisma/enums';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }
    
    @UseGuards(AuthGuard('jwt'), new RolesGuard(['ADMIN']))
    @Post('employees')
    async createEmployee(@Body() dto: CreateEmployeeDto) {
        return this.usersService.createEmployee(dto);
    }

    @UseGuards(AuthGuard('jwt'), new RolesGuard(['ADMIN', 'MANAGER']))
    @Get('employees')
    async getEmployees(@Query('role') roleQuery?: UserRole) {
    
        if (roleQuery) {
            const normalizedRole = roleQuery.toUpperCase() as UserRole;

            if (!Object.values(UserRole).includes(normalizedRole)) {
         throw new BadRequestException(`Роль '${roleQuery}' не існує`);
      }
            return this.usersService.findAllByRoles([normalizedRole]);
        }
        return this.usersService.findAllByRoles([UserRole.MECHANIC, UserRole.MANAGER]);
    }


    @UseGuards(AuthGuard('jwt'), new RolesGuard(['ADMIN', 'MANAGER']))
    @Get('clients')
    async getAllClients() {
        return this.usersService.findAllByRoles([UserRole.CLIENT]);
    }
}
