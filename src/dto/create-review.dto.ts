import { IsInt, Min, Max, IsString, IsOptional } from 'class-validator';

export class CreateReviewDto {
  @IsInt({ message: 'Оцінка має бути цілим числом' })
  @Min(1, { message: 'Мінімальна оцінка 1' })
  @Max(5, { message: 'Максимальна оцінка 5' })
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}