import { IsString, IsNotEmpty, IsOptional, IsInt, IsDateString, Matches } from 'class-validator';

export class CreateQuickOrderDto {
  @IsString()
  @IsNotEmpty()
  clientName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+/, { message: 'Номер телефону повинен починатися з +' })
  clientPhone: string;

  @IsString()
  @IsNotEmpty()
  carBrand: string;

  @IsOptional()
  @IsString()
  carModel?: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsInt()
  estimatedMin?: number;
}
