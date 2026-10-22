import { applyDecorators } from '@nestjs/common';
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
import { TaskStatus } from '../../../domain/value-objects/task-status.vo';
import { IsCalendarDate } from '../../../../../shared/presentation/validators/is-calendar-date';

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
 * The field rules shared by the create and replace bodies (plan 003 → DTOs), so the two can
 * never drift apart (AC-03.9.3: all create rules apply to edits).
 */
export const TaskFields = {
  /** 3–120 characters after trimming, no control characters (AC-03.1.2, AC-03.1.8). */
  title: () =>
    applyDecorators(
      ApiProperty({
        minLength: 3,
        maxLength: 120,
        example: 'Write release notes',
      }),
      Transform(trimUnless(CONTROL)),
      IsString(),
      Length(3, 120),
      Matches(/^\P{Cc}*$/u, {
        message: 'title must not contain control characters',
      }),
    ),

  /** Optional, at most 2000 characters after trimming; blank means none (AC-03.1.3). */
  description: () =>
    applyDecorators(
      ApiPropertyOptional({ type: String, maxLength: 2000, nullable: true }),
      Transform(trimUnless(CONTROL_EXCEPT_LINE_BREAK)),
      IsOptional(),
      IsString(),
      MaxLength(2000),
      Matches(/^[\P{Cc}\n\r]*$/u, {
        message:
          'description must not contain control characters other than line breaks',
      }),
    ),

  /** Exact upper case (AC-03.1.4); optional on create (defaults to PENDING). */
  status: ({ required }: { required: boolean }) =>
    applyDecorators(
      required
        ? ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
        : ApiPropertyOptional({ enum: TaskStatus, enumName: 'TaskStatus' }),
      ...(required ? [] : [IsOptional()]),
      IsIn(Object.values(TaskStatus), {
        message: 'status must be one of PENDING, IN_PROGRESS, DONE',
      }),
    ),

  /** A real calendar date, past dates allowed (AC-03.1.5). */
  dueDate: () =>
    applyDecorators(
      ApiPropertyOptional({
        type: String,
        format: 'date',
        nullable: true,
        example: '2026-10-31',
      }),
      IsOptional(),
      IsCalendarDate(),
    ),

  /**
   * Distinct team ids. 11–100 pass here and the domain answers `422 TOO_MANY_TEAMS`; above 100
   * is a payload guard (400). Unknown or foreign ids → `422 UNKNOWN_TEAMS` (AC-03.1.6).
   */
  teamIds: ({ required }: { required: boolean }) =>
    applyDecorators(
      (required ? ApiProperty : ApiPropertyOptional)({
        type: [String],
        format: 'uuid',
        maxItems: 100,
        uniqueItems: true,
        description: 'At most 10 distinct ids of your teams.',
      }),
      ...(required ? [] : [IsOptional()]),
      IsArray(),
      ArrayMaxSize(100),
      IsUUID('all', {
        each: true,
        message: 'each value in teamIds must be a UUID',
      }),
      ArrayUnique({ message: 'teamIds must not contain duplicates' }),
    ),
};
