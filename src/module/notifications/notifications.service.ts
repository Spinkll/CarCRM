import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class NotificationsService {
    constructor(private prisma: PrismaService) { }

    async create(userId: number, title: string, message: string, type: string, orderId?: number) {
        return this.prisma.notification.create({
            data: { userId, title, message, type, orderId: orderId || null },
        });
    }

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

    async notifyByRoles(roles: UserRole[], title: string, message: string, type: string, orderId?: number) {
        const users = await this.prisma.user.findMany({
            where: { role: { in: roles }, deletedAt: null },
            select: { id: true },
        });

        const userIds = users.map((u) => u.id);
        return this.notifyMany(userIds, title, message, type, orderId);
    }

    async findAll(userId: number) {
        return this.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async countUnread(userId: number) {
        const count = await this.prisma.notification.count({
            where: { userId, isRead: false },
        });
        return { count };
    }

    async markAsRead(userId: number, notificationId: number) {
        return this.prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { isRead: true },
        });
    }

    async markAllAsRead(userId: number) {
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }
}
