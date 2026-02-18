import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from 'generated/prisma/client';
import { PrismaService } from 'src/db/prisma.service';
import { CreateCarDto } from 'src/dto/create-car.dto';
import { UpdateCarDto } from 'src/dto/update-car.dto';


@Injectable()
export class CarsService {
  constructor(private readonly prisma: PrismaService) { }
  
  async create(userId: number, dto: CreateCarDto) {
    return this.prisma.car.create({
      data: {
        ...dto,
        userId,
      },
    });
  }

  async findAll(userId: number, role: UserRole) {
    if (role === 'ADMIN' || role === 'MANAGER') {
      return this.prisma.car.findMany({
        include: { user: true }
      });
    }
    return this.prisma.car.findMany({
      where: {
        userId: userId 
      }
    });
  }

  async findOne(userId: number, carId: number) {
    const car = await this.prisma.car.findFirst({
      where: {
        id: carId,
        userId, 
      },
    });

    if (!car) throw new NotFoundException('Машина не найдена или доступ запрещен');
    return car;
  }

  async update(userId: number, carId: number, dto: UpdateCarDto) {
    await this.findOne(userId, carId); 
    return this.prisma.car.update({
      where: { id: carId },
      data: dto,
    });
  }

  async remove(userId: number, carId: number) {
    await this.findOne(userId, carId);
    return this.prisma.car.delete({
      where: { id: carId },
    });
  }
}
