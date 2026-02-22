import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches
} from 'class-validator';

export class LoginDto {

  @IsEmail({}, { message: 'Некоректний формат email' })
  @IsNotEmpty({ message: 'Email є обовʼязковим' })
  email: string;

  @IsNotEmpty({ message: 'Пароль є обовʼязковим' })
  password: string;
}

export class RegisterDto {
  @IsEmail({}, { message: 'Email має бути валідним' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Пароль має містити мінімум 8 символів' })
  password: string;

  @IsString()
  @MinLength(2, { message: 'Імʼя має містити мінімум 2 символи' })
  firstName: string;

  @IsString()
  @MinLength(2, { message: 'Прізвище має містити мінімум 2 символи' })
  lastName: string;

  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'Телефон має бути у форматі +380XXXXXXXXX' })
  phone: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Некоректний формат email' })
  @IsNotEmpty({ message: 'Email є обовʼязковим' })
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Токен є обовʼязковим' })
  token: string;

  @IsString()
  @MinLength(8, { message: 'Пароль має містити мінімум 8 символів' })
  password: string;
}

