import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ServiceRequestsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService
  ) {}

  async createRequest(clientId: number, carId: number, reason: string, scheduledAt?: string, mileage?: number) {
    const car = await this.prisma.car.findUnique({ where: { id: carId } });
    if (!car || car.userId !== clientId) {
      throw new BadRequestException('Автомобиль не найден или не принадлежит вам');
    }

    // Залишаємо лише захист "від дурня", щоб клієнт не ввів пробіг менший за той, що вже є в базі
    if (mileage && mileage < car.mileage) {
      throw new BadRequestException(`Вказаний пробіг (${mileage} км) менший за поточний (${car.mileage} км). Перевірте дані.`);
    }

    // 👇 БЛОК ЖЕСТКОГО РЕЗЕРВИРОВАНИЯ ВРЕМЕНИ 👇
    if (scheduledAt) {
      const requestedTime = new Date(scheduledAt);

      const isTimeLockedByRequest = await this.prisma.serviceRequest.findFirst({
        where: {
          scheduledAt: requestedTime,
          status: { notIn: ['REJECTED'] }
        }
      });

      const isTimeLockedByAppointment = await this.prisma.appointment.findFirst({
        where: {
          scheduledAt: requestedTime,
          status: { notIn: ['CANCELLED'] } 
        }
      });

      if (isTimeLockedByRequest || isTimeLockedByAppointment) {
        throw new ConflictException('Это время уже забронировано или находится на рассмотрении. Пожалуйста, выберите другое время.');
      }
    }
    // 👆 КОНЕЦ БЛОКА РЕЗЕРВИРОВАНИЯ 👆

    // 👇 Створюємо ТІЛЬКИ заявку. Базу машини не чіпаємо! 👇
    const request = await this.prisma.serviceRequest.create({
      data: {
        clientId,
        carId,
        reason,
        mileage: mileage || null, // 👈 Зберігаємо пробіг виключно як інформацію всередині заявки
        status: 'NEW',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      },
    });

    const timeInfo = scheduledAt ? ` Бажаний час: ${new Date(scheduledAt).toLocaleString('uk-UA')}` : '';
    const mileageInfo = mileage ? ` Заявлений пробіг: ${mileage} км.` : '';
    
    await this.notifications.notifyByRoles(
      ['ADMIN', 'MANAGER'], 
      'Нова заявка на сервіс', 
      `Клієнт створив нову заявку для авто ${car.brand} ${car.model}. Причина: ${reason}.${timeInfo}${mileageInfo}`, 
      'NEW_REQUEST'
    );

    return request;
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

  async findByClient(clientId: number) {
    return this.prisma.serviceRequest.findMany({
      where: { clientId },
      include: { car: true },
      orderBy: { createdAt: 'desc' },
    });
  }

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

      const targetTime = new Date(dto.scheduledAt);

      const isTimeSlotTaken = await tx.appointment.findFirst({
        where: {
          scheduledAt: targetTime,
          status: { notIn: ['CANCELLED'] } 
        }
      });

      if (isTimeSlotTaken) {
        throw new ConflictException('Неможливо схвалити: цей час у розкладі вже зайнятий іншим авто. Узгодьте з клієнтом інший час.');
      }

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

      await tx.appointment.create({
        data: {
          orderId: order.id,
          scheduledAt: new Date(dto.scheduledAt),
          estimatedMin: dto.estimatedMin || 60, 
          status: 'SCHEDULED',
        }
      });

      await tx.serviceRequest.update({
        where: { id: requestId },
        data: {
          status: 'PROCESSED',
          orderId: order.id,
        }
      });

      await tx.orderHistory.create({
        data: {
          orderId: order.id,
          changedById: managerId,
          action: 'ORDER_CREATED',
          comment: `Замовлення створене із заявки #${requestId}`
        }
      });

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

  async rejectRequest(requestId: number) {
    const request = await this.prisma.serviceRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' },
      include: { car: true } 
    });

    await this.notifications.create(
      request.clientId,
      'Заявку відхилено',
      `Вашу заявку на обслуговування авто ${request.car.brand} ${request.car.model} було відхилено. Будь ласка, зв'яжіться з нами для уточнення деталей.`,
      'REQUEST_REJECTED'
    );

    return request;
  }
}