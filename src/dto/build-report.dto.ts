import { IsString, IsOptional, IsArray, IsObject, IsIn } from 'class-validator';

export class BuildReportDto {
  @IsString()
  @IsIn(['order', 'payment', 'user', 'car']) // Дозволені таблиці для звітів
  entity: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsObject()
  filters?: Record<string, any>; // Тут будуть динамічні фільтри, напр: { status: 'PAID' }

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fields?: string[]; // Які колонки повернути: ['id', 'totalAmount', 'createdAt']
}