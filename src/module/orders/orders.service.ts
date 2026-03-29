import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto } from 'src/dto/create-order.dto';
import { AssignOrderDto } from 'src/dto/assign-order.dto';
import { CreateOrderItemDto } from 'src/dto/create-order-item.dto';
import { CreateQuickOrderDto } from 'src/dto/create-quick-order.dto';
import { OrderStatus, UserRole } from 'generated/prisma/enums';
import { NotificationsService } from '../notifications/notifications.service';
import PDFDocument = require('pdfkit');
import { CreateReviewDto } from 'src/dto/create-review.dto';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

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

  async create(userId: number, role: UserRole, dto: CreateOrderDto) {
    const car = await this.prisma.car.findUnique({ where: { id: dto.vehicleId } });
    if (!car) throw new NotFoundException('Автомобіль не знайдено');

    // Перевірка на тимчасові авто
    if (role === 'CLIENT') {
      const hasTempCar = await this.prisma.car.findFirst({
        where: {
          userId: userId,
          deletedAt: null,
          OR: [
            { vin: { startsWith: 'TEMP-' } },
            { plate: { startsWith: 'TEMP-' } },
            { year: 0 }
          ]
        }
      });

      if (hasTempCar) {
        throw new BadRequestException('Ви не можете створити нове замовлення, поки не заповните дані про свій існуючий автомобіль (VIN, номер, рік).');
      }
    }

    // Перевірка прав
    if (role === 'CLIENT' && car.userId !== Number(userId)) {
      throw new ForbiddenException(`Ви не можете створити замовлення на чужий автомобіль (Власник: ${car.userId}, Ви: ${userId})`);
    }

    // 👇 ДОДАНО: Перевірка на "скручений" або помилковий пробіг
    if (dto.mileage && dto.mileage < car.mileage) {
      throw new BadRequestException(`Вказаний пробіг (${dto.mileage} км) менший за поточний (${car.mileage} км)`);
    }

    const currentMileage = dto.mileage || car.mileage;

    const order = await this.prisma.$transaction(async (tx) => {
      // 1. Створюємо замовлення
      const createdOrder = await tx.order.create({
        data: {
          carId: dto.vehicleId,
          mileage: currentMileage,
          description: dto.description,
          totalAmount: 0,
          status: 'CONFIRMED',
        },
      });

      // 👇 ДОДАНО: Оновлюємо загальний пробіг машини, якщо він виріс
      if (currentMileage > car.mileage) {
        await tx.car.update({
          where: { id: car.id },
          data: { mileage: currentMileage },
        });
      }

      // 3. Створюємо запис у календарі (якщо є дата)
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

      // 4. Записуємо історію
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

    // Сповіщення власнику, якщо створював не він
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

  async quickCreate(managerId: number, dto: CreateQuickOrderDto) {
    const ts = Date.now();
    const rnd = crypto.randomBytes(3).toString('hex'); // extra uniqueness

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Нормалізуємо вхідний телефон до цифр
      const inputDigits = dto.clientPhone.replace(/\D/g, '');
      const last10 = inputDigits.slice(-10);

      // 2. Шукаємо існуючого клієнта — порівнюємо останні 10 цифр
      const allClients = await tx.user.findMany({
        where: { role: 'CLIENT' },
        select: { id: true, phone: true, firstName: true, lastName: true },
      });

      let client = allClients.find((c) => {
        const dbDigits = (c.phone || '').replace(/\D/g, '');
        return dbDigits === inputDigits || (last10.length >= 10 && dbDigits.endsWith(last10));
      }) as any;

      // 3. Якщо клієнта немає — створюємо з мінімальними даними
      if (!client) {
        const nameParts = dto.clientName.trim().split(/\s+/);
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || 'Невідомо';
        const tempEmail = `temp-${ts}@placeholder.local`;
        const rawPassword = crypto.randomBytes(4).toString('hex');
        const hashedPassword = await bcrypt.hash(rawPassword, 10);

        client = await tx.user.create({
          data: {
            firstName,
            lastName,
            phone: dto.clientPhone,
            email: tempEmail,
            password: hashedPassword,
            role: 'CLIENT',
            isVerified: false,
          },
        });
      }

      // 4. Створюємо авто з placeholder-ами для обов'язкових полів
      const car = await tx.car.create({
        data: {
          brand: dto.carBrand,
          model: dto.carModel || 'Невідомо',
          year: 0,
          vin: `TEMP-${ts}-${rnd}`,
          plate: `TEMP-${ts}-${rnd}`,
          color: 'Невідомо',
          mileage: 0,
          userId: client.id,
        },
      });

      // 4. Створюємо замовлення
      const order = await tx.order.create({
        data: {
          carId: car.id,
          managerId,
          mileage: 0,
          description: dto.description,
          totalAmount: 0,
          status: 'CONFIRMED',
        },
      });

      // 5. Створюємо запис у календарі (якщо є час)
      if (dto.scheduledAt) {
        await tx.appointment.create({
          data: {
            orderId: order.id,
            scheduledAt: new Date(dto.scheduledAt),
            estimatedMin: dto.estimatedMin || 60,
            status: 'SCHEDULED',
          },
        });
      }

      // 6. Записуємо історію
      await tx.orderHistory.create({
        data: {
          orderId: order.id,
          changedById: managerId,
          action: 'ORDER_CREATED',
          comment: `Швидкий запис: ${dto.clientName}, ${dto.carBrand}${dto.carModel ? ' ' + dto.carModel : ''} — "${dto.description}"`,
        },
      });

      return { order, car, client };
    });

    return result.order;
  }

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
      review: true,
    };

    const where: any = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.mechanicId) where.mechanicId = filters.mechanicId;
    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    const userRole = (role?.toString() || '').toUpperCase();

    if (userRole === 'ADMIN' || userRole === 'MANAGER') {
      return this.prisma.order.findMany({ where, include: includeOptions, orderBy: { createdAt: 'desc' } });
    }

    if (userRole === 'MECHANIC') {
      return this.prisma.order.findMany({ where: { ...where, mechanicId: userId }, include: includeOptions, orderBy: { createdAt: 'desc' } });
    }

    return this.prisma.order.findMany({
      where: { ...where, car: { userId: userId } },
      include: includeOptions,
      orderBy: { createdAt: 'desc' },
    });
  }

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
        review: true,
      },
    });

    if (!order) throw new NotFoundException('Замовлення не знайдено');
    if (role === UserRole.CLIENT && order.car.userId !== userId) throw new ForbiddenException('Доступ заборонено');

    return order;
  }

  async updateStatus(userId: number, id: number, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        car: { select: { userId: true } },
        appointments: true,
      }
    });
    if (!order) throw new NotFoundException('Замовлення не знайдено');

    const actor = await this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    const oldStatus = order.status;

    // ОБМЕЖЕННЯ: Відновлювати скасоване замовлення може тільки Співробітник
    if (oldStatus === OrderStatus.CANCELLED && dto.status !== OrderStatus.CANCELLED) {
      if (actor?.role === UserRole.CLIENT) {
        throw new ForbiddenException('Клієнт не може самостійно відновлювати скасоване замовлення. Зверніться до адміністратора.');
      }
    }

    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      const data: any = { status: dto.status };

      if (dto.status === OrderStatus.COMPLETED && !order.completedAt) {
        data.completedAt = new Date();
      }

      // Якщо замовлення "оживає" зі скасованого
      if (oldStatus === OrderStatus.CANCELLED && (dto.status === OrderStatus.CONFIRMED || dto.status === OrderStatus.IN_PROGRESS)) {
        // Оновлюємо також статус запису в календарі, якщо він був пропущений
        await tx.appointment.updateMany({
          where: { orderId: id, status: 'NO_SHOW' },
          data: { status: 'SCHEDULED' }
        });
      }

      const result = await tx.order.update({ where: { id }, data });

      await tx.orderHistory.create({
        data: {
          orderId: id,
          changedById: userId,
          action: 'STATUS_UPDATED',
          oldValue: oldStatus,
          newValue: dto.status,
          comment: oldStatus === OrderStatus.CANCELLED
            ? `Замовлення ВІДНОВЛЕНО: ${STATUS_LABELS[dto.status] || dto.status}`
            : `Статус змінено: ${STATUS_LABELS[oldStatus] || oldStatus} → ${STATUS_LABELS[dto.status] || dto.status}`,
        },
      });

      return result;
    });

    const notifyIds = new Set<number>();
    notifyIds.add(order.car.userId); // Клієнт
    if (updatedOrder.managerId) notifyIds.add(updatedOrder.managerId);
    if (updatedOrder.mechanicId) notifyIds.add(updatedOrder.mechanicId);

    notifyIds.delete(userId);

    if (notifyIds.size > 0) {
      this.notifications.notifyMany(
        Array.from(notifyIds),
        oldStatus === OrderStatus.CANCELLED ? 'Замовлення відновлено' : 'Статус замовлення змінено',
        `Замовлення #${id} перейшло у статус: ${STATUS_LABELS[dto.status] || dto.status}`,
        'STATUS_CHANGED',
        id,
      ).catch((e) => console.error('Помилка масового сповіщення:', e));
    }

    return updatedOrder;
  }

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
          action: 'TEAM_ASSIGNED',
          comment: changes.join('; '),
        },
      });

      return result;
    });

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

  async addItem(userId: number, orderId: number, dto: CreateOrderItemDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Замовлення не знайдено');

    const itemType = dto.type || (dto.partId ? 'PART' : 'SERVICE');
    const quantity = dto.quantity || 1;

    return this.prisma.$transaction(async (tx) => {
      let currentCostPrice = 0;

      if (itemType === 'SERVICE') {
        if (dto.serviceId) {
          const service = await tx.service.findUnique({ where: { id: dto.serviceId } });
          if (!service) throw new NotFoundException('Послугу не знайдено');
        }

        let mechanicRate = 30;

        if (dto.mechanicId) {
          const mechanic = await tx.user.findUnique({
            where: { id: dto.mechanicId },
            select: { commissionRate: true }
          });

          if (mechanic && mechanic.commissionRate) {
            mechanicRate = mechanic.commissionRate;
          }
        }

        currentCostPrice = (Number(dto.price || 0) * mechanicRate) / 100;
      }

      if (itemType === 'PART' && dto.partId) {
        const part = await tx.part.findUnique({ where: { id: dto.partId } });
        if (!part) throw new NotFoundException('Запчастину не знайдено');

        if (part.stockQuantity < quantity) {
          throw new BadRequestException(`Недостатньо на складі! Залишок: ${part.stockQuantity} шт.`);
        }

        currentCostPrice = Number(part.purchasePrice) || 0;

        await tx.part.update({
          where: { id: part.id },
          data: { stockQuantity: { decrement: quantity } },
        });
      }

      const item = await tx.orderItem.create({
        data: {
          orderId,
          serviceId: dto.serviceId || null,
          partId: dto.partId || null,
          name: dto.name,
          quantity: quantity,
          price: dto.price,
          type: itemType,
          mechanicId: dto.mechanicId || null,
          costPrice: currentCostPrice,
        },
        include: { service: true, part: true },
      });

      await this.recalcTotal(tx, orderId);

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

 async generateWorkOrderPdf(orderId: number): Promise<Buffer> {
    // 1. Отримуємо дані про замовлення
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        car: { include: { user: true } },
        items: true,
      },
    });

    if (!order) throw new NotFoundException('Замовлення не знайдено');

    // 2. Отримуємо налаштування компанії (беремо перший запис, оскільки це Singleton)
    const settings = await this.prisma.companySettings.findFirst();
    
    // Формуємо динамічні дані для шапки (з фолбеками на випадок порожньої бази)
    const companyName = settings?.companyName || 'СТО "WAGGarage"';
    const city = settings?.city ? `${settings.city}, ` : '';
    const address = settings?.addressLine || 'вул. Не вказана';
    const phone = settings?.phone ? ` | тел. ${settings.phone}` : '';
    const edrpou = settings?.edrpou ? ` | ЄДРПОУ: ${settings.edrpou}` : '';

    const services = order.items.filter((i) => i.type === 'SERVICE');
    const parts = order.items.filter((i) => i.type === 'PART');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Підключаємо шрифт з підтримкою кирилиці
      const fontPath = require('path').join(process.cwd(), 'src', 'assets', 'fonts', 'Roboto-Regular.ttf');
      doc.font(fontPath);

      // ─── ШАПКА СТО (ДИНАМІЧНА) ───
      doc.fontSize(20).text(companyName, { align: 'center' });
      doc.fontSize(10).text(`${city}${address}${phone}${edrpou}`, { align: 'center' });
      
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1).stroke();
      doc.moveDown(1);

      // ─── НАЗВА ДОКУМЕНТА ───
      doc.fontSize(16).text(`ЗАКАЗ-НАРЯД № ${order.id}`, { align: 'center' });
      doc.fontSize(12).text('(Акт виконаних робіт / прийому-передачі авто)', { align: 'center' });
      doc.moveDown(1.5);

      // ─── ІНФОРМАЦІЯ ПРО КЛІЄНТА ТА АВТО ───
      const dateStr = new Date(order.createdAt).toLocaleDateString('uk-UA');
      
      const startBlockY = doc.y;

      // Ліва колонка (Клієнт)
      doc.fontSize(11);
      doc.text(`Дата оформлення: ${dateStr}`, 50, startBlockY); // x=50, y=startBlockY
      doc.text(`Клієнт: ${order.car.user.firstName} ${order.car.user.lastName}`, 50, doc.y + 15); // x=50, y=y+15
      doc.text(`Телефон: ${order.car.user.phone || '—'}`, 50, doc.y + 15); // x=50, y=y+15

      // Права колонка (Автомобіль)
      // Використовуємо той самий 'startBlockY', щоб вирівняти по горизонталі
      doc.text(`Автомобіль: ${order.car.brand} ${order.car.model}`, 300, startBlockY); // x=300, y=startBlockY. *Фікс!*
      // Тепер використовуємо відносний 'y' для інших рядків правої колонки
      doc.text(`Держ. номер: ${order.car.plate}`, 300, doc.y + 15); // x=300, y=y+15
      doc.text(`Пробіг: ${order.mileage || '—'} км`, 300, doc.y + 15); // x=300, y=y+15
      // Опис скарги/причини
      doc.moveDown(3);
      doc.fontSize(11).text(`Причина звернення: ${order.description || 'Планове ТО'}`, 50);
      doc.moveDown(1);

      // ─── ТАБЛИЦЯ РОБІТ ТА ЗАПЧАСТИН ───
      const colX = { name: 50, qty: 320, price: 380, sum: 460 };

      const drawTableHeader = () => {
        doc.fontSize(10).font(fontPath);
        const y = doc.y;
        doc.text('Найменування', colX.name, y);
        doc.text('К-ть', colX.qty, y);
        doc.text('Ціна', colX.price, y);
        doc.text('Сума', colX.sum, y);
        doc.moveDown(0.3);
        doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).stroke();
        doc.moveDown(0.3);
      };

      const drawItemRow = (item: (typeof order.items)[0]) => {
        const sum = (item.quantity * Number(item.price)).toFixed(2);
        const y = doc.y;
        doc.fontSize(10);
        doc.text(item.name, colX.name, y, { width: 260 });
        doc.text(item.quantity.toString(), colX.qty, y);
        doc.text(Number(item.price).toFixed(2), colX.price, y);
        doc.text(sum, colX.sum, y);
        doc.moveDown(0.3);
      };

      // Послуги
      if (services.length > 0) {
        doc.fontSize(12).text('Виконані роботи:', 50);
        doc.moveDown(0.3);
        drawTableHeader();
        services.forEach(drawItemRow);
        doc.moveDown(1);
      }

      // Запчастини
      if (parts.length > 0) {
        doc.fontSize(12).text('Встановлені запчастини:', 50);
        doc.moveDown(0.3);
        drawTableHeader();
        parts.forEach(drawItemRow);
        doc.moveDown(1);
      }

      // ─── ПІДСУМОК ДО СПЛАТИ ───
      const summaryY = doc.y;
      doc.moveTo(50, summaryY).lineTo(545, summaryY).lineWidth(1).stroke();
      doc.y = summaryY + 15;

      doc.fontSize(14).text(`ЗАГАЛОМ ДО СПЛАТИ: ${Number(order.totalAmount).toFixed(2)} грн`, 50, doc.y, {
        align: 'right',
        width: 495,
      });
      doc.moveDown(3);

      // ─── БЛОК ПІДПИСІВ ───
      doc.fontSize(10).text('Претензій щодо якості виконаних робіт та комплектності автомобіля не маю.', 50, doc.y);
      doc.moveDown(2);

      const signY = doc.y;
      doc.text('Автомобіль здав (Майстер):', 50, signY);
      doc.text('________________________', 50, signY + 15);

      doc.text('Автомобіль прийняв (Клієнт):', 350, signY);
      doc.text('________________________', 350, signY + 15);

      doc.end();
    });
  }

  async getOrderReview(orderId: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Замовлення не знайдено');

    // Якщо відгуку немає, поверне null (що ідеально для фронтенду)
    return this.prisma.review.findUnique({
      where: { orderId: orderId },
      include: {
        client: { select: { firstName: true, lastName: true } }
      }
    });
  }

  async createOrderReview(userId: number, role: string, orderId: number, dto: CreateReviewDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { car: true }
    });

    if (!order) throw new NotFoundException('Замовлення не знайдено');

    // Перевірка прав (клієнт може оцінити тільки своє авто)
    if (role === 'CLIENT' && order.car.userId !== userId) {
      throw new ForbiddenException('Ви можете залишити відгук лише на власне замовлення');
    }

    // Тільки закриті замовлення
    if (order.status !== 'COMPLETED' && order.status !== 'PAID') {
      throw new BadRequestException('Відгук можна залишити лише після завершення або оплати ремонту');
    }

    // Захист від подвійного відгуку
    const existingReview = await this.prisma.review.findUnique({
      where: { orderId: orderId }
    });

    if (existingReview) {
      throw new ConflictException('Відгук для цього замовлення вже існує');
    }

    return this.prisma.review.create({
      data: {
        rating: dto.rating,
        comment: dto.comment,
        orderId: order.id,
        clientId: order.car.userId,
      }
    });
  }
}