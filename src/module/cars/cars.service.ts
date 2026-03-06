import { 
  Injectable, 
  NotFoundException, 
  ConflictException, 
  InternalServerErrorException, 
  BadRequestException,
  ForbiddenException
} from '@nestjs/common';

import { UserRole } from 'generated/prisma/client';
import { PrismaClientKnownRequestError } from 'generated/prisma/internal/prismaNamespace';
import { PrismaService } from 'src/db/prisma.service';
import { CreateCarDto } from 'src/dto/create-car.dto';
import { UpdateCarDto } from 'src/dto/update-car.dto';


@Injectable()
export class CarsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateCarDto) {
    try {
      return await this.prisma.car.create({
        data: {
          ...dto,
          userId,
        },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Транспортний засіб з таким VIN-кодом або номерним знаком вже існує.');
        }
      }
      throw new InternalServerErrorException('Помилка при створенні автомобіля');
    }
  }

  
  async findAll(userId: number, role: UserRole) {
   if (role === 'CLIENT') {
      return this.prisma.car.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    }

   if (role === 'MECHANIC') {
      return this.prisma.car.findMany({
        where: {
          orders: {
            some: { mechanicId: userId }
          }
        },
        include: {
          user: { select: { firstName: true, lastName: true, phone: true } } 
        },
        distinct: ['id'], 
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.car.findMany({
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } }
      },
      orderBy: { createdAt: 'desc' },
    });
  
  
}

  async findOne(userId: number, carId: number, role: UserRole) {
    try {
      const whereClause: any = { id: carId };
      
      if (role !== 'ADMIN' && role !== 'MANAGER') {
        whereClause.userId = userId;
      }

      const car = await this.prisma.car.findFirst({
        where: whereClause,
      });

      if (!car) {
        throw new NotFoundException('Машину не знайдено або доступ заборонено');
      }

      return car;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Помилка при пошуку автомобіля');
    }
  }

  async update(userId: number, carId: number, dto: UpdateCarDto, role: UserRole) {
    await this.findOne(userId, carId, role);

    try {
      return await this.prisma.car.update({
        where: { id: carId },
        data: dto,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('Транспортний засіб з таким VIN-кодом вже існує.');
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('Машину для оновлення не знайдено.');
        }
      }
      throw new InternalServerErrorException('Помилка при оновленні автомобіля');
    }
  }

  async deleteCar(carId: number, userId?: number, userRole?: string) {
    const car = await this.prisma.car.findUnique({ where: { id: carId } });
    if (!car) throw new NotFoundException('Автомобиль не найден');
    if (car.deletedAt) throw new BadRequestException('Автомобиль уже в архиве');

    if (userRole === 'CLIENT' && car.userId !== userId) {
      throw new ForbiddenException('Вы можете удалять только свои автомобили');
    }

    // Мягкое удаление
    await this.prisma.car.update({
      where: { id: carId },
      data: { deletedAt: new Date() },
    });

    return { message: `Автомобиль ${car.brand} ${car.model} удален` };
  }
}
