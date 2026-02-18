import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(private mailerService: MailerService) {}

    async sendUserPassword(email: string, name: string, pass: string) {
    
    const loginUrl = 'http://169.254.96.210:3001/login'; 
    const appName = 'WagGarage CRM';

    await this.mailerService.sendMail({
      to: email,
      subject: `🔐 Дані для входу в ${appName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                /* Ці стилі для клієнтів, які їх підтримують */
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .header { background-color: #2563eb; padding: 30px 20px; text-align: center; }
                .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
                .content { padding: 40px 30px; color: #374151; line-height: 1.6; }
                .greeting { font-size: 20px; font-weight: bold; margin-bottom: 20px; color: #111827; }
                .card { background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 6px; padding: 20px; margin: 25px 0; text-align: center; }
                .label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; display: block; }
                .value { font-size: 18px; font-weight: bold; color: #1e40af; font-family: 'Courier New', Courier, monospace; margin-bottom: 15px; display: block; }
                .btn { display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold; margin-top: 20px; }
                .footer { background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; }
            </style>
        </head>
        <body style="margin: 0; padding: 20px; background-color: #f3f4f6;">
            
            <div class="container" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                
                <div class="header" style="background-color: #2563eb; padding: 30px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-family: sans-serif; font-size: 24px;">${appName}</h1>
                </div>

                <div class="content" style="padding: 40px 30px; color: #374151; font-family: sans-serif; line-height: 1.6;">
                    <div class="greeting" style="font-size: 20px; font-weight: bold; margin-bottom: 20px; color: #111827;">
                        Вітаємо, ${name}! 👋
                    </div>
                    
                    <p>Ваш обліковий запис було успішно створено адміністратором. Тепер ви можете увійти в систему та переглядати статус ваших авто та замовлень.</p>
                    
                    <div class="card" style="background-color: #eff6ff; border: 1px solid #dbeafe; border-radius: 6px; padding: 20px; margin: 25px 0; text-align: center;">
                        
                        <span class="label" style="font-size: 12px; color: #6b7280; text-transform: uppercase; display: block;">Ваш Логін (Email)</span>
                        <span class="value" style="font-size: 16px; font-weight: bold; color: #1f2937; margin-bottom: 15px; display: block;">${email}</span>
                        
                        <span class="label" style="font-size: 12px; color: #6b7280; text-transform: uppercase; display: block;">Ваш тимчасовий пароль</span>
                        <span class="value" style="font-size: 20px; font-weight: bold; color: #2563eb; background: #fff; display: inline-block; padding: 5px 10px; border-radius: 4px; border: 1px dashed #2563eb; font-family: monospace;">${pass}</span>
                    
                    </div>

                    <p style="font-size: 14px; color: #6b7280;">⚠️ З міркувань безпеки, ми рекомендуємо змінити цей пароль після першого входу в особистому кабінеті.</p>

                    <div style="text-align: center;">
                        <a href="${loginUrl}" class="btn" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 6px; font-weight: bold; margin-top: 10px;">
                            Увійти в кабінет
                        </a>
                    </div>
                </div>

                <div class="footer" style="background-color: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; border-top: 1px solid #e5e7eb; font-family: sans-serif;">
                    <p style="margin: 0;">Це автоматичний лист, будь ласка, не відповідайте на нього.</p>
                    <p style="margin: 5px 0;">© 2026 ${appName}. Всі права захищено.</p>
                </div>

            </div>
        </body>
        </html>
      `,
    });
  }
}