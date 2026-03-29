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
import { CatalogModule } from './module/catalog/catalog.module';
import { InventoryModule } from './module/inventory/inventory.module';
import { PayrollModule } from './module/payroll/payroll.module';
import { PaymentModule } from './module/payment/payment.module';
import { ServicesModule } from './module/services/services.module';
import { StripeModule } from './module/stripe/stripe.module';
import { ReportsModule } from './reports/reports.module';
import { CompaniesModule } from './module/companies/companies.module';
import { ScheduleModule } from '@nestjs/schedule';
@Module({
  imports: [
    UsersModule,
    AuthModule,
    PrismaModule,
    CarsModule,
    OrdersModule,
    StripeModule,
    MailModule,
    NotificationsModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ServiceRequestsModule,
    AppointmentsModule,
    CatalogModule,
    InventoryModule,
    PayrollModule,
    PaymentModule,
    ServicesModule,
    ReportsModule,
    CompaniesModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
