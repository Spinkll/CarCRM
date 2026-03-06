import { IsNumber, Min, IsEnum } from 'class-validator';
import { PaymentMethod } from 'generated/prisma/enums';


export class CreatePaymentDto {
  @IsNumber({}, { message: 'Сума має бути числом' })
  @Min(1, { message: 'Сума оплати має бути більшою за 0' })
  amount: number;

  @IsEnum(PaymentMethod, { message: 'Невідомий метод оплати' })
  method: PaymentMethod; 
}