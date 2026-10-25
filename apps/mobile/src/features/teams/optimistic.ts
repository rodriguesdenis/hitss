import type {
  CreateTeamDto,
  TaskResponseDto,
  TeamChipDto,
  TeamResponseDto,
  UpdateTeamDto,
} from '@hitss/api-client';
import type { QueryClient } from '@tanstack/react-query';

import {
  insertInLists,
  removeFromLists,
  replaceIdInLists,
  setDetail,
  updateInLists,
} from '@/offline';

type Team = TeamResponseDto;
type Task = TaskResponseDto;

export function acceptsTeam(
  params: Record<string, unknown>,
  team: Team,
): boolean {
  const search = (params.search as string | undefined)?.toLowerCase();
  return !search || team.name.toLowerCase().includes(search);
}

const byName = (a: TeamChipDto, b: TeamChipDto) => a.name.localeCompare(b.name);

function updateTasksChips(
  queryClient: QueryClient,
  update: (teams: TeamChipDto[], task: Task) => TeamChipDto[],
): void {
  const apply = (task: Task): Task => {
    const teams = update(task.teams, task);
    return teams === task.teams ? task : { ...task, teams };
  };
  updateInLists<Task>(queryClient, 'tasks', apply);
  for (const query of queryClient
    .getQueryCache()
    .findAll({ queryKey: ['tasks', 'detail'] })) {
    const data = query.state.data as { data: Task } | undefined;
    if (data) {
      const next = apply(data.data);
      if (next !== data.data) {
        queryClient.setQueryData(query.queryKey, { data: next });
      }
    }
  }
}

export function setChip(
  queryClient: QueryClient,
  id: string,
  chip: TeamChipDto,
): void {
  updateTasksChips(queryClient, (teams) =>
    teams.some((team) => team.id === id)
      ? teams.map((team) => (team.id === id ? chip : team)).sort(byName)
      : teams,
  );
}

export function stripChip(queryClient: QueryClient, id: string): string[] {
  const touched: string[] = [];
  updateTasksChips(queryClient, (teams, task) => {
    if (!teams.some((team) => team.id === id)) {
      return teams;
    }
    touched.push(task.id);
    return teams.filter((team) => team.id !== id);
  });
  return [...new Set(touched)];
}

export function restoreChip(
  queryClient: QueryClient,
  chip: TeamChipDto,
  taskIds: string[],
): void {
  updateTasksChips(queryClient, (teams, task) =>
    taskIds.includes(task.id) && !teams.some((team) => team.id === chip.id)
      ? [...teams, chip].sort(byName)
      : teams,
  );
}

export function findTeam(
  queryClient: QueryClient,
  id: string,
): Team | undefined {
  const detail = queryClient.getQueryData<{ data: Team }>([
    'teams',
    'detail',
    id,
  ]);
  if (detail) {
    return detail.data;
  }
  for (const query of queryClient
    .getQueryCache()
    .findAll({ queryKey: ['teams', 'list'] })) {
    const data = query.state.data as { pages: { data: Team[] }[] } | undefined;
    const team = data?.pages
      .flatMap((page) => page.data)
      .find((candidate) => candidate.id === id);
    if (team) {
      return team;
    }
  }
  return undefined;
}

export const chipOf = ({ id, name, colorHex }: Team): TeamChipDto => ({
  id,
  name,
  colorHex,
});

export function buildTempTeam(tempId: string, body: CreateTeamDto): Team {
  const now = new Date().toISOString();
  return {
    id: tempId,
    name: body.name,
    colorHex: body.colorHex.toUpperCase(),
    description: body.description ?? null,
    taskCount: 0,
    createdAt: now,
    updatedAt: now,
    version: 0,
  };
}

export function insertTeam(queryClient: QueryClient, team: Team): void {
  insertInLists<Team>(queryClient, 'teams', team, (params) =>
    acceptsTeam(params, team),
  );
  queryClient.setQueryData(['teams', 'detail', team.id], { data: team });
}

export function confirmTeam(
  queryClient: QueryClient,
  tempId: string,
  team: Team,
): void {
  replaceIdInLists<Team>(queryClient, 'teams', tempId, team);
  setChip(queryClient, tempId, chipOf(team));
}

export function mergeTeam(
  queryClient: QueryClient,
  previous: Team,
  body: UpdateTeamDto,
): Team {
  const merged: Team = {
    ...previous,
    name: body.name,
    colorHex: body.colorHex.toUpperCase(),
    description: body.description ?? null,
    updatedAt: new Date().toISOString(),
  };
  updateInLists<Team>(queryClient, 'teams', (team, params) =>
    team.id === merged.id
      ? acceptsTeam(params, merged)
        ? merged
        : null
      : team,
  );
  setDetail<Team>(queryClient, 'teams', merged.id, () => merged);
  setChip(queryClient, merged.id, chipOf(merged));
  return merged;
}

export function removeTeam(queryClient: QueryClient, id: string): string[] {
  removeFromLists(queryClient, 'teams', id);
  queryClient.removeQueries({ queryKey: ['teams', 'detail', id], exact: true });
  return stripChip(queryClient, id);
}
