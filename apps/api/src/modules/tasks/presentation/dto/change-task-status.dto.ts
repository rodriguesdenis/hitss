import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { TaskStatus } from '../../domain/value-objects/task-status';

/**
 * Body of `PATCH /api/v1/tasks/:id/status`: the status and nothing else. `version`,
 * `completedAt` and any other field → 400 naming it (global pipe, AC-03.10.4).
 */
export class ChangeTaskStatusDto {
  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  @IsIn(Object.values(TaskStatus), {
    message: 'status must be one of PENDING, IN_PROGRESS, DONE',
  })
  status!: TaskStatus;
}
