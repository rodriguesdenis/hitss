import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

const CONTROL = /\p{Cc}/u;
const CONTROL_EXCEPT_LINE_BREAK = /(?![\n\r])\p{Cc}/u;

/**
 * Trims a string unless it holds a forbidden control character: trimming first would erase a
 * leading or trailing one ("\nMobile") and let it pass (AC-02.1.10, AC-02.1.11). The untouched
 * value then fails the `@Matches` rule below.
 */
const trimUnless =
  (forbidden: RegExp) =>
  ({ value }: TransformFnParams): unknown =>
    typeof value === 'string' && !forbidden.test(value) ? value.trim() : value;

/** Body of `POST /api/v1/teams`. Any other field → 400 naming it (global pipe, AC-02.1.8). */
export class CreateTeamDto {
  /** 2–50 characters after trimming, no control characters (AC-02.1.2, AC-02.1.10). */
  @ApiProperty({ minLength: 2, maxLength: 50, example: 'Mobile' })
  @Transform(trimUnless(CONTROL))
  @IsString()
  @Length(2, 50)
  @Matches(/^\P{Cc}*$/u, {
    message: 'name must not contain control characters',
  })
  name!: string;

  /** `#RRGGBB` in any letter case; stored in upper case (AC-02.1.3). */
  @ApiProperty({ pattern: '^#[0-9A-Fa-f]{6}$', example: '#7C3AED' })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'colorHex must be a #RRGGBB hex color',
  })
  colorHex!: string;

  /**
   * Optional, at most 280 characters after trimming; blank means none (AC-02.1.4). Line breaks
   * are allowed, other control characters are not (AC-02.1.11).
   */
  @ApiPropertyOptional({ type: String, maxLength: 280, nullable: true })
  @Transform(trimUnless(CONTROL_EXCEPT_LINE_BREAK))
  @IsOptional()
  @IsString()
  @MaxLength(280)
  @Matches(/^[\P{Cc}\n\r]*$/u, {
    message:
      'description must not contain control characters other than line breaks',
  })
  description?: string | null;
}
