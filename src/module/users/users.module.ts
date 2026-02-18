import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaModule } from 'src/db/prisma.module';
import { UsersController } from './users.controller';
import { MailModule } from '../mail/mail.module';

@Module({
  controllers: [UsersController],
  imports: [PrismaModule, MailModule], 
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
