import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/presentation/dto/pagination-query.dto';
import { sortValues } from '../../../../../shared/presentation/sort';
import { TEAM_SORT_FIELDS } from '../../../application/ports/team.read-model';

export const TEAM_SORTS = sortValues(TEAM_SORT_FIELDS);

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Query of `GET /api/v1/teams`. */
export class ListTeamsQueryDto extends PaginationQueryDto {
  /**
   * Case-insensitive substring of the name, matched literally (`%` and `_` too). Trimmed; blank
   * or over 100 characters → 400 naming `search` (AC-02.3.2).
   */
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;

  /** A field, `-` for descending; ties are broken by id (AC-02.4.x). */
  @ApiPropertyOptional({ enum: TEAM_SORTS, default: '-createdAt' })
  @IsOptional()
  @IsIn(TEAM_SORTS)
  sort: string = '-createdAt';
}
