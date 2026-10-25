import { QueryClient, type QueryKey } from '@tanstack/react-query';

import { applyCacheEffects, type CacheMutation } from './cache-effects';
import { qk } from './query-keys';

const keys = {
  taskList: qk.tasks.list({ limit: 20 }),
  teamTaskList: qk.tasks.list({ teamId: 'team-1' }),
  taskDetail: qk.tasks.detail('task-1'),
  otherTaskDetail: qk.tasks.detail('task-2'),
  teamList: qk.teams.list({ sort: 'name' }),
  teamDetail: qk.teams.detail('team-1'),
};

type Name = keyof typeof keys;

function seed() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity } },
  });
  for (const key of Object.values(keys)) {
    client.setQueryData(key, { data: 'seed' });
  }
  return client;
}

const isInvalidated = (client: QueryClient, key: QueryKey) =>
  client.getQueryState(key)?.isInvalidated ?? false;

const all = Object.keys(keys) as Name[];

describe.each<
  [CacheMutation, string, Name | null, 'set' | 'remove' | null, Name[]]
>([
  [
    'tasks.create',
    'task-1',
    'taskDetail',
    'set',
    ['taskList', 'teamTaskList', 'teamList'],
  ],
  [
    'tasks.update',
    'task-1',
    'taskDetail',
    'set',
    ['taskList', 'teamTaskList', 'teamList'],
  ],
  [
    'tasks.changeStatus',
    'task-1',
    'taskDetail',
    'set',
    ['taskList', 'teamTaskList'],
  ],
  [
    'tasks.delete',
    'task-1',
    'taskDetail',
    'remove',
    ['taskList', 'teamTaskList', 'teamList'],
  ],
  ['teams.create', 'team-1', null, null, ['teamList']],
  [
    'teams.update',
    'team-1',
    'teamDetail',
    'set',
    ['teamList', 'taskList', 'teamTaskList', 'taskDetail', 'otherTaskDetail'],
  ],
  [
    'teams.delete',
    'team-1',
    'teamDetail',
    'remove',
    ['teamList', 'taskList', 'teamTaskList', 'taskDetail', 'otherTaskDetail'],
  ],
])('%s', (mutation, id, detail, effect, invalidated) => {
  it('applies the plan table', async () => {
    const client = seed();
    const response = { data: 'fresh' };
    await applyCacheEffects(client, mutation, { id, response });

    if (detail && effect === 'set') {
      expect(client.getQueryData(keys[detail])).toEqual(response);
    }
    if (detail && effect === 'remove') {
      expect(client.getQueryState(keys[detail])).toBeUndefined();
    }
    const untouchedDetail = all.filter((name) => !(effect && name === detail));
    expect(
      untouchedDetail
        .filter((name) => isInvalidated(client, keys[name]))
        .sort(),
    ).toEqual(invalidated.filter((name) => name !== detail).sort());
  });
});
