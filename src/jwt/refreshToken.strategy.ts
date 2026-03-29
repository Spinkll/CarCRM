import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { UnauthorizedException, Injectable } from '@nestjs/common'; // Змінив Forbidden на Unauthorized
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/db/prisma.service'; // Вкажи свій правильний шлях до Prisma

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService // 👇 Додали Prisma сюди
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_REFRESH_SECRET')!, 
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: any) {
    const refreshToken = req.get('Authorization')
      ?.replace('Bearer', '')
      .trim();

    // 👇 1. Шукаємо юзера в базі
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub }
    });

    // 👇 2. ПЕРЕВІРКИ БЕЗПЕКИ 👇
    if (!user) throw new UnauthorizedException('Користувача не знайдено');
    if (user.deletedAt) throw new UnauthorizedException('Ваш акаунт видалено');
    if (user.isBlocked) throw new UnauthorizedException('Акаунт заблоковано. Оновлення токена заборонено.');
    // 👆 ---------------------- 👆

    return {
      id: user.id, 
      role: user.role,
      refreshToken,
    };
  }
}