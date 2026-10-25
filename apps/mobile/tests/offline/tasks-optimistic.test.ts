import type { TaskResponseDto } from '@hitss/api-client';
import { delay, http, HttpResponse } from 'msw';

import type {
  TaskCreateVars,
  TaskDeleteVars,
  TaskStatusVars,
  TaskUpdateVars,
} from '@/features/tasks';
import type { TeamCreateVars } from '@/features/teams';
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
  taskTitles,
  toast,
  writes,
} from './harness';

setupOffline();

const all = { limit: 20 };
const mobile = { limit: 20, teamId: 'team-mobile' };
const pending = { limit: 20, status: ['PENDING' as const] };

const crash = { id: 'task-crash', title: 'Fix crash on Android' };

const detail = (client: ReturnType<typeof newClient>, id: string) =>
  client.getQueryData<{ data: TaskResponseDto }>(qk.tasks.detail(id))?.data;

async function seeded() {
  const client = newClient();
  await Promise.all([
    seedTasks(client, all),
    seedTasks(client, mobile),
    seedTasks(client, pending),
  ]);
  await seedTeams(client, { limit: 20, sort: 'name' });
  client.setQueryData(qk.tasks.detail(crash.id), {
    data: db.tasks.find((task) => task.id === crash.id),
  });
  return client;
}

const statusOf = (
  client: ReturnType<typeof newClient>,
  params: object,
  id: string,
) =>
  listed<TaskResponseDto>(client, qk.tasks.list(params as never)).find(
    (t) => t.id === id,
  )?.status;

describe('status change', () => {
  it('AC-05.3.1 shows the new status before the server answers', async () => {
    const client = await seeded();
    let answer: () => void = () => undefined;
    server.use(
      http.patch(`${API_URL}/api/v1/tasks/:id/status`, async () => {
        await new Promise<void>((resolve) => (answer = resolve));
        return HttpResponse.json({ data: { ...db.tasks[1], status: 'DONE' } });
      }),
    );
    const done = mutate<TaskStatusVars>(client, mk.tasks.changeStatus, {
      ...crash,
      status: 'DONE',
    });
    await settle();
    expect(detail(client, crash.id)?.status).toBe('DONE');
    expect(detail(client, crash.id)?.completedAt).not.toBeNull();
    expect(statusOf(client, all, crash.id)).toBe('DONE');
    expect(statusOf(client, mobile, crash.id)).toBe('DONE');
    answer();
    await done;
  });

  it('AC-05.3.4 AC-05.3.5 drops the task from a list filtered on another status', async () => {
    const client = await seeded();
    void mutate<TaskStatusVars>(client, mk.tasks.changeStatus, {
      ...crash,
      status: 'DONE',
    });
    await settle();
    expect(taskTitles(client, pending)).not.toContain(crash.title);
    expect(taskTitles(client, all)).toContain(crash.title);
  });

  it('AC-05.3.2 reverts and explains a rejected change', async () => {
    const client = await seeded();
    server.use(
      http.patch(`${API_URL}/api/v1/tasks/:id/status`, () =>
        HttpResponse.json(
          { error: { code: 'VALIDATION_FAILED', message: 'x', traceId: 't' } },
          { status: 400 },
        ),
      ),
    );
    await mutate<TaskStatusVars>(client, mk.tasks.changeStatus, {
      ...crash,
      status: 'DONE',
    });
    expect(detail(client, crash.id)?.status).toBe('PENDING');
    expect(statusOf(client, all, crash.id)).toBe('PENDING');
    expect(taskTitles(client, pending)).toContain(crash.title);
    expect(toast()).toBe(
      'Não foi possível salvar “Fix crash on Android”: Alguns campos são inválidos. Verifique os campos destacados.',
    );
  });

  it('AC-05.3.3 keeps the last of two offline changes', async () => {
    const client = await seeded();
    goOffline();
    void mutate<TaskStatusVars>(client, mk.tasks.changeStatus, {
      ...crash,
      status: 'IN_PROGRESS',
    });
    void mutate<TaskStatusVars>(client, mk.tasks.changeStatus, {
      ...crash,
      status: 'DONE',
    });
    await settle();
    expect(detail(client, crash.id)?.status).toBe('DONE');
    await goOnline(client);
    expect(db.tasks.find((t) => t.id === crash.id)?.status).toBe('DONE');
  });

  it('AC-05.7.2 AC-05.7.5 removes a task deleted elsewhere, explains it and sends the next change', async () => {
    const client = await seeded();
    goOffline();
    void mutate<TaskStatusVars>(client, mk.tasks.changeStatus, {
      ...crash,
      status: 'DONE',
    });
    void mutate<TaskStatusVars>(client, mk.tasks.changeStatus, {
      id: 'task-deps',
      title: 'Update dependencies',
      status: 'DONE',
    });
    await settle();
    db.tasks = db.tasks.filter((t) => t.id !== crash.id);
    await goOnline(client);
    expect(db.tasks.find((t) => t.id === 'task-deps')?.status).toBe('DONE');
    expect(taskTitles(client, all)).not.toContain(crash.title);
    expect(detail(client, crash.id)).toBeUndefined();
    expect(toast()).toBe('“Fix crash on Android” foi excluída em outro lugar.');
  });
});

