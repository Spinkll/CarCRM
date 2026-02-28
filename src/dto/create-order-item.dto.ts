import { IsString, IsNotEmpty, IsInt, IsOptional, IsNumber, Min, IsIn } from 'class-validator';

export class CreateOrderItemDto {
    @IsInt()
    @IsOptional()
    serviceId?: number;

    @IsInt()
    @IsOptional()
    partId?: number;

    @IsInt()
    @IsOptional()
    mechanicId?: number;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsInt()
    @Min(1)
    @IsOptional()
    quantity?: number = 1;

    @IsString() 
    @IsOptional()
    sku?: string;

    @IsNumber()
    @Min(0)
    price: number; 

    @IsString()
    @IsIn(['SERVICE', 'PART']) 
    @IsOptional() 
    type?: string;
}