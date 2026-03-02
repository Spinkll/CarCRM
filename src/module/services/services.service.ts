import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { CreateServiceDto } from 'src/dto/create-service.dto';
import { UpdateServiceDto } from 'src/dto/update-service.dto';


@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  // 1. СТВОРЕННЯ ПОСЛУГИ
  async createService(dto: CreateServiceDto) {
    const existing = await this.prisma.service.findFirst({
      where: { name: dto.name, deletedAt: null }
    });

    if (existing) {
      throw new BadRequestException('Послуга з такою назвою вже існує в прайс-листі');
    }

    return this.prisma.service.create({ data: dto });
  }

  // 2. ОТРИМАННЯ ВСІХ АКТИВНИХ ПОСЛУГ (для випадаючого списку)
  async findAllActive() {
    return this.prisma.service.findMany({
      where: { deletedAt: null }, // Показуємо ТІЛЬКИ ті, що не в архіві
      orderBy: { name: 'asc' },   // Сортуємо за алфавітом для зручності
    });
  }

  // 3. РЕДАГУВАННЯ ПОСЛУГИ (наприклад, змінилася ціна)
  async updateService(id: number, dto: UpdateServiceDto) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    
    if (!service || service.deletedAt) {
      throw new NotFoundException('Послугу не знайдено або вона в архіві');
    }

    return this.prisma.service.update({
      where: { id },
      data: dto,
    });
  }

  // 4. БЕЗПЕЧНЕ ВИДАЛЕННЯ (Soft Delete)
  async deleteService(id: number) {
    const service = await this.prisma.service.findUnique({ where: { id } });
    
    if (!service) throw new NotFoundException('Послугу не знайдено');
    if (service.deletedAt) throw new BadRequestException('Послуга вже видалена');

    // Просто ставимо штамп часу. Старі чеки залишаться цілими!
    await this.prisma.service.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: `Послуга "${service.name}" успішно перенесена в архів` };
  }
}