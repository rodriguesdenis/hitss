import { ArgumentMetadata } from '@nestjs/common';
import { RequestValidationException } from '../filters/api-exception';
import { ParseUuidPipe } from './parse-uuid.pipe';

const param = (data?: string): ArgumentMetadata => ({
  type: 'param',
  metatype: String,
  data,
});

describe('ParseUuidPipe', () => {
  const pipe = new ParseUuidPipe();

  it('passes a UUID through', async () => {
    const id = '0d8f6a52-6c1e-4b8a-9f3e-5a7c2e1d4b90';

    expect(await pipe.transform(id, param('id'))).toBe(id);
  });

  it.each([
    'not-a-uuid',
    '',
    '0d8f6a52-6c1e-4b8a-9f3e-5a7c2e1d4b9',
    "1' OR '1'='1",
  ])(
    'rejects %j as 400 VALIDATION_FAILED naming the parameter, without echoing it',
    async (value) => {
      let error: unknown;
      try {
        await pipe.transform(value, param('id'));
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(RequestValidationException);
      expect((error as RequestValidationException).details).toEqual([
        { field: 'id', message: 'id must be a UUID' },
      ]);
    },
  );

  it('names the route parameter it validates', async () => {
    await expect(pipe.transform('nope', param('teamId'))).rejects.toMatchObject(
      {
        details: [{ field: 'teamId', message: 'teamId must be a UUID' }],
      },
    );
  });
});
