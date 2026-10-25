import type {
  CreateTaskDto,
  TaskResponseDto,
  TaskStatus,
  TeamChipDto,
  TeamResponseDto,
  UpdateTaskDto,
} from '@hitss/api-client';
import type { QueryClient } from '@tanstack/react-query';

import {
  insertInLists,
  removeFromLists,
  replaceIdInLists,
  setDetail,
  updateInLists,
} from '@/offline';

type Task = TaskResponseDto;
type Params = Record<string, unknown>;

function chipFor(queryClient: QueryClient, id: string): TeamChipDto | null {
  const detail = queryClient.getQueryData<{ data: TeamResponseDto }>([
    'teams',
    'detail',
    id,
  ]);
  if (detail) {
    return { id, name: detail.data.name, colorHex: detail.data.colorHex };
  }
  for (const query of queryClient
    .getQueryCache()
    .findAll({ queryKey: ['teams', 'list'] })) {
    const data = query.state.data as
      { pages: { data: TeamResponseDto[] }[] } | undefined;
    const team = data?.pages
      .flatMap((page) => page.data)
      .find((candidate) => candidate.id === id);
    if (team) {
      return { id, name: team.name, colorHex: team.colorHex };
    }
  }
  return null;
}

function chipsFor(
  queryClient: QueryClient,
  teamIds: string[] | undefined,
): TeamChipDto[] {
  return (teamIds ?? [])
    .map((id) => chipFor(queryClient, id))
    .filter((chip): chip is TeamChipDto => chip !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function acceptsTask(params: Params, task: Task): boolean {
  const teamId = params.teamId as string | undefined;
  const statuses = params.status as TaskStatus[] | undefined;
  const search = (params.search as string | undefined)?.toLowerCase();
  return (
    (!teamId || task.teams.some((team) => team.id === teamId)) &&
    (!statuses?.length || statuses.includes(task.status)) &&
    (!search || task.title.toLowerCase().includes(search))
  );
}

export function adjustTaskCounts(
  queryClient: QueryClient,
  teamIds: string[],
  delta: number,
): void {
  if (teamIds.length === 0) {
    return;
  }
  updateInLists<TeamResponseDto>(queryClient, 'teams', (team) =>
    teamIds.includes(team.id)
      ? { ...team, taskCount: Math.max(0, team.taskCount + delta) }
      : team,
  );
  for (const id of teamIds) {
    setDetail<TeamResponseDto>(queryClient, 'teams', id, (team) =>
      team
        ? { ...team, taskCount: Math.max(0, team.taskCount + delta) }
        : undefined,
    );
  }
}

function withStatus(task: Task, status: TaskStatus, now: string): Task {
  return {
    ...task,
    status,
    completedAt: status === 'DONE' ? (task.completedAt ?? now) : null,
    isOverdue: status === 'DONE' ? false : task.isOverdue,
    updatedAt: now,
  };
}

export function applyStatus(
  queryClient: QueryClient,
  id: string,
  status: TaskStatus,
): void {
  const now = new Date().toISOString();
  updateInLists<Task>(queryClient, 'tasks', (task, params) => {
    if (task.id !== id) {
      return task;
    }
    const next = withStatus(task, status, now);
    return acceptsTask(params, next) ? next : null;
  });
  setDetail<Task>(queryClient, 'tasks', id, (task) =>
    task ? withStatus(task, status, now) : undefined,
  );
}

export function findTask(
  queryClient: QueryClient,
  id: string,
): Task | undefined {
  const detail = queryClient.getQueryData<{ data: Task }>([
    'tasks',
    'detail',
    id,
  ]);
  if (detail) {
    return detail.data;
  }
  for (const query of queryClient
    .getQueryCache()
    .findAll({ queryKey: ['tasks', 'list'] })) {
    const data = query.state.data as { pages: { data: Task[] }[] } | undefined;
    const task = data?.pages
      .flatMap((page) => page.data)
      .find((candidate) => candidate.id === id);
    if (task) {
      return task;
    }
  }
  return undefined;
}

export function removeTask(queryClient: QueryClient, id: string): void {
  removeFromLists(queryClient, 'tasks', id);
  queryClient.removeQueries({ queryKey: ['tasks', 'detail', id], exact: true });
}

export function buildTempTask(
  queryClient: QueryClient,
  tempId: string,
  body: CreateTaskDto,
): Task {
  const now = new Date().toISOString();
  return {
    id: tempId,
    title: body.title,
    description: body.description ?? null,
    dueDate: body.dueDate ?? null,
    status: body.status ?? 'PENDING',
    isOverdue: false,
    teams: chipsFor(queryClient, body.teamIds),
    completedAt: (body.status ?? 'PENDING') === 'DONE' ? now : null,
    createdAt: now,
    updatedAt: now,
    version: 0,
  };
}

export function insertTask(queryClient: QueryClient, task: Task): void {
  insertInLists<Task>(queryClient, 'tasks', task, (params) =>
    acceptsTask(params, task),
  );
  queryClient.setQueryData(['tasks', 'detail', task.id], { data: task });
  adjustTaskCounts(
    queryClient,
    task.teams.map((team) => team.id),
    1,
  );
}

export function confirmTask(
  queryClient: QueryClient,
  tempId: string,
  task: Task,
): void {
  replaceIdInLists<Task>(queryClient, 'tasks', tempId, task);
}

export function mergeTask(
  queryClient: QueryClient,
  previous: Task,
  body: UpdateTaskDto,
): Task {
  const merged: Task = {
    ...withStatus(previous, body.status, new Date().toISOString()),
    title: body.title,
    description: body.description ?? null,
    dueDate: body.dueDate ?? null,
    teams: chipsFor(queryClient, body.teamIds),
  };
  updateInLists<Task>(queryClient, 'tasks', (task, params) =>
    task.id === merged.id
      ? acceptsTask(params, merged)
        ? merged
        : null
      : task,
  );
  const before = previous.teams.map((team) => team.id);
  const after = merged.teams.map((team) => team.id);
  const added = after.filter((id) => !before.includes(id));
  const removed = before.filter((id) => !after.includes(id));
  insertInLists<Task>(
    queryClient,
    'tasks',
    merged,
    (params) =>
      added.includes(params.teamId as string) && acceptsTask(params, merged),
  );
  setDetail<Task>(queryClient, 'tasks', merged.id, () => merged);
  adjustTaskCounts(queryClient, added, 1);
  adjustTaskCounts(queryClient, removed, -1);
  return merged;
}
