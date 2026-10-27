import type { TeamView } from '../../../application/interfaces/team-read-model.interface';
import type { TeamResponseDto } from '../dto/team-response.dto';

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