describe('delete', () => {
  it('AC-05.4.1 removes the task everywhere offline and deletes it on reconnect', async () => {
    const client = await seeded();
    goOffline();
    void mutate<TaskDeleteVars>(client, mk.tasks.delete, crash);
    await settle();
    expect(taskTitles(client, all)).not.toContain(crash.title);
    expect(taskTitles(client, mobile)).not.toContain(crash.title);
    expect(detail(client, crash.id)).toBeUndefined();
    await goOnline(client);
    expect(db.tasks.some((t) => t.id === crash.id)).toBe(false);
  });

  it('AC-05.4.2 restores the task in its position when the deletion is rejected', async () => {
    const client = await seeded();
    const before = taskTitles(client, all);
    server.use(
      http.delete(`${API_URL}/api/v1/tasks/:id`, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'x', traceId: 't' } },
          { status: 500 },
        ),
      ),
    );
    await mutate<TaskDeleteVars>(client, mk.tasks.delete, crash);
    expect(taskTitles(client, all)).toEqual(before);
    expect(toast()).toBe(
      'Não foi possível salvar “Fix crash on Android”: Algo deu errado do nosso lado. Tente novamente.',
    );
  });

  it('AC-05.4.3 treats a task already deleted elsewhere as deleted, silently', async () => {
    const client = await seeded();
    goOffline();
    void mutate<TaskDeleteVars>(client, mk.tasks.delete, crash);
    await settle();
    db.tasks = db.tasks.filter((t) => t.id !== crash.id);
    await goOnline(client);
    expect(toast()).toBeUndefined();
    expect(
      client
        .getMutationCache()
        .getAll()
        .every((m) => m.state.status === 'success'),
    ).toBe(true);
  });
});

describe('create', () => {
  it('AC-05.5.1 puts a task created offline first in the global and team lists', async () => {
    const client = await seeded();
    goOffline();
    void mutate<TaskCreateVars>(client, mk.tasks.create, {
      tempId: newTempId(),
      body: { title: 'Write release notes', teamIds: ['team-mobile'] },
    });
    await settle();
    expect(taskTitles(client, all)[0]).toBe('Write release notes');
    expect(taskTitles(client, mobile)[0]).toBe('Write release notes');
    expect(taskTitles(client, pending)[0]).toBe('Write release notes');
    const [first] = listed<TaskResponseDto>(client, qk.tasks.list(all));
    expect(first?.teams).toEqual([
      { id: 'team-mobile', name: 'Mobile', colorHex: '#7C3AED' },
    ]);
  });

  it('AC-05.5.3 syncs create → status → delete on one temporary task in order', async () => {
    const client = await seeded();
    goOffline();
    const tempId = newTempId();
    void mutate<TaskCreateVars>(client, mk.tasks.create, {
      tempId,
      body: { title: 'Temporary idea' },
    });
    void mutate<TaskStatusVars>(client, mk.tasks.changeStatus, {
      id: tempId,
      status: 'DONE',
      title: 'Temporary idea',
    });
    void mutate<TaskDeleteVars>(client, mk.tasks.delete, {
      id: tempId,
      title: 'Temporary idea',
    });
    await settle();
    expect(taskTitles(client, all)).not.toContain('Temporary idea');
    await goOnline(client);
    const realId = useSyncStore.getState().idMap[tempId];
    expect(realId).toBeDefined();
    expect(writes.slice(-3)).toEqual([
      'POST /api/v1/tasks',
      `PATCH /api/v1/tasks/${realId}/status`,
      `DELETE /api/v1/tasks/${realId}`,
    ]);
    expect(db.tasks.some((t) => t.title === 'Temporary idea')).toBe(false);
    expect(JSON.stringify(writes)).not.toContain('tmp-');
  });

  it('AC-05.5.4 sends a task in a team created offline with the real team id', async () => {
    const client = await seeded();
    goOffline();
    const teamTemp = newTempId();
    void mutate<TeamCreateVars>(client, mk.teams.create, {
      tempId: teamTemp,
      body: { name: 'Platform', colorHex: '#3B82F6' },
    });
    void mutate<TaskCreateVars>(client, mk.tasks.create, {
      tempId: newTempId(),
      body: { title: 'Set up CI', teamIds: [teamTemp] },
    });
    await settle();
    await goOnline(client);
    const team = db.teams.find((t) => t.name === 'Platform');
    expect(
      db.tasks.find((t) => t.title === 'Set up CI')?.teams.map((t) => t.id),
    ).toEqual([team?.id]);
  });

  it('AC-05.5.6 fails the dependants of a rejected team creation unsent and continues', async () => {
    const client = await seeded();
    goOffline();
    const teamTemp = newTempId();
    void mutate<TeamCreateVars>(client, mk.teams.create, {
      tempId: teamTemp,
      body: { name: 'Backend', colorHex: '#3B82F6' },
    });
    void mutate<TaskCreateVars>(client, mk.tasks.create, {
      tempId: newTempId(),
      body: { title: 'Set up CI', teamIds: [teamTemp] },
    });
    void mutate<TaskStatusVars>(client, mk.tasks.changeStatus, {
      ...crash,
      status: 'DONE',
    });
    await settle();
    writes.length = 0;
    await goOnline(client);
    expect(writes).toEqual([
      'POST /api/v1/teams',
      `PATCH /api/v1/tasks/${crash.id}/status`,
    ]);
    expect(taskTitles(client, all)).not.toContain('Set up CI');
    expect(db.tasks.find((t) => t.id === crash.id)?.status).toBe('DONE');
  });
});

