import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from 'src/dto/auth';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
    private configService: ConfigService,
  ) { }

  // 1. РЕЄСТРАЦІЯ
  async register(dto: RegisterDto) {
    const clientData = {
      ...dto,
      role: 'CLIENT', 
      isVerified: false,
    };

    const user = await this.usersService.createUser(clientData as any);

    const verifyToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.configService.get('JWT_VERIFY_SECRET') || this.configService.get('JWT_ACCESS_SECRET'),
        expiresIn: '24h',
      },
    );

    const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3001';
    const verifyLink = `${frontendUrl}/verify-email?token=${verifyToken}`;

    await this.mailService.sendVerificationEmail(user.email, user.firstName, verifyLink).catch(e => {
      console.error('Помилка відправки листа верифікації', e);
    });

    const tokens = await this.generateTokens(user);
    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

    return tokens;
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user)
      throw new UnauthorizedException('Невірний email або пароль');

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch)
      throw new UnauthorizedException('Невірний email або пароль');

    const tokens = await this.generateTokens(user);

    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified
      },
    };
  }


  // 3. LOGOUT (Вихід)
  async logout(userId: number) {
    await this.usersService.update(userId, { hashedRefreshToken: null });
    return { message: 'Logged out successfully' };
  }

  // 4. REFRESH (Оновлення)
  async refreshTokens(userId: number, refreshToken: string) {
    const user = await this.usersService.findById(userId);

    if (!user || !user.hashedRefreshToken)
      throw new ForbiddenException('Access Denied');

    const tokenMatches = await bcrypt.compare(
      refreshToken,
      user.hashedRefreshToken,
    );

    if (!tokenMatches)
      throw new ForbiddenException('Access Denied');

    const tokens = await this.generateTokens(user);
    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  }

  // 5. FORGOT PASSWORD
  async forgotPassword(dto: ForgotPasswordDto) {
    try {
      const user = await this.usersService.findByEmail(dto.email);

      const resetToken = await this.jwtService.signAsync(
        { sub: user.id, email: user.email },
        {
          secret: this.configService.get('JWT_RESET_SECRET'),
          expiresIn: '1h',
        },
      );

      const frontendUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3001';
      const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;

      await this.mailService.sendPasswordReset(user.email, user.firstName, resetLink);
    } catch (e) {
      // Не раскрываем, существует ли email в системе
    }

    return { message: 'Якщо email існує в системі, лист з інструкцією буде надіслано' };
  }

  // 6. RESET PASSWORD
  async resetPassword(dto: ResetPasswordDto) {
    let payload: any;

    try {
      payload = await this.jwtService.verifyAsync(dto.token, {
        secret: this.configService.get('JWT_RESET_SECRET'),
      });
    } catch (e) {
      throw new BadRequestException('Токен невалідний або прострочений');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    await this.usersService.update(payload.sub, { password: hashedPassword });

    return { message: 'Пароль успішно змінено' };
  }

  // --- PRIVATE HELPERS ---

  async updateRefreshTokenHash(userId: number, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.update(userId, { hashedRefreshToken: hash });
  }

  async generateTokens(user: any) {
    const payload = {
      sub: user.id,
      role: user.role,
    };

    const [at, rt] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: '7d',
      }),
    ]);

    return {
      access_token: at,
      refresh_token: rt,
    };
  }

  async verifyEmail(token: string) {
    let payload: any;

    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('JWT_VERIFY_SECRET') || this.configService.get('JWT_ACCESS_SECRET'),
      });
    } catch (e) {
      throw new BadRequestException('Токен підтвердження невалідний або прострочений');
    }

    await this.usersService.update(payload.sub, { isVerified: true });

    return { message: 'Email успішно підтверджено' };
  }

}