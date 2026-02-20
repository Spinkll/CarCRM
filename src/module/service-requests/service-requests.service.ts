import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';

@Injectable()
export class ServiceRequestsService {
  constructor(private prisma: PrismaService) {}

  // 1. Клиент создает заявку
  async createRequest(clientId: number, carId: number, reason: string) {
    // Проверяем, принадлежит ли машина клиенту
    const car = await this.prisma.car.findUnique({ where: { id: carId } });
    if (!car || car.userId !== clientId) {
      throw new BadRequestException('Автомобіль не знайдено або він не належить вам');
    }

    return this.prisma.serviceRequest.create({
      data: {
        clientId,
        carId,
        reason,
        status: 'NEW',
      },
    });
  }

  async findAll() {
    return this.prisma.serviceRequest.findMany({
      include: {
        client: { select: { id: true, firstName: true, lastName: true, phone: true } },
        car: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 3. Получить заявки конкретного клиента
  async findByClient(clientId: number) {
    return this.prisma.serviceRequest.findMany({
      where: { clientId },
      include: { car: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 4. ОДОБРИТЬ И ЗАПИСАТЬ (Транзакция)
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

      // Создаем Заказ
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

      // Создаем Запись (Appointment) в календарь
      await tx.appointment.create({
        data: {
          orderId: order.id,
          scheduledAt: new Date(dto.scheduledAt),
          estimatedMin: dto.estimatedMin || 60, // По умолчанию 1 час
          status: 'SCHEDULED',
        }
      });

      // Обновляем заявку
      await tx.serviceRequest.update({
        where: { id: requestId },
        data: {
          status: 'PROCESSED',
          orderId: order.id,
        }
      });

      // История заказа
      await tx.orderHistory.create({
        data: {
          orderId: order.id,
          changedById: managerId,
          action: 'ORDER_CREATED',
          comment: `Заказ створений із заявки #${requestId}`
        }
      });

      // Уведомление клиенту (если есть notifications.service, можно вызвать его)
      await tx.notification.create({
        data: {
          userId: request.clientId,
          title: 'Заявка одобрена',
          message: `Ваш визит назначен на ${new Date(dto.scheduledAt).toLocaleString('uk-UA')}`,
          type: 'APPOINTMENT',
          orderId: order.id
        }
      });

      return order;
    });
  }

  // 5. Отклонить заявку
  async rejectRequest(requestId: number) {
    return this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' },
    });
  }
}