import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './module/users/users.module';
import { AuthModule } from './module/auth/auth.module';
import { PrismaModule } from './db/prisma.module';
import { CarsModule } from './module/cars/cars.module';
import { OrdersModule } from './module/orders/orders.module';
import { MailModule } from './module/mail/mail.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [UsersModule, AuthModule, PrismaModule, CarsModule,OrdersModule,MailModule,ConfigModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
