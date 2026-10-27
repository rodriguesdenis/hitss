import { ApiProperty } from '@nestjs/swagger';
import type { TeamView } from '../../../application/interfaces/team-read-model.interface';

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
    description: 'Incremented on every write (informational; last write wins)',
    example: 1,
  })
  version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;

  static from(team: TeamView): TeamResponseDto {
    return {
      id: team.id,
      name: team.name,
      colorHex: team.colorHex,
      description: team.description,
      taskCount: team.taskCount,
      version: team.version,
      createdAt: team.createdAt.toISOString(),
      updatedAt: team.updatedAt.toISOString(),
    };
  }
}
