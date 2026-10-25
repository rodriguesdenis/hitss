import type { TaskResponseDto } from '@hitss/api-client';
import { http, HttpResponse } from 'msw';

import type {
  TeamCreateVars,
  TeamDeleteVars,
  TeamUpdateVars,
} from '@/features/teams';
import { mk, qk } from '@/lib/query-keys';
import { newTempId, useSyncStore } from '@/offline';

import { db } from '../db';
import { API_URL } from '../fixtures';
import { server } from '../server';
import {
  goOffline,
  goOnline,
  listed,
  mutate,
  newClient,
  seedTasks,
  seedTeams,
  settle,
  setupOffline,
  teamNames,
  toast,
} from './harness';

setupOffline();

const teamsParams = { limit: 20, sort: 'name' as const };
const all = { limit: 20 };

async function seeded() {
  const client = newClient();
  await Promise.all([seedTeams(client, teamsParams), seedTasks(client, all)]);
  client.setQueryData(qk.tasks.detail('task-login'), {
    data: db.tasks.find((t) => t.id === 'task-login'),
  });
  return client;
}

const chipsOf = (client: ReturnType<typeof newClient>, id: string) =>
  listed<TaskResponseDto>(client, qk.tasks.list(all))
    .find((t) => t.id === id)
    ?.teams.map((team) => team.name);

const detailChips = (client: ReturnType<typeof newClient>, id: string) =>
  client
    .getQueryData<{ data: TaskResponseDto }>(qk.tasks.detail(id))
    ?.data.teams.map((team) => team.name);

const mobileBody = { name: 'Apps', colorHex: '#7C3AED', description: null };

describe('team changes', () => {
  it('AC-05.7.4 renames the chips of cached tasks immediately', async () => {
    const client = await seeded();
    goOffline();
    void mutate<TeamUpdateVars>(client, mk.teams.update, {
      id: 'team-mobile',
      body: mobileBody,
    });
    await settle();
    expect(teamNames(client, teamsParams)).toContain('Apps');
    expect(chipsOf(client, 'task-login')).toEqual(['Apps', 'Backend']);
    expect(detailChips(client, 'task-login')).toEqual(['Apps', 'Backend']);
    await goOnline(client);
    expect(db.teams.find((t) => t.id === 'team-mobile')?.name).toBe('Apps');
  });

  it('reverts a rejected rename in lists and chips', async () => {
    const client = await seeded();
    goOffline();
    void mutate<TeamUpdateVars>(client, mk.teams.update, {
      id: 'team-mobile',
      body: mobileBody,
    });
    await settle();
    await goOnline(
      client,
      http.put(`${API_URL}/api/v1/teams/:id`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'TEAM_NAME_ALREADY_EXISTS',
              message: 'x',
              traceId: 't',
            },
          },
          { status: 409 },
        ),
      ),
    );
    expect(teamNames(client, teamsParams)).toContain('Mobile');
    expect(chipsOf(client, 'task-login')).toEqual(['Backend', 'Mobile']);
    expect(toast()).toBe(
      'Não foi possível salvar “Apps”: Você já tem um time com este nome.',
    );
  });

  it('AC-05.4.4 strips a deleted team from cached tasks and deletes it on reconnect', async () => {
    const client = await seeded();
    goOffline();
    void mutate<TeamDeleteVars>(client, mk.teams.delete, {
      id: 'team-mobile',
      name: 'Mobile',
    });
    await settle();
    expect(teamNames(client, teamsParams)).not.toContain('Mobile');
    expect(chipsOf(client, 'task-login')).toEqual(['Backend']);
    expect(chipsOf(client, 'task-crash')).toEqual([]);
    await goOnline(client);
    expect(db.teams.some((t) => t.id === 'team-mobile')).toBe(false);
  });

  it('restores the team and its chips when the deletion is rejected', async () => {
    const client = await seeded();
    server.use(
      http.delete(`${API_URL}/api/v1/teams/:id`, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'x', traceId: 't' } },
          { status: 500 },
        ),
      ),
    );
    await mutate<TeamDeleteVars>(client, mk.teams.delete, {
      id: 'team-mobile',
      name: 'Mobile',
    });
    expect(teamNames(client, teamsParams)).toEqual([
      'Backend',
      'Design',
      'Mobile',
    ]);
    expect(chipsOf(client, 'task-login')).toEqual(['Backend', 'Mobile']);
    expect(chipsOf(client, 'task-crash')).toEqual(['Mobile']);
    expect(toast()).toBe(
      'Não foi possível salvar “Mobile”: Algo deu errado do nosso lado. Tente novamente.',
    );
  });

  it('AC-05.5.1 shows a team created offline and swaps in the real id on reconnect', async () => {
    const client = await seeded();
    goOffline();
    const tempId = newTempId();
    void mutate<TeamCreateVars>(client, mk.teams.create, {
      tempId,
      body: { name: 'Platform', colorHex: '#3b82f6' },
    });
    await settle();
    expect(teamNames(client, teamsParams)[0]).toBe('Platform');
    await goOnline(client);
    const realId = useSyncStore.getState().idMap[tempId];
    expect(realId).toBeDefined();
    const ids = listed<{ id: string }>(client, qk.teams.list(teamsParams)).map(
      (t) => t.id,
    );
    expect(ids).toContain(realId);
    expect(ids).not.toContain(tempId);
  });

  it('AC-05.5.5 removes a rejected offline team creation and explains it', async () => {
    const client = await seeded();
    goOffline();
    void mutate<TeamCreateVars>(client, mk.teams.create, {
      tempId: newTempId(),
      body: { name: 'Backend', colorHex: '#3B82F6' },
    });
    await settle();
    await goOnline(client);
    expect(
      teamNames(client, teamsParams).filter((name) => name === 'Backend'),
    ).toHaveLength(1);
    expect(toast()).toBe(
      'Não foi possível salvar “Backend”: Você já tem um time com este nome.',
    );
  });
});
