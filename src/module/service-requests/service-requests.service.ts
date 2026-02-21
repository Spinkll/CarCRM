import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ServiceRequestsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService
  ) {}

  // 1. Клієнт створює заявку
  async createRequest(clientId: number, carId: number, reason: string) {
    // Перевіряємо, чи належить машина клієнту
    const car = await this.prisma.car.findUnique({ where: { id: carId } });
    if (!car || car.userId !== clientId) {
      throw new BadRequestException('Автомобіль не знайдено або він не належить вам');
    }

    // ВИПРАВЛЕННЯ 1: Спочатку створюємо запис у БД
    const request = await this.prisma.serviceRequest.create({
      data: {
        clientId,
        carId,
        reason,
        status: 'NEW',
      },
    });

    // ПОТІМ відправляємо сповіщення адмінам/менеджерам
    await this.notifications.notifyByRoles(
      ['ADMIN', 'MANAGER'], 
      'Нова заявка на сервіс', 
      `Клієнт створив нову заявку для авто ${car.brand} ${car.model}. Причина: ${reason}`, 
      'NEW_REQUEST'
    );

    return request;
  }

  // 2. Отримати всі заявки
  async findAll() {
    return this.prisma.serviceRequest.findMany({
      include: {
        client: { select: { id: true, firstName: true, lastName: true, phone: true } },
        car: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 3. Отримати заявки конкретного клієнта
  async findByClient(clientId: number) {
    return this.prisma.serviceRequest.findMany({
      where: { clientId },
      include: { car: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 4. ОДОБРИТИ ТА ЗАПИСАТИ (Транзакція)
  async approveAndSchedule(requestId: number, managerId: number, dto: { 
    scheduledAt: string; 
    estimatedMin?: number; 
    mechanicId?: number; 
    description?: string 
  }) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.serviceRequest.findUnique({
        where: { id: requestId },
        include: { car: true }
      });

      if (!request) throw new NotFoundException('Заявка не знайдена');
      if (request.status !== 'NEW' && request.status !== 'IN_REVIEW') {
        throw new BadRequestException('Цю заявку вже опрацювали');
      }

      // Створюємо Замовлення (Order)
      const order = await tx.order.create({
        data: {
          carId: request.carId,
          managerId,
          mechanicId: dto.mechanicId || null,
          mileage: request.car.mileage,
          description: dto.description || request.reason,
          status: 'CONFIRMED',
        }
      });

      // Створюємо Запис (Appointment) у календар
      await tx.appointment.create({
        data: {
          orderId: order.id,
          scheduledAt: new Date(dto.scheduledAt),
          estimatedMin: dto.estimatedMin || 60, 
          status: 'SCHEDULED',
        }
      });

      // Оновлюємо статус заявки
      await tx.serviceRequest.update({
        where: { id: requestId },
        data: {
          status: 'PROCESSED',
          orderId: order.id,
        }
      });

      // Історія замовлення
      await tx.orderHistory.create({
        data: {
          orderId: order.id,
          changedById: managerId,
          action: 'ORDER_CREATED',
          comment: `Замовлення створене із заявки #${requestId}`
        }
      });

      // Сповіщення клієнту про підтвердження візиту
      await tx.notification.create({
        data: {
          userId: request.clientId,
          title: 'Вашу заявку схвалено!',
          message: `Візит призначено на ${new Date(dto.scheduledAt).toLocaleString('uk-UA')}. Чекаємо на вас!`,
          type: 'REQUEST_APPROVED',
          orderId: order.id
        }
      });

      return order;
    });
  }

  // 5. ВІДХИЛИТИ заявку
  async rejectRequest(requestId: number) {
    // ВИПРАВЛЕННЯ 2: Зберігаємо оновлену заявку в змінну, підтягуємо авто
    const request = await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' },
      include: { car: true } 
    });

    // Сповіщаємо клієнта, що його заявку відхилено
    await this.notifications.create(
      request.clientId,
      'Заявку відхилено',
      `Вашу заявку на обслуговування авто ${request.car.brand} ${request.car.model} було відхилено. Будь ласка, зв'яжіться з нами для уточнення деталей.`,
      'REQUEST_REJECTED'
    );

    return request;
  }
}