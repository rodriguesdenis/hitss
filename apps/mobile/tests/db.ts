import type { TaskResponseDto, TeamResponseDto } from '@hitss/api-client';

import { tasks, teams } from './fixtures';

export const db: { teams: TeamResponseDto[]; tasks: TaskResponseDto[] } = {
  teams: [],
  tasks: [],
};

export function resetDb(): void {
  db.teams = structuredClone(teams);
  db.tasks = structuredClone(tasks);
}
