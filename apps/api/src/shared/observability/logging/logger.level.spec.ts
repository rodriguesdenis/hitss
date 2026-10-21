import type { Server } from 'node:http';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { LogCapture } from '../../../../test/support/logging/capture';
import { bootLogApp } from '../../../../test/support/logging/log-app';

describe('log level', () => {
  let app: INestApplication;
  let out: LogCapture;

  beforeAll(async () => {
    ({ app, out } = await bootLogApp('info'));
    out.reset();
  });
  afterAll(() => app.close());

  it('AC-06.3.5 emits one JSON object per line and nothing below info', async () => {
    await request(app.getHttpServer() as Server).get('/api/v1/tasks/1');
    expect(out.lines.length).toBeGreaterThan(0);
    expect(out.lines.every((l) => (l.level as number) >= 30)).toBe(true);
  });
});
