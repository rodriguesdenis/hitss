import { ArgumentMetadata } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsOptional, IsString, Length, ValidateNested } from 'class-validator';
import { RequestValidationException } from './filters/api-exception';
import { AppValidationPipe } from './validation.pipe';

class ProbeChildDto {
  @IsString()
  label!: string;
}

class ProbeDto {
  @IsString()
  @Length(2, 5)
  name!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProbeChildDto)
  child?: ProbeChildDto;
}

const body: ArgumentMetadata = { type: 'body', metatype: ProbeDto };
const pipe = new AppValidationPipe();

async function details(value: unknown, metadata = body) {
  try {
    await pipe.transform(value, metadata);
  } catch (error) {
    expect(error).toBeInstanceOf(RequestValidationException);
    return (error as RequestValidationException).details;
  }
  throw new Error('expected a validation error');
}

describe('AppValidationPipe', () => {
  it('returns a DTO instance for a valid body', async () => {
    const result: unknown = await pipe.transform(
      { name: 'ok', child: { label: 'x' } },
      body,
    );

    expect(result).toBeInstanceOf(ProbeDto);
    expect((result as ProbeDto).child).toBeInstanceOf(ProbeChildDto);
  });

  it('reports each broken rule with its field', async () => {
    expect(await details({ name: 'x' })).toEqual([
      {
        field: 'name',
        message: 'name must be longer than or equal to 2 characters',
      },
    ]);
  });

  it('reports nested fields with a dotted path', async () => {
    expect(await details({ name: 'ok', child: { label: 1 } })).toEqual([
      { field: 'child.label', message: 'label must be a string' },
    ]);
  });

  it.each(['updatedAt', 'deletedAt', 'ownerId', 'owner_id', 'userId', 'id'])(
    'AC-01.6.4 AC-01.6.6 an undeclared field %s is rejected by name',
    async (field) => {
      expect(await details({ name: 'ok', [field]: 'x' })).toEqual([
        { field, message: `property ${field} should not exist` },
      ]);
    },
  );

  it('AC-01.6.4 an owner given as an object is rejected, not merged', async () => {
    expect(await details({ name: 'ok', owner: { id: 'u-2' } })).toEqual([
      { field: 'owner', message: 'property owner should not exist' },
    ]);
  });

  it.each([
    ['__proto__', '{"name":"ok","__proto__":{"isAdmin":true}}', '__proto__'],
    [
      'constructor',
      '{"name":"ok","constructor":{"prototype":{}}}',
      'constructor',
    ],
    ['prototype', '{"name":"ok","prototype":{}}', 'prototype'],
    [
      'nested __proto__',
      '{"name":"ok","child":{"label":"x","__proto__":{}}}',
      'child.__proto__',
    ],
    [
      '__proto__ inside an array',
      '{"name":"ok","items":[{"__proto__":{}}]}',
      'items.0.__proto__',
    ],
  ])(
    'AC-01.6.6 a %s key never reaches the DTO',
    async (_label, json, field) => {
      expect(await details(JSON.parse(json))).toEqual([
        {
          field,
          message: `property ${field.split('.').pop()} should not exist`,
        },
      ]);
    },
  );

  it('prototype keys are rejected in query strings too', async () => {
    expect(
      await details(JSON.parse('{"__proto__":{}}'), {
        type: 'query',
        metatype: ProbeDto,
      }),
    ).toEqual([
      { field: '__proto__', message: 'property __proto__ should not exist' },
    ]);
  });

  it.each([
    ['a string', 'oops'],
    ['an array', [{ name: 'ok' }]],
    ['null', null],
  ])(
    'a body that is %s instead of an object is rejected',
    async (_label, value) => {
      const result = await details(value);

      expect(result).toEqual([
        { field: 'body', message: 'body must be a JSON object' },
      ]);
    },
  );

  it('leaves parameters without a DTO class untouched', async () => {
    expect(
      await pipe.transform('42', {
        type: 'param',
        metatype: String,
        data: 'id',
      }),
    ).toBe('42');
  });
});
