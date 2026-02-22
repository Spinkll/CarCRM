import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';


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

export class ChangePasswordDto {
  @IsString({ message: 'Поточний пароль має бути рядком' })
  @IsNotEmpty({ message: 'Введіть поточний пароль' })
  currentPassword: string;

  @IsString({ message: 'Новий пароль має бути рядком' })
  @IsNotEmpty({ message: 'Введіть новий пароль' })
  @MinLength(6, { message: 'Новий пароль має містити мінімум 6 символів' })
  newPassword: string;
}