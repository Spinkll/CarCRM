import { IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString({ message: 'Назва послуги має бути рядком' })
  name: string;

  @IsNumber({}, { message: 'Ціна має бути числом' })
  @Min(0, { message: 'Ціна не може бути від\'ємною' })
  price: number;

  @IsOptional()
  @IsNumber()
  estimatedMin?: number; 
}