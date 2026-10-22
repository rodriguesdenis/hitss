import { ApiProperty } from '@nestjs/swagger';
import { TaskStatus } from '../../domain/value-objects/task-status';
import { TeamChipDto } from './team-chip.dto';

/** A task in responses (api-contracts → Task resource). */
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
}
