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

const trimUnless =
  (forbidden: RegExp) =>
  ({ value }: TransformFnParams): unknown =>
    typeof value === 'string' && !forbidden.test(value) ? value.trim() : value;

export class CreateTeamDto {
  @ApiProperty({ minLength: 2, maxLength: 50, example: 'Mobile' })
  @Transform(trimUnless(CONTROL))
  @IsString()
  @Length(2, 50)
  @Matches(/^\P{Cc}*$/u, {
    message: 'name must not contain control characters',
  })
  name!: string;

  @ApiProperty({ pattern: '^#[0-9A-Fa-f]{6}$', example: '#7C3AED' })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'colorHex must be a #RRGGBB hex color',
  })
  colorHex!: string;

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
