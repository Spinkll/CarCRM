import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/db/prisma.service'; // Вкажи свій правильний шлях до Prisma

@Injectable()
export class AccessTokenStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService // 👇 Додали Prisma сюди
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_ACCESS_SECRET'), 
    });
  }

  async validate(payload: any) {
    // 👇 1. Шукаємо юзера в базі під час кожного запиту
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub }
    });

    // 👇 2. ПЕРЕВІРКИ БЕЗПЕКИ 👇
    if (!user) {
      throw new UnauthorizedException('Користувача не знайдено');
    }

    if (user.deletedAt) {
      throw new UnauthorizedException('Ваш акаунт видалено');
    }

    if (user.isBlocked) {
      throw new UnauthorizedException(`Акаунт заблоковано. Причина: ${user.blockReason || 'Зверніться до адміністратора'}`);
    }
    // 👆 ---------------------- 👆

    // Якщо все добре, повертаємо те, що піде в req.user
    return {
      id: user.id,
      role: user.role,
    };
  }
}