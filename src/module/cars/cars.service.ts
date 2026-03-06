import { 
  Injectable, 
  NotFoundException, 
  ConflictException, 
  InternalServerErrorException, 
  BadRequestException,
  ForbiddenException
} from '@nestjs/common';
import { Prisma } from 'generated/prisma/browser';

import { UserRole } from 'generated/prisma/client';
import { PrismaClientKnownRequestError } from 'generated/prisma/internal/prismaNamespace';
import { PrismaService } from 'src/db/prisma.service';
import { CreateCarDto } from 'src/dto/create-car.dto';
import { GetCarHistoryDto } from 'src/dto/get-car-history.dto';
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

  async getCarHistory(carId: number, filters: GetCarHistoryDto) {
    // 1. Перевіряємо, чи існує автомобіль і чи не видалений він
    const car = await this.prisma.car.findUnique({
      where: { id: carId, deletedAt: null },
      include: { user: true } // Одразу підтягнемо власника для шапки
    });

    if (!car) {
      throw new NotFoundException('Автомобіль не знайдено');
    }

    // 2. Збираємо динамічні фільтри для замовлень
    const whereClause: Prisma.OrderWhereInput = {
      carId: carId,
      deletedAt: null, // Ігноруємо видалені замовлення
      // Можеш додати статус, якщо хочеш показувати ТІЛЬКИ завершені:
      // status: 'COMPLETED',
    };

    // Фільтр по даті створення або завершення
    if (filters.startDate || filters.endDate) {
      whereClause.createdAt = {}; // Шукаємо по даті створення замовлення
      if (filters.startDate) whereClause.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) whereClause.createdAt.lte = new Date(filters.endDate);
    }

    // Фільтр по вартості
    if (filters.minAmount || filters.maxAmount) {
      whereClause.totalAmount = {};
      if (filters.minAmount) whereClause.totalAmount.gte = parseFloat(filters.minAmount);
      if (filters.maxAmount) whereClause.totalAmount.lte = parseFloat(filters.maxAmount);
    }

    // 3. Робимо запит до бази
    const history = await this.prisma.order.findMany({
      where: whereClause,
      orderBy: {
        createdAt: 'desc', // Найновіші заїзди будуть зверху (ідеально для таймлайну)
      },
      include: {
        items: true,      // Підтягуємо список виконаних робіт і запчастин (OrderItem)
        mechanic: {       // Хто робив машину
          select: { id: true, firstName: true, lastName: true }
        },
        manager: {        // Хто приймав замовлення
          select: { id: true, firstName: true, lastName: true }
        }
      }
    });

    // 4. Формуємо красиву відповідь для фронтенду
    return {
      carInfo: {
        id: car.id,
        fullName: `${car.brand} ${car.model}`,
        year: car.year,
        vin: car.vin,
        plate: car.plate,
        color: car.color,
        currentMileage: car.mileage,
        owner: car.user ? `${car.user.firstName} ${car.user.lastName}` : 'Невідомо',
      },
      totalOrders: history.length,
      // Рахуємо загальну суму, яку клієнт витратив на цю машину
      totalSpent: history.reduce((sum, order) => sum + Number(order.totalAmount), 0),
      timeline: history.map(order => ({
        orderId: order.id,
        status: order.status,
        date: order.createdAt,
        completedAt: order.completedAt,
        mileageAtOrder: order.mileage,
        description: order.description,
        totalAmount: Number(order.totalAmount), // Prisma Decimal треба перетворити в Number для JSON
        mechanic: order.mechanic,
        items: order.items // Тут лежать твої послуги та запчастини
      }))
    };
  }
}

