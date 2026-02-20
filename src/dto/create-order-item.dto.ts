import { IsString, IsNotEmpty, IsInt, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateOrderItemDto {
    @IsInt()
    @IsOptional()
    serviceId?: number;

    @IsInt()
    @IsOptional()
    partId?: number;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsInt()
    @Min(1)
    @IsOptional()
    quantity?: number = 1;

    @IsNumber()
    @Min(0)
    price: number;
}
