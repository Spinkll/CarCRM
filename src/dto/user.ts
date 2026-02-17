import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';


export class UpdateUserDto {
  @IsOptional()
  @IsEmail({}, { message: 'Email має бути валідним' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Імʼя має містити мінімум 3 символи' })
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Прізвище має містити мінімум 3 символи' })
  lastName?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Пароль має містити мінімум 8 символів' })
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}