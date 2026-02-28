import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';


@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

  async getMechanicEarnings(mechanicId: number, month?: string, year?: string) {
    const now = new Date();
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
    const targetYear = year ? parseInt(year) : now.getFullYear();

    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    const completedWorks = await this.prisma.orderItem.findMany({
      where: {
        mechanicId: mechanicId,
        type: 'SERVICE',
        order: {
          status: 'COMPLETED',
          updatedAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      },
      include: {
        order: {
          select: {
            id: true,
            updatedAt: true,
            car: { select: { brand: true, model: true, plate: true } },
          },
        },
      },
      orderBy: { order: { updatedAt: 'desc' } },
    });

    const totalEarnings = completedWorks.reduce((sum, item) => {
      return sum + (Number(item.costPrice) || 0) * item.quantity;
    }, 0);

    return {
      period: {
        start: startOfMonth,
        end: endOfMonth,
        month: targetMonth + 1,
        year: targetYear,
      },
      totalEarnings,
      worksCount: completedWorks.length,
      works: completedWorks.map((work) => ({
        id: work.id,
        orderId: work.orderId,
        car: `${work.order.car.brand} ${work.order.car.model} (${work.order.car.plate})`,
        serviceName: work.name,
        earned: (Number(work.costPrice) || 0) * work.quantity,
        date: work.order.updatedAt,
      })),
    };
    }
    
    async getPayrollSummary(month?: string, year?: string) {
    const now = new Date();
    // Якщо параметри не передані, беремо поточний місяць
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
    const targetYear = year ? parseInt(year) : now.getFullYear();

    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    // 1. Витягуємо ВСІ послуги, які виконувались у закритих замовленнях за цей місяць
    const completedWorks = await this.prisma.orderItem.findMany({
      where: {
        mechanicId: { not: null }, // Беремо тільки ті позиції, де призначений механік
        type: 'SERVICE',
        order: {
          status: 'COMPLETED',
          updatedAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      },
      include: {
        mechanic: { select: { id: true, firstName: true, lastName: true } }, // Щоб знати ПІБ
        order: {
          select: {
            id: true,
            updatedAt: true,
            car: { select: { brand: true, model: true, plate: true } },
          },
        },
      },
      orderBy: { order: { updatedAt: 'asc' } },
    });

    // 2. Групуємо роботи по механіках за допомогою Map
    const summaryMap = new Map();

    for (const work of completedWorks) {
      if (!work.mechanic) continue;

      const mechanicId = work.mechanicId;
      const earned = (Number(work.costPrice) || 0) * work.quantity;

      // Якщо цього механіка ще немає в нашому словнику - додаємо
      if (!summaryMap.has(mechanicId)) {
        summaryMap.set(mechanicId, {
          mechanicId: mechanicId,
          mechanicName: `${work.mechanic.firstName} ${work.mechanic.lastName}`,
          worksCount: 0,
          totalEarnings: 0,
          works: [],
        });
      }

      // Отримуємо запис механіка і оновлюємо його касу
      const mechanicData = summaryMap.get(mechanicId);
      mechanicData.worksCount += 1;
      mechanicData.totalEarnings += earned;
      mechanicData.works.push({
        id: work.id,
        orderId: work.orderId,
        car: `${work.order.car.brand} ${work.order.car.model} (${work.order.car.plate})`,
        serviceName: work.name,
        earned: earned,
        date: work.order.updatedAt,
      });
    }

    // 3. Перетворюємо Map назад у масив для фронтенду
    return {
      period: {
        month: targetMonth + 1,
        year: targetYear,
      },
      summary: Array.from(summaryMap.values()), // Видаємо масив, як ти і просив
    };
  }

    
}