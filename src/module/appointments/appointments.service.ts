import { Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus } from 'generated/prisma/enums';
import { PrismaService } from 'src/db/prisma.service';


@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  // 1. Отримати всі записи (для Календаря)
  async findAll() {
    return this.prisma.appointment.findMany({
      include: {
        order: {
          include: {
            car: {
              include: {
                user: { select: { firstName: true, lastName: true, phone: true } }
              }
            },
            mechanic: { select: { id: true, firstName: true, lastName: true } }
          }
        }
      },
      orderBy: { scheduledAt: 'asc' }, // Сортуємо від найближчих
    });
  }

  // 2. Отримати записи конкретного клієнта
  async findByClient(clientId: number) {
    return this.prisma.appointment.findMany({
      where: {
        order: { car: { userId: clientId } }
      },
      include: {
        order: { include: { car: true } }
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  // 3. Змінити статус запису (напр. клієнт приїхав)
  async updateStatus(id: number, status: AppointmentStatus) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundException('Запис не знайдено');

    return this.prisma.appointment.update({
      where: { id },
      data: { status },
    });
  }

  // 4. Перенести запис на інший час (Reschedule)
  async reschedule(id: number, scheduledAt: string, estimatedMin?: number) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundException('Запис не знайдено');

    return this.prisma.appointment.update({
      where: { id },
      data: { 
        scheduledAt: new Date(scheduledAt),
        ...(estimatedMin && { estimatedMin }) // Оновлюємо тривалість, якщо передана
      },
    });
  }
}