import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { RefreshTokenStrategy } from 'src/jwt/refreshToken.strategy';
import { UsersModule } from '../users/users.module';
import { AccessTokenStrategy } from 'src/jwt/accessToken.strategy';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports:[PassportModule,JwtModule.register({}),UsersModule,ConfigModule],
  providers: [AuthService, AccessTokenStrategy,RefreshTokenStrategy],
  controllers: [AuthController]
})
export class AuthModule {}
