import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { CreateInventoryDto } from 'src/dto/create-inventory.dto';
import { UpdateInventoryDto } from 'src/dto/update-inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  private generateSku(): string {
    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `PRT-${randomPart}`;
  }

  async create(dto: CreateInventoryDto) {
    let newSku = this.generateSku();
    let isUnique = false;

    while (!isUnique) {
      const existingPart = await this.prisma.part.findUnique({
        where: { sku: newSku },
      });

      if (!existingPart) {
        isUnique = true;
      } else {
        newSku = this.generateSku(); 
      }
    }

    return this.prisma.part.create({
      data: {
        name: dto.name,
        sku: newSku, 
        purchasePrice: dto.purchasePrice,
        retailPrice: dto.retailPrice,
        stockQuantity: dto.stockQuantity,
        minStockLevel: dto.minStockLevel || 3,
      },
    });
  }

  async findAll() {
    // Повертаємо тільки ті деталі, які НЕ видалені
    const parts = await this.prisma.part.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
    });

    // Prisma повертає Decimal як об'єкти. 
    // Фронтенд очікує числа, тому робимо швидкий мапінг:
    return parts.map(part => ({
      id: part.id,
      name: part.name,
      sku: part.sku,
      purchasePrice: Number(part.purchasePrice),
      retailPrice: Number(part.retailPrice),
      stockQuantity: part.stockQuantity,
      minStockLevel: part.minStockLevel,
    }));
  }

  async findOne(id: number) {
    const part = await this.prisma.part.findFirst({
      where: { id, deletedAt: null },
    });

    if (!part) throw new NotFoundException('Запчастину не знайдено');

    return {
      ...part,
      purchasePrice: Number(part.purchasePrice),
      retailPrice: Number(part.retailPrice),
    };
  }

  async update(id: number, dto: UpdateInventoryDto) {
    // Перевіряємо, чи існує деталь
    await this.findOne(id);

    const updatedPart = await this.prisma.part.update({
      where: { id },
      data: dto,
    });

    return {
      ...updatedPart,
      purchasePrice: Number(updatedPart.purchasePrice),
      retailPrice: Number(updatedPart.retailPrice),
    };
  }

  async remove(id: number) {
    await this.findOne(id);

    await this.prisma.part.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { message: 'Запчастину успішно видалено зі складу' };
  }
}