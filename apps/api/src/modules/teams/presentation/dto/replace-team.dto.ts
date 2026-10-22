import { CreateTeamDto } from './create-team.dto';

/**
 * Body of `PUT /api/v1/teams/:id`: a full replacement with the creation rules (AC-02.6.2); an
 * omitted description clears it (AC-02.6.3).
 */
export class ReplaceTeamDto extends CreateTeamDto {}
