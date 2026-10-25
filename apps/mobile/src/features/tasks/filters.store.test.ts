import { resetSessionState } from '@/lib/session-reset';

import {
  emptyFilters,
  hasActiveFilters,
  useTaskFiltersStore,
} from './filters.store';
import { tasksListParams } from './hooks/useTasksList';

const store = () => useTaskFiltersStore.getState();

beforeEach(() => store().reset());

describe('task filters store', () => {
  it('AC-04.5.5 keeps filters per list', () => {
    store().setStatus('all', 'DONE');
    store().setSearch('team-mobile', 'crash');
    expect(store().byScope).toEqual({
      all: { status: 'DONE', search: '' },
      'team-mobile': { status: 'ALL', search: 'crash' },
    });
  });

  it('AC-04.5.4 clears one list without touching the others', () => {
    store().setStatus('all', 'DONE');
    store().setStatus('team-mobile', 'PENDING');
    store().clear('team-mobile');
    expect(store().byScope).toEqual({ all: { status: 'DONE', search: '' } });
  });

  it('AC-04.5.5 starts unfiltered after sign-out', async () => {
    store().setStatus('all', 'DONE');
    await resetSessionState();
    expect(store().byScope).toEqual({});
  });

  it('knows when a filter is active', () => {
    expect(hasActiveFilters(emptyFilters)).toBe(false);
    expect(hasActiveFilters({ status: 'ALL', search: '  ' })).toBe(false);
    expect(hasActiveFilters({ status: 'DONE', search: '' })).toBe(true);
  });
});

describe('tasks list params', () => {
  it('AC-04.5.1 sends no status for Todas and exactly one otherwise', () => {
    expect(tasksListParams(undefined, emptyFilters)).toEqual({
      limit: 20,
      sort: '-createdAt',
    });
    expect(
      tasksListParams('team-mobile', { status: 'IN_PROGRESS', search: '' }),
    ).toEqual({
      limit: 20,
      sort: '-createdAt',
      teamId: 'team-mobile',
      status: ['IN_PROGRESS'],
    });
  });

  it('AC-04.5.2 trims the search and caps it at 100 characters', () => {
    expect(
      tasksListParams(undefined, { status: 'ALL', search: '  login ' }).search,
    ).toBe('login');
    expect(
      tasksListParams(undefined, { status: 'ALL', search: 'x'.repeat(150) })
        .search,
    ).toHaveLength(100);
    expect(
      tasksListParams(undefined, { status: 'ALL', search: '   ' }),
    ).not.toHaveProperty('search');
  });
});
