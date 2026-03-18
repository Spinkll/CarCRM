import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { PrismaModule } from 'src/db/prisma.module';

@Module({
  imports: [PrismaModule], // Обов'язково імпортуємо, бо CompaniesService працює з базою
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}