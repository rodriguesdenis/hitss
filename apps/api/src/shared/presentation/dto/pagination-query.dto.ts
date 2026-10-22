import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export const toInteger = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;

export const MAX_OFFSET = 1_000_000;

export class PaginationQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_OFFSET, default: 0 })
  @Transform(toInteger)
  @IsInt()
  @Min(0)
  @Max(MAX_OFFSET)
  offset: number = 0;
}
