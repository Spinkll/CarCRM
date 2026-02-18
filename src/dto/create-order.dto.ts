import { IsString, IsNotEmpty, IsInt, IsOptional, IsArray, IsNumber, IsEnum } from 'class-validator';
import { OrderStatus } from '@prisma/client'; 

export class CreateOrderDto {
  @IsInt()
  @IsNotEmpty()
  vehicleId: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsOptional()
  services?: string[];

  @IsNumber()
  @IsOptional()
  totalCost?: number;
  
  @IsInt()
  @IsOptional()
  mileage?: number; 
    
  @IsInt()
  @IsOptional()
  customerId?: number;
}

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;
}