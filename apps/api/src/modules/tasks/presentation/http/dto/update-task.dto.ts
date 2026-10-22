import { ApiProperty, OmitType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsUUID,
} from 'class-validator';
import { TaskStatus } from '../../../domain/value-objects/task-status.vo';
import { CreateTaskDto, STATUS_RULE, TEAM_IDS_DOC } from './create-task.dto';

export class UpdateTaskDto extends OmitType(CreateTaskDto, [
  'status',
  'teamIds',
] as const) {
  @ApiProperty({ enum: TaskStatus, enumName: 'TaskStatus' })
  @IsIn(Object.values(TaskStatus), STATUS_RULE)
  status!: TaskStatus;

  @ApiProperty(TEAM_IDS_DOC)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', {
    each: true,
    message: 'each value in teamIds must be a UUID',
  })
  @ArrayUnique({ message: 'teamIds must not contain duplicates' })
  teamIds!: string[];
}
