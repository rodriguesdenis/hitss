import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

/**
 * A query-string integer: only an optional minus and digits convert; anything else (`''`, `1.5`,
 * `ten`, a repeated parameter) stays as given and fails `@IsInt`. `Number()` would turn `''`
 * into 0 and let it pass.
 */
export const toInteger = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value;

/**
 * Offset pagination of every list endpoint (ADR-0006). Extend it with the endpoint's own
 * filters; the global pipe refuses unknown parameters (AC-02.2.9).
 */
export class PaginationQueryDto {
  /** 1–100, default 20 (AC-02.2.2, AC-02.2.5). */
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @Transform(toInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  /** ≥ 0, default 0; past the end is an empty page, not an error (AC-02.2.4). */
  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @Transform(toInteger)
  @IsInt()
  @Min(0)
  offset: number = 0;
}
