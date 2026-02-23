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

  // --- СТВОРЕННЯ ЗАМОВЛЕННЯ ---
  async create(userId: number, role: UserRole, dto: CreateOrderDto) {
    const car = await this.prisma.car.findUnique({ where: { id: dto.vehicleId } });
    if (!car) throw new NotFoundException('Автомобіль не знайдено');

    if (role === 'CLIENT' && car.userId !== Number(userId)) {
      throw new ForbiddenException(`Ви не можете створити замовлення на чужий автомобіль (Власник: ${car.userId}, Ви: ${userId})`);
    }

    const currentMileage = dto.mileage || car.mileage;

    const order = await this.prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          carId: dto.vehicleId,
          mileage: currentMileage,
          description: dto.description,
          totalAmount: 0,
          status: 'CONFIRMED', 
        },
      });

      if (dto.scheduledAt) {
        await tx.appointment.create({
          data: {
            orderId: createdOrder.id,
            scheduledAt: new Date(dto.scheduledAt),
            estimatedMin: 60, 
            status: 'SCHEDULED', 
          }
        });
      }

      await tx.orderHistory.create({
        data: {
          orderId: createdOrder.id,
          changedById: userId,
          action: 'ORDER_CREATED',
          comment: 'Замовлення створено через веб-інтерфейс',
        },
      });

      return createdOrder;
    });

    // 🔔 СПОВІЩЕННЯ: Якщо замовлення створює менеджер або адмін, сповіщаємо клієнта
    if (role === 'ADMIN' || role === 'MANAGER') {
      this.notifications.create(
        car.userId,
        'Нове замовлення',
        `Для вашого авто ${car.brand} створено замовлення #${order.id}.`,
        'ORDER_CREATED',
        order.id
      ).catch(e => console.error('Помилка сповіщення:', e));
    }

    return order;
  }

  // --- СПИСОК ЗАМОВЛЕНЬ (без змін) ---
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

    const where: any = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.mechanicId) where.mechanicId = filters.mechanicId;
    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    if (role === UserRole.ADMIN || role === UserRole.MANAGER) {
      return this.prisma.order.findMany({ where, include: includeOptions, orderBy: { createdAt: 'desc' } });
    }

    if (role === UserRole.MECHANIC) {
      return this.prisma.order.findMany({ where: { ...where, mechanicId: userId }, include: includeOptions, orderBy: { createdAt: 'desc' } });
    }

    return this.prisma.order.findMany({
      where: { ...where, car: { userId: userId } },
      include: includeOptions,
      orderBy: { createdAt: 'desc' },
    });
  }

  // --- ДЕТАЛІ ЗАМОВЛЕННЯ (без змін) ---
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
    if (role === UserRole.CLIENT && order.car.userId !== userId) throw new ForbiddenException('Доступ заборонено');

    return order;
  }

  // --- ЗМІНА СТАТУСУ ---
  async updateStatus(userId: number, id: number, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({ 
      where: { id },
      include: { car: { select: { userId: true } } } 
    });
    if (!order) throw new NotFoundException('Замовлення не знайдено');

    const oldStatus = order.status;

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const data: any = { status: dto.status };
      if (dto.status === OrderStatus.COMPLETED && !order.completedAt) {
        data.completedAt = new Date();
      }

      const result = await tx.order.update({ where: { id }, data });

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

    // 🔔 СПОВІЩЕННЯ: Формуємо список отримувачів (Клієнт + Команда)
    const notifyIds = new Set<number>();
    notifyIds.add(order.car.userId); // Клієнт
    if (updatedOrder.managerId) notifyIds.add(updatedOrder.managerId); // Менеджер
    if (updatedOrder.mechanicId) notifyIds.add(updatedOrder.mechanicId); // Механік

    notifyIds.delete(userId); // Не сповіщати того, хто сам змінив статус!

    if (notifyIds.size > 0) {
      this.notifications.notifyMany(
        Array.from(notifyIds),
        'Статус замовлення змінено',
        `Замовлення #${id} перейшло у статус: ${STATUS_LABELS[dto.status] || dto.status}`,
        'STATUS_CHANGED',
        id,
      ).catch((e) => console.error('Помилка масового сповіщення:', e));
    }

    return updatedOrder;
  }

  // --- ПРИЗНАЧЕННЯ КОМАНДИ ---
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
        const oldName = order.manager ? `${order.manager.firstName} ${order.manager.lastName}` : 'не призначено';
        const newName = `${newManager.firstName} ${newManager.lastName}`;
        changes.push(`Менеджер: ${oldName} → ${newName}`);
      }
      if (dto.mechanicId && newMechanic) {
        updateData.mechanicId = dto.mechanicId;
        const oldName = order.mechanic ? `${order.mechanic.firstName} ${order.mechanic.lastName}` : 'не призначено';
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

    // 🔔 СПОВІЩЕННЯ: Призначеним співробітникам (якщо вони не призначали самі себе)
    if (dto.managerId && newManager && dto.managerId !== userId) {
      this.notifications.create(
        dto.managerId,
        'Нове призначення',
        `Вас призначено менеджером замовлення #${orderId}`,
        'ASSIGNMENT',
        orderId,
      ).catch((e) => console.error('Помилка сповіщення менеджера:', e));
    }
    
    if (dto.mechanicId && newMechanic && dto.mechanicId !== userId) {
      this.notifications.create(
        dto.mechanicId,
        'Нове призначення',
        `Вас призначено механіком замовлення #${orderId}`,
        'ASSIGNMENT',
        orderId,
      ).catch((e) => console.error('Помилка сповіщення механіка:', e));
    }

    return updatedOrder;
  }

  // --- ДОДАВАННЯ ТА ВИДАЛЕННЯ ПОЗИЦІЙ (без змін логіки сповіщень) ---
  async addItem(userId: number, orderId: number, dto: CreateOrderItemDto) {
    
    console.log('--- НОВА ПОЗИЦІЯ ---');
    console.log('DTO від фронтенду:', dto);

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Замовлення не знайдено');

    const itemType = dto.type || (dto.partId ? 'PART' : 'SERVICE');
    const quantity = dto.quantity || 1;

    // Починаємо транзакцію
    return this.prisma.$transaction(async (tx) => {
      let currentCostPrice = 0; // Собівартість для фіксації в чеку

      // 1. Обробка ПОСЛУГИ
      if (itemType === 'SERVICE' && dto.serviceId) {
        const service = await tx.service.findUnique({ where: { id: dto.serviceId } });
        if (!service) throw new NotFoundException('Послугу не знайдено');
        
        currentCostPrice = Number(service.costPrice) || 0;
      }

      // 2. Обробка ЗАПЧАСТИНИ (зі списанням зі складу)
      if (itemType === 'PART' && dto.partId) {
        const part = await tx.part.findUnique({ where: { id: dto.partId } });
        if (!part) throw new NotFoundException('Запчастину не знайдено');

        // Перевіряємо, чи вистачає деталей на складі
        if (part.stockQuantity < quantity) {
          throw new BadRequestException(`Недостатньо на складі! Залишок: ${part.stockQuantity} шт.`);
        }

        currentCostPrice = Number(part.purchasePrice) || 0;

        // Зменшуємо залишок на складі
        await tx.part.update({
          where: { id: part.id },
          data: { stockQuantity: { decrement: quantity } },
        });
      }

      // 3. Створюємо позицію в чеку
      const item = await tx.orderItem.create({
        data: {
          orderId,
          serviceId: dto.serviceId || null,
          partId: dto.partId || null,
          name: dto.name,
          quantity: quantity,
          price: dto.price,
          type: itemType,
          // Щоб розкоментувати наступний рядок, додай `costPrice Decimal?` у модель OrderItem
          // costPrice: currentCostPrice, 
        },
        include: { service: true, part: true },
      });

      // 4. Перераховуємо загальну суму замовлення
      await this.recalcTotal(tx, orderId);

      // 5. Записуємо історію
      const typeLabel = itemType === 'PART' ? 'запчастину' : 'послугу';
      await tx.orderHistory.create({
        data: {
          orderId,
          changedById: userId,
          action: 'ITEM_ADDED',
          newValue: `[${itemType}] ${dto.name} x${quantity} — ${dto.price}`,
          comment: `Додано ${typeLabel}: ${dto.name}`,
        },
      });

      return item;
    });
  }

  async removeItem(userId: number, orderId: number, itemId: number) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId },
    });
    if (!item) throw new NotFoundException('Позицію не знайдено');

    return this.prisma.$transaction(async (tx) => {
      if (item.type === 'PART' && item.partId) {
        await tx.part.update({
          where: { id: item.partId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }

      await tx.orderItem.delete({ where: { id: itemId } });

      await this.recalcTotal(tx, orderId);

      await tx.orderHistory.create({
        data: {
          orderId,
          changedById: userId,
          action: 'ITEM_REMOVED',
          oldValue: `${item.name} x${item.quantity} — ${item.price}`,
          comment: `Видалено позицію: ${item.name}${item.type === 'PART' ? ' (Повернуто на склад)' : ''}`,
        },
      });

      return { message: 'Позицію видалено' };
    });
  }

  private async recalcTotal(tx: any, orderId: number) {
    const items = await tx.orderItem.findMany({ where: { orderId } });
    const total = items.reduce((sum: number, item: any) => sum + Number(item.price) * item.quantity, 0);

    await tx.order.update({
      where: { id: orderId },
      data: { totalAmount: total },
    });
  }
}