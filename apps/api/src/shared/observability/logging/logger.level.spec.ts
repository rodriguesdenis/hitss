import { INestApplication } from '@nestjs/common';
import { LogCapture } from '../../../../test/support/logging/capture';
import { bootLogApp } from '../../../../test/support/logging/log-app';

describe('log level', () => {
  let app: INestApplication;
  let out: LogCapture;
  let call: Awaited<ReturnType<typeof bootLogApp>>['call'];

  beforeAll(async () => {
    ({ app, out, call } = await bootLogApp('info'));
    out.reset();
  });
  afterAll(() => app.close());

  it('AC-06.3.5 emits one JSON object per line and nothing below info', async () => {
    await call('/api/v1/tasks/1');
    await out.waitFor((l) => l.msg === 'request completed');
    expect(out.lines.length).toBeGreaterThan(0);
    expect(out.lines.every((l) => (l.level as number) >= 30)).toBe(true);
  });
});
