import {
  Body,
  Controller,
  INestApplication,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { IdParamDto } from '../../../../../src/shared/presentation/dto/id-param.dto';
import { RequestValidationException } from '../../../../../src/shared/presentation/filters/api-exception';
import { GlobalExceptionFilter } from '../../../../../src/shared/presentation/filters/global-exception.filter';
import { AppValidationPipe } from '../../../../../src/shared/presentation/pipes/validation.pipe';

class NameDto {
  @IsString()
  name!: string;
}

@Controller('things')
class ThingsController {
  @Put(':id')
  replace(@Param() { id }: IdParamDto, @Body() body: NameDto) {
    return { id, ...body };
  }
}

const CASES = [
  ['v4', '0d8f6a52-6c1e-4b8a-9f3e-5a7c2e1d4b90'],
  ['v7', '019a2f4e-8c3b-7d21-9e5f-3a6b8c0d1e2f'],
  ['upper case', '0D8F6A52-6C1E-4B8A-9F3E-5A7C2E1D4B90'],
  ['nil', '00000000-0000-0000-0000-000000000000'],
  ['max', 'ffffffff-ffff-ffff-ffff-ffffffffffff'],
  ['version 0', '0d8f6a52-6c1e-0b8a-9f3e-5a7c2e1d4b90'],
  ['version 9', '0d8f6a52-6c1e-9b8a-9f3e-5a7c2e1d4b90'],
  ['variant c', '0d8f6a52-6c1e-4b8a-cf3e-5a7c2e1d4b90'],
  ['short', '0d8f6a52-6c1e-4b8a-9f3e-5a7c2e1d4b9'],
  ['no dashes', '0d8f6a526c1e4b8a9f3e5a7c2e1d4b90'],
  ['braces', '{0d8f6a52-6c1e-4b8a-9f3e-5a7c2e1d4b90}'],
  ['empty', ''],
  ['text', 'not-a-uuid'],
  ['injection', "1' OR '1'='1"],
] as const;

async function nestAccepts(value: string): Promise<boolean> {
  try {
    await new ParseUUIDPipe().transform(value, {
      type: 'param',
      metatype: String,
      data: 'id',
    });
    return true;
  } catch {
    return false;
  }
}

async function dtoResult(value: string): Promise<unknown> {
  try {
    return await new AppValidationPipe().transform(
      { id: value },
      { type: 'param', metatype: IdParamDto },
    );
  } catch (error) {
    return error;
  }
}

describe('IdParamDto', () => {
  it.each(CASES)(
    'AC-10.3 accepts or rejects %s exactly as ParseUUIDPipe did',
    async (_label, value) => {
      const result = await dtoResult(value);

      expect(!(result instanceof Error)).toBe(await nestAccepts(value));
    },
  );

  it.each(CASES.filter(([label]) => label !== 'v4'))(
    'AC-10.3 a rejected id (%s) gives the ParseUuidPipe details, without echoing it',
    async (_label, value) => {
      const result = await dtoResult(value);
      if (!(result instanceof RequestValidationException)) return;

      expect(result.getStatus()).toBe(400);
      expect(result.code).toBe('VALIDATION_FAILED');
      expect(result.message).toBe('Request validation failed.');
      expect(result.details).toEqual([
        { field: 'id', message: 'id must be a UUID' },
      ]);
    },
  );

  describe('through the global pipe and filter', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [ThingsController],
      }).compile();
      app = moduleRef.createNestApplication({ logger: false });
      app.useGlobalPipes(new AppValidationPipe());
      app.useGlobalFilters(
        new GlobalExceptionFilter({ logger: { error: () => undefined } }),
      );
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it('AC-10.3 an invalid id with a valid body reports the id', async () => {
      const response = await request(app.getHttpServer())
        .put('/things/nope')
        .send({ name: 'x' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed.',
          details: [{ field: 'id', message: 'id must be a UUID' }],
          traceId: expect.any(String) as string,
        },
      });
    });

    it.each([
      ['a wrong type', { name: 42 }, 'name'],
      ['a missing field', {}, 'name'],
      [
        'a prototype key',
        JSON.parse('{"constructor":1}') as object,
        'constructor',
      ],
    ])(
      'AC-10.3 an invalid id with a body with %s reports the body, as ParseUuidPipe did',
      async (_label, body, field) => {
        const response = await request(app.getHttpServer())
          .put('/things/nope')
          .send(body);

        expect(response.status).toBe(400);
        expect(
          (
            response.body as { error: { details: { field: string }[] } }
          ).error.details.map((detail) => detail.field),
        ).toEqual([field]);
      },
    );

    it('AC-10.3 a valid id reaches the handler as a string', async () => {
      const id = '0d8f6a52-6c1e-4b8a-9f3e-5a7c2e1d4b90';

      await request(app.getHttpServer())
        .put(`/things/${id}`)
        .send({ name: 'x' })
        .expect(200, { id, name: 'x' });
    });
  });
});
