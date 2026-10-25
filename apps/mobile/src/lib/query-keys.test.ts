import { mk, qk } from './query-keys';

describe('query key factory', () => {
  it('nests lists and details under the resource root', () => {
    expect(qk.teams.lists()).toEqual(['teams', 'list']);
    expect(qk.teams.list({ limit: 20, sort: 'name' })).toEqual([
      'teams',
      'list',
      { limit: 20, sort: 'name' },
    ]);
    expect(qk.teams.detail('t1')).toEqual(['teams', 'detail', 't1']);
    expect(qk.tasks.list({ teamId: 't1' })).toEqual([
      'tasks',
      'list',
      { teamId: 't1' },
    ]);
    expect(qk.tasks.detail('k1')).toEqual(['tasks', 'detail', 'k1']);
  });

  it('keeps a stable mutation key per operation', () => {
    expect(mk.tasks).toEqual({
      create: ['tasks', 'create'],
      update: ['tasks', 'update'],
      changeStatus: ['tasks', 'changeStatus'],
      delete: ['tasks', 'delete'],
    });
    expect(mk.teams).toEqual({
      create: ['teams', 'create'],
      update: ['teams', 'update'],
      delete: ['teams', 'delete'],
    });
  });
});
