import { ApiProperty } from '@nestjs/swagger';
import {
  TaskStatus,
  type TaskView,
} from '../../../application/interfaces/task-read-model.interface';

export class TeamChipDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Mobile' }) name!: string;
  @ApiProperty({ example: '#7C3AED', description: '`#RRGGBB`, upper case.' })
  colorHex!: string;
}

export class TaskResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Implement login screen' }) title!: string;
  @ApiProperty({ type: String, nullable: true }) description!: string | null;
  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  status!: TaskStatus;
  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    example: '2026-10-31',
  })
  dueDate!: string | null;
  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completedAt!: string | null;
  @ApiProperty({
    description: 'Not DONE and due before today in UTC.',
  })
  isOverdue!: boolean;
  @ApiProperty({
    type: [TeamChipDto],
    description: 'Live teams, ordered by name.',
  })
  teams!: TeamChipDto[];
  @ApiProperty({ example: 3 }) version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;

  static from(view: TaskView): TaskResponseDto {
    return {
      id: view.id,
      title: view.title,
      description: view.description,
      status: view.status,
      dueDate: view.dueDate,
      completedAt: view.completedAt?.toISOString() ?? null,
      isOverdue: view.isOverdue,
      teams: view.teams.map(({ id, name, colorHex }) => ({
        id,
        name,
        colorHex,
      })),
      version: view.version,
      createdAt: view.createdAt.toISOString(),
      updatedAt: view.updatedAt.toISOString(),
    };
  }
}
