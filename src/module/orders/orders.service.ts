import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { CreateOrderDto, UpdateOrderStatusDto } from 'src/dto/create-order.dto';
import { OrderStatus, UserRole } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  // --- СОЗДАНИЕ ЗАКАЗА ---
  async create(userId: number, role: UserRole, dto: CreateOrderDto) {
    const car = await this.prisma.car.findUnique({ where: { id: dto.vehicleId } });
    if (!car) throw new NotFoundException('Машина не найдена');

    if (role === 'CLIENT' && car.userId !== Number(userId)) {
      throw new ForbiddenException(`Вы не можете создать заказ на чужую машину (CarOwner: ${car.userId}, You: ${userId})`);
    }

    const currentMileage = dto.mileage || car.mileage;

    let fullDescription = dto.description;
    if (dto.services && dto.services.length > 0) {
      fullDescription += `\nRequested Services: ${dto.services.join(', ')}`;
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
              carId: dto.vehicleId,
            
          mileage: currentMileage,
          description: fullDescription,
          totalAmount: dto.totalCost || 0,
          status: OrderStatus.PENDING,
        },
      });

      await tx.orderHistory.create({
        data: {
          orderId: order.id,
          changedById: userId,
          action: 'ORDER_CREATED',
          comment: 'Order created via web interface',
        },
      });

      return order;
    });
  }

  async findAll(userId: number, role: UserRole) {
    const includeOptions = {
      car: true, 
      manager: { select: { firstName: true, lastName: true } },
      mechanic: { select: { firstName: true, lastName: true } },
    };

    if (role === UserRole.ADMIN || role === UserRole.MANAGER) {
      return this.prisma.order.findMany({
        include: includeOptions,
        orderBy: { createdAt: 'desc' },
      });
    }

    if (role === UserRole.MECHANIC) {
      return this.prisma.order.findMany({
        where: { mechanicId: userId },
        include: includeOptions,
        orderBy: { createdAt: 'desc' },
      });
    }

    return this.prisma.order.findMany({
      where: {
        car: {
          userId: userId,
        },
      },
      include: includeOptions,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(userId: number, role: UserRole, id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        car: true,
        items: true,
        history: { include: { changedBy: true }, orderBy: { timestamp: 'desc' } },
      },
    });

    if (!order) throw new NotFoundException('Заказ не найден');

    if (role === UserRole.CLIENT && order.car.userId !== userId) {
      throw new ForbiddenException('Доступ запрещен');
    }

    return order;
  }

  async updateStatus(userId: number, id: number, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Заказ не найден');

    const oldStatus = order.status;

    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status: dto.status },
      });

      await tx.orderHistory.create({
        data: {
          orderId: id,
          changedById: userId,
          action: 'STATUS_CHANGE',
          oldValue: oldStatus,
          newValue: dto.status,
          comment: `Status changed from ${oldStatus} to ${dto.status}`,
        },
      });

      return updatedOrder;
    });
  }
}