import { Module } from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [ NotificationsModule],
  controllers: [PaymentController],
  providers: [PaymentService, PrismaService],
})
export class PaymentModule { }