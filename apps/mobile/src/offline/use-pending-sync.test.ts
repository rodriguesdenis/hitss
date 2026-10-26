import { pendingLabel, tasksTabLabel } from './use-pending-sync';

describe('pendingLabel', () => {
  it.each([
    [0, 'Todas as alterações sincronizadas'],
    [1, '1 alteração aguardando sincronização'],
    [3, '3 alterações aguardando sincronização'],
  ])('describes %i pending changes', (count, expected) => {
    expect(pendingLabel(count)).toBe(expected);
  });
});

describe('tasksTabLabel', () => {
  it('announces pending changes on the tasks tab', () => {
    expect(tasksTabLabel(true)).toBe(
      'Tarefas, alterações aguardando sincronização',
    );
  });

  it('resets to the plain tab name once everything is synced', () => {
    expect(tasksTabLabel(false)).toBe('Tarefas');
  });
});
