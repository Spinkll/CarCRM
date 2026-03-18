import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { BuildReportDto } from 'src/dto/build-report.dto';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async buildDynamicReport(dto: BuildReportDto) {
    const { entity, startDate, endDate, filters, fields } = dto;

    // 1. Будуємо динамічний об'єкт WHERE (Фільтри)
    const whereClause: any = { ...filters };

    // Додаємо фільтрацію по датах, якщо вони передані
    if (startDate || endDate) {
      // Визначаємо поле з датою (для платежів це paidAt, для інших - createdAt/updatedAt)
      const dateField = entity === 'payment' ? 'paidAt' : 'createdAt';
      whereClause[dateField] = {};
      
      if (startDate) whereClause[dateField].gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Кінець дня
        whereClause[dateField].lte = end;
      }
    }

    // 2. Будуємо динамічний об'єкт SELECT (Колонки)
    let selectClause: any = undefined;
    
    if (fields && fields.length > 0) {
      selectClause = {};
      fields.forEach((field) => {
        // БЕЗПЕКА: Жорстко блокуємо спроби дістати паролі!
        if (field !== 'password' && field !== 'hashedRefreshToken') {
          selectClause[field] = true;
        }
      });
    }

    // 3. Виконуємо запит залежно від обраної сутності
    try {
      switch (entity) {
        case 'order':
          // Для замовлень завжди круто підтягувати інфу про авто і клієнта
          if (selectClause) {
            selectClause.car = { select: { plate: true, brand: true, model: true } };
          }
          return await this.prisma.order.findMany({
            where: whereClause,
            select: selectClause,
            orderBy: { createdAt: 'desc' },
          });

        case 'payment':
          return await this.prisma.payment.findMany({
            where: whereClause,
            select: selectClause,
            orderBy: { paidAt: 'desc' },
          });

        case 'user':
          // Якщо не вибрали конкретні колонки, віддаємо безпечний мінімум
          if (!selectClause) {
            selectClause = { id: true, firstName: true, lastName: true, phone: true, role: true };
          }
          return await this.prisma.user.findMany({
            where: whereClause,
            select: selectClause,
            orderBy: { createdAt: 'desc' },
          });

        case 'car':
          return await this.prisma.car.findMany({
            where: whereClause,
            select: selectClause,
            orderBy: { createdAt: 'desc' },
          });

        default:
          throw new BadRequestException(`Сутність ${entity} не підтримується для звітів`);
      }
    } catch (error) {
      console.error(error);
      throw new BadRequestException('Помилка при генерації звіту. Перевірте передані параметри.');
    }
  }
}