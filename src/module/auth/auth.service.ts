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
    
    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);
    
    return tokens;
  }

  // 2. ЛОГІН
  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Невірний email або пароль');

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) throw new UnauthorizedException('Невірний email або пароль');

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);
    
    return tokens;
  }

  // 3. LOGOUT (Вихід)
  async logout(userId: number) {
    await this.usersService.update(userId, { hashedRefreshToken: null });
    return { message: 'Logged out successfully' };
  }

  // 4. REFRESH (Оновлення)
  async refreshTokens(userId: number, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.hashedRefreshToken) throw new ForbiddenException('Access Denied');

    const tokenMatches = await bcrypt.compare(refreshToken, user.hashedRefreshToken);
    if (!tokenMatches) throw new ForbiddenException('Access Denied');

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshTokenHash(user.id, tokens.refresh_token);
    
    return tokens;
  }

  // --- PRIVATE HELPERS ---

  async updateRefreshTokenHash(userId: number, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.update(userId, { hashedRefreshToken: hash });
  }

  async generateTokens(userId: number, email: string, role: string) {
    const [at, rt] = await Promise.all([
      // Access Token (15 хвилин)
      this.jwtService.signAsync(
        { sub: userId, email, role },
        { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '15m' },
      ),
      // Refresh Token (7 днів)
      this.jwtService.signAsync(
        { sub: userId, email, role },
        { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d' },
      ),
    ]);

    return {
      access_token: at,
      refresh_token: rt,
      user: { id: userId, email, role } 
    };
  }
}