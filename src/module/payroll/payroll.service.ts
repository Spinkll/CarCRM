import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';


@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) { }

  async getMechanicEarnings(mechanicId: number, month?: string, year?: string) {
    const now = new Date();
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
    const targetYear = year ? parseInt(year) : now.getFullYear();

    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    const mechanicObj = await this.prisma.user.findUnique({ where: { id: mechanicId } });
    const fallbackRate = mechanicObj?.commissionRate || 30;

    const completedWorks = await this.prisma.orderItem.findMany({
      where: {
        mechanicId: mechanicId,
        type: 'SERVICE',
        order: {
          status: { in: ['COMPLETED', 'PAID'] },
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

    const commissionEarnings = completedWorks.reduce((sum, item) => {
      let earned = Number(item.costPrice) || 0;
      if (earned === 0 && Number((item as any).price) > 0) {
        earned = (Number((item as any).price) * fallbackRate) / 100;
      }
      return sum + earned * item.quantity;
    }, 0);

    const baseSalary = Number(mechanicObj?.baseSalary) || 0;
    const totalEarnings = baseSalary + commissionEarnings;

    return {
      period: {
        start: startOfMonth,
        end: endOfMonth,
        month: targetMonth + 1,
        year: targetYear,
      },
      commissionEarnings,
      baseSalary,
      totalEarnings, // Total sum (Salary + Commission)
      worksCount: completedWorks.length,
      works: completedWorks.map((work: any) => {
        let earned = Number(work.costPrice) || 0;
        if (earned === 0 && Number(work.price) > 0) {
          earned = (Number(work.price) * fallbackRate) / 100;
        }
        return {
          id: work.id,
          orderId: work.orderId,
          car: `${work.order.car.brand} ${work.order.car.model} (${work.order.car.plate})`,
          serviceName: work.name,
          earned: earned * work.quantity,
          date: work.order.updatedAt,
        };
      }),
    };
  }


  async getPayrollSummary(month?: string, year?: string) {
    const now = new Date();
    const targetMonth = month ? parseInt(month) - 1 : now.getMonth();
    const targetYear = year ? parseInt(year) : now.getFullYear();

    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

    const summaryMap = new Map();

    // 1. ВИБИРАЄМО ВСІХ АКТИВНИХ ПРАЦІВНИКІВ ЗІ СТАВКАМИ
    // (навіть якщо вони не зробили жодного замовлення за місяць)
    const activeEmployees = await this.prisma.user.findMany({
      where: {
        role: { in: ['MANAGER', 'MECHANIC'] },
        deletedAt: null, // Тільки ті, хто зараз працює
        createdAt: { lte: endOfMonth }, // Не включати тих, кого ще не найняли
      },
      select: { id: true, firstName: true, lastName: true, role: true, commissionRate: true, baseSalary: true }
    });

    // Одразу записуємо їх у відомість
    for (const emp of activeEmployees) {
      const base = Number(emp.baseSalary) || 0;
      summaryMap.set(emp.id, {
        employeeId: emp.id,
        name: `${emp.firstName} ${emp.lastName}`,
        role: emp.role,
        currentCommissionRate: emp.commissionRate || 0,
        baseSalary: base,
        commissionEarnings: 0,
        totalEarnings: base, // Зі старту дорівнює ставці
        tasksCount: 0,
        details: [],
      });
    }

    // Допоміжна функція (залишається для тих, кого могли звільнити в цьому місяці, але вони встигли попрацювати)
    const initEmployee = (user: any, role: string) => {
      if (!summaryMap.has(user.id)) {
        const base = Number(user.baseSalary) || 0;
        summaryMap.set(user.id, {
          employeeId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          role: role,
          currentCommissionRate: user.commissionRate || 0,
          baseSalary: base,
          commissionEarnings: 0,
          totalEarnings: base,
          tasksCount: 0,
          details: [],
        });
      }
      return summaryMap.get(user.id);
    };

    // 2. Витягуємо всі ЗАВЕРШЕНІ ЗАМОВЛЕННЯ за місяць
    const completedOrders = await this.prisma.order.findMany({
      where: {
        status: { in: ['COMPLETED', 'PAID'] },
        updatedAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        manager: {
          select: { id: true, firstName: true, lastName: true, commissionRate: true, baseSalary: true, role: true }
        },
        items: {
          where: { type: 'SERVICE', mechanicId: { not: null } },
          include: {
            mechanic: {
              select: { id: true, firstName: true, lastName: true, commissionRate: true, baseSalary: true, role: true }
            }
          }
        },
        car: { select: { brand: true, model: true, plate: true } },
      },
      orderBy: { updatedAt: 'asc' },
    });

    // 3. Нараховуємо відсотки поверх ставки
    for (const order of completedOrders) {

      // --- ЗАРПЛАТА МЕНЕДЖЕРА ---
      if (order.manager && order.manager.role !== 'ADMIN') {
        const managerData = initEmployee(order.manager, 'MANAGER');
        managerData.tasksCount += 1;

        const managerCommission = order.manager.commissionRate
          ? (Number(order.totalAmount) * order.manager.commissionRate) / 100
          : 0;

        managerData.commissionEarnings += managerCommission;
        managerData.totalEarnings = managerData.baseSalary + managerData.commissionEarnings;

        managerData.details.push({
          orderId: order.id,
          car: `${order.car.brand} ${order.car.model} (${order.car.plate})`,
          description: `Ведення замовлення (Сума: ${order.totalAmount} грн)`,
          earned: managerCommission,
          date: order.updatedAt,
        });
      }

      // --- ЗАРПЛАТА МЕХАНІКІВ ---
      for (const item of order.items as any[]) {
        if (!item.mechanic || item.mechanic.role === 'ADMIN') continue;

        const mechanicData = initEmployee(item.mechanic, 'MECHANIC');

        let unitEarned = Number(item.costPrice) || 0;
        if (unitEarned === 0 && Number(item.price) > 0) {
          const mRate = item.mechanic.commissionRate || 30;
          unitEarned = (Number(item.price) * mRate) / 100;
        }

        const earned = unitEarned * item.quantity;

        mechanicData.tasksCount += 1;
        mechanicData.commissionEarnings += earned;
        mechanicData.totalEarnings = mechanicData.baseSalary + mechanicData.commissionEarnings;

        mechanicData.details.push({
          orderId: order.id,
          car: `${order.car.brand} ${order.car.model} (${order.car.plate})`,
          description: item.name,
          earned: earned,
          date: order.updatedAt,
        });
      }
    }

    return {
      period: {
        month: targetMonth + 1,
        year: targetYear,
      },
      summary: Array.from(summaryMap.values()),
    };
  }

}