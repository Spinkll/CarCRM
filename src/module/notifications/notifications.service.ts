import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class NotificationsService {
    constructor(private prisma: PrismaService) { }

    // --- Створити одне повідомлення ---
    async create(userId: number, title: string, message: string, type: string, orderId?: number) {
        return this.prisma.notification.create({
            data: { userId, title, message, type, orderId: orderId || null },
        });
    }

    // --- Масове створення (список userId) ---
    async notifyMany(userIds: number[], title: string, message: string, type: string, orderId?: number) {
        if (userIds.length === 0) return;

        return this.prisma.notification.createMany({
            data: userIds.map((userId) => ({
                userId,
                title,
                message,
                type,
                orderId: orderId || null,
            })),
        });
    }

    // --- Сповістити всіх з певною роллю ---
    async notifyByRoles(roles: UserRole[], title: string, message: string, type: string, orderId?: number) {
        const users = await this.prisma.user.findMany({
            where: { role: { in: roles }, deletedAt: null },
            select: { id: true },
        });

        const userIds = users.map((u) => u.id);
        return this.notifyMany(userIds, title, message, type, orderId);
    }

    // --- Мої повідомлення ---
    async findAll(userId: number) {
        return this.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    // --- Кількість непрочитаних ---
    async countUnread(userId: number) {
        const count = await this.prisma.notification.count({
            where: { userId, isRead: false },
        });
        return { count };
    }

    // --- Позначити як прочитане ---
    async markAsRead(userId: number, notificationId: number) {
        return this.prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { isRead: true },
        });
    }

    // --- Позначити всі як прочитані ---
    async markAllAsRead(userId: number) {
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }
}
