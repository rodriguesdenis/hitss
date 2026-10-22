import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { TaskStatus } from '../../../domain/value-objects/task-status.vo';

export class ChangeTaskStatusDto {
  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  @IsIn(Object.values(TaskStatus), {
    message: 'status must be one of PENDING, IN_PROGRESS, DONE',
  })
  status!: TaskStatus;
}
