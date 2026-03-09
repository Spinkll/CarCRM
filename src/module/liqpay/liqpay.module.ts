import { Module } from '@nestjs/common';
import { LiqpayService } from './liqpay.service';
import { LiqpayController } from './liqpay.controller';
import { PrismaModule } from 'src/db/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [LiqpayController],
    providers: [LiqpayService],
    exports: [LiqpayService],
})
export class LiqpayModule { }
