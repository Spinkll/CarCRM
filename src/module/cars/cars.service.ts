import { 
  Injectable, 
  NotFoundException, 
  ConflictException, 
  InternalServerErrorException, 
  BadRequestException,
  ForbiddenException
} from '@nestjs/common';
import { Prisma, UserRole } from 'generated/prisma/client';
import { PrismaClientKnownRequestError } from 'generated/prisma/internal/prismaNamespace';
import { PrismaService } from 'src/db/prisma.service';
import { CreateCarDto } from 'src/dto/create-car.dto';
import { GetCarHistoryDto } from 'src/dto/get-car-history.dto';
import { UpdateCarDto } from 'src/dto/update-car.dto';


@Injectable()
export class CarsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, role: string, dto: CreateCarDto) {
    // Якщо клієнт намагається додати авто, перевіряємо чи немає в нього "тимчасових" машин
    if (role === 'CLIENT') {
      const hasTempCar = await this.prisma.car.findFirst({
        where: {
          userId: userId,
          OR: [
            { vin: { startsWith: 'TEMP-' } },
            { plate: { startsWith: 'TEMP-' } },
            { year: 0 }
          ]
        }
      });

      if (hasTempCar) {
        throw new BadRequestException('Ви не можете додати новий автомобіль, поки не заповните дані про свій існуючий (VIN, номер, рік).');
      }
    }

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
          const target = (error.meta?.target as any) || [];
          const field = Array.isArray(target) ? target.join(', ') : target;
          throw new ConflictException(`Транспортний засіб з таким ${field || 'VIN-кодом або номерним знаком'} вже існує в базі.`);
        }
      }
      throw new InternalServerErrorException('Помилка при створенні автомобіля');
    }
  }

  
  async findAll(userId: number, role: UserRole) {
    const userRole = (role?.toString() || '').toUpperCase();

    // 1. КЛІЄНТ: бачить тільки свої АКТИВНІ авто
    if (userRole === 'CLIENT') {
      return this.prisma.car.findMany({
        where: { 
          userId: userId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    // 2. МЕХАНІК: бачить АКТИВНІ авто, в яких він є виконавцем замовлення
    if (userRole === 'MECHANIC') {
      return this.prisma.car.findMany({
        where: {
          deletedAt: null,
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

    // 3. АДМІН / МЕНЕДЖЕР: бачать всі АКТИВНІ авто на СТО
    return this.prisma.car.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: number, carId: number, role: UserRole) {
    try {
      const whereClause: any = { id: carId };
      
      const userRole = (role?.toString() || '').toUpperCase();
      
      if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
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
    const car = await this.findOne(userId, carId, role);

    const userRole = (role?.toString() || '').toUpperCase();

    // CLIENT може оновлювати тільки свої авто
    if (userRole === 'CLIENT' && car.userId !== userId) {
      throw new ForbiddenException('Ви не можете редагувати чужий автомобіль');
    }

    // CLIENT не може змінювати пробіг — тільки ADMIN/MANAGER
    if (userRole === 'CLIENT') {
      delete dto.mileage;
    }

    try {
      return await this.prisma.car.update({
        where: { id: carId },
        data: dto,
      });
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          const target = (error.meta?.target as any) || [];
          const field = Array.isArray(target) ? target.join(', ') : target;
          throw new ConflictException(`Транспортний засіб з таким ${field || 'VIN-кодом або номерним знаком'} вже існує в базі.`);
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('Машину для оновлення не знайдено.');
        }
      }
      throw new InternalServerErrorException('Помилка при оновленні автомобіля');
    }
  }

  async getCarHistory(carId: number, filters: GetCarHistoryDto) {
    // 1. Перевіряємо, чи існує автомобіль і чи не видалений він
    const car = await this.prisma.car.findUnique({
      where: { id: carId },
      include: { user: true } // Одразу підтягнемо власника для шапки
    });

    if (!car) {
      throw new NotFoundException('Автомобіль не знайдено');
    }

    // 2. Збираємо динамічні фільтри для замовлень
    const whereClause: Prisma.OrderWhereInput = {
      carId: carId,
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
        engine: car.engine,
        fuelType: car.fuelType,
        bodyClass: car.bodyClass,
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
        items: order.items.map(item => ({
          ...item,
          price: Number(item.price)
        }))
      }))
    };
    
  }

  async decodeVin(vin: string) {
    if (!vin || vin.length !== 17) {
      throw new BadRequestException('VIN-код має містити рівно 17 символів');
    }

    try {
      const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${vin}?format=json`);
      const data = await response.json();
      const results = data.Results;
      
      const getVar = (name: string) => {
        const item = results.find((r: any) => r.Variable === name);
        return item && item.Value && item.Value !== 'Not Applicable' ? item.Value : null;
      };

      // 1. Отримуємо сирі англійські дані
      const rawFuelType = getVar('Fuel Type - Primary');
      const rawBodyClass = getVar('Body Class');

      // 2. Словник для типу пального
      const translateFuel = (fuel: string | null) => {
        if (!fuel) return null;
        const f = fuel.toLowerCase();
        if (f.includes('gasoline')) return 'Бензин';
        if (f.includes('diesel')) return 'Дизель';
        if (f.includes('electric')) return 'Електро';
        if (f.includes('hybrid')) return 'Гібрид';
        if (f.includes('liquefied petroleum gas') || f.includes('lpg')) return 'Газ (ГБО)';
        if (f.includes('compressed natural gas') || f.includes('cng')) return 'Газ (Метан)';
        return fuel; // Якщо щось невідоме, повертаємо як є
      };

      // 3. Словник для типу кузова
      const translateBody = (body: string | null) => {
        if (!body) return null;
        const b = body.toLowerCase();
        if (b.includes('sedan') || b.includes('saloon')) return 'Седан';
        if (b.includes('suv') || b.includes('sport utility')) return 'Кросовер / Позашляховик';
        if (b.includes('hatchback')) return 'Хетчбек';
        if (b.includes('coupe')) return 'Купе';
        if (b.includes('pickup')) return 'Пікап';
        if (b.includes('wagon')) return 'Універсал';
        if (b.includes('van') || b.includes('minivan')) return 'Мінівен / Фургон';
        if (b.includes('convertible')) return 'Кабріолет';
        return body; 
      };

      const engineLiters = getVar('Displacement (L)');

      // 4. Формуємо фінальний об'єкт з перекладом
      const decodedCar = {
        vin: vin.toUpperCase(),
        brand: getVar('Make'), // Залишаємо англійською (BMW, Nissan)
        model: getVar('Model'), // Залишаємо англійською (X5, Juke)
        year: parseInt(getVar('Model Year'), 10) || null,
        engineVolume: engineLiters ? `${engineLiters} л.` : null, // Додаємо красиве "л."
        fuelType: translateFuel(rawFuelType), // Перекладено!
        bodyClass: translateBody(rawBodyClass), // Перекладено!
      };

      if (!decodedCar.brand) {
        throw new BadRequestException('Не вдалося розшифрувати цей VIN-код. Перевірте правильність вводу.');
      }

      return decodedCar;
    } catch (error) {
      throw new BadRequestException('Помилка при розшифровці VIN-коду: ' + error.message);
    }
  }

  async deleteCar(id: number, userId: number, role: string) {
    // 1. Знаходимо авто і рахуємо, чи є в нього пов'язані документи
    const car = await this.prisma.car.findUnique({
      where: { id },
      include: { 
        _count: { 
          select: { orders: true, serviceRequests: true } 
        } 
      }
    });

    // Якщо машини немає
    if (!car) {
      throw new NotFoundException('Автомобіль не знайдено');
    }

    // 2. Перевірка прав доступу
    if (role === 'CLIENT' && car.userId !== userId) {
      throw new ForbiddenException('Ви не можете видалити чужий автомобіль');
    }

    // 3. РОЗУМНЕ ВИДАЛЕННЯ
    const hasHistory = car._count.orders > 0 || car._count.serviceRequests > 0;

    if (hasHistory) {
      // Є історія -> М'яке видалення (ховаємо)
      return this.prisma.car.update({
        where: { id },
        data: { deletedAt: new Date() }, // Записуємо час видалення
      });
    } else {
      // Історії немає -> Повне фізичне видалення (стираємо)
      return this.prisma.car.delete({
        where: { id },
      });
    }
  }
}


