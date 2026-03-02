import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AppointmentStatus } from 'generated/prisma/enums';
import { PrismaService } from 'src/db/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService, // <-- ІНЖЕКТИМО СЕРВІС СПОВІЩЕНЬ
  ) { }

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
        order: { include: { car: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  // Отримати записи конкретного механіка
  async findByMechanic(mechanicId: number) {
    return this.prisma.appointment.findMany({
      where: {
        order: { mechanicId: mechanicId }
      },
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
  // ДОДАНО параметр changedById, щоб знати, хто саме переносить запис
  async reschedule(id: number, scheduledAt: string, estimatedMin?: number, changedById?: number) {
    // Спочатку знаходимо запис РАЗОМ із даними про авто, щоб дізнатися ID клієнта
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
      include: {
        order: { include: { car: true } }
      }
    });

    if (!appointment) throw new NotFoundException('Запис не знайдено');

    // Оновлюємо запис у базі
    const updatedAppointment = await this.prisma.appointment.update({
      where: { id },
      data: {
        scheduledAt: new Date(scheduledAt),
        ...(estimatedMin && { estimatedMin }) // Оновлюємо тривалість, якщо передана
      },
    });

    // 🔔 СПОВІЩЕННЯ: Якщо запис переносить Менеджер/Адмін (тобто changedById не дорівнює ID клієнта)
    const clientId = appointment.order?.car?.userId;

    if (clientId && changedById !== clientId) {
      const newDate = new Date(scheduledAt).toLocaleString('uk-UA', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });

      this.notifications.create(
        clientId,
        'Змінено час візиту',
        `Ваш візит на сервіс було перенесено. Новий час: ${newDate}.`,
        'RESCHEDULED',
        appointment.orderId
      ).catch(e => console.error('Помилка відправки сповіщення:', e));
    }

    return updatedAppointment;
  }

  async getAvailableSlots(dateString: string) {
    const searchDate = new Date(dateString);
    if (isNaN(searchDate.getTime())) {
      throw new BadRequestException('Неправильний формат дати. Використовуйте YYYY-MM-DD');
    }

    const workStartHour = 8;
    const workEndHour = 18;
    const slotDurationMinutes = 60;

    const startOfDay = new Date(searchDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(searchDate);
    endOfDay.setHours(23, 59, 59, 999);

    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        scheduledAt: { gte: startOfDay, lte: endOfDay },
        status: { in: ['SCHEDULED', 'CONFIRMED', 'ARRIVED'] },
      },
      select: { scheduledAt: true },
    });

    const pendingRequests = await this.prisma.serviceRequest.findMany({
      where: {
        scheduledAt: { gte: startOfDay, lte: endOfDay },
        status: { in: ['NEW', 'IN_REVIEW'] }
      },
      select: { scheduledAt: true }
    });

    const busyTimes = [...existingAppointments, ...pendingRequests]
      .filter(item => item.scheduledAt)
      .map((item) => {
        const d = new Date(item.scheduledAt!);
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      });

    const availableSlots: string[] = [];

    let currentSlot = new Date(startOfDay);
    currentSlot.setHours(workStartHour, 0, 0, 0);

    const endTime = new Date(startOfDay);
    endTime.setHours(workEndHour, 0, 0, 0);

    const now = new Date();

    while (currentSlot < endTime) {
      if (currentSlot > now) {
        const timeString = `${currentSlot.getHours().toString().padStart(2, '0')}:${currentSlot.getMinutes().toString().padStart(2, '0')}`;

        if (!busyTimes.includes(timeString)) {
          availableSlots.push(timeString);
        }
      }

      currentSlot.setMinutes(currentSlot.getMinutes() + slotDurationMinutes);
    }

    return availableSlots;
  }
}