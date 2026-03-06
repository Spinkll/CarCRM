import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { MailService } from './mail.service';
import { ConfigModule, ConfigService } from '@nestjs/config'; 

@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule], 
      
      useFactory: async (config: ConfigService) => ({
        transport: {
          host: config.get('MAIL_HOST'),
          port: 587,
          secure: false,
          auth: {
            user: config.get('MAIL_USER'),
            pass: config.get('MAIL_PASSWORD'),
          },
          logger: true, // Буде писати всі кроки в консоль
  debug: true,  // Покаже детальний мережевий трафік
  connectionTimeout: 10000,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}