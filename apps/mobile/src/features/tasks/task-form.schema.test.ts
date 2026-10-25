import { taskFormSchema } from './task-form.schema';

const valid = {
  title: 'Implementar login',
  description: '',
  status: 'PENDING' as const,
  dueDate: null,
  teamIds: [],
};

const message = (input: object) =>
  taskFormSchema.safeParse({ ...valid, ...input }).error?.issues[0]?.message;

describe('task form schema', () => {
  it.each([
    ['ab', 'O título deve ter pelo menos 3 caracteres'],
    ['  ab  ', 'O título deve ter pelo menos 3 caracteres'],
    ['abc', undefined],
    ['a'.repeat(120), undefined],
    ['a'.repeat(121), 'O título deve ter no máximo 120 caracteres'],
    ['   ', 'O título é obrigatório'],
  ])('AC-04.7.2 title %j → %s', (title, expected) => {
    expect(message({ title })).toBe(expected);
  });

  it('AC-04.7.3 limits the description to 2000 characters', () => {
    expect(message({ description: 'x'.repeat(2000) })).toBeUndefined();
    expect(message({ description: 'x'.repeat(2001) })).toBe(
      'A descrição deve ter no máximo 2000 caracteres',
    );
  });

  it('AC-04.7.4 allows up to 10 teams', () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);
    expect(message({ teamIds: ids(10) })).toBeUndefined();
    expect(message({ teamIds: ids(11) })).toBe(
      'Você pode escolher até 10 times',
    );
  });

  it('trims the title and sends null for an empty description', () => {
    expect(
      taskFormSchema.parse({ ...valid, title: '  Login ', description: ' ' }),
    ).toMatchObject({ title: 'Login', description: null });
  });
});
