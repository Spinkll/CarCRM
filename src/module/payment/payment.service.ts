import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { CreatePaymentDto } from 'src/dto/create-payment.dto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import PDFDocument = require('pdfkit');

@Injectable()
export class PaymentService {
  constructor(private prisma: PrismaService) { }

  async processPayment(userId: number, orderId: number, dto: CreatePaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Знаходимо замовлення
      const order = await tx.order.findUnique({
        where: { id: orderId }
      });

      if (!order) throw new NotFoundException('Замовлення не знайдено');

      // 2. Валідація статусів
      if (order.status === 'PAID') {
        throw new BadRequestException('Це замовлення вже успішно оплачено');
      }
      if (order.status !== 'COMPLETED') {
        throw new BadRequestException('Оплатити можна тільки завершені замовлення (статус COMPLETED)');
      }

      const orderTotal = Number(order.totalAmount);

      // 3. ЖОРСТКА ПЕРЕВІРКА СУМИ (Тільки повна оплата)
      if (dto.amount !== orderTotal) {
        throw new BadRequestException(`До сплати приймається лише повна сума: ${orderTotal} грн. Ви передали: ${dto.amount} грн.`);
      }

      // 4. Створюємо запис про платіж (для чека)
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          amount: dto.amount,
          method: dto.method,
        },
      });

      // 5. Одразу оновлюємо статус замовлення на PAID
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'PAID' },
      });

      // 6. Записуємо одну красиву історію: зміна статусу + факт оплати
      await tx.orderHistory.create({
        data: {
          orderId: order.id,
          changedById: userId,
          action: 'PAYMENT_RECEIVED',
          oldValue: 'COMPLETED',
          newValue: 'PAID',
          comment: `Отримано повну оплату: ${dto.amount} грн (${dto.method}). Замовлення закрито.`,
        },
      });

      return {
        message: 'Оплата пройшла успішно, замовлення закрито',
        payment,
        isFullyPaid: true
      };
    });
  }

  // Метод для перегляду чека (залишаємо)
  async getOrderPayments(orderId: number) {
    return this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { paidAt: 'desc' },
    });
  }

  async generateReceiptPdf(orderId: number): Promise<Buffer> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        car: { include: { user: true } },
        items: true,
        payments: true,
      },
    });

    if (!order) throw new NotFoundException('Замовлення не знайдено');
    if (order.status !== 'PAID')
      throw new BadRequestException('Чек доступний тільки для оплачених замовлень');

    const payment = order.payments[0];
    const services = order.items.filter((i) => i.type === 'SERVICE');
    const parts = order.items.filter((i) => i.type === 'PART');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Шрифт з підтримкою кирилиці
      const fontPath = require('path').join(
        process.cwd(),
        'src',
        'assets',
        'fonts',
        'Roboto-Regular.ttf',
      );
      doc.font(fontPath);

      // ─── ШАПКА ───
      doc.fontSize(22).text('СТО "WAGGarage"', { align: 'center' });
      doc
        .fontSize(10)
        .text('м. Запоріжжя, вул. Шкільна, 32 | тел. +380 XX XXX XX XX', {
          align: 'center',
        });
      doc.moveDown(0.5);

      doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .lineWidth(1)
        .stroke();
      doc.moveDown(0.5);

      doc
        .fontSize(16)
        .text(`ЧЕК ОПЛАТИ № ${order.id}`, { align: 'center' });
      doc.moveDown();

      // ─── КЛІЄНТ / АВТО ───
      const dateStr = payment?.paidAt
        ? new Date(payment.paidAt).toLocaleDateString('uk-UA')
        : new Date().toLocaleDateString('uk-UA');

      doc.fontSize(11);
      doc.text(`Дата: ${dateStr}`);
      doc.text(
        `Клієнт: ${order.car.user.firstName} ${order.car.user.lastName}`,
      );
      doc.text(
        `Автомобіль: ${order.car.brand} ${order.car.model} (${order.car.plate})`,
      );
      doc.moveDown();

      // ─── HELPER: таблиця рядків ───
      const colX = { name: 50, qty: 320, price: 380, sum: 460 };

      const drawTableHeader = () => {
        doc.fontSize(10).font(fontPath);
        const y = doc.y;
        doc.text('Найменування', colX.name, y);
        doc.text('К-ть', colX.qty, y);
        doc.text('Ціна', colX.price, y);
        doc.text('Сума', colX.sum, y);
        doc.moveDown(0.3);
        doc
          .moveTo(50, doc.y)
          .lineTo(545, doc.y)
          .lineWidth(0.5)
          .stroke();
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
        doc.moveDown(0.2);
      };

      // ─── ПОСЛУГИ ───
      if (services.length > 0) {
        doc.fontSize(12).text('Послуги', 50);
        doc.moveDown(0.3);
        drawTableHeader();
        services.forEach(drawItemRow);
        doc.moveDown(0.5);
      }

      // ─── ЗАПЧАСТИНИ ───
      if (parts.length > 0) {
        doc.fontSize(12).text('Запчастини', 50);
        doc.moveDown(0.3);
        drawTableHeader();
        parts.forEach(drawItemRow);
        doc.moveDown(0.5);
      }

      // ─── ПІДСУМОК ───
      const summaryY = doc.y;
      doc.x = 50; // скинути x після таблиці

      doc
        .moveTo(50, summaryY)
        .lineTo(545, summaryY)
        .lineWidth(1)
        .stroke();
      doc.y = summaryY + 10;

      doc
        .fontSize(14)
        .text(`РАЗОМ: ${Number(order.totalAmount).toFixed(2)} грн`, 50, doc.y, {
          align: 'right',
          width: 495,
        });
      doc.moveDown(0.5);

      const methodMap: Record<string, string> = {
        CASH: 'Готівка',
        CARD: 'Картка',
        TRANSFER: 'Переказ',
      };
      const methodLabel = methodMap[payment?.method] ?? payment?.method ?? '—';

      doc.fontSize(10).text(`Тип оплати: ${methodLabel}`, 50, doc.y, {
        align: 'right',
        width: 495,
      });
      doc.moveDown(0.3);
      doc.text('Статус: ОПЛАЧЕНО', 50, doc.y, {
        align: 'right',
        width: 495,
      });

      doc.end();
    });
  }
}