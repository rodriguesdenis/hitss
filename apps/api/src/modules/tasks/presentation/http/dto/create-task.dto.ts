import {
  ApiProperty,
  ApiPropertyOptional,
  type ApiPropertyOptions,
} from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { IsCalendarDate } from '../../../../../shared/presentation/validators/is-calendar-date';
import { TaskStatus } from '../../../domain/value-objects/task-status.vo';

const CONTROL = /\p{Cc}/u;
const CONTROL_EXCEPT_LINE_BREAK = /(?![\n\r])\p{Cc}/u;

const trimUnless =
  (forbidden: RegExp) =>
  ({ value }: TransformFnParams): unknown =>
    typeof value === 'string' && !forbidden.test(value) ? value.trim() : value;

export const STATUS_RULE = {
  message: 'status must be one of PENDING, IN_PROGRESS, DONE',
};
export const TEAM_IDS_DOC: ApiPropertyOptions = {
  type: [String],
  format: 'uuid',
  maxItems: 100,
  uniqueItems: true,
  description: 'At most 10 distinct ids of your teams.',
};

export class CreateTaskDto {
  @ApiProperty({ minLength: 3, maxLength: 120, example: 'Write release notes' })
  @Transform(trimUnless(CONTROL))
  @IsString()
  @Length(3, 120)
  @Matches(/^\P{Cc}*$/u, {
    message: 'title must not contain control characters',
  })
  title!: string;

  @ApiPropertyOptional({ type: String, maxLength: 2000, nullable: true })
  @Transform(trimUnless(CONTROL_EXCEPT_LINE_BREAK))
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  @Matches(/^[\P{Cc}\n\r]*$/u, {
    message:
      'description must not contain control characters other than line breaks',
  })
  description?: string | null;

  @ApiPropertyOptional({ enum: TaskStatus, enumName: 'TaskStatus' })
  @IsOptional()
  @IsIn(Object.values(TaskStatus), STATUS_RULE)
  status?: TaskStatus;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    example: '2026-10-31',
  })
  @IsOptional()
  @IsCalendarDate()
  dueDate?: string | null;

  @ApiPropertyOptional(TEAM_IDS_DOC)
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', {
    each: true,
    message: 'each value in teamIds must be a UUID',
  })
  @ArrayUnique({ message: 'teamIds must not contain duplicates' })
  teamIds?: string[];
}
