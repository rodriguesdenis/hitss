import type { CreateTeamDto, TeamResponseDto } from '@hitss/api-client';
import { http, HttpResponse } from 'msw';

import { db } from '../db';
import { API_URL, page } from '../fixtures';

const error = (status: number, code: string) =>
  HttpResponse.json(
    { error: { code, message: code, traceId: 'trace-test' } },
    { status },
  );

const byName = (a: TeamResponseDto, b: TeamResponseDto) =>
  a.name.localeCompare(b.name);

function nameTaken(name: string, exceptId?: string) {
  return db.teams.some(
    (team) =>
      team.id !== exceptId && team.name.toLowerCase() === name.toLowerCase(),
  );
}

export const teamsHandlers = [
  http.get(`${API_URL}/api/v1/teams`, ({ request }) => {
    const url = new URL(request.url);
    const search = url.searchParams.get('search')?.toLowerCase();
    const items = (
      search
        ? db.teams.filter((t) => t.name.toLowerCase().includes(search))
        : db.teams
    ).toSorted(byName);
    return HttpResponse.json(page(items, url));
  }),
  http.get(`${API_URL}/api/v1/teams/:id`, ({ params }) => {
    const found = db.teams.find((t) => t.id === params.id);
    return found
      ? HttpResponse.json({ data: found })
      : error(404, 'TEAM_NOT_FOUND');
  }),
  http.post(`${API_URL}/api/v1/teams`, async ({ request }) => {
    const body = (await request.json()) as CreateTeamDto;
    if (nameTaken(body.name)) {
      return error(409, 'TEAM_NAME_ALREADY_EXISTS');
    }
    const stamp = new Date().toISOString();
    const team: TeamResponseDto = {
      id: `team-${db.teams.length + 1}-${body.name.toLowerCase()}`,
      name: body.name,
      colorHex: body.colorHex.toUpperCase(),
      description: body.description ?? null,
      taskCount: 0,
      createdAt: stamp,
      updatedAt: stamp,
      version: 1,
    };
    db.teams.push(team);
    return HttpResponse.json({ data: team }, { status: 201 });
  }),
  http.put(`${API_URL}/api/v1/teams/:id`, async ({ params, request }) => {
    const team = db.teams.find((t) => t.id === params.id);
    if (!team) {
      return error(404, 'TEAM_NOT_FOUND');
    }
    const body = (await request.json()) as CreateTeamDto;
    if (nameTaken(body.name, team.id)) {
      return error(409, 'TEAM_NAME_ALREADY_EXISTS');
    }
    Object.assign(team, {
      name: body.name,
      colorHex: body.colorHex.toUpperCase(),
      description: body.description ?? null,
      version: team.version + 1,
    });
    for (const task of db.tasks) {
      task.teams = task.teams.map((chip) =>
        chip.id === team.id
          ? { id: team.id, name: team.name, colorHex: team.colorHex }
          : chip,
      );
    }
    return HttpResponse.json({ data: team });
  }),
  http.delete(`${API_URL}/api/v1/teams/:id`, ({ params }) => {
    const index = db.teams.findIndex((t) => t.id === params.id);
    if (index === -1) {
      return error(404, 'TEAM_NOT_FOUND');
    }
    db.teams.splice(index, 1);
    for (const task of db.tasks) {
      task.teams = task.teams.filter((chip) => chip.id !== params.id);
    }
    return new HttpResponse(null, { status: 204 });
  }),
];
