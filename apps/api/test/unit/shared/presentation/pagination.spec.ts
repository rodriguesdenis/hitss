import { RequestValidationException } from '../../../../src/shared/presentation/filters/api-exception';
import { PaginationQueryDto } from '../../../../src/shared/presentation/dto/pagination-query.dto';
import { toPageMeta } from '../../../../src/shared/presentation/page-meta';
import { AppValidationPipe } from '../../../../src/shared/presentation/pipes/validation.pipe';
import {
  parseSort,
  sortValues,
} from '../../../../src/shared/presentation/sort';

const pipe = new AppValidationPipe();
const parse = (query: Record<string, unknown>) =>
  pipe.transform(query, {
    type: 'query',
    metatype: PaginationQueryDto,
  }) as Promise<PaginationQueryDto>;

const failedField = async (query: Record<string, unknown>) => {
  try {
    await parse(query);
  } catch (error) {
    // One detail per failed constraint: compare the distinct fields.
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

describe('PaginationQueryDto', () => {
  it('AC-02.2.2 defaults to limit 20 and offset 0', async () => {
    await expect(parse({})).resolves.toMatchObject({ limit: 20, offset: 0 });
  });

  it('converts query strings to integers', async () => {
    await expect(parse({ limit: '100', offset: '40' })).resolves.toMatchObject({
      limit: 100,
      offset: 40,
    });
  });

  it.each([
    [{ limit: '0' }, 'limit'],
    [{ limit: '101' }, 'limit'],
    [{ limit: '1.5' }, 'limit'],
    [{ limit: 'ten' }, 'limit'],
    [{ limit: ['10', '20'] }, 'limit'],
    [{ limit: '' }, 'limit'],
    [{ offset: '-1' }, 'offset'],
    [{ offset: '2.5' }, 'offset'],
    [{ offset: 'x' }, 'offset'],
    [{ offset: '' }, 'offset'],
    [{ offset: '1000001' }, 'offset'],
    [{ offset: '99999999999999999999' }, 'offset'],
  ])('AC-02.2.5 %j → 400 naming %s', async (query, field) => {
    expect(await failedField(query)).toEqual([field]);
  });

  it('AC-02.2.5 offset 1 000 000 is the largest accepted', async () => {
    await expect(parse({ offset: '1000000' })).resolves.toMatchObject({
      offset: 1_000_000,
    });
  });

  it('AC-02.2.5 the bounds 1 and 100 are accepted', async () => {
    await expect(parse({ limit: '1' })).resolves.toMatchObject({ limit: 1 });
    await expect(parse({ limit: '100' })).resolves.toMatchObject({
      limit: 100,
    });
  });
});

describe('sort helpers', () => {
  const FIELDS = ['name', 'createdAt'] as const;

  it('lists every field ascending and descending', () => {
    expect(sortValues(FIELDS)).toEqual([
      'name',
      '-name',
      'createdAt',
      '-createdAt',
    ]);
  });

  it.each([
    ['name', { field: 'name', direction: 'asc' }],
    ['-createdAt', { field: 'createdAt', direction: 'desc' }],
  ])('parses %s', (value, sort) => {
    expect(parseSort<'name' | 'createdAt'>(value as 'name')).toEqual(sort);
  });
});

describe('toPageMeta', () => {
  it.each([
    [{ limit: 10, offset: 0 }, 10, 25, true],
    [{ limit: 10, offset: 10 }, 10, 25, true],
    [{ limit: 10, offset: 20 }, 5, 25, false],
    [{ limit: 20, offset: 3 }, 0, 3, false],
    [{ limit: 20, offset: 0 }, 0, 0, false],
  ])(
    'AC-02.2.3 AC-02.2.4 AC-02.2.6 %j with %i of %i → hasNextPage %s',
    (request, returned, total, next) => {
      expect(toPageMeta(request, returned, total)).toEqual({
        total,
        limit: request.limit,
        offset: request.offset,
        hasNextPage: next,
      });
    },
  );
});
