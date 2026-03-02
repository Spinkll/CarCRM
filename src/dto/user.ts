import { IsOptional, IsEmail, IsString, MinLength, IsInt, Min, Max, IsEnum, IsNotEmpty, IsNumber } from 'class-validator';
import { UserRole } from '@prisma/client';

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

  @IsOptional()
  @IsEnum(UserRole, { message: 'Невірна роль користувача' })
  role?: UserRole;

  @IsOptional()
  @IsInt({ message: 'Відсоток має бути цілим числом' })
  @Min(0, { message: 'Відсоток не може бути менше 0' })
  @Max(100, { message: 'Відсоток не може бути більше 100' })
  commissionRate?: number;

  @IsOptional()
  @IsNumber({}, { message: 'Ставка має бути числом' })
  @Min(0, { message: 'Ставка не може бути від\'ємною' })
  baseSalary?: number;
}

export class ChangePasswordDto {
  @IsString({ message: 'Поточний пароль має бути рядком' })
  @IsNotEmpty({ message: 'Введіть поточний пароль' })
  currentPassword: string;

  @IsString({ message: 'Новий пароль має бути рядком' })
  @IsNotEmpty({ message: 'Введіть новий пароль' })
  @MinLength(6, { message: 'Новий пароль має містити мінімум 6 символів' })
  newPassword: string;
}