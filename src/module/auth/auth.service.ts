import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { RegisterDto, LoginDto } from 'src/dto/auth';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService, 
    private jwtService: JwtService,
  ) {}

  // 1. РЕЄСТРАЦІЯ
  async register(dto: RegisterDto) {  
    const user = await this.usersService.createUser(dto); 
    
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

}