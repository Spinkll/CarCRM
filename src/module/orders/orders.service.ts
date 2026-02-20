import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto } from 'src/dto/create-order.dto';
import { AssignOrderDto } from 'src/dto/assign-order.dto';
import { CreateOrderItemDto } from 'src/dto/create-order-item.dto';
import { OrderStatus, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Очікує',
  CONFIRMED: 'Підтверджено',
  IN_PROGRESS: 'В роботі',
  WAITING_PARTS: 'Очікує запчастини',
  COMPLETED: 'Завершено',
  PAID: 'Оплачено',
  CANCELLED: 'Скасовано',
};

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) { }

  // --- СОЗДАНИЕ ЗАКАЗА (клиент) ---
  async create(userId: number, role: UserRole, dto: CreateOrderDto) {
    const car = await this.prisma.car.findUnique({ where: { id: dto.vehicleId } });
    if (!car) throw new NotFoundException('Автомобіль не знайдено');

    if (role === 'CLIENT' && car.userId !== Number(userId)) {
      throw new ForbiddenException(`Ви не можете створити замовлення на чужий автомобіль (Власник: ${car.userId}, Ви: ${userId})`);
    }

    const currentMileage = dto.mileage || car.mileage;

    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          carId: dto.vehicleId,
          mileage: currentMileage,
          description: dto.description,
          totalAmount: 0,
          status: 'PENDING',
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        },
      });

      await tx.orderHistory.create({
        data: {
          orderId: created.id,
          changedById: userId,
          action: 'ORDER_CREATED',
          comment: 'Замовлення створено через веб-інтерфейс',
        },
      });

      return created;
    });

    // Сповіщення адмінам та менеджерам
    const carInfo = `${car.brand} ${car.model}`.trim();
    this.notifications.notifyByRoles(
      [UserRole.ADMIN, UserRole.MANAGER],
      'Нове замовлення',
      `Створено замовлення #${order.id} на ${carInfo}: ${dto.description}`,
      'ORDER_CREATED',
      order.id,
    ).catch((e) => console.error('Помилка створення повідомлення:', e));

    return order;
  }

  // --- СПИСОК ЗАКАЗОВ (с фильтрацией) ---
  async findAll(userId: number, role: UserRole, filters?: {
    status?: OrderStatus;
    mechanicId?: number;
    from?: string;
    to?: string;
  }) {
    const includeOptions = {
      car: true,
      manager: { select: { id: true, firstName: true, lastName: true } },
      mechanic: { select: { id: true, firstName: true, lastName: true } },
      items: true,
    };

    // Базовый where для фильтрации
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.mechanicId) {
      where.mechanicId = filters.mechanicId;
    }
    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    if (role === UserRole.ADMIN || role === UserRole.MANAGER) {
      return this.prisma.order.findMany({
        where,
        include: includeOptions,
        orderBy: { createdAt: 'desc' },
      });
    }

    if (role === UserRole.MECHANIC) {
      return this.prisma.order.findMany({
        where: { ...where, mechanicId: userId },
        include: includeOptions,
        orderBy: { createdAt: 'desc' },
      });
    }

    // CLIENT — только свои заказы
    return this.prisma.order.findMany({
      where: {
        ...where,
        car: { userId: userId },
      },
      include: includeOptions,
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- ДЕТАЛИ ЗАКАЗА ---
  async findOne(userId: number, role: UserRole, id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        car: true,
        manager: { select: { id: true, firstName: true, lastName: true } },
        mechanic: { select: { id: true, firstName: true, lastName: true } },
        items: { include: { service: true, part: true } },
        tasks: true,
        payments: true,
        history: { include: { changedBy: { select: { firstName: true, lastName: true } } }, orderBy: { timestamp: 'desc' } },
      },
    });

    if (!order) throw new NotFoundException('Замовлення не знайдено');

    if (role === UserRole.CLIENT && order.car.userId !== userId) {
      throw new ForbiddenException('Доступ заборонено');
    }

    return order;
  }

  // --- СМЕНА СТАТУСА ---
  async updateStatus(userId: number, id: number, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Замовлення не знайдено');

    const oldStatus = order.status;

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const data: any = { status: dto.status };

      if (dto.status === OrderStatus.COMPLETED && !order.completedAt) {
        data.completedAt = new Date();
      }

      const result = await tx.order.update({
        where: { id },
        data,
      });

      await tx.orderHistory.create({
        data: {
          orderId: id,
          changedById: userId,
          action: 'STATUS_CHANGE',
          oldValue: oldStatus,
          newValue: dto.status,
          comment: `Статус змінено: ${STATUS_LABELS[oldStatus] || oldStatus} → ${STATUS_LABELS[dto.status] || dto.status}`,
        },
      });

      return result;
    });

    // Сповіщення клієнту (власнику авто)
    const orderWithCar = await this.prisma.order.findUnique({
      where: { id },
      include: { car: { select: { userId: true } } },
    });
    if (orderWithCar) {
      this.notifications.create(
        orderWithCar.car.userId,
        'Статус замовлення змінено',
        `Замовлення #${id}: ${STATUS_LABELS[dto.status] || dto.status}`,
        'STATUS_CHANGED',
        id,
      ).catch((e) => console.error('Помилка створення повідомлення:', e));
    }

    return updatedOrder;
  }

  // --- НАЗНАЧЕНИЕ МЕНЕДЖЕРА / МЕХАНИКА ---
  async assignOrder(userId: number, orderId: number, dto: AssignOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        manager: { select: { firstName: true, lastName: true } },
        mechanic: { select: { firstName: true, lastName: true } },
      },
    });
    if (!order) throw new NotFoundException('Замовлення не знайдено');

    if (!dto.managerId && !dto.mechanicId) {
      throw new BadRequestException('Вкажіть managerId або mechanicId');
    }

    // Проверяем и загружаем новых сотрудников
    let newManager: { firstName: string; lastName: string } | null = null;
    let newMechanic: { firstName: string; lastName: string } | null = null;

    if (dto.managerId) {
      const manager = await this.prisma.user.findUnique({ where: { id: dto.managerId } });
      if (!manager) throw new NotFoundException('Менеджера не знайдено');
      if (manager.role !== UserRole.MANAGER && manager.role !== UserRole.ADMIN) {
        throw new BadRequestException('Вказаний користувач не є менеджером');
      }
      newManager = manager;
    }

    if (dto.mechanicId) {
      const mechanic = await this.prisma.user.findUnique({ where: { id: dto.mechanicId } });
      if (!mechanic) throw new NotFoundException('Механіка не знайдено');
      if (mechanic.role !== UserRole.MECHANIC) {
        throw new BadRequestException('Вказаний користувач не є механіком');
      }
      newMechanic = mechanic;
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const updateData: any = {};
      const changes: string[] = [];

      if (dto.managerId && newManager) {
        updateData.managerId = dto.managerId;
        const oldName = order.manager
          ? `${order.manager.firstName} ${order.manager.lastName}`
          : 'не призначено';
        const newName = `${newManager.firstName} ${newManager.lastName}`;
        changes.push(`Менеджер: ${oldName} → ${newName}`);
      }
      if (dto.mechanicId && newMechanic) {
        updateData.mechanicId = dto.mechanicId;
        const oldName = order.mechanic
          ? `${order.mechanic.firstName} ${order.mechanic.lastName}`
          : 'не призначено';
        const newName = `${newMechanic.firstName} ${newMechanic.lastName}`;
        changes.push(`Механік: ${oldName} → ${newName}`);
      }

      const result = await tx.order.update({
        where: { id: orderId },
        data: updateData,
        include: {
          manager: { select: { id: true, firstName: true, lastName: true } },
          mechanic: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      await tx.orderHistory.create({
        data: {
          orderId,
          changedById: userId,
          action: 'ASSIGNMENT_CHANGE',
          comment: changes.join('; '),
        },
      });

      return result;
    });

    // Сповіщення призначеним співробітникам
    if (dto.managerId && newManager) {
      this.notifications.create(
        dto.managerId,
        'Вас призначено менеджером',
        `Вас призначено менеджером замовлення #${orderId}`,
        'ASSIGNMENT',
        orderId,
      ).catch((e) => console.error('Помилка створення повідомлення:', e));
    }
    if (dto.mechanicId && newMechanic) {
      this.notifications.create(
        dto.mechanicId,
        'Вас призначено механіком',
        `Вас призначено механіком замовлення #${orderId}`,
        'ASSIGNMENT',
        orderId,
      ).catch((e) => console.error('Помилка створення повідомлення:', e));
    }

    return updatedOrder;
  }

  // --- ДОБАВЛЕНИЕ ПОЗИЦИИ (услуга / запчасть) ---
  async addItem(userId: number, orderId: number, dto: CreateOrderItemDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Замовлення не знайдено');

    // Проверяем существование услуги, если указана
    if (dto.serviceId) {
      const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId } });
      if (!service) throw new NotFoundException('Послугу не знайдено');
    }

    // Проверяем существование запчасти, если указана
    if (dto.partId) {
      const part = await this.prisma.part.findUnique({ where: { id: dto.partId } });
      if (!part) throw new NotFoundException('Запчастину не знайдено');
    }

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.create({
        data: {
          orderId,
          serviceId: dto.serviceId || null,
          partId: dto.partId || null,
          name: dto.name,
          quantity: dto.quantity || 1,
          price: dto.price,
        },
        include: { service: true, part: true },
      });

      // Пересчитываем totalAmount
      await this.recalcTotal(tx, orderId);

      await tx.orderHistory.create({
        data: {
          orderId,
          changedById: userId,
          action: 'ITEM_ADDED',
          newValue: `${dto.name} x${dto.quantity || 1} — ${dto.price}`,
          comment: `Додано позицію: ${dto.name}`,
        },
      });

      return item;
    });
  }

  // --- УДАЛЕНИЕ ПОЗИЦИИ ---
  async removeItem(userId: number, orderId: number, itemId: number) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
    });
    if (!item) throw new NotFoundException('Позицію не знайдено');

    return this.prisma.$transaction(async (tx) => {
      await tx.orderItem.delete({ where: { id: itemId } });

      // Пересчитываем totalAmount
      await this.recalcTotal(tx, orderId);

      await tx.orderHistory.create({
        data: {
          orderId,
          changedById: userId,
          action: 'ITEM_REMOVED',
          oldValue: `${item.name} x${item.quantity} — ${item.price}`,
          comment: `Видалено позицію: ${item.name}`,
        },
      });

      return { message: 'Позицію видалено' };
    });
  }

  // --- ПЕРЕСЧЁТ TOTAL ---
  private async recalcTotal(tx: any, orderId: number) {
    const items = await tx.orderItem.findMany({ where: { orderId } });

    const total = items.reduce((sum: number, item: any) => {
      return sum + Number(item.price) * item.quantity;
    }, 0);

    await tx.order.update({
      where: { id: orderId },
      data: { totalAmount: total },
    });
  }
}