import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateServiceRequestDto {
  @IsInt()
  @IsNotEmpty()
  carId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}