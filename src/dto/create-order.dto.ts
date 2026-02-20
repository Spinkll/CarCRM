import { IsString, IsNotEmpty, IsInt, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class CreateOrderDto {
  @IsInt()
  @IsNotEmpty()
  vehicleId: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsInt()
  @IsOptional()
  mileage?: number;

  @IsInt()
  @IsOptional()
  customerId?: number;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}