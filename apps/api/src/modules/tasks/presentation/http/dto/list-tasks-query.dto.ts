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
import { TASK_SORT_FIELDS } from '../../../application/interfaces/task-read-model.interface';
import { TaskStatus } from '../../../application/interfaces/task-read-model.interface';

export const TASK_SORTS = sortValues(TASK_SORT_FIELDS);

const trim = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' ? value.trim() : value;

const toStatusList = ({ value }: TransformFnParams): unknown =>
  typeof value === 'string' || Array.isArray(value)
    ? [value].flat().join(',').split(',')
    : value;

export class ListTasksQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('all', { message: 'teamId must be a UUID' })
  teamId?: string;

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

  @ApiPropertyOptional({ minLength: 1, maxLength: 100 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional({ enum: TASK_SORTS, default: '-createdAt' })
  @IsOptional()
  @IsIn(TASK_SORTS, { message: `sort must be one of ${TASK_SORTS.join(', ')}` })
  sort: string = '-createdAt';
}
