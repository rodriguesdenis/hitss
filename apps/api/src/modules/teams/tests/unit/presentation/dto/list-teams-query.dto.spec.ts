import { RequestValidationException } from '../../../../../../shared/presentation/filters/api-exception';
import { AppValidationPipe } from '../../../../../../shared/presentation/pipes/validation.pipe';
import { ListTeamsQueryDto } from '../../../../presentation/dto/list-teams-query.dto';

const pipe = new AppValidationPipe();
const parse = (query: Record<string, unknown>) =>
  pipe.transform(query, {
    type: 'query',
    metatype: ListTeamsQueryDto,
  }) as Promise<ListTeamsQueryDto>;
const failedFields = async (query: Record<string, unknown>) => {
  try {
    await parse(query);
  } catch (error) {
    return [
      ...new Set(
        (error as RequestValidationException).details.map(
          (detail) => detail.field,
        ),
      ),
    ];
  }
  return [];
};

describe('ListTeamsQueryDto', () => {
  it('AC-02.2.2 defaults: limit 20, offset 0, newest first, no search', async () => {
    await expect(parse({})).resolves.toMatchObject({
      limit: 20,
      offset: 0,
      sort: '-createdAt',
      search: undefined,
    });
  });

  it('AC-02.3.2 trims the search term', async () => {
    await expect(parse({ search: '  mob  ' })).resolves.toMatchObject({
      search: 'mob',
    });
  });

  it.each([
    ['blank', ''],
    ['whitespace only', '   '],
    ['101 characters', 's'.repeat(101)],
    ['repeated', ['a', 'b']],
  ])('AC-02.3.2 a %s search → 400 naming search', async (_label, search) => {
    expect(await failedFields({ search })).toEqual(['search']);
  });

  it('AC-02.3.2 100 characters after trimming are accepted', async () => {
    await expect(
      parse({ search: ` ${'s'.repeat(100)} ` }),
    ).resolves.toMatchObject({
      search: 's'.repeat(100),
    });
  });

  it.each([
    'name',
    '-name',
    'createdAt',
    '-createdAt',
    'updatedAt',
    '-updatedAt',
  ])('AC-02.4.1 AC-02.4.2 accepts sort=%s', async (sort) => {
    await expect(parse({ sort })).resolves.toMatchObject({ sort });
  });

  it.each([
    'color',
    'taskCount',
    '--name',
    '',
    'NAME',
    '+name',
    'name,createdAt',
  ])('AC-02.4.3 rejects sort=%j naming sort', async (sort) => {
    expect(await failedFields({ sort })).toEqual(['sort']);
  });

  it('AC-02.2.9 an unknown parameter → 400 naming it', async () => {
    expect(await failedFields({ color: 'red' })).toEqual(['color']);
  });

  it('AC-10.8 toCriteria maps the query to the use case criteria', async () => {
    const dto = await parse({
      limit: '5',
      offset: '10',
      search: ' mob ',
      sort: 'name',
    });

    expect(dto.toCriteria()).toEqual({
      page: { limit: 5, offset: 10 },
      search: 'mob',
      sort: { field: 'name', direction: 'asc' },
    });
    expect((await parse({})).toCriteria()).toEqual({
      page: { limit: 20, offset: 0 },
      search: undefined,
      sort: { field: 'createdAt', direction: 'desc' },
    });
  });
});
