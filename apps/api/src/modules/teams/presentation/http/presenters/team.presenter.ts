import type { TeamView } from '../../../application/ports/team.read-model';
import type { TeamResponseDto } from '../dto/team-response.dto';

/** TeamView → the documented response fields only, timestamps as ISO 8601 strings. */
export function toTeamResponse(team: TeamView): TeamResponseDto {
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
