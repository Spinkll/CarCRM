import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './module/users/users.module';
import { AuthModule } from './module/auth/auth.module';
import { PrismaModule } from './db/prisma.module';
import { CarsModule } from './module/cars/cars.module';
import { OrdersModule } from './module/orders/orders.module';
import { MailModule } from './module/mail/mail.module';
import { NotificationsModule } from './module/notifications/notifications.module';
import { ConfigModule } from '@nestjs/config';
import { ServiceRequestsModule } from './module/service-requests/service-requests.module';
import { AppointmentsModule } from './module/appointments/appointments.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CatalogModule } from './module/services/catalog.module';


@Module({
  imports: [UsersModule, AuthModule, PrismaModule, CarsModule, OrdersModule, MailModule, NotificationsModule, ConfigModule, ServiceRequestsModule, AppointmentsModule,CatalogModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
