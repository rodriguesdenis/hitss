import type { TeamDetails } from '../application/views/team.view';
import type { TeamResponseDto } from './dto/team-response.dto';

/** TeamDetails → the documented response fields only, timestamps as ISO 8601 strings. */
export function toTeamResponse(team: TeamDetails): TeamResponseDto {
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
