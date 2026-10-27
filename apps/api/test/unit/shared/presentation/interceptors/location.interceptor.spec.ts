import type {
  CallHandler,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Controller, HttpCode, Post, Version } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureRouting } from '../../../../../src/app.setup';
import { Location } from '../../../../../src/shared/presentation/decorators/location.decorator';
import { lastValueFrom, of } from 'rxjs';
import { TasksController } from '../../../../../src/modules/tasks/presentation/tasks.controller';
import { TeamsController } from '../../../../../src/modules/teams/presentation/teams.controller';
import { LocationInterceptor } from '../../../../../src/shared/presentation/interceptors/location.interceptor';

const ID = '0d8f6a52-6c1e-4b8a-9f3e-5a7c2e1d4b90';

@Controller('/things/')
class ThingsController {
  @Post('drafts')
  draft(): void {}

  @Post()
  @Version('2')
  create(): void {}
}

@Controller('gadgets')
class GadgetsController {
  @Post()
  @HttpCode(201)
  @Location()
  create(): { id: string } {
    return { id: ID };
  }
}

const handlerOf = (target: { prototype: object }, name: string) =>
  Object.getOwnPropertyDescriptor(target.prototype, name)?.value as object;

function run(
  target: { prototype: object },
  method: string,
  value: unknown,
  originalUrl = '/API/V1/TASKS/?x=1',
) {
  const setHeader = jest.fn();
  const context = {
    getClass: () => target,
    getHandler: () => handlerOf(target, method),
    switchToHttp: () => ({
      getRequest: () => ({ originalUrl, url: originalUrl }),
      getResponse: () => ({ setHeader }),
    }),
  } as unknown as ExecutionContext;
  const next: CallHandler = { handle: () => of(value) };
  const result = lastValueFrom(
    new LocationInterceptor().intercept(context, next),
  );
  return { result, setHeader };
}

describe('LocationInterceptor', () => {
  it.each([
    [TasksController, '/API/V1/TASKS/?x=1', `/api/v1/tasks/${ID}`],
    [TeamsController, '/API/V1/TEAMS/?x=1', `/api/v1/teams/${ID}`],
    [TasksController, '/api/v1/tasks', `/api/v1/tasks/${ID}`],
  ])(
    'AC-10.7 %p create requested as %s answers Location %s, from the declared route',
    async (controller, url, location) => {
      const { result, setHeader } = run(
        controller,
        'create',
        { id: ID, name: 'Mobile' },
        url,
      );

      await expect(result).resolves.toEqual({ id: ID, name: 'Mobile' });
      expect(setHeader).toHaveBeenCalledWith('Location', location);
    },
  );

  it('AC-10.7 joins the handler path and honours a declared version', async () => {
    const draft = run(ThingsController, 'draft', { id: ID });
    const create = run(ThingsController, 'create', { id: ID });
    await Promise.all([draft.result, create.result]);

    expect(draft.setHeader).toHaveBeenCalledWith(
      'Location',
      `/api/v1/things/drafts/${ID}`,
    );
    expect(create.setHeader).toHaveBeenCalledWith(
      'Location',
      `/api/v2/things/${ID}`,
    );
  });

  it.each([[undefined], [null], [{}], [{ id: 7 }]])(
    'AC-10.7 sets no Location when the response %j has no string id',
    async (value) => {
      const { result, setHeader } = run(TasksController, 'create', value);

      await expect(result).resolves.toEqual(value);
      expect(setHeader).not.toHaveBeenCalled();
    },
  );

  describe('in an app routed by configureRouting', () => {
    let app: INestApplication;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        controllers: [GadgetsController],
      }).compile();
      app = moduleRef.createNestApplication({ logger: false });
      configureRouting(app);
      await app.init();
    });

    afterAll(async () => {
      await app.close();
    });

    it.each(['/api/v1/gadgets', '/API/V1/GADGETS/?x=1'])(
      'AC-10.7 POST %s answers Location /api/v1/gadgets/<id>',
      async (url) => {
        const response = await request(app.getHttpServer()).post(url);

        expect(response.status).toBe(201);
        expect(response.headers.location).toBe(`/api/v1/gadgets/${ID}`);
      },
    );
  });
});
