import type { Page, PageRequest } from '../../../../shared/application/page';
import type { PageMeta } from '../../../../shared/presentation/openapi/api-envelope';
import { toPageMeta } from '../../../../shared/presentation/page-meta';
import type { TeamView } from '../../application/interfaces/team-read-model.interface';
import { TeamResponseDto } from './team-response.dto';

export class TeamPageResponseDto {
  data!: TeamResponseDto[];
  meta!: PageMeta;

  static from(found: Page<TeamView>, page: PageRequest): TeamPageResponseDto {
    return {
      data: found.items.map((item) => TeamResponseDto.from(item)),
      meta: toPageMeta(page, found.items.length, found.total),
    };
  }
}
