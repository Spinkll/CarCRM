import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/db/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(private prisma: PrismaService, private configService: ConfigService) {
    this.stripe = new Stripe(this.configService.get('STRIPE_SECRET_KEY') || '');
  }

  async createCheckoutSession(orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { car: true }
    });

    if (!order) throw new Error('Замовлення не знайдено');

    const amount = Number(order.totalAmount) > 0 ? Number(order.totalAmount) : 100;
    const frontendDomain = this.configService.get('FRONTEND_DOMAIN');

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'uah',
            product_data: {
              name: `Оплата замовлення #${order.id} (Авто: ${order.car.brand} ${order.car.plate})`,
            },
            unit_amount: amount * 100,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${frontendDomain}/orders-detail/${order.id}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendDomain}/orders-detail/${order.id}?payment=cancel`,
      metadata: {
        orderId: order.id.toString(),
      },
    });

    return { url: session.url };
  }

  async verifySession(sessionId: string) {
    // Отримуємо сесію зі Stripe API
    const session = await this.stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return { verified: false, message: 'Оплата ще не завершена' };
    }

    const orderId = parseInt(session.metadata?.orderId ?? '0', 10);
    if (!orderId) {
      return { verified: false, message: 'Невірна сесія' };
    }

    // 👇 ЗМІНА 1: Додаємо include: { car: true }, щоб знати власника
    const order = await this.prisma.order.findUnique({ 
      where: { id: orderId },
      include: { car: true } 
    });
    
    if (!order) {
      return { verified: false, message: 'Замовлення не знайдено' };
    }
    if (order.status === 'PAID') {
      return { verified: true, message: 'Вже оплачено' };
    }

    const amountPaid = (session.amount_total ?? 0) / 100;

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'PAID' },
      });

      await tx.payment.create({
        data: { orderId, amount: amountPaid, method: 'CARD' },
      });

      await tx.orderHistory.create({
        data: {
          orderId,
          // 👇 ЗМІНА 2: Використовуємо реальний ID власника авто
          changedById: order.car.userId, 
          action: 'PAYMENT_RECEIVED',
          oldValue: order.status,
          newValue: 'PAID',
          comment: `Оплата онлайн через Stripe: ${amountPaid} UAH`,
        },
      });
    });

    console.log(`✅ Stripe: Замовлення #${orderId} успішно оплачено на ${amountPaid} UAH`);
    return { verified: true, message: 'Оплату підтверджено' };
  }

  async handleWebhook(event: any) {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const sessionId = session.id;
      await this.verifySession(sessionId);
    }
    return { received: true };
  }
}