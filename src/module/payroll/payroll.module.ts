import { Module } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { PrismaModule } from 'src/db/prisma.module';
import { PayrollController } from './payroll.controller';

@Module({
  imports: [PrismaModule], 
  controllers: [PayrollController],
  providers: [PayrollService]
})
export class PayrollModule {}
