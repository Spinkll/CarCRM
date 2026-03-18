import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { UpdateCompanySettingsDto } from 'src/dto/update-company-settings.dto';

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  async getMySettings(companyId: number) {
    // Шукаємо налаштування. Якщо їх немає - створюємо порожній "каркас"
    const settings = await this.prisma.companySettings.upsert({
      where: { companyId },
      update: {}, // Якщо є - нічого не робимо
      create: { companyId }, // Якщо немає - створюємо
    });

    return settings;
  }

  async updateMySettings(companyId: number, dto: UpdateCompanySettingsDto) {
    // Prisma автоматично ігнорує undefined, але записує null. 
    // Це забезпечує консистентність, як ти й просив.
    return this.prisma.companySettings.upsert({
      where: { companyId },
      update: dto,
      create: { companyId, ...dto },
    });
  }
}