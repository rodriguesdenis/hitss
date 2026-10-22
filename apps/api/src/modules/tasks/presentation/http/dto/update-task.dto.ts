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

/**
 * Body of `PUT /api/v1/tasks/:id`: a full replacement with the create rules (AC-03.9.3). `status`
 * and `teamIds` are required here, so they are redeclared without the create body's
 * `@IsOptional` (inherited, it would let them be omitted); an omitted description or due date is
 * cleared (AC-03.9.1, AC-03.9.2).
 */
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
