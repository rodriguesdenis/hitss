import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
import { TaskStatus } from '../../domain/value-objects/task-status';
import { IsCalendarDate } from '../validators/is-calendar-date';

const CONTROL = /\p{Cc}/u;
const CONTROL_EXCEPT_LINE_BREAK = /(?![\n\r])\p{Cc}/u;

/**
 * Trims a string unless it holds a forbidden control character: trimming first would erase a
 * leading or trailing one ("\tShip") and let it pass (AC-03.1.8). The untouched value then
 * fails the `@Matches` rule.
 */
const trimUnless =
  (forbidden: RegExp) =>
  ({ value }: TransformFnParams): unknown =>
    typeof value === 'string' && !forbidden.test(value) ? value.trim() : value;

/**
 * Body of `POST /api/v1/tasks` (plan 003 → DTOs). Any other field, owner fields included,
 * → 400 naming it (global pipe, AC-03.1.7, AC-03.12.6).
 */
export class CreateTaskDto {
  /** 3–120 characters after trimming, no control characters (AC-03.1.2, AC-03.1.8). */
  @ApiProperty({ minLength: 3, maxLength: 120, example: 'Write release notes' })
  @Transform(trimUnless(CONTROL))
  @IsString()
  @Length(3, 120)
  @Matches(/^\P{Cc}*$/u, {
    message: 'title must not contain control characters',
  })
  title!: string;

  /** Optional, at most 2000 characters after trimming; blank means none (AC-03.1.3). */
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

  /** Defaults to PENDING; exact upper case (AC-03.1.4). */
  @ApiPropertyOptional({ enum: TaskStatus, enumName: 'TaskStatus' })
  @IsOptional()
  @IsIn(Object.values(TaskStatus), {
    message: 'status must be one of PENDING, IN_PROGRESS, DONE',
  })
  status?: TaskStatus;

  /** A real calendar date, past dates allowed (AC-03.1.5). */
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    nullable: true,
    example: '2026-10-31',
  })
  @IsOptional()
  @IsCalendarDate()
  dueDate?: string | null;

  /**
   * Distinct team ids. 11–100 pass here and the domain answers `422 TOO_MANY_TEAMS`; above 100
   * is a payload guard (400). Unknown or foreign ids → `422 UNKNOWN_TEAMS` (AC-03.1.6).
   */
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    maxItems: 100,
    uniqueItems: true,
    description: 'At most 10 distinct ids of your teams.',
  })
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
