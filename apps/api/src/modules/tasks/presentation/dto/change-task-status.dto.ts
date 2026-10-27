import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { TaskStatus } from '../../application/interfaces/task-read-model.interface';

export class ChangeTaskStatusDto {
  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  @IsIn(Object.values(TaskStatus), {
    message: 'status must be one of PENDING, IN_PROGRESS, DONE',
  })
  status!: TaskStatus;
}
