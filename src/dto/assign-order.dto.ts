import { IsInt, IsOptional } from 'class-validator';

export class AssignOrderDto {
    @IsInt()
    @IsOptional()
    managerId?: number;

    @IsInt()
    @IsOptional()
    mechanicId?: number;
}
