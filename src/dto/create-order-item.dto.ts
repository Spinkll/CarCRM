import { IsString, IsNotEmpty, IsInt, IsOptional, IsNumber, Min, IsIn } from 'class-validator';

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

    @IsString() // ДОДАНО: обов'язково вказуємо тип для sku
    @IsOptional()
    sku?: string;

    @IsNumber()
    @Min(0)
    price: number; // Це фінальна ціна продажу клієнту (retailPrice або Service.price)

    @IsString()
    @IsIn(['SERVICE', 'PART']) 
    @IsOptional() // ВИПРАВЛЕНО: прибрано зайвий "!"
    type?: string;
}