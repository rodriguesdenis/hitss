import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListTasksQueryDto } from '../../../../../presentation/http/dto/list-tasks-query.dto';

const parse = async (query: Record<string, unknown>) => {
  const dto = plainToInstance(ListTasksQueryDto, query);
  const errors = await validate(dto, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { dto, fields: errors.map((error) => error.property) };
};

describe('ListTasksQueryDto', () => {
  it('AC-03.7.1 defaults to limit 20, offset 0 and no filters', async () => {
    const { dto, fields } = await parse({});

    expect(fields).toEqual([]);
    expect(dto).toMatchObject({ limit: 20, offset: 0 });
    expect(dto.status).toBeUndefined();
    expect(dto.teamId).toBeUndefined();
    expect(dto.search).toBeUndefined();
    expect(dto.sort).toBe('-createdAt');
  });

  it.each([
    ['PENDING', ['PENDING']],
    ['PENDING,DONE', ['PENDING', 'DONE']],
    [
      ['PENDING', 'IN_PROGRESS'],
      ['PENDING', 'IN_PROGRESS'],
    ],
    ['DONE,DONE', ['DONE', 'DONE']],
  ])('AC-03.4.2 status %p → %p', async (status, expected) => {
    const { dto, fields } = await parse({ status });

    expect(fields).toEqual([]);
    expect(dto.status).toEqual(expected);
  });

  it.each(['pending', 'BLOCKED', '', 'PENDING,', ',DONE', 'PENDING,,DONE'])(
    'AC-03.4.3 status %p → 400 on status',
    async (status) => {
      expect((await parse({ status })).fields).toEqual(['status']);
    },
  );

  it('AC-03.3.3 a malformed teamId → 400 on teamId', async () => {
    expect((await parse({ teamId: 'not-a-uuid' })).fields).toEqual(['teamId']);
  });

  it.each([
    [{ limit: '0' }, 'limit'],
    [{ limit: '101' }, 'limit'],
    [{ limit: '1.5' }, 'limit'],
    [{ offset: '-1' }, 'offset'],
    [{ offset: 'ten' }, 'offset'],
  ])('AC-03.7.4 %p → 400 on %s', async (query, field) => {
    expect((await parse(query)).fields).toEqual([field]);
  });

  it.each([
    ['  login  ', 'login'],
    ['a', 'a'],
    ['x'.repeat(100), 'x'.repeat(100)],
  ])('AC-03.5.2 search %p is trimmed to %p', async (search, expected) => {
    const { dto, fields } = await parse({ search });

    expect(fields).toEqual([]);
    expect(dto.search).toBe(expected);
  });

  it.each(['', '   ', 'x'.repeat(101)])(
    'AC-03.5.2 search %p → 400 on search',
    async (search) => {
      expect((await parse({ search })).fields).toEqual(['search']);
    },
  );

  it.each([
    'createdAt',
    '-createdAt',
    'updatedAt',
    '-updatedAt',
    'dueDate',
    '-dueDate',
    'title',
    '-title',
    'status',
    '-status',
  ])('AC-03.6.1 sort %s is accepted', async (sort) => {
    expect((await parse({ sort })).fields).toEqual([]);
  });

  it.each([
    'priority',
    '--title',
    '+title',
    'title,-createdAt',
    'ownerId',
    '-',
    ['title', '-title'],
  ])('AC-03.6.5 sort %p → 400 on sort', async (sort) => {
    expect((await parse({ sort })).fields).toEqual(['sort']);
  });
});
