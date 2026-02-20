import { 
  Injectable, 
  NotFoundException, 
  ConflictException, 
  InternalServerErrorException 
} from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { UserRole } from 'generated/prisma/client';
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
    try {
      if (role === 'ADMIN' || role === 'MANAGER') {
        return await this.prisma.car.findMany({
          include: { user: true },
        });
      }
      return await this.prisma.car.findMany({
        where: { userId: userId },
      });
    } catch (error) {
      throw new InternalServerErrorException('Помилка при отриманні списку автомобілів');
    }
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

  async remove(userId: number, carId: number, role: UserRole) {
    await this.findOne(userId, carId, role);

    try {
      return await this.prisma.car.delete({
        where: { id: carId },
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Машину для видалення не знайдено.');
        }
      }
      throw new InternalServerErrorException('Помилка при видаленні автомобіля');
    }
  }
}