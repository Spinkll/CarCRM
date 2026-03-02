import { BadRequestException, ConflictException, ForbiddenException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { RegisterDto } from 'src/dto/auth';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UpdateUserDto, ChangePasswordDto } from 'src/dto/user';
import { UserRole } from 'generated/prisma/enums';
import { CreateEmployeeDto } from 'src/dto/create-employee.dto';
import { MailService } from '../mail/mail.service';
import { CreateCustomerDto } from 'src/dto/create-customer.dto';



@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService,
      private mailService: MailService
    ) { }
    
    async createUser(dto: RegisterDto) {
    const { email, password, firstName, lastName,phone } = dto;

    const existingUser = await this.prisma.user.findFirst({
  where: {
    OR: [
      { email: dto.email },
      { phone: dto.phone }
    ]
  }
    } );
if (existingUser) {
  throw new ConflictException('Користувач з таким email або телефоном вже існує');
}

    const rawPassword = dto.password || crypto.randomBytes(4).toString('hex');
    const hashedPassword = await bcrypt.hash(rawPassword, 10);;

    const user = await this.prisma.user.create({
        data: {
          email,
        phone,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'CLIENT', 
      },
    });

    //    try {
    //    await this.mailService.sendUserPassword(user.email, user.firstName, rawPassword);
    //  } catch (e) {
    //    console.error(`Failed to send email to client ${user.email}:`, e);
    //    }
      
    return user;
  }

  async findByEmail(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundException('Користувача не знайдено');
    }
    return user;
  }

  async findById(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Користувача не знайдено');
    }
    return user;
  }

  async updateUser(requesterId: number, requesterRole: string, targetUserId: number, dto: UpdateUserDto) {
    // 1. Перевіряємо, чи існує користувач
    const user = await this.prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw new NotFoundException('Користувача не знайдено');

    // 2. БЕЗПЕКА: Хто робить запит?
    const isAdminOrManager = requesterRole === 'ADMIN' || requesterRole === 'MANAGER';

    if (!isAdminOrManager) {
      // Клієнт або механік може редагувати ТІЛЬКИ свій профіль
      if (requesterId !== targetUserId) {
        throw new ForbiddenException('Ви можете редагувати лише власний профіль');
      }
      
      // ВИРІЗАЄМО секретні поля, щоб звичайний юзер не міг їх змінити
      delete dto.role;
      delete dto.commissionRate;
    }

    // 3. Валідація відсотка зарплати (його можна ставити тільки механікам)
    const newRole = dto.role || user.role;
    if (dto.commissionRate !== undefined && newRole !== 'MECHANIC') {
      throw new BadRequestException('Відсоток зарплати можна встановлювати тільки механікам');
    }

    // 4. Підготовка даних (твоя логіка хешування)
    const data: any = { ...dto };

    if (dto.password) {
      data.password = await bcrypt.hash(dto.password, 10);
    }

    // 5. Зберігаємо в базу
    return this.prisma.user.update({
      where: { id: targetUserId },
      data,
      // Повертаємо безпечні поля (без пароля)
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        commissionRate: true,
      },
    });
  }
  
  async update(userId: number, data: any) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  async deleteUser(id: number) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');

    if (user.deletedAt) {
      throw new BadRequestException('Пользователь уже удален (находится в архиве)');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.car.updateMany({
        where: { userId: id, deletedAt: null }, 
        data: { deletedAt: new Date() },
      });

      const deletedUser = await tx.user.update({
        where: { id },
        data: { 
          deletedAt: new Date(),
          hashedRefreshToken: null 
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: true,
          deletedAt: true,
        }
      });

      return {
        message: 'Пользователь и его автомобили успешно перенесены в архив',
        user: deletedUser
      };
    });
  }

  async findAllByRoles(roles: UserRole[]) {
    return this.prisma.user.findMany({
      where: { role: { in: roles } },
      select: { 
        id: true, firstName: true, lastName: true, email: true, phone: true, role: true, createdAt: true, commissionRate: true, baseSalary:true 
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async createEmployee(dto: CreateEmployeeDto) {
    const { email,firstName, lastName,phone,role } = dto;

    const existingUser = await this.prisma.user.findFirst({
  where: {
    OR: [
      { email: dto.email },
      { phone: dto.phone }
    ]
  }
    } );
if (existingUser) {
  throw new ConflictException('Користувач з таким email або телефоном вже існує');
}

    const rawPassword = crypto.randomBytes(4).toString('hex');
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const user = await this.prisma.user.create({
        data: {
          email,
        phone,
        password: hashedPassword,
        firstName,
        lastName,
        role, 
        isVerified: true
      },
    });

   try {
     await this.mailService.sendUserPassword(user.email, user.firstName, rawPassword);
    } catch (e) {
       console.error(`Failed to send email to employee ${user.email}:`, e);
     }

    return user;
  }
    
  async findEmployees() {
    return this.findAllByRoles([UserRole.ADMIN, UserRole.MANAGER, UserRole.MECHANIC]);
  }
  
  async findCustomers() {
    return this.findAllByRoles([UserRole.CLIENT]);
  }

  async createCustomer(dto: CreateCustomerDto) {
    const { email, password, firstName, lastName,phone } = dto;

    const existingUser = await this.prisma.user.findFirst({
  where: {
    OR: [
      { email: dto.email },
      { phone: dto.phone }
    ]
  }
    } );
if (existingUser) {
  throw new ConflictException('Користувач з таким email або телефоном вже існує');
}

    const rawPassword = dto.password || crypto.randomBytes(4).toString('hex');
    const hashedPassword = await bcrypt.hash(rawPassword, 10);;

    const user = await this.prisma.user.create({
        data: {
          email,
        phone,
        password: hashedPassword,
        firstName,
        lastName,
        role: 'CLIENT',
        isVerified: true
      },
    });

      try {
      await this.mailService.sendUserPassword(user.email, user.firstName, rawPassword);
    } catch (e) {
      console.error(`Failed to send email to client ${user.email}:`, e);
      }
      
    return user;
  }

  async findMechanics() {
    try {
      return await this.findAllByRoles([UserRole.MECHANIC]);
    } catch (error) {
      throw new InternalServerErrorException('Помилка при отриманні списку механіків');
    }
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    // 1. Находим пользователя
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Користувача не знайдено');
    }

    const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
    
    if (!isPasswordValid) {
      throw new BadRequestException('Поточний пароль введено неправильно');
    }

    const isSamePassword = await bcrypt.compare(dto.newPassword, user.password);
    if (isSamePassword) {
      throw new BadRequestException('Новий пароль не може співпадати зі старим');
    }

    const hashedNewPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    return { success: true, message: 'Пароль успішно змінено' };
  }

  async getMechanicEarnings(mechanicId: number) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

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
        order: { select: { id: true,updatedAt: true, car: { select: { brand: true, model: true } } } },
      },
    });

    const totalEarnings = completedWorks.reduce((sum, item) => {
      return sum + (Number(item.costPrice) || 0) * item.quantity;
    }, 0);

    return {
      period: {
        start: startOfMonth,
        end: endOfMonth,
      },
      totalEarnings,
      works: completedWorks.map((work) => ({
        id: work.id,
        orderId: work.orderId,
        car: `${work.order.car.brand} ${work.order.car.model}`,
        name: work.name,
        quantity: work.quantity,
        earned: Number(work.costPrice) || 0,
        date: work.order.updatedAt,
      })),
    };
  }

}
