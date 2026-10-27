import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { PaginationQueryDto } from '../../../../shared/presentation/dto/pagination-query.dto';
import { parseSort, sortValues } from '../../../../shared/presentation/sort';
import {
  ListTeamsCriteria,
  TEAM_SORT_FIELDS,
  TeamSortField,
} from '../../application/interfaces/team-read-model.interface';

export const TEAM_SORTS = sortValues(TEAM_SORT_FIELDS);

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class ListTeamsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional({ enum: TEAM_SORTS, default: '-createdAt' })
  @IsOptional()
  @IsIn(TEAM_SORTS)
  sort: string = '-createdAt';

  toCriteria(): ListTeamsCriteria {
    return {
      page: { limit: this.limit, offset: this.offset },
      search: this.search,
      sort: parseSort(this.sort as TeamSortField | `-${TeamSortField}`),
    };
  }
}
