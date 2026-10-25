import type {
  ChangeTaskStatusDto,
  CreateTaskDto,
  TaskResponseDto,
  TeamChipDto,
} from '@hitss/api-client';
import { http, HttpResponse } from 'msw';

import { db } from '../db';
import { API_URL, page } from '../fixtures';

const MAX_TEAMS = 10;

const error = (status: number, code: string, details?: unknown) =>
  HttpResponse.json(
    { error: { code, message: code, traceId: 'trace-test', details } },
    { status },
  );

const notFound = () => error(404, 'TASK_NOT_FOUND');

function chips(teamIds: string[] = []): TeamChipDto[] | Response {
  if (teamIds.length > MAX_TEAMS) {
    return error(422, 'TOO_MANY_TEAMS', {
      max: MAX_TEAMS,
      received: teamIds.length,
    });
  }
  const missing = teamIds.filter((id) => !db.teams.some((t) => t.id === id));
  if (missing.length > 0) {
    return error(422, 'UNKNOWN_TEAMS', { teamIds: missing });
  }
  return db.teams
    .filter((team) => teamIds.includes(team.id))
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .map(({ id, name, colorHex }) => ({ id, name, colorHex }));
}

function isOverdue(task: Pick<TaskResponseDto, 'status' | 'dueDate'>) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    task.status !== 'DONE' && task.dueDate !== null && task.dueDate < today
  );
}

function write(
  task: TaskResponseDto,
  body: CreateTaskDto,
  teams: TeamChipDto[],
) {
  const status = body.status ?? 'PENDING';
  Object.assign(task, {
    title: body.title,
    description: body.description ?? null,
    dueDate: body.dueDate ?? null,
    status,
    teams,
    completedAt:
      status === 'DONE' ? (task.completedAt ?? new Date().toISOString()) : null,
    updatedAt: new Date().toISOString(),
  });
  task.isOverdue = isOverdue(task);
}

export const tasksHandlers = [
  http.get(`${API_URL}/api/v1/tasks`, ({ request }) => {
    const url = new URL(request.url);
    const teamId = url.searchParams.get('teamId');
    const statuses = url.searchParams.getAll('status');
    const search = url.searchParams.get('search')?.toLowerCase();
    const items = db.tasks.filter(
      (t) =>
        (!teamId || t.teams.some((chip) => chip.id === teamId)) &&
        (statuses.length === 0 || statuses.includes(t.status)) &&
        (!search ||
          t.title.toLowerCase().includes(search) ||
          (t.description ?? '').toLowerCase().includes(search)),
    );
    return HttpResponse.json(page(items, url));
  }),
  http.get(`${API_URL}/api/v1/tasks/:id`, ({ params }) => {
    const found = db.tasks.find((t) => t.id === params.id);
    return found ? HttpResponse.json({ data: found }) : notFound();
  }),
  http.post(`${API_URL}/api/v1/tasks`, async ({ request }) => {
    const body = (await request.json()) as CreateTaskDto;
    const teams = chips(body.teamIds);
    if (teams instanceof Response) {
      return teams;
    }
    const stamp = new Date().toISOString();
    const task: TaskResponseDto = {
      id: `task-${db.tasks.length + 1}`,
      title: '',
      description: null,
      dueDate: null,
      status: 'PENDING',
      isOverdue: false,
      teams: [],
      completedAt: null,
      createdAt: stamp,
      updatedAt: stamp,
      version: 1,
    };
    write(task, body, teams);
    db.tasks.unshift(task);
    return HttpResponse.json({ data: task }, { status: 201 });
  }),
  http.put(`${API_URL}/api/v1/tasks/:id`, async ({ params, request }) => {
    const task = db.tasks.find((t) => t.id === params.id);
    if (!task) {
      return notFound();
    }
    const body = (await request.json()) as CreateTaskDto;
    const teams = chips(body.teamIds);
    if (teams instanceof Response) {
      return teams;
    }
    write(task, body, teams);
    task.version += 1;
    return HttpResponse.json({ data: task });
  }),
  http.patch(
    `${API_URL}/api/v1/tasks/:id/status`,
    async ({ params, request }) => {
      const task = db.tasks.find((t) => t.id === params.id);
      if (!task) {
        return notFound();
      }
      const { status } = (await request.json()) as ChangeTaskStatusDto;
      task.status = status;
      task.completedAt = status === 'DONE' ? new Date().toISOString() : null;
      task.isOverdue = isOverdue(task);
      task.version += 1;
      return HttpResponse.json({ data: task });
    },
  ),
  http.delete(`${API_URL}/api/v1/tasks/:id`, ({ params }) => {
    const index = db.tasks.findIndex((t) => t.id === params.id);
    if (index === -1) {
      return notFound();
    }
    db.tasks.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
