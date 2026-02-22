import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
    constructor(private mailerService: MailerService) { }

    async sendUserPassword(email: string, name: string, pass: string) {
        const loginUrl = 'http://169.254.96.210:3001/login';
        const appName = 'WagGarage CRM';

        await this.mailerService.sendMail({
            to: email,
            subject: `Дані для входу в ${appName}`,
            html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
        </head>
        <body style="margin: 0; padding: 20px; background-color: #161618; font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
            
            <div style="max-width: 500px; margin: 40px auto; background-color: #212124; border: 1px solid #37373b; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                
                <!-- Card Header -->
                <div style="padding: 24px;">
                    <div style="margin-bottom: 24px;">
                        <h1 style="color: #f4f4f5; margin: 0 0 6px 0; font-size: 20px; font-weight: 600; letter-spacing: -0.025em;">
                            WagGarage CRM
                        </h1>
                        <p style="margin: 0; color: #9ca3af; font-size: 14px;">Дані для входу в систему</p>
                    </div>

                    <!-- Card Content -->
                    <div style="color: #f4f4f5; font-size: 14px; line-height: 24px;">
                        <p style="margin: 0 0 16px 0;">Вітаємо, <strong>${name}</strong>!<br>Ваш обліковий запис було успішно створено адміністратором.</p>
                        
                        <div style="margin: 24px 0; border: 1px solid #37373b; border-radius: 8px; background-color: #161618; padding: 16px;">
                            <div style="margin-bottom: 12px;">
                                <span style="display: block; font-size: 12px; font-weight: 500; color: #9ca3af; margin-bottom: 4px;">Електронна пошта</span>
                                <span style="display: block; font-size: 14px; color: #f4f4f5;">${email}</span>
                            </div>
                            <div>
                                <span style="display: block; font-size: 12px; font-weight: 500; color: #9ca3af; margin-bottom: 4px;">Тимчасовий пароль</span>
                                <span style="display: block; font-size: 18px; font-weight: 600; font-family: 'Geist Mono', Consolas, monospace; letter-spacing: 1px; color: #3b82f6;">${pass}</span>
                            </div>
                        </div>

                        <p style="margin: 0 0 24px 0; color: #9ca3af; font-size: 13px;">
                            З міркувань безпеки ми рекомендуємо змінити цей пароль після першого входу.
                        </p>

                        <!-- Button -->
                        <div style="margin-top: 24px;">
                            <a href="${loginUrl}" style="display: inline-block; background-color: #3b82f6; color: #fafafa; text-decoration: none; padding: 10px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; text-align: center;">
                                Увійти в кабінет
                            </a>
                        </div>
                    </div>
                </div>

                <!-- Card Footer -->
                <div style="padding: 16px 24px; background-color: #161618; border-top: 1px solid #37373b; font-size: 12px; color: #9ca3af;">
                    Це автоматичний лист. Будь ласка, не відповідайте на нього.
                </div>

            </div>
        </body>
        </html>
      `,
        });
    }

    async sendPasswordReset(email: string, name: string, resetLink: string) {
        const appName = 'WagGarage CRM';

        await this.mailerService.sendMail({
            to: email,
            subject: `Відновлення пароля — ${appName}`,
            html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
        </head>
        <body style="margin: 0; padding: 20px; background-color: #161618; font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
            
            <div style="max-width: 500px; margin: 40px auto; background-color: #212124; border: 1px solid #37373b; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                
                <div style="padding: 24px;">
                    <div style="margin-bottom: 24px;">
                        <h1 style="color: #f4f4f5; margin: 0 0 6px 0; font-size: 20px; font-weight: 600; letter-spacing: -0.025em;">
                            Відновлення пароля
                        </h1>
                        <p style="margin: 0; color: #9ca3af; font-size: 14px;">${appName}</p>
                    </div>

                    <div style="color: #f4f4f5; font-size: 14px; line-height: 24px;">
                        <p style="margin: 0 0 16px 0;">Вітаємо, <strong>${name}</strong>!<br>Ми отримали запит на скидання пароля для вашого облікового запису.</p>
                        
                        <div style="margin-top: 24px; margin-bottom: 24px;">
                            <a href="${resetLink}" style="display: inline-block; background-color: #f4f4f5; color: #18181b; text-decoration: none; padding: 10px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; text-align: center;">
                                Скинути пароль
                            </a>
                        </div>

                        <div style="border: 1px solid #37373b; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; background-color: #161618;">
                            <p style="margin: 0; color: #9ca3af; font-size: 13px;">
                                Посилання дійсне протягом 1 години. Якщо ви не надсилали цей запит, ви можете безпечно проігнорувати цей лист. Вашому акаунту нічого не загрожує.
                            </p>
                        </div>

                        <p style="margin: 0; color: #6b7280; font-size: 12px;">
                            Якщо кнопка не працює, скопіюйте це посилання у браузер:<br>
                            <a href="${resetLink}" style="color: #3b82f6; word-break: break-all;">${resetLink}</a>
                        </p>
                    </div>
                </div>

                <div style="padding: 16px 24px; background-color: #161618; border-top: 1px solid #37373b; font-size: 12px; color: #9ca3af;">
                    Це автоматичний лист. Будь ласка, не відповідайте на нього.
                </div>

            </div>
        </body>
        </html>
      `,
        });
    }

    async sendVerificationEmail(email: string, name: string, verifyLink: string) {
        const appName = 'WagGarage CRM';

        await this.mailerService.sendMail({
            to: email,
            subject: `Підтвердження реєстрації — ${appName}`,
            html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
        </head>
        <body style="margin: 0; padding: 20px; background-color: #161618; font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
            
            <div style="max-width: 500px; margin: 40px auto; background-color: #212124; border: 1px solid #37373b; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);">
                
                <div style="padding: 24px;">
                    <div style="margin-bottom: 24px;">
                        <h1 style="color: #f4f4f5; margin: 0 0 6px 0; font-size: 20px; font-weight: 600; letter-spacing: -0.025em;">
                            Підтвердження Email
                        </h1>
                        <p style="margin: 0; color: #9ca3af; font-size: 14px;">${appName}</p>
                    </div>

                    <div style="color: #f4f4f5; font-size: 14px; line-height: 24px;">
                        <p style="margin: 0 0 16px 0;">Вітаємо, <strong>${name}</strong>!<br>Дякуємо за реєстрацію. Будь ласка, підтвердіть вашу електронну адресу, щоб активувати обліковий запис.</p>
                        
                        <div style="margin-top: 24px; margin-bottom: 24px;">
                            <a href="${verifyLink}" style="display: inline-block; background-color: #f4f4f5; color: #18181b; text-decoration: none; padding: 10px 16px; border-radius: 6px; font-size: 14px; font-weight: 500; text-align: center;">
                                Підтвердити Email
                            </a>
                        </div>

                        <div style="border: 1px solid #37373b; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; background-color: #161618;">
                            <p style="margin: 0; color: #9ca3af; font-size: 13px;">
                                Посилання дійсне протягом 24 годин.
                            </p>
                        </div>

                        <p style="margin: 0; color: #6b7280; font-size: 12px;">
                            Якщо кнопка не працює, скопіюйте це посилання у браузер:<br>
                            <a href="${verifyLink}" style="color: #3b82f6; word-break: break-all;">${verifyLink}</a>
                        </p>
                    </div>
                </div>

                <div style="padding: 16px 24px; background-color: #161618; border-top: 1px solid #37373b; font-size: 12px; color: #9ca3af;">
                    Це автоматичний лист. Будь ласка, не відповідайте на нього.
                </div>

            </div>
        </body>
        </html>
      `,
        });
    }
}
