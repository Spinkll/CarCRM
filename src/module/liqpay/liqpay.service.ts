import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from 'src/db/prisma.service';

@Injectable()
export class LiqpayService {
    constructor(private prisma: PrismaService) { }

    async generatePaymentData(orderId: number) {
        // Якщо ключі не задані в .env, беремо стандартні тестові ключі LiqPay (sandbox)
        const publicKey = process.env.LIQPAY_PUBLIC_KEY || "sandbox_i52542456456";
        const privateKey = process.env.LIQPAY_PRIVATE_KEY || "sandbox_uG8K65S8m3yY905nUqj9VzSXX8vJ2K258Bfbbz7b";
        const frontendDomain = process.env.FRONTEND_DOMAIN || 'http://localhost:3001';
        const backendDomain = process.env.BACKEND_DOMAIN || 'http://localhost:3000';

        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { car: true }
        });

        if (!order) throw new Error('Замовлення не знайдено');

        const amount = Number(order.totalAmount);

        // JSON Params для LiqPay
        const params = {
            action: 'pay',
            amount: amount,
            currency: 'UAH',
            description: `Оплата замовлення #${order.id} (Авто: ${order.car.brand} ${order.car.plate})`,
            order_id: `ORDER_${order.id}_${Date.now()}`,
            version: 3,
            public_key: publicKey,
            result_url: `${frontendDomain}/api/liqpay/return/${order.id}`,
            server_url: `${backendDomain}/liqpay/webhook`,
        };

        // 1. Кодуємо параметри JSON у Base64
        const dataString = JSON.stringify(params);
        const data = Buffer.from(dataString).toString('base64');

        // 2. Створюємо підпис (signature) за алгоритмом SHA1(private_key + data + private_key)
        const signString = privateKey + data + privateKey;
        const signature = crypto.createHash('sha1').update(signString).digest('base64');

        return {
            data,
            signature
        };
    }

    async handleWebhook(body: any) {
        const { data, signature } = body;
        const privateKey = process.env.LIQPAY_PRIVATE_KEY || "sandbox_uG8K65S8m3yY905nUqj9VzSXX8vJ2K258Bfbbz7b";

        if (!data || !signature) {
            throw new BadRequestException('Invalid webhook data');
        }

        // Перевіряємо, чи підпис, що надіслав LiqPay, відповідає нашому
        const signString = privateKey + data + privateKey;
        const expectedSignature = crypto.createHash('sha1').update(signString).digest('base64');

        if (signature !== expectedSignature) {
            throw new BadRequestException('Invalid signature');
        }

        // Розшифровуємо дані
        const decodedData = JSON.parse(Buffer.from(data, 'base64').toString('utf-8'));

        // Status 'sandbox' - це успіх у тестовому режимі. 'success' - в бойовому.
        const isSuccess = decodedData.status === 'success' || decodedData.status === 'sandbox';

        const orderIdString = decodedData.order_id.split('_')[1];
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
                            amount: decodedData.amount,
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
                            comment: `Оплата онлайн через LiqPay: ${decodedData.amount} ${decodedData.currency}`,
                        }
                    });
                });
                console.log(`✅ Замовлення #${orderId} успішно оплачено через LiqPay на суму ${decodedData.amount} ${decodedData.currency}`);
            }
        } else {
            console.log(`❌ Оплата замовлення #${orderId} через LiqPay відхилена. Статус: ${decodedData.status}`);
        }

        return { status: 'ok' };
    }
}
