import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { PaginationQueryDto } from '../../../../../shared/presentation/dto/pagination-query.dto';
import { sortValues } from '../../../../../shared/presentation/sort';
import { TASK_SORT_FIELDS } from '../../../application/ports/task.read-model';
import { TaskStatus } from '../../../domain/value-objects/task-status.vo';

export const TASK_SORTS = sortValues(TASK_SORT_FIELDS);

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

/**
 * `status=A,B` and `status=A&status=B` both become `['A', 'B']`. An empty value stays an empty
 * entry (`PENDING,` → `['PENDING', '']`) and fails `@IsIn` (AC-03.4.3).
 */
const toStatusList = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' || Array.isArray(value)
    ? [value].flat().join(',').split(',')
    : value;

/** Query of `GET /api/v1/tasks` (plan 003 → DTOs). Unknown parameters → 400 (global pipe). */
export class ListTasksQueryDto extends PaginationQueryDto {
  /**
   * Only tasks assigned to this team. A well-formed id that is not one of my live teams → an
   * empty page, not an error (AC-03.3.2); a malformed one → 400 on `teamId` (AC-03.3.3).
   */
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'teamId must be a UUID' })
  teamId?: string;

  /**
   * Any of these statuses, comma-separated or repeated; repeats are tolerated (AC-03.4.2). An
   * unknown, lower-case or empty value → 400 on `status` (AC-03.4.3).
   */
  @ApiPropertyOptional({
    type: [String],
    enum: TaskStatus,
    enumName: 'TaskStatus',
    example: 'PENDING,IN_PROGRESS',
    description: 'Comma-separated or repeated.',
  })
  @Transform(toStatusList)
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(Object.values(TaskStatus), {
    each: true,
    message:
      'status must be a comma-separated list of PENDING, IN_PROGRESS, DONE',
  })
  status?: TaskStatus[];

  /**
   * Case-insensitive substring of the title or the description, matched literally (`%`, `_` and
   * `\` too). Trimmed; blank or over 100 characters → 400 on `search` (AC-03.5.2, AC-03.5.3).
   */
  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;

  /**
   * One field, `-` for descending; ties are broken by id in the same direction (AC-03.6.x).
   * Anything else → 400 on `sort` (AC-03.6.5).
   */
  @ApiPropertyOptional({ enum: TASK_SORTS, default: '-createdAt' })
  @IsOptional()
  @IsIn(TASK_SORTS, { message: `sort must be one of ${TASK_SORTS.join(', ')}` })
  sort: string = '-createdAt';
}
