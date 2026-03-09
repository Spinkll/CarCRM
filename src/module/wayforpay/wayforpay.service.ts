import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from 'src/db/prisma.service';

@Injectable()
export class WayforpayService {
  constructor(private prisma: PrismaService) { }

  async generatePaymentData(orderId: number) {
    const merchantAccount = process.env.WAYFORPAY_MERCHANT_ACCOUNT;
    const secretKey = process.env.WAYFORPAY_MERCHANT_SECRET_KEY;
    const frontendDomain = process.env.FRONTEND_DOMAIN;
    const backendDomain = process.env.BACKEND_DOMAIN;

    if (!merchantAccount || !secretKey) {
      throw new InternalServerErrorException('Помилка сервера: Не налаштовані ключі WayForPay в .env');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { car: true }
    });

    if (!order) throw new Error('Замовлення не знайдено');

    const orderReference = `ORDER_${order.id}_${Date.now()}`;
    const orderDate = Math.round(Date.now() / 1000);
    const amount = Number(order.totalAmount);
    const currency = 'UAH';

    const productName = [`Оплата замовлення #${order.id} (Авто: ${order.car.brand} ${order.car.plate})`];
    const productCount = [1];
    const productPrice = [amount];

    const stringToSign = [
      merchantAccount,
      frontendDomain,
      orderReference,
      orderDate,
      amount,
      currency,
      productName.join(';'),
      productCount.join(';'),
      productPrice.join(';')
    ].join(';');

    const merchantSignature = crypto
      .createHmac('md5', secretKey)
      .update(stringToSign)
      .digest('hex');

    return {
      merchantAccount,
      merchantDomainName: frontendDomain,
      merchantTransactionSecureType: 'AUTO',
      orderReference,
      orderDate,
      amount,
      currency,
      productName,
      productPrice,
      productCount,
      merchantSignature,
      returnUrl: `${frontendDomain}/api/wayforpay/return/${order.id}`,
      serviceUrl: `${backendDomain}/wayforpay/webhook`
    };
  }

  async handleWebhook(body: any) {
    // 👇 Зчитуємо секретний ключ і перевіряємо його наявність
    const secretKey = process.env.WAYFORPAY_MERCHANT_SECRET_KEY;
    if (!secretKey) {
      throw new InternalServerErrorException('Помилка сервера: Не налаштовано WAYFORPAY_MERCHANT_SECRET_KEY');
    }

    // 👇 Захищаємо бекенд від падіння, якщо прийшов порожній запит або бот
    if (!body || !body.orderReference) {
      throw new BadRequestException('Некоректний формат даних від WayForPay');
    }

    const isSuccess = body.transactionStatus === 'Approved';

    const orderIdString = body.orderReference.split('_')[1];
    const orderId = parseInt(orderIdString, 10);

    if (isSuccess && orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { car: true }
      });

      if (order && order.status !== 'PAID') {
        await this.prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: orderId },
            data: { status: 'PAID' },
          });

          await tx.payment.create({
            data: {
              orderId: orderId,
              amount: body.amount,
              method: "CARD"
            }
          });

          await tx.orderHistory.create({
            data: {
              orderId: orderId,
              changedById: order.car.userId,
              action: 'PAYMENT_RECEIVED',
              oldValue: order.status,
              newValue: 'PAID',
              comment: `Оплата онлайн через WayForPay: ${body.amount} ${body.currency}`,
            }
          });
        });
        console.log(`✅ Замовлення #${orderId} успішно оплачено на суму ${body.amount} ${body.currency}`);
      }
    } else {
      console.log(`❌ Помилка оплати замовлення #${orderId}: ${body.transactionStatus}`);
    }

    const time = Math.round(Date.now() / 1000);
    const signatureString = [body.orderReference, 'accept', time].join(';');

    // 👇 Тепер використовуємо локальну змінну secretKey замість this.secretKey
    const signature = crypto
      .createHmac('md5', secretKey)
      .update(signatureString)
      .digest('hex');

    return {
      orderReference: body.orderReference,
      status: 'accept',
      time: time,
      signature: signature
    };
  }
}