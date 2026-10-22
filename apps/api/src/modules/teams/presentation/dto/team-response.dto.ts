import { ApiProperty } from '@nestjs/swagger';

/** A team in responses (api-contracts → Teams). `version` is also sent as the ETag. */
export class TeamResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Mobile', minLength: 2, maxLength: 50 })
  name!: string;
  @ApiProperty({
    description: '#RRGGBB, upper case',
    example: '#7C3AED',
    pattern: '^#[0-9A-F]{6}$',
  })
  colorHex!: string;
  @ApiProperty({ type: String, nullable: true, maxLength: 280 }) description!:
    string | null;
  @ApiProperty({ description: 'Active tasks assigned to the team', example: 0 })
  taskCount!: number;
  @ApiProperty({
    description: 'Optimistic-concurrency version, also the ETag',
    example: 1,
  })
  version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
