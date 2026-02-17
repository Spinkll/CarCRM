import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { RegisterDto } from 'src/dto/auth';
import * as bcrypt from 'bcrypt';
import { UpdateUserDto } from 'src/dto/user';
import { UserRole } from 'generated/prisma/enums';
import { CreateEmployeeDto } from 'src/dto/create-employee.dto';



@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }
    
    async createUser(dto: RegisterDto) {
    const { email, password, firstName, lastName,phone } = dto;

    const existingUser = await this.prisma.user.findFirst({
  where: {
    OR: [
      { email: dto.email },
      { phone: dto.phone }
    ]
  }
    } );
if (existingUser) {
  throw new ConflictException('Користувач з таким email або телефоном вже існує');
}

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
        data: {
          email,
        phone,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'CLIENT', 
      },
    });

    return user;
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('Користувача не знайдено');
    }
    return user;
  }

  async findById(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Користувача не знайдено');
    }
    return user;
  }

  async updateUser(id: number, dto: UpdateUserDto) {
  const data: any = { ...dto };

  if (dto.password) {
    data.password = await bcrypt.hash(dto.password, 10);
  }

  return this.prisma.user.update({
    where: { id },
    data,
  });
  }
  
  async update(userId: number, data: any) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async deleteUser(id: number) {
    return this.prisma.user.delete({ where: { id } });
  }

  async findAllByRoles(roles: UserRole[]) {
    return this.prisma.user.findMany({
      where: {
        role: { in: roles } 
      },
      select: { 
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
      },
    });
  }

  async createEmployee(dto: CreateEmployeeDto) {
    const { email, password, firstName, lastName,phone,role } = dto;

    const existingUser = await this.prisma.user.findFirst({
  where: {
    OR: [
      { email: dto.email },
      { phone: dto.phone }
    ]
  }
    } );
if (existingUser) {
  throw new ConflictException('Користувач з таким email або телефоном вже існує');
}

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
        data: {
          email,
        phone,
        password: hashedPassword,
        firstName,
        lastName,
        role, 
      },
    });

    return user;
  }
    
}
