import type { Page, PageRequest } from '../../../../shared/application/page';
import type { PageMeta } from '../../../../shared/presentation/openapi/api-envelope';
import { toPageMeta } from '../../../../shared/presentation/page-meta';
import type { TaskView } from '../../application/interfaces/task-read-model.interface';
import { TaskResponseDto } from './task-response.dto';

export class TaskPageResponseDto {
  data!: TaskResponseDto[];
  meta!: PageMeta;

  static from(found: Page<TaskView>, page: PageRequest): TaskPageResponseDto {
    return {
      data: found.items.map((item) => TaskResponseDto.from(item)),
      meta: toPageMeta(page, found.items.length, found.total),
    };
  }
}