describe('edit', () => {
  it('AC-05.5.2 shows an offline edit at once and moves the task between team lists', async () => {
    const client = await seeded();
    goOffline();
    void mutate<TaskUpdateVars>(client, mk.tasks.update, {
      id: crash.id,
      body: {
        title: 'Fix crash on Pixel',
        status: 'PENDING',
        teamIds: ['team-backend'],
        description: null,
        dueDate: null,
      },
    });
    await settle();
    expect(detail(client, crash.id)?.title).toBe('Fix crash on Pixel');
    expect(taskTitles(client, all)).toContain('Fix crash on Pixel');
    expect(taskTitles(client, mobile)).not.toContain('Fix crash on Pixel');
    await goOnline(client);
    expect(db.tasks.find((t) => t.id === crash.id)?.title).toBe(
      'Fix crash on Pixel',
    );
  });

  it('AC-05.7.1 overwrites an edit made elsewhere without a message', async () => {
    const client = await seeded();
    goOffline();
    void mutate<TaskUpdateVars>(client, mk.tasks.update, {
      id: crash.id,
      body: {
        title: 'Fix crash on Android 14',
        status: 'PENDING',
        teamIds: ['team-mobile'],
      },
    });
    await settle();
    db.tasks = db.tasks.map((t) =>
      t.id === crash.id ? { ...t, title: 'Fix Android crash' } : t,
    );
    await goOnline(client);
    expect(db.tasks.find((t) => t.id === crash.id)?.title).toBe(
      'Fix crash on Android 14',
    );
    expect(toast()).toBeUndefined();
  });

  it('AC-05.7.3 reverts an offline edit rejected for unknown teams', async () => {
    const client = await seeded();
    goOffline();
    void mutate<TaskUpdateVars>(client, mk.tasks.update, {
      id: 'task-deps',
      body: {
        title: 'Plan sprint',
        status: 'PENDING',
        teamIds: ['team-design'],
      },
    });
    await settle();
    db.teams = db.teams.filter((t) => t.id !== 'team-design');
    await goOnline(client);
    expect(taskTitles(client, all)).toContain('Update dependencies');
    expect(toast()).toBe(
      'Não foi possível salvar “Plan sprint”: Alguns times não existem mais e foram removidos.',
    );
  });
});

it('keeps queued status changes in order with an unrelated delayed request', async () => {
  const client = await seeded();
  server.use(
    http.patch(`${API_URL}/api/v1/tasks/:id/status`, async ({ request }) => {
      await delay(10);
      return HttpResponse.json({
        data: { ...db.tasks[1], ...((await request.json()) as object) },
      });
    }),
  );
  await mutate<TaskStatusVars>(client, mk.tasks.changeStatus, {
    ...crash,
    status: 'IN_PROGRESS',
  });
  expect(detail(client, crash.id)?.status).toBe('IN_PROGRESS');
});
