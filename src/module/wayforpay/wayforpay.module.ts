import { Module } from '@nestjs/common';
import { WayforpayService } from './wayforpay.service';
import { WayforpayController } from './wayforpay.controller';
import { PrismaModule } from 'src/db/prisma.module';
 // Шлях може відрізнятися залежно від твоєї структури

@Module({
  imports: [PrismaModule], // Обов'язково додаємо Прізму!
  controllers: [WayforpayController],
  providers: [WayforpayService],
  exports: [WayforpayService], // На всякий випадок, якщо знадобиться в інших модулях
})
export class WayforpayModule {}